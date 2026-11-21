// Persistência. Ordem de preferência:
//  1) "nuvem do artefato": arquivo de dados em `assets` + índice e anotações em `db`
//     (fica salvo junto com o dashboard e abre em qualquer dispositivo)
//  2) "este navegador": IndexedDB (só neste navegador; pode ser apagado)
//  3) "memória": nada é salvo — exporte um backup
const HAS_DATA_FLAG = "jpa.hasData";

export function hintHasData() {
  try { return localStorage.getItem(HAS_DATA_FLAG) === "1"; } catch { return false; }
}
function setHint(v) {
  try { v ? localStorage.setItem(HAS_DATA_FLAG, "1") : localStorage.removeItem(HAS_DATA_FLAG); } catch { /* sem armazenamento */ }
}

// ---------- IndexedDB ----------
function idb() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open("jungle-performance-analytics", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("kv");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
async function idbGet(key) {
  const db = await idb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction("kv", "readonly");
      const r = tx.objectStore("kv").get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(undefined);
    } catch { resolve(undefined); }
  });
}
async function idbSet(key, value) {
  const db = await idb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction("kv", "readwrite");
      value === undefined ? tx.objectStore("kv").delete(key) : tx.objectStore("kv").put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch { resolve(false); }
  });
}

// Arquivos grandes vão comprimidos (gzip + base64 em texto): bem menos para baixar ao abrir.
async function pack(obj) {
  const json = JSON.stringify(obj);
  if (typeof CompressionStream === "undefined") return { blob: new Blob([json], { type: "application/json" }), encoding: "json" };
  try {
    const gz = await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
    const bytes = new Uint8Array(gz);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return { blob: new Blob([btoa(bin)], { type: "text/plain" }), encoding: "gzip-b64" };
  } catch {
    return { blob: new Blob([json], { type: "application/json" }), encoding: "json" };
  }
}
async function unpack(res, encoding) {
  if (encoding !== "gzip-b64") return res.json();
  const b64 = (await res.text()).trim();
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const text = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  return JSON.parse(text);
}

const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);

