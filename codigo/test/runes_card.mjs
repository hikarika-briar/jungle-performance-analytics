// Abre uma partida no site estático e fotografa o card de Runas.
// Uso: SITE_ROOT=<pasta> node test/runes_card.mjs <pastaFotos> [largura] [textoDaPartida]
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const [outDir, width = "1440", match = "Evelynn", death = "30:02"] = process.argv.slice(2);
const root = path.resolve(process.env.SITE_ROOT || "dist/site");
const types = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".webp": "image/webp" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p.endsWith("/")) p += "index.html";
  const f = path.join(root, p); if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
}).listen(0);
const CDN = { "react@18.3.1/umd/react.production.min.js": "node_modules/react/umd/react.production.min.js", "react-dom@18.3.1/umd/react-dom.production.min.js": "node_modules/react-dom/umd/react-dom.production.min.js", "prop-types@15.8.1/prop-types.min.js": "node_modules/prop-types/prop-types.min.js", "recharts@2.12.7/umd/Recharts.js": "node_modules/recharts/umd/Recharts.js" };
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setRequestInterception(true);
page.on("request", (r) => { const u = r.url(); if (u.startsWith("https://cdn.jsdelivr.net/npm/")) { const k = u.replace("https://cdn.jsdelivr.net/npm/", ""); return CDN[k] ? r.respond({ status: 200, contentType: "application/javascript", body: fs.readFileSync(CDN[k]) }) : r.abort(); } if (u.startsWith("https://fonts.")) return r.abort(); r.continue(); });
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.setViewport({ width: Number(width), height: 1000, deviceScaleFactor: 1 });
await page.goto(`http://localhost:${server.address().port}${process.env.PAGE_PATH || "/"}#historico`, { waitUntil: "load" });
await page.waitForFunction(() => document.querySelectorAll("tbody tr").length > 0, { timeout: 60000 });
const rows = await page.$$("tbody tr");
let opened = false;
for (const r of rows) { const t = await r.evaluate((n) => n.innerText); if (t.includes(match)) { await r.click(); opened = true; break; } }
if (!opened) await rows[0].click();
await new Promise((r) => setTimeout(r, 1200));
const ok = await page.evaluate((death) => {
  const chip = [...document.querySelectorAll(".chips .chip")].find((b) => b.innerText.trim().startsWith(death));
  if (chip) chip.click();
  return !!chip;
}, death);
await new Promise((r) => setTimeout(r, 500));
const card = await page.evaluateHandle((sel) => [...document.querySelectorAll(".card")].find((c) => (c.querySelector("h2,h3,.card-title,header")?.innerText || "").trim().toUpperCase().startsWith(sel)), "RUNAS");
await card.evaluate((n) => n.scrollIntoView({ block: "start" })); await page.mouse.move(2, 2);
await new Promise((r) => setTimeout(r, 400));
await card.screenshot({ path: `${outDir}/runes_${width}.png` });
const info = await page.evaluate(() => ({ pins: [...document.querySelectorAll(".rmap-pin")].map((p) => p.getAttribute("aria-label")), cap: document.querySelector(".rmap-cap")?.innerText, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
const second = [];
if (second[2]) { await second[2].hover(); await new Promise((r) => setTimeout(r, 300)); const m = await page.$(".rmap"); await m.screenshot({ path: `${outDir}/evmap_hover_${width}.png` }); }
console.log("chip", ok, JSON.stringify(info, null, 1)); console.log("ERRORS", JSON.stringify(errors));
await browser.close(); server.close();
