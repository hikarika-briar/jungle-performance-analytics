import fs from "node:fs";
import * as E from "../src/engine.js";
const raw = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const P = E.prepare(raw); const meta = P.meta;
const all = E.applyFilters(P.games, { ...E.DEFAULT_FILTERS, period: "all" }).pool;
const L = all.slice(0, 50);
const pct = (v) => E.pctTxt(v, 0), f1 = (v) => (v == null || Number.isNaN(v) ? "—" : v.toFixed(1)), f2 = (v) => (v == null ? "—" : v.toFixed(2));
const wr = (gs) => `${pct(E.winRate(gs).rate)} (${gs.length})`;
const tg = (g, s) => E.teamDiffAt(g, s)?.goldDiff;
// 1) Dragão
const firstDrag = (g) => (g.elite || []).find((e) => e.type === "DRAGON");
const tl = all.filter((g) => g.elite);
const ourD = tl.filter((g) => firstDrag(g)?.mine === true), theirD = tl.filter((g) => firstDrag(g)?.mine === false);
console.log("1º dragão do time:", wr(ourD), "| 1º dragão do inimigo:", wr(theirD));
console.log("  seu ouro vs jungler aos 15: time pegou", Math.round(E.mean(ourD.map((g) => E.playerDiffAt(g, 900)?.gold))), "| inimigo pegou", Math.round(E.mean(theirD.map((g) => E.playerDiffAt(g, 900)?.gold))));
const punish = theirD.map((g) => { const d = firstDrag(g); const ev = g.myEvents; return ev.kills.filter((k) => k.t > d.t && k.t <= d.t + 120).length + ev.assists.filter((k) => k.t > d.t && k.t <= d.t + 120).length; });
console.log("  quando o inimigo pega o 1º dragão: abates+assist. seus nos 2 min seguintes", f2(E.mean(punish)), "| partidas com pelo menos 1:", pct(punish.filter((x) => x > 0).length / punish.length));
const early = (g) => (g.elite || []).filter((e) => e.type === "DRAGON" && e.t < 900);
for (const [k, f] of [["0 dragões inimigos antes dos 15'", (g) => early(g).filter((e) => !e.mine).length === 0], ["1", (g) => early(g).filter((e) => !e.mine).length === 1], ["2+", (g) => early(g).filter((e) => !e.mine).length >= 2]]) console.log("  ", k, wr(tl.filter(f)));
console.log("  últimas 50: 1º dragão do time", wr(L.filter((g) => firstDrag(g)?.mine === true)), "| do inimigo", wr(L.filter((g) => firstDrag(g)?.mine === false)));
// 2) Conversão de vantagem
for (const [k, f] of [["time +2.000 aos 15'", (g) => tg(g, 900) >= 2000], ["time +3.000 aos 20'", (g) => tg(g, 1200) >= 3000], ["você +500 vs jungler aos 10'", (g) => g.early?.diff10?.gold >= 500], ["time −2.000 aos 15'", (g) => tg(g, 900) <= -2000], ["time entre −2.000 e +2.000 aos 15'", (g) => Math.abs(tg(g, 900) ?? 99999) < 2000]]) {
  console.log("vantagem:", k.padEnd(36), "total", wr(tl.filter(f)), "| últimas 50", wr(L.filter(f)));
}
// 3) Marcadores de tilt
const csAt = (g, m) => { const r = g.raw.timeline.me.find((x) => Math.round(x[0] / 60) === m); return r ? r[5] + r[6] : null; };
const avg1525 = E.mean(all.filter((g) => g.durMin >= 25.5).map((g) => (csAt(g, 25) - csAt(g, 15)) / 10));
function markers(g) {
  const d = g.myEvents.deaths.map((x) => x.t);
  let seq = 0; for (let i = 1; i < d.length; i++) if (d[i] - d[i - 1] <= 150) seq++;
  const behindT = (g.raw.timeline.team || []).find((r) => (g.teamId === 100 ? r[1] - r[2] : r[2] - r[1]) <= -3000)?.[0] ?? null;
  const deathsAfterBehind = behindT == null ? 0 : d.filter((t) => t >= behindT).length;
  const lostGameDeaths = d.filter((t) => (tg(g, t) ?? 0) <= -5000).length;
  const farm = g.durMin >= 25.5 ? (csAt(g, 25) - csAt(g, 15)) / 10 : null;
  const farmRatio = farm != null ? farm / avg1525 : null;
  const flags = [];
  if (seq >= 2) flags.push(`${seq} mortes logo depois de voltar`);
  if (deathsAfterBehind >= 4) flags.push(`${deathsAfterBehind} mortes depois de o time ficar 3k atrás`);
  if (farmRatio != null && farmRatio < 0.75) flags.push(`farm 15–25' em ${pct(farmRatio)} do normal`);
  return { seq, behindT, deathsAfterBehind, lostGameDeaths, farmRatio, flags };
}
console.log(`\nfarm/min normal entre 15 e 25 min: ${f2(avg1525)}`);
const lossType = (g) => { const t15 = tg(g, 900), t20 = tg(g, 1200); if (t15 == null) return "?"; if (t15 <= -2000) return "começou mal"; if (t15 >= 1500 || (t20 ?? 0) >= 1500) return "vantagem perdida"; return "equilibrada"; };
const losses = L.filter((g) => !g.win), winsL = L.filter((g) => g.win);
const lm = losses.map((g) => ({ g, m: markers(g), type: lossType(g) })), wm = winsL.map((g) => ({ g, m: markers(g) }));
console.log("derrotas por tipo (últimas 50):", Object.entries(E.groupBy(lm, (x) => x.type) ? Object.fromEntries([...E.groupBy(lm, (x) => x.type)].map(([k, v]) => [k, v.length])) : {}).map(([k, v]) => `${k} ${v}`).join(", "));
console.log("com marcador de tilt: derrotas", lm.filter((x) => x.m.flags.length).length, "de", lm.length, "| vitórias", wm.filter((x) => x.m.flags.length).length, "de", wm.length);
console.log("mortes logo depois de voltar por partida: derrotas", f2(E.mean(lm.map((x) => x.m.seq))), "vitórias", f2(E.mean(wm.map((x) => x.m.seq))));
console.log("mortes com o time 5k+ atrás por partida (derrotas):", f2(E.mean(lm.map((x) => x.m.lostGameDeaths))));
console.log("\nDerrotas (mais recentes primeiro):");
for (const x of lm) {
  const g = x.g;
  console.log(` ${new Date(g.start).toLocaleDateString("pt-BR")} vs ${E.champDisplay(meta, g.oppChamp, g.oppChampId).padEnd(12)} ${String(g.k).padStart(2)}/${String(g.d).padStart(2)}/${String(g.a).padStart(2)} ${f1(g.durMin)}min | ${x.type.padEnd(16)} | time 15' ${String(Math.round(tg(g, 900))).padStart(6)} 20' ${String(Math.round(tg(g, 1200) ?? NaN)).padStart(6)} | você vs jg 10' ${String(Math.round(g.early?.diff10?.gold)).padStart(5)} | pick-offs ${E.pickoffsBeforeObjectives(g)} | ${x.m.flags.join("; ") || "sem marcador"}`);
}