export async function initStore() {
  let db = null, assets = null, downloads = null, sample = null;
  const cl = typeof window !== "undefined" ? window.claude : null;
  if (cl && typeof cl.use === "function") {
    [db, assets, downloads, sample] = await Promise.all([
      withTimeout(cl.use("db").catch(() => null), 11000),
      withTimeout(cl.use("assets").catch(() => null), 11000),
      withTimeout(cl.use("downloads").catch(() => null), 11000),
      withTimeout(cl.use("sample").catch(() => null), 11000),
    ]);
  }
  const cloud = !!db;
  const canWriteCloud = !!(db && assets);
  const mode = canWriteCloud ? "cloud" : cloud ? "cloud-readonly" : "local";

  const stateDoc = cloud ? db.doc("jpa/state") : null;
  const prefsDoc = cloud ? db.doc("jpa/prefs") : null;
  const refsDoc = cloud ? db.doc("jpa/refs") : null;

  // Jogadores de referência (aba Rumo ao Challenger): arquivo separado das suas partidas
  async function loadRefs() {
    if (cloud) {
      try {
        const s = await refsDoc.get();
        const st = s.exists ? s.data() : null;
        if (st && st.assetId) {
          const res = await fetch("/_blob/" + st.assetId);
          if (res.ok) return { refs: await unpack(res, st.encoding), where: "cloud" };
        }
      } catch (e) { console.warn("Falha ao ler referências salvas", e); }
    }
    const local = await idbGet("refs");
    return local ? { refs: local.refs, where: "local" } : null;
  }
  async function saveRefs(refs) {
    const savedAt = new Date().toISOString();
    if (canWriteCloud) {
      try {
        const prev = await refsDoc.get();
        const prevId = prev.exists ? prev.data().assetId : null;
        const { blob, encoding } = await pack(refs);
        const up = await assets.upload(blob, { type: blob.type });
        await refsDoc.set({ assetId: up.id, encoding, updatedAt: savedAt, players: refs.players.length, sizeBytes: up.sizeBytes });
        if (prevId && prevId !== up.id) assets.delete(prevId).catch(() => {});
        return { where: "cloud", savedAt };
      } catch (e) { console.warn("Não foi possível salvar as referências no artefato", e); }
    }
    const ok = await idbSet("refs", { refs, savedAt });
    return { where: ok ? "local" : "memory", savedAt };
  }
  async function clearRefs() {
    if (canWriteCloud) {
      try {
        const prev = await refsDoc.get();
        const prevId = prev.exists ? prev.data().assetId : null;
        await refsDoc.delete();
        if (prevId) await assets.delete(prevId).catch(() => {});
      } catch (e) { console.warn(e); }
    }
    await idbSet("refs", undefined);
  }

  // Mono Briar: só no navegador (o arquivo vem do coletor; no site, da pasta dados)
  async function loadBriarRefs() { const local = await idbGet("briarRefs"); return local ? { refs: local.refs, where: "local" } : null; }
  async function saveBriarRefs(refs) { const savedAt = new Date().toISOString(); const ok = await idbSet("briarRefs", { refs, savedAt }); return { where: ok ? "local" : "memory", savedAt }; }
  async function clearBriarRefs() { await idbSet("briarRefs", undefined); }

  async function loadDataset() {
    if (cloud) {
      try {
        const s = await stateDoc.get();
        const st = s.exists ? s.data() : null;
        if (st && st.datasetAssetId) {
          const res = await fetch("/_blob/" + st.datasetAssetId);
          if (res.ok) { setHint(true); return { dataset: await unpack(res, st.encoding), savedAt: st.updatedAt, where: "cloud" }; }
        }
      } catch (e) { console.warn("Falha ao ler dados salvos no artefato", e); }
    }
    const local = await idbGet("dataset");
    if (local) { setHint(true); return { dataset: local.dataset, savedAt: local.savedAt, where: "local" }; }
    setHint(false);
    return null;
  }

  async function saveDataset(dataset) {
    const savedAt = new Date().toISOString();
    if (canWriteCloud) {
      try {
        const prev = await stateDoc.get();
        const prevId = prev.exists ? prev.data().datasetAssetId : null;
        const { blob, encoding } = await pack(dataset);
        const up = await assets.upload(blob, { type: blob.type });
        await stateDoc.set({ datasetAssetId: up.id, encoding, updatedAt: savedAt, matches: dataset.matches.length, sizeBytes: up.sizeBytes });
        if (prevId && prevId !== up.id) assets.delete(prevId).catch(() => {});
        setHint(true);
        return { where: "cloud", savedAt };
      } catch (e) {
        console.warn("Não foi possível salvar no artefato", e);
        const ok = await idbSet("dataset", { dataset, savedAt });
        if (ok) setHint(true);
        return { where: ok ? "local" : "memory", savedAt, error: e && (e.code || e.message) };
      }
    }
    const ok = await idbSet("dataset", { dataset, savedAt });
    if (ok) setHint(true);
    return { where: ok ? "local" : "memory", savedAt };
  }

  async function clearDataset() {
    if (canWriteCloud) {
      try {
        const prev = await stateDoc.get();
        const prevId = prev.exists ? prev.data().datasetAssetId : null;
        await stateDoc.delete();
        if (prevId) await assets.delete(prevId).catch(() => {});
      } catch (e) { console.warn(e); }
    }
    await idbSet("dataset", undefined);
    setHint(false);
  }

  async function loadNotes() {
    const out = {};
    if (cloud) {
      try {
        const snap = await db.collection("notes").limit(1000).get();
        for (const d of snap.docs) out[d.id] = d.data();
        return out;
      } catch (e) { console.warn(e); }
    }
    return (await idbGet("notes")) || {};
  }

  async function saveNote(matchId, note, allNotes) {
    const safeId = String(matchId).replace(/[^A-Za-z0-9_.~:@+-]/g, "_");
    if (canWriteCloud) {
      try {
        if (!note || (!note.tags?.length && !note.text)) await db.doc("notes/" + safeId).delete();
        else await db.doc("notes/" + safeId).set({ ...note, matchId, updatedAt: new Date().toISOString() });
        return "cloud";
      } catch (e) { console.warn(e); }
    }
    const ok = await idbSet("notes", allNotes);
    return ok ? "local" : "memory";
  }

  async function loadPrefs() {
    if (cloud) {
      try { const s = await prefsDoc.get(); if (s.exists) return s.data(); } catch { /* segue */ }
    }
    return (await idbGet("prefs")) || null;
  }
  async function savePrefs(prefs) {
    if (canWriteCloud) {
      try { await prefsDoc.set(prefs); return "cloud"; } catch { /* segue */ }
    }
    return (await idbSet("prefs", prefs)) ? "local" : "memory";
  }

  // Imagem própria (fundo do banner): vai para o armazenamento do artefato; sem ele, volta null.
  async function uploadImage(blob) {
    if (!canWriteCloud) return null;
    try { const up = await assets.upload(blob, { type: blob.type }); return { id: up.id, url: "/_blob/" + up.id }; }
    catch (e) { console.warn("Não foi possível enviar a imagem", e); return null; }
  }
  async function deleteAsset(id) {
    if (canWriteCloud && id) await assets.delete(id).catch(() => {});
  }

  async function download(filename, data) {
    if (!downloads) return { ok: false, reason: "unavailable" };
    try { await downloads.save({ filename, data }); return { ok: true }; }
    catch (e) { return { ok: false, reason: e && e.code }; }
  }

  return { mode, canWriteCloud, cloud, canDownload: !!downloads, sample, loadDataset, saveDataset, clearDataset, loadRefs, saveRefs, clearRefs, loadBriarRefs, saveBriarRefs, clearBriarRefs, loadNotes, saveNote, loadPrefs, savePrefs, uploadImage, deleteAsset, download };
}
