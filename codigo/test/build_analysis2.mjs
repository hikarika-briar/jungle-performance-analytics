import fs from "node:fs";
import * as E from "../src/engine.js";
const raw = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const P = E.prepare(raw); const meta = P.meta;
const all = E.applyFilters(P.games, { ...E.DEFAULT_FILTERS, period: "all" }).current;
const pct = (v) => E.pctTxt(v, 0), f2 = (v) => (v == null ? "—" : v.toFixed(2));
const COL = 6676, HYD = 3748, LDR = 3036, ECL = 6692, DDA = 6333;
const p21 = all.filter((g) => g.patch === "16.21");
console.log("16.21:", p21.length, "jogos");
for (const [lbl, a, b, gs] of [["16.21 Col+Hid+Ecl vs DdM", [COL, HYD, ECL], [COL, HYD, DDA], p21], ["16.21 Col+Hid+LDR+Ecl vs DdM", [COL, HYD, LDR, ECL], [COL, HYD, LDR, DDA], p21]]) {
  const c = E.compareBuilds(gs, { items: a, mode: "set" }, { items: b, mode: "set" }, meta);
  console.log(lbl, `A ${c.a.games.length} ${pct(c.a.summary.rate)} B ${c.b.games.length} ${pct(c.b.summary.rate)} bruto ${E.pctTxt(c.wrDiff?.diff,1)} [${E.pctTxt(c.wrDiff?.ci[0])};${E.pctTxt(c.wrDiff?.ci[1])}] ajust ${E.pctTxt(c.byGold.adjusted?.diff,1)} [${E.pctTxt(c.byGold.adjusted?.ci[0])};${E.pctTxt(c.byGold.adjusted?.ci[1])}]`, c.byGold.rows.map((r) => `${r.key} ${r.a.wins}/${r.a.n} x ${r.b.wins}/${r.b.n}`).join(" · "), "ouro", Math.round(c.a.context.teamGold.mean), Math.round(c.b.context.teamGold.mean));
}
// Mortes por 10 min depois de fechar o item (por partida), Eclipse vs DdM, total
const after = (gs, id) => gs.map((g) => E.contextAtCompletion(g, id)?.after.d).filter((v) => v != null);
const withE = all.filter((g) => g.finalItems.includes(ECL) && !g.finalItems.includes(DDA));
const withD = all.filter((g) => g.finalItems.includes(DDA) && !g.finalItems.includes(ECL));
const md = E.meanDiff(after(withE, ECL), after(withD, DDA));
console.log("mortes/10 após fechar: Eclipse", f2(E.mean(after(withE, ECL))), "n", md.nA, "| DdM", f2(E.mean(after(withD, DDA))), "n", md.nB, "| diff", f2(md.diff), "IC", md.ci?.map(f2).join(" a "));
const afterK = (gs, id) => gs.map((g) => E.contextAtCompletion(g, id)?.after.k).filter((v) => v != null);
const mk = E.meanDiff(afterK(withE, ECL), afterK(withD, DDA));
console.log("abates/10 após fechar: diff", f2(mk.diff), "IC", mk.ci?.map(f2).join(" a "));
// 3º item dentro de Coletora > Hidra
const ch = all.filter((g) => g.order && g.order[0]?.id === COL && g.order[1]?.id === HYD && g.order[2]);
const ldr = ch.filter((g) => g.order[2].id === LDR), oth = ch.filter((g) => g.order[2].id !== LDR);
const d3 = E.proportionDiff(ldr.filter((g) => g.win).length, ldr.length, oth.filter((g) => g.win).length, oth.length);
const tg = (gs) => E.mean(gs.map((g) => E.teamDiffAt(g, g.order[2].t)?.goldDiff));
console.log(`3º item após Col>Hid: LDR ${ldr.length} ${pct(E.winRate(ldr).rate)} | outros ${oth.length} ${pct(E.winRate(oth).rate)} | diff ${E.pctTxt(d3.diff,1)} [${E.pctTxt(d3.ci[0])};${E.pctTxt(d3.ci[1])}] | ouro time na compra ${Math.round(tg(ldr))} vs ${Math.round(tg(oth))} | tempo ${E.fmtClock(E.describe(ldr.map(g=>g.order[2].t)).median)} vs ${E.fmtClock(E.describe(oth.map(g=>g.order[2].t)).median)}`);
const c3 = E.compareBuilds(ch, { items: [COL, HYD, LDR], mode: "seq" }, { items: [COL, HYD], mode: "seq" }, meta, { excludeOverlap: false });
// baseline: jogos que chegaram ao 3º e 4º item
const os = E.orderStats(all, meta, 5); os.bySlot.forEach((s) => console.log(`chegou ao ${s.slot}º item: ${s.reached} jogos, WR ${pct(s.winRateReached.rate)}`));
// 2º item após Coletora
const c1 = all.filter((g) => g.order && g.order[0]?.id === COL && g.order[1]);
for (const [id, x] of E.groupBy(c1, (g) => g.order[1].id)) console.log("2º após Coletora:", E.itemName(meta, id), x.length, pct(E.winRate(x).rate), "dano/min", Math.round(E.mean(x.map(g=>g.dmgMin))), "patches", [...new Set(x.map(g=>g.patch))].join(","));
// 1º item por patch
for (const [p, x] of E.groupBy(all.filter((g) => g.order?.[0]), (g) => g.patch)) console.log("1º item no patch", p, [...E.groupBy(x, (g) => g.order[0].id)].map(([id, y]) => `${E.itemName(meta, id)} ${y.length}`).join(", "));
// Fragmentos e secundária
const shardKey = (g) => (g.runes.shards || [])[0];
for (const [k, x] of E.groupBy(all, shardKey)) console.log("fragmento ofensivo", meta.shards?.[k] || k, x.length, pct(E.winRate(x).rate), "dano/min", Math.round(E.mean(x.map(g=>g.dmgMin))), "mortes", E.mean(x.map(g=>g.d)).toFixed(1), "patches", [...new Set(x.map(g=>g.patch))].sort().join(","));
const dom = all.filter((g) => g.subStyle === 8100), ins = all.filter((g) => g.subStyle === 8300);
const ds = E.proportionDiff(dom.filter(g=>g.win).length, dom.length, ins.filter(g=>g.win).length, ins.length);
console.log("Dominação vs Inspiração diff", E.pctTxt(ds.diff,1), "IC", E.pctTxt(ds.ci[0]), E.pctTxt(ds.ci[1]), "| Inspiração patches", [...new Set(ins.map(g=>g.patch))].join(","), "| ouro10 dom", Math.round(E.mean(dom.map(g=>g.early?.diff10?.gold))), "ins", Math.round(E.mean(ins.map(g=>g.early?.diff10?.gold))), "| cs/min", E.mean(dom.map(g=>g.csMin)).toFixed(2), E.mean(ins.map(g=>g.csMin)).toFixed(2));
const sh3 = E.groupBy(all, (g) => (g.runes.shards || [])[2]);
for (const [k, x] of sh3) console.log("fragmento defensivo", meta.shards?.[k] || k, x.length, pct(E.winRate(x).rate), "mortes", E.mean(x.map(g=>g.d)).toFixed(1));
// Recente vs anterior (mesma build-base?) 
const rec = all.slice(0, 50), prev = all.slice(50, 100);
console.log("WR últimas 50", pct(E.winRate(rec).rate), "| 50 anteriores", pct(E.winRate(prev).rate), "patches anteriores", [...new Set(prev.map(g=>g.patch))].join(","));
