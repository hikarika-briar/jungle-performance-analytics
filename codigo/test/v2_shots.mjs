import puppeteer from "puppeteer-core";
import path from "node:path";
const [dataFile, refsFile, outDir, ...sections] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox", "--allow-file-access-from-files"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
await page.goto("file://" + path.resolve("dist/local.html"), { waitUntil: "load" });
await page.waitForSelector(".nav", { timeout: 20000 });
await page.evaluate(() => { location.hash = "importacao"; });
await new Promise((r) => setTimeout(r, 600));
await (await page.$("#imp-file")).uploadFile(dataFile);
await page.waitForFunction(() => document.querySelector(".callout.good"), { timeout: 90000 });
if (refsFile !== "-") {
  await (await page.$("#imp-file")).uploadFile(refsFile);
  await page.waitForFunction(() => [...document.querySelectorAll(".callout.good")].some((c) => c.innerText.includes("referência")), { timeout: 90000 });
}
for (const sec of sections) {
  const [name, w] = sec.split("@");
  await page.setViewport({ width: Number(w || 1440), height: 1000 });
  await page.evaluate((n) => { location.hash = n; }, name);
  await new Promise((r) => setTimeout(r, 1500));
  const fullH = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewport({ width: Number(w || 1440), height: Math.min(16000, fullH) });
  await new Promise((r) => setTimeout(r, 1800));
  await page.screenshot({ path: `${outDir}/v2_${name}_${w || 1440}.png`, fullPage: true });
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  console.log(name, w || 1440, JSON.stringify(m));
}
console.log("ERRORS", JSON.stringify(errors));
await browser.close();
