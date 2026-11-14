// Fotografa o topo do Rumo ao Challenger (2x) em vários instantes, para conferir a moldura e a animação.
import puppeteer from "puppeteer-core";
import path from "node:path";
const [dataFile, refsFile, outDir, width = "1440", frames = "1"] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox", "--allow-file-access-from-files"] });
const page = await browser.newPage();
await page.setViewport({ width: Number(width), height: 1100, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("file://" + path.resolve("dist/local.html"), { waitUntil: "load" });
await page.waitForSelector(".nav");
await page.evaluate(() => { location.hash = "importacao"; });
await new Promise((r) => setTimeout(r, 600));
await (await page.$("#imp-file")).uploadFile(dataFile);
await page.waitForFunction(() => document.querySelector(".callout.good"), { timeout: 90000 });
await (await page.$("#imp-file")).uploadFile(refsFile);
await page.waitForFunction(() => [...document.querySelectorAll(".callout.good")].some((c) => c.innerText.includes("referência")), { timeout: 90000 });
await page.evaluate(() => { location.hash = "rumo-challenger"; });
await new Promise((r) => setTimeout(r, 2500));
const wrap = await page.$(".chal-wrap");
const box = await wrap.boundingBox();
for (let i = 0; i < Number(frames); i++) {
  await page.screenshot({ path: `${outDir}/hero_${width}_${i}.png`, clip: { x: box.x - 20, y: box.y - 40, width: box.width + 40, height: box.height + 60 } });
  await new Promise((r) => setTimeout(r, 450));
}
console.log(JSON.stringify({ box, errors }));
await browser.close();
