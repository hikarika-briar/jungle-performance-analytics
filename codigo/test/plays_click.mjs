// Clica numa jogada do quadro "Jogadas e respostas" e confere se a linha do tempo foi para aquele momento.
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const [outDir, width = "1440", match = "Master Yi"] = process.argv.slice(2);
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
await page.goto(`http://localhost:${server.address().port}${process.env.PAGE_PATH || "/"}#historico`, { waitUntil: "load" });
await page.waitForFunction(() => document.querySelectorAll("tbody tr").length > 0, { timeout: 60000 });
for (const r of await page.$$("tbody tr")) { if ((await r.evaluate((n) => n.innerText)).includes(match)) { await r.click(); break; } }
await new Promise((r) => setTimeout(r, 1200));
const plays = await page.$$(".play");
await plays[2].click();
await new Promise((r) => setTimeout(r, 1500));
const info = await page.evaluate(() => ({ clicked: document.querySelectorAll(".play")[2].innerText.split("\n")[0], eyebrow: [...document.querySelectorAll("#tl-card .eyebrow")].map((e) => e.innerText).find((t) => t.startsWith("NO MAPA") || t.startsWith("No mapa")), first: document.querySelector("#tl-card .evlist.numbered div")?.innerText, top: document.getElementById("tl-card").getBoundingClientRect().top, st: document.querySelector(".drawer").scrollTop, sh: document.querySelector(".drawer").scrollHeight, items: [...document.querySelectorAll("#tl-card .evlist.numbered div")].map((d) => d.innerText.replace(/\n/g, " ")).slice(0, 6) }));
console.log(JSON.stringify(info)); console.log("ERRORS", JSON.stringify(errors));
await page.screenshot({ path: `${outDir}/plays_click_${width}.png` });
await browser.close(); server.close();
