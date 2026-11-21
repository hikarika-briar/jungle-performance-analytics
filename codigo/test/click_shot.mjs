// Abre uma aba, clica num seletor e fotografa. Uso: SITE_ROOT=... PAGE_PATH=/previa/ node test/click_shot.mjs <saida.png> <largura> <aba> <seletor-para-clicar> [seletor-para-fotografar] [js-antes]
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const [out, width = "1440", section = "mono-briar", clickSel = "", shotSel = "", pre = ""] = process.argv.slice(2);
const root = path.resolve(process.env.SITE_ROOT || "dist/site");
const types = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".webp": "image/webp" };
const server = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p.endsWith("/")) p += "index.html"; const f = path.join(root, p); if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); }).listen(0);
const CDN = { "react@18.3.1/umd/react.production.min.js": "node_modules/react/umd/react.production.min.js", "react-dom@18.3.1/umd/react-dom.production.min.js": "node_modules/react-dom/umd/react-dom.production.min.js", "prop-types@15.8.1/prop-types.min.js": "node_modules/prop-types/prop-types.min.js", "recharts@2.12.7/umd/Recharts.js": "node_modules/recharts/umd/Recharts.js" };
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setRequestInterception(true);
page.on("request", (r) => { const u = r.url(); if (u.startsWith("https://cdn.jsdelivr.net/npm/")) { const k = u.replace("https://cdn.jsdelivr.net/npm/", ""); return CDN[k] ? r.respond({ status: 200, contentType: "application/javascript", body: fs.readFileSync(CDN[k]) }) : r.abort(); } if (u.startsWith("https://fonts.")) return r.abort(); r.continue(); });
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.setViewport({ width: Number(width), height: 1000 });
await page.goto(`http://localhost:${server.address().port}${process.env.PAGE_PATH || "/"}#${section}`, { waitUntil: "load" });
await page.waitForFunction(() => document.querySelector(".data-pill") && !/Carregando/.test(document.querySelector(".data-pill").innerText), { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));
if (pre) { await page.evaluate(pre); await new Promise((r) => setTimeout(r, 1200)); }
if (clickSel) { await page.evaluate((s) => document.querySelector(s)?.click(), clickSel); await new Promise((r) => setTimeout(r, 2500)); }
if (shotSel) {
  const el = await page.$(shotSel);
  if (el) { await el.evaluate((e) => e.scrollIntoView({ block: "start" })); await new Promise((r) => setTimeout(r, 900)); await el.screenshot({ path: out }); }
  else console.log("NO ELEMENT", shotSel);
} else await page.screenshot({ path: out });
console.log("ERRORS", JSON.stringify(errors));
await browser.close(); server.close();
