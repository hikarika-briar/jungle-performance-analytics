// Monta o artefato: um único HTML com CSS e o app inline; React/Recharts via jsDelivr (UMD fixado).
import { build } from "esbuild";
import fs from "node:fs";

const local = process.argv.includes("--local");
const res = await build({
  entryPoints: ["src/main.jsx"], bundle: true, format: "iife", write: false, minify: true, target: "es2020",
  jsxFactory: "React.createElement", jsxFragment: "React.Fragment", loader: { ".jsx": "jsx" }, legalComments: "none",
});
const app = res.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = fs.readFileSync("src/styles.css", "utf8");
const libs = local
  ? ["node_modules/react/umd/react.production.min.js", "node_modules/react-dom/umd/react-dom.production.min.js", "node_modules/prop-types/prop-types.min.js", "node_modules/recharts/umd/Recharts.js"].map((p) => "file://" + process.cwd() + "/" + p)
  : ["https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js", "https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js",
     "https://cdn.jsdelivr.net/npm/prop-types@15.8.1/prop-types.min.js", "https://cdn.jsdelivr.net/npm/recharts@2.12.7/umd/Recharts.js"];
const html = `<title>Jungle Performance Analytics v2</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Semi+Condensed:wght@500;600;700&family=Cinzel:wght@600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
${css}
</style>
<div id="root"></div>
<noscript>Este dashboard precisa de JavaScript.</noscript>
${libs.map((s) => `<script src="${s}"></script>`).join("\n")}
<script>
${app}
</script>
`;
// --site[=pasta]: versão pública só de leitura (página completa que lê os dados de dados/)
const siteArg = process.argv.find((a) => a.startsWith("--site"));
if (siteArg) {
  const dir = siteArg.includes("=") ? siteArg.split("=")[1] : "dist/site";
  const cfg = JSON.parse(fs.readFileSync("site.config.json", "utf8"));
  const url = cfg.url.replace(/\/?$/, "/");
  const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const head = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(cfg.title)}</title>
<meta name="description" content="${esc(cfg.description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(cfg.title)}">
<meta property="og:description" content="${esc(cfg.description)}">
<meta property="og:image" content="${url}preview.jpg">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#010A13">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#010A13"/><path d="M16 4l10 12-10 12L6 16z" fill="none" stroke="#C8AA6E" stroke-width="2.4"/><path d="M16 10l5 6-5 6-5-6z" fill="#0AC8B9"/></svg>')}">
<style>:root{color-scheme:dark;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#010A13}img{max-width:100%}[hidden]{display:none!important}</style>
<script>window.JPA_STATIC = { base: "dados/" };</script>
</head>
<body>
`;
  fs.mkdirSync(dir, { recursive: true });
  const page = head + html.replace(/^<title>.*<\/title>\n/, "").replace('<meta name="claude:viewport-fit-sides" content="cover">\n', "") + "</body>\n</html>\n";
  fs.writeFileSync(dir + "/index.html", page);
  console.log(dir + "/index.html", (fs.statSync(dir + "/index.html").size / 1024).toFixed(0) + " KB", res.warnings.length ? res.warnings : "");
} else {
  const out = local ? "dist/local.html" : "dist/jungle-performance-analytics-v2.html";
  fs.mkdirSync("dist", { recursive: true });
  fs.writeFileSync(out, local ? `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${html}` : html);
  console.log(out, (fs.statSync(out).size / 1024).toFixed(0) + " KB", res.warnings.length ? res.warnings : "");
}
