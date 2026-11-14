// Testa a versão pública (dist/site): serve a pasta por HTTP, troca o CDN pelas cópias locais,
// abre todas as abas, procura erros e tira fotos. Uso: node test/site_test.mjs <pastaFotos> [largura]
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const [outDir, width = "1440", ...only] = process.argv.slice(2);
const root = path.resolve(process.env.SITE_ROOT || "dist/site");
const types = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end("404"); }
  res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream", "last-modified": fs.statSync(f).mtime.toUTCString() });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;
const CDN = {
  "react@18.3.1/umd/react.production.min.js": "node_modules/react/umd/react.production.min.js",
  "react-dom@18.3.1/umd/react-dom.production.min.js": "node_modules/react-dom/umd/react-dom.production.min.js",
  "prop-types@15.8.1/prop-types.min.js": "node_modules/prop-types/prop-types.min.js",
  "recharts@2.12.7/umd/Recharts.js": "node_modules/recharts/umd/Recharts.js",
};
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setRequestInterception(true);
page.on("request", (r) => {
  const u = r.url();
  if (u.startsWith("https://cdn.jsdelivr.net/npm/")) {
    const key = u.replace("https://cdn.jsdelivr.net/npm/", "");
    return CDN[key] ? r.respond({ status: 200, contentType: "application/javascript", body: fs.readFileSync(CDN[key]) }) : r.abort();
  }
  if (u.startsWith("https://fonts.")) return r.abort();
  return r.continue();
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED/.test(m.text())) errors.push("console: " + m.text()); });
await page.setViewport({ width: Number(width), height: 1000 });
const t0 = Date.now();
await page.goto(`http://localhost:${port}${process.env.PAGE_PATH || "/"}`, { waitUntil: "load" });
await page.waitForFunction(() => document.querySelector(".data-pill") && !/Carregando/.test(document.querySelector(".data-pill").innerText), { timeout: 60000 });
const info = await page.evaluate(() => ({ pill: document.querySelector(".data-pill").innerText, demo: !!document.querySelector(".demo-banner"), nav: [...document.querySelectorAll(".nav button")].map((b) => b.innerText.trim()), editBtn: !!document.querySelector(".banner-edit"), foot: !!document.querySelector(".site-foot") }));
console.log("loaded in", Date.now() - t0, "ms", JSON.stringify(info));
const sections = only.length ? only : ["visao-geral", "coach", "rumo-challenger", "metas", "builds", "runas", "early-game", "mortes", "objetivos", "farm", "matchups", "estatisticas", "evolucao", "historico"];
for (const s of sections) {
  await page.evaluate((n) => { location.hash = n; }, s);
  await new Promise((r) => setTimeout(r, 1300));
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, h: document.documentElement.scrollHeight }));
  await page.screenshot({ path: `${outDir}/site_${s}_${width}.png`, fullPage: false });
  console.log(s, JSON.stringify(m));
}
// abre uma partida para conferir o painel lateral sem anotações
await page.evaluate(() => { location.hash = "historico"; });
await new Promise((r) => setTimeout(r, 800));
const row = await page.$("tbody tr");
if (row) { await row.click(); await new Promise((r) => setTimeout(r, 1000)); console.log("drawer notes:", await page.evaluate(() => !!document.querySelector("#note-text"))); }
console.log("ERRORS", JSON.stringify(errors));
await browser.close();
server.close();
