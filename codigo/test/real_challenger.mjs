import puppeteer from "puppeteer-core";
import path from "node:path";
const [dataFile, refsFile, outDir] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox", "--allow-file-access-from-files"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
await page.goto("file://" + path.resolve("dist/local.html"), { waitUntil: "load" });
await page.waitForSelector(".kpi");
// demo + sem referências
await page.evaluate(() => { location.hash = "rumo-challenger"; });
await new Promise((r) => setTimeout(r, 800));
const demoEmpty = await page.evaluate(() => [...document.querySelectorAll(".card h2")].map((h) => h.innerText));
// importa os dados reais
await page.evaluate(() => { location.hash = "importacao"; });
await new Promise((r) => setTimeout(r, 300));
await (await page.$("#imp-file")).uploadFile(dataFile);
await page.waitForFunction(() => document.querySelector(".callout.good"), { timeout: 60000 });
await page.evaluate(() => { location.hash = "rumo-challenger"; });
await new Promise((r) => setTimeout(r, 1000));
await page.screenshot({ path: outDir + "/ch_empty.png", fullPage: true });
const empty = await page.evaluate(() => ({ titles: [...document.querySelectorAll(".card h2")].map((h) => h.innerText), rows: document.querySelectorAll(".tablewrap tbody tr").length }));
// arquivo errado na aba
await (await page.$("#ch-file")).uploadFile(dataFile);
await page.waitForFunction(() => document.querySelector(".callout.warn"), { timeout: 30000 });
const wrong = await page.evaluate(() => document.querySelector(".callout.warn").innerText);
// referências pela importação principal (deve ir para a aba, sem misturar)
await page.evaluate(() => { location.hash = "importacao"; });
await new Promise((r) => setTimeout(r, 400));
await (await page.$("#imp-file")).uploadFile(refsFile);
await page.waitForFunction(() => [...document.querySelectorAll(".callout.good")].some((c) => c.innerText.includes("referência")), { timeout: 60000 });
const mainRoute = await page.evaluate(() => ({ msg: [...document.querySelectorAll(".callout.good")].map((c) => c.innerText).find((t) => t.includes("referência")), pill: document.querySelector(".data-pill").innerText }));
console.log("MAINROUTE", JSON.stringify(mainRoute));
await page.evaluate(() => { location.hash = "rumo-challenger"; });
await new Promise((r) => setTimeout(r, 600));
await (await page.$("#ch-file")).uploadFile(refsFile);
await page.waitForFunction(() => document.querySelector(".toast")?.innerText.includes("0 partidas novas"), { timeout: 60000 });
await page.waitForFunction(() => document.querySelector(".ch-row"), { timeout: 60000 });
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: outDir + "/ch_full.png", fullPage: true });
const full = await page.evaluate(() => ({
  titles: [...document.querySelectorAll(".card h2")].map((h) => h.innerText),
  kpis: [...document.querySelectorAll(".kpi")].map((k) => k.innerText.replace(/\s+/g, " ")),
  focus: [...document.querySelectorAll(".diag h3")].map((h) => h.innerText),
  stripRows: document.querySelectorAll(".ch-row").length,
  sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
}));
await page.select("#ch-who", (await page.evaluate(() => document.querySelector("#ch-who").options[1].value)));
await new Promise((r) => setTimeout(r, 600));
const single = await page.evaluate(() => [...document.querySelectorAll(".diag h3")].map((h) => h.innerText));
await page.select("#ch-who", "all");
await page.select("#ch-champ", "fighter");
await new Promise((r) => setTimeout(r, 600));
const fighter = await page.evaluate(() => document.querySelector(".callout").innerText.slice(0, 120));
await page.select("#ch-champ", "all");
await new Promise((r) => setTimeout(r, 400));
// recarrega: referências persistem?
await page.reload({ waitUntil: "load" });
await new Promise((r) => setTimeout(r, 2500));
const persisted = await page.evaluate(() => document.querySelectorAll(".ch-row").length);
// mobile
await page.setViewport({ width: 400, height: 900 });
await new Promise((r) => setTimeout(r, 700));
const mobile = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
await page.screenshot({ path: outDir + "/ch_mobile.png", fullPage: false });
const stripEl = await page.$(".ch-rows");
await stripEl.screenshot({ path: outDir + "/ch_mobile_strip.png" });
console.log(JSON.stringify({ demoEmpty, empty, wrong, full, single, fighter, persisted, mobile, errors }, null, 1));
await browser.close();
