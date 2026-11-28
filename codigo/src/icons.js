// Converte os ícones embutidos (PNG do Data Dragon) para WebP no momento da importação,
// sem aumentar ícones pequenos e reduzindo só os maiores que `size`. Mantém o original quando não ajuda.
function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function shrinkIcons(ds, size = 128) {
  if (!ds || !ds.meta || !ds.meta.icons || typeof document === "undefined") return ds;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return ds;
  ctx.imageSmoothingQuality = "high";
  const out = {};
  for (const [kind, map] of Object.entries(ds.meta.icons)) {
    out[kind] = {};
    for (const [id, uri] of Object.entries(map || {})) {
      if (typeof uri !== "string" || uri.length < 6000 || uri.startsWith("data:image/webp")) { out[kind][id] = uri; continue; }
      try {
        const img = await loadImg(uri);
        const nat = Math.max(img.naturalWidth || size, img.naturalHeight || size);
        const s = Math.min(size, nat);
        const w = Math.round((img.naturalWidth || s) * (s / nat)), h = Math.round((img.naturalHeight || s) * (s / nat));
        canvas.width = w; canvas.height = h;
        ctx.imageSmoothingQuality = "high";
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const small = canvas.toDataURL("image/webp", 0.94);
        out[kind][id] = small.startsWith("data:image/webp") && small.length < uri.length ? small : uri;
      } catch {
        out[kind][id] = uri;
      }
    }
  }
  return { ...ds, meta: { ...ds.meta, icons: out } };
}

// Recorta a borda transparente de uma imagem (os emblemas de elo vêm numa tela de 2560×1440 com o desenho
// pequeno no meio) e limita a largura. Devolve { src, ar } com a proporção largura/altura do recorte.
export async function trimImage(uri, maxW = 480) {
  const img = await loadImg(uri);
  const W = img.naturalWidth, H = img.naturalHeight;
  if (!W || !H) return { src: uri, ar: 1 };
  // Procura o contorno numa cópia reduzida (rápido) e recorta no original.
  const scan = Math.min(1, 640 / W);
  const sw = Math.max(1, Math.round(W * scan)), sh = Math.max(1, Math.round(H * scan));
  const c1 = document.createElement("canvas"); c1.width = sw; c1.height = sh;
  const x1 = c1.getContext("2d", { willReadFrequently: true });
  x1.drawImage(img, 0, 0, sw, sh);
  const px = x1.getImageData(0, 0, sw, sh).data;
  let minX = sw, minY = sh, maxX = -1, maxY = -1;
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    if (px[(y * sw + x) * 4 + 3] > 8) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (maxX < 0) return { src: uri, ar: W / H };
  const pad = 2;
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad); maxX = Math.min(sw - 1, maxX + pad); maxY = Math.min(sh - 1, maxY + pad);
  const cx = minX / scan, cy = minY / scan, cw = (maxX - minX + 1) / scan, ch = (maxY - minY + 1) / scan;
  const ar = cw / ch;
  if (cw >= W * 0.96 && ch >= H * 0.96 && W <= maxW) return { src: uri, ar };
  const ow = Math.min(maxW, Math.round(cw)), oh = Math.round(ow / ar);
  const c2 = document.createElement("canvas"); c2.width = ow; c2.height = oh;
  const x2 = c2.getContext("2d");
  x2.imageSmoothingQuality = "high";
  x2.drawImage(img, cx, cy, cw, ch, 0, 0, ow, oh);
  let out = c2.toDataURL("image/webp", 0.94);
  if (!out.startsWith("data:image/webp")) out = c2.toDataURL("image/png");
  return { src: out, ar };
}

// Reduz a arte do banner (splash) para no máximo 1280 px de largura em WebP e recorta os emblemas de elo.
export async function shrinkVisual(ds, maxW = 1280) {
  const v = ds?.meta?.visual;
  if (!v || typeof document === "undefined") return ds;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return ds;
  const splash = {};
  for (const [k, uri] of Object.entries(v.splash || {})) {
    if (typeof uri !== "string" || uri.length < 250000) { splash[k] = uri; continue; }
    try {
      const img = await loadImg(uri);
      const w = Math.min(maxW, img.naturalWidth || maxW), h = Math.round((img.naturalHeight || 720) * (w / (img.naturalWidth || maxW)));
      canvas.width = w; canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      const small = canvas.toDataURL("image/webp", 0.88);
      splash[k] = small.startsWith("data:image/webp") && small.length < uri.length ? small : uri;
    } catch { splash[k] = uri; }
  }
  const emblems = {};
  for (const [k, uri] of Object.entries(v.emblems || {})) {
    if (typeof uri !== "string") { emblems[k] = uri; continue; }
    try { const t = await trimImage(uri); emblems[k] = t.src.length < uri.length ? t.src : uri; } catch { emblems[k] = uri; }
  }
  return { ...ds, meta: { ...ds.meta, visual: { ...v, splash, emblems } } };
}

// Prepara uma imagem enviada pelo usuário para o fundo do banner: até 1920 px de largura, em WebP.
export async function prepareBannerImage(file, maxW = 1920) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImg(url);
    const w = Math.min(maxW, img.naturalWidth), h = Math.round(img.naturalHeight * (w / img.naturalWidth));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((res) => c.toBlob(res, "image/webp", 0.86));
    const dataUrl = c.toDataURL("image/webp", 0.8);
    return { blob: blob || file, dataUrl, w, h };
  } finally { URL.revokeObjectURL(url); }
}
