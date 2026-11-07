import puppeteer from "puppeteer-core";
import fs from "node:fs";
const b64 = fs.readFileSync(process.argv[2], "utf8");
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto("about:blank");
const r = await page.evaluate(async (b64) => {
  const bin = atob(b64.trim()); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const text = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  const obj = JSON.parse(text);
  // ida e volta com o mesmo código do dashboard
  const json = JSON.stringify(obj);
  const gz = await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
  const u = new Uint8Array(gz); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  const back = atob(btoa(s)); const b2 = new Uint8Array(back.length); for (let i = 0; i < back.length; i++) b2[i] = back.charCodeAt(i);
  const t2 = await new Response(new Blob([b2]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  return { matches: (obj.matches || obj.players || []).length, visual: Object.keys(obj.meta?.visual || {}), roundTrip: t2 === json, b64len: btoa(s).length };
}, b64);
console.log(JSON.stringify(r));
await browser.close();
