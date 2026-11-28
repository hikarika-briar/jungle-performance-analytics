import puppeteer from "puppeteer-core";
import path from "node:path";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox", "--allow-file-access-from-files"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });
await page.goto("file://" + path.resolve("dist/local.html") + "#estatisticas", { waitUntil: "load" });
await new Promise((r) => setTimeout(r, 3000));
await page.addStyleTag({ content: ".kpis{align-items:start !important}" });
const r = await page.evaluate(() => {
  const ks = [...document.querySelectorAll(".kpis > .kpi")].map((k) => [k.querySelector(".label")?.textContent, Math.round(k.getBoundingClientRect().height), [...k.children].map((c) => Math.round(c.getBoundingClientRect().height)).join("/")]);
  const c = document.querySelector(".content"); const kp = document.querySelector(".kpis");
  const hero = document.querySelector(".kpi.hero"); const kids = [...hero.children].map((c) => [c.className, Math.round(c.getBoundingClientRect().height)]);
  const L = hero.querySelector(".label"); const before = L.getBoundingClientRect().height; const tipEl = L.querySelector(".tip"); const tipCs = getComputedStyle(tipEl); const tipInfo = ["position","height","display"].map((k)=>k+"="+tipCs[k]).join(" "); const bubCs = getComputedStyle(tipEl.querySelector(".bubble")); const bubInfo = ["position","height","display","bottom"].map((k)=>k+"="+bubCs[k]).join(" "); tipEl.remove(); const after = L.getBoundingClientRect().height; const cs = getComputedStyle(L); const info = ["display","height","lineHeight","fontSize","paddingTop","paddingBottom","flexDirection","flexWrap","whiteSpace","writingMode","width"].map((k) => k + "=" + cs[k]).join(" ");
  const pb = getComputedStyle(L, "::before"), pa = getComputedStyle(L, "::after"); const pseudo = [pb.content, pb.height, pb.display, pa.content, pa.height]; const rects = [...L.getClientRects()].length; const range = document.createRange(); range.selectNodeContents(L); const rr = range.getBoundingClientRect(); const hcs = getComputedStyle(hero); const heroInfo = ["gridTemplateRows","alignContent","display","height"].map((k)=>k+"="+hcs[k]).join(" ");
  return { heroInfo, pseudo, rr: [Math.round(rr.top), Math.round(rr.height)], Ltop: Math.round(L.getBoundingClientRect().top), before, after, tipInfo, bubInfo, info, kids, ks, kpis: Math.round(kp.getBoundingClientRect().height), rows: getComputedStyle(kp).gridTemplateRows, content: Math.round(c.getBoundingClientRect().height), contentRows: getComputedStyle(c).gridTemplateRows.slice(0, 200) };
});
console.log(JSON.stringify(r));
await browser.close();
