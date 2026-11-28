// Smoke test no Chrome: abre o dashboard, passa por todas as seções, importa o
// arquivo do coletor, abre uma partida e coleta erros de console.
import puppeteer from "puppeteer-core";
import path from "node:path";

const out = process.argv[2];
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox", "--allow-file-access-from-files"] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error" && !/fonts\.g/.test(m.text())) errors.push("console: " + m.text()); });
page.on("requestfailed", (r) => { if (!/fonts\.g/.test(r.url())) errors.push("requestfailed: " + r.url()); });
const file = "file://" + path.resolve("dist/local.html");
await page.goto(file, { waitUntil: "load" });
await page.waitForSelector(".kpi", { timeout: 15000 });
const sections = ["visao-geral", "builds", "runas", "early-game", "farm", "objetivos", "mortes", "matchups", "evolucao", "historico", "coach", "importacao"];
const report = {};
for (const s of sections) {
  await page.evaluate((id) => { location.hash = id; }, s);
  await new Promise((r) => setTimeout(r, 450));
  report[s] = await page.evaluate(() => ({ h1: document.querySelector(".section-title h1")?.textContent, cards: document.querySelectorAll(".card").length, empty: document.querySelectorAll(".empty").length,
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1 }));
  if (s === "visao-geral") await page.screenshot({ path: `${out}/01-visao-geral.png` });
  if (s === "builds") await page.screenshot({ path: `${out}/02-comparador.png`, fullPage: true });
}
// Sub-abas de builds
await page.evaluate(() => { location.hash = "builds"; });
await new Promise((r) => setTimeout(r, 300));
for (const label of ["Win rate por item", "Combinações", "Ordem de compra", "Por patch"]) {
  await page.evaluate((l) => [...document.querySelectorAll(".subtabs button")].find((b) => b.textContent === l)?.click(), label);
  await new Promise((r) => setTimeout(r, 300));
}
// Filtros mudam os números
const before = await page.evaluate(() => document.querySelector(".section-title p")?.textContent);
await page.select("#f-champ", "Viego");
await new Promise((r) => setTimeout(r, 300));
const after = await page.evaluate(() => document.querySelector(".section-title p")?.textContent);
await page.select("#f-champ", "Briar");
// Importa o arquivo do coletor
await page.evaluate(() => { location.hash = "importacao"; });
await new Promise((r) => setTimeout(r, 400));
const input = await page.$("#imp-file");
await input.uploadFile(path.resolve("test/fixture_export.json"));
await new Promise((r) => setTimeout(r, 1200));
const importMsg = await page.evaluate(() => document.querySelector(".callout")?.textContent);
const bannerGone = await page.evaluate(() => !document.querySelector(".demo-banner"));
// Abre uma partida pelo histórico (filtro amplo)
await page.select("#f-period", "all");
await page.select("#f-champ", "ALL");
await page.select("#f-queue", "all");
await page.evaluate(() => { location.hash = "historico"; });
await new Promise((r) => setTimeout(r, 400));
const rows = await page.evaluate(() => document.querySelectorAll("tbody tr.clickable").length);
await page.evaluate(() => document.querySelector("tbody tr.clickable")?.click());
await new Promise((r) => setTimeout(r, 600));
const drawer = await page.evaluate(() => !!document.querySelector(".drawer"));
await page.screenshot({ path: `${out}/03-partida.png` });
// Celular
await page.keyboard.press("Escape");
await page.setViewport({ width: 400, height: 860 });
await page.evaluate(() => { location.hash = "visao-geral"; });
await new Promise((r) => setTimeout(r, 500));
const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
console.log(JSON.stringify({ report, filterChanged: before !== after, before, after, importMsg, bannerGone, rows, drawer, mobileOverflow, errors: errors.slice(0, 20) }, null, 1));
await browser.close();
