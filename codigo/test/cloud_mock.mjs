// Simula o armazenamento do artefato (db + assets) para testar a abertura com os dados pré-carregados.
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const [dsB64, refsB64, outDir] = process.argv.slice(2);
const blobs = { DS: fs.readFileSync(dsB64), RF: fs.readFileSync(refsB64) };
const html = fs.readFileSync("dist/local.html", "utf8").replace(/file:\/\/[^"]*node_modules/g, "/nm");
const srv = http.createServer((req, res) => {
  if (req.url.startsWith("/_blob/")) { const k = req.url.slice(7); res.writeHead(200, { "content-type": "text/plain" }); return res.end(blobs[k]); }
  if (req.url.startsWith("/nm/")) { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(fs.readFileSync(path.join("node_modules", req.url.slice(4)))); }
  res.writeHead(200, { "content-type": "text/html" }); res.end(html);
}).listen(8931);
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.evaluateOnNewDocument(() => {
  const docs = {
    "jpa/state": { datasetAssetId: "DS", encoding: "gzip-b64" },
    "jpa/refs": { assetId: "RF", encoding: "gzip-b64" },
    "jpa/prefs": { rankManual: [{ t: 1767614400000, tier: "DIAMOND", rank: "I", lp: 14 }, { t: 1793676600000, tier: "EMERALD", rank: "I", lp: 3 }] },
  };
  const doc = (p) => ({ get: async () => ({ exists: !!docs[p], data: () => docs[p] }), set: async (d) => { docs[p] = d; }, delete: async () => { delete docs[p]; } });
  const db = { doc, collection: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }) };
  const assets = { upload: async () => ({ id: "X", sizeBytes: 1 }), delete: async () => {} };
  window.claude = { use: async (n) => (n === "db" ? db : n === "assets" ? assets : null) };
});
await page.goto("http://127.0.0.1:8931/", { waitUntil: "load" });
await page.waitForSelector(".banner", { timeout: 30000 });
await new Promise((r) => setTimeout(r, 2500));
const info = await page.evaluate(() => ({ pill: document.querySelector(".data-pill")?.innerText, rank: document.querySelector(".rank-name")?.innerText, name: document.querySelector(".hero-name")?.innerText, demo: !!document.querySelector(".demo-banner"), focus: [...document.querySelectorAll(".focus-item .t")].map((x) => x.innerText) }));
await page.screenshot({ path: outDir + "/cloud_home.png" });
console.log(JSON.stringify({ info, errors }));
await browser.close(); srv.close();
