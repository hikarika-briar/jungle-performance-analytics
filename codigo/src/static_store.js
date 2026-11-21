// Modo público (site estático, ex.: GitHub Pages): os dados vêm de arquivos na pasta dados/,
// ao lado do index.html, e nada é salvo. Ativado quando a página define window.JPA_STATIC.
import * as E from "./engine.js";
import * as CH from "./challenger.js";
import { shrinkIcons, shrinkVisual } from "./icons.js";

export const STATIC = typeof window !== "undefined" && window.JPA_STATIC ? window.JPA_STATIC : null;

function baseUrl() {
  try { return new URL(STATIC.base || "dados/", document.baseURI).href; } catch { return "dados/"; }
}
async function getJSON(name) {
  const res = await fetch(baseUrl() + name, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  return { json: await res.json(), modified: res.headers.get("last-modified") };
}

export async function initStaticStore() {
  const memory = async () => ({ where: "memory", savedAt: new Date().toISOString() });
  return {
    mode: "static", static: true, canWriteCloud: false, cloud: false, canDownload: false, sample: null,
    async loadDataset() {
      const { json, modified } = await getJSON("jungle_data.json");
      const raw = E.validateDataset(json) === "backup" ? json.dataset : json;
      E.validateDataset(raw);
      const { dataset } = E.mergeDatasets(null, raw);
      const ds = await shrinkVisual(await shrinkIcons(E.riftOnly(dataset)));
      return { dataset: ds, savedAt: raw.generatedAt || modified || null, where: "static" };
    },
    async loadRefs() {
      try {
        const { json } = await getJSON("referencias_challenger.json");
        if (!CH.isRefsFile(json)) return null;
        return { refs: await shrinkIcons(json), where: "static" };
      } catch { return null; }
    },
    async loadBriarRefs() {
      try {
        const { json } = await getJSON("referencias_briar.json");
        if (!CH.isRefsFile(json)) return null;
        return { refs: await shrinkIcons(json), where: "static" };
      } catch { return null; }
    },
    async loadPrefs() {
      try {
        const { json } = await getJSON("preferencias.json");
        const p = json && typeof json === "object" ? { ...json } : {};
        if (p.banner && p.banner.src && !/^(https?:|data:|\/)/.test(p.banner.src)) p.banner = { ...p.banner, src: baseUrl() + p.banner.src };
        return p;
      } catch { return {}; }
    },
    async loadNotes() { return {}; },
    saveDataset: memory, clearDataset: async () => {}, saveRefs: memory, clearRefs: async () => {}, saveBriarRefs: memory, clearBriarRefs: async () => {},
    async saveNote() { return "memory"; }, async savePrefs() { return "memory"; },
    uploadImage: null, async deleteAsset() {},
    async download() { return { ok: false, reason: "unavailable" }; },
  };
}
