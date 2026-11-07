// Troca o período na aba Metas e confere se os cartões mudam.
import puppeteer from "puppeteer-core";
import path from "node:path";
const [dataFile, outDir] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox", "--allow-file-access-from-files"] });
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 1000 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("file://" + path.resolve("dist/local.html"), { waitUntil: "load" });
await page.waitForSelector(".nav");
await page.evaluate(() => { location.hash = "importacao"; });
await new Promise((r) => setTimeout(r, 600));
await (await page.$("#imp-file")).uploadFile(dataFile);
await page.waitForFunction(() => document.querySelector(".callout.good"), { timeout: 90000 });
await page.evaluate(() => { location.hash = "metas"; });
await new Promise((r) => setTimeout(r, 1200));
for (const p of ["last20", "last100", "d30", "all"]) {
  await page.select("#f-period", p);
  await new Promise((r) => setTimeout(r, 1500));
  const card = await page.evaluate(() => { const c = document.querySelector(".goal"); return { sub: c.querySelector(".stat-sub").innerText, vals: [...c.querySelectorAll(".row3 div")].map((d) => d.innerText.replace(/\n/g, " ")), pts: c.querySelectorAll(".recharts-line-dot, .recharts-dot").length, foot: [...c.querySelectorAll(".dim")].pop().innerText }; });
  console.log(p, JSON.stringify(card));
  if (p === "d30") { await page.screenshot({ path: `${outDir}/metas_d30.png`, fullPage: false }); }
}
console.log("ERRORS", JSON.stringify(errors));
await browser.close();
