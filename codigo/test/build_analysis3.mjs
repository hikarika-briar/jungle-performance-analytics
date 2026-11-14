import fs from "node:fs";
import * as E from "../src/engine.js";
const raw = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const P = E.prepare(raw); const meta = P.meta;
const all = E.applyFilters(P.games, { ...E.DEFAULT_FILTERS, period: "all" }).current;
const pct = (v) => E.pctTxt(v, 0), f1 = (v) => (v == null || Number.isNaN(v) ? "—" : v.toFixed(1)), f2 = (v) => (v == null ? "—" : v.toFixed(2));
const COL = 6676, HYD = 3748, LDR = 3036, ECL = 6692, DDA = 6333, BC = 3071;
const B1 = [COL, HYD, LDR, ECL], B2 = [COL, HYD, LDR, DDA], B3 = [HYD, BC, DDA], B0 = [COL, HYD, LDR];
const tanks = (g) => g.participants.filter((p) => p.teamId !== g.teamId && ((meta.champions[String(p.championId)] || {}).tags || []).includes("Tank")).length;
const ap = (g) => g.participants.filter((p) => p.teamId !== g.teamId && ((meta.champions[String(p.championId)] || {}).tags || [])[0] === "Mage").length;
const tl = all.filter((g) => g.order);
for (const [name, items] of [["B1 Col>Hid>LDR>Ecl", B1], ["B2 Col>Hid>LDR>DdM", B2], ["B3 Hid>BC>DdM", B3], ["B0 Col>Hid>LDR", B0]]) {
  const gs = all.filter((g) => E.matchesBuild(g, { items, mode: "seq" }) === true);
  const s = E.summarize(gs);
  const depth = items.length;
  const reached = tl.filter((g) => g.order.length >= depth);
  const rest = reached.filter((g) => !gs.includes(g));
  const d = E.proportionDiff(s.wins, s.n, rest.filter((g) => g.win).length, rest.length);
  const last = items.at(-1);
  const ctx = gs.map((g) => E.contextAtCompletion(g, last)).filter(Boolean);
  console.log(`${name}: ${s.n}j ${pct(s.rate)} IC[${pct(s.ci?.[0])}–${pct(s.ci?.[1])}] | resto mesma profundidade(${depth}) ${rest.length}j ${pct(E.winRate(rest).rate)} diff ${E.pctTxt(d?.diff,1)} [${E.pctTxt(d?.ci[0])};${E.pctTxt(d?.ci[1])}]`);
  console.log(`   mortes ${f1(s.deaths)} kda ${f2(s.kda?.value)} cs ${f2(s.csMin)} ouro/min ${Math.round(s.goldMin)} dano ${Math.round(s.dmgMin)} kp ${pct(s.kp)} dur ${f1(s.durMin)} | último item ${E.fmtClock(E.describe(ctx.map(c=>c.t)).median)} ouro time ${Math.round(E.mean(ctx.map(c=>c.teamGold)))} | mortes/10 depois ${f2(E.mean(ctx.map(c=>c.after.d)))}`);
  console.log(`   tanques inimigos ${f1(E.mean(gs.map(tanks)))} magos ${f1(E.mean(gs.map(ap)))} | ouro10 ${Math.round(E.mean(gs.map(g=>g.early?.diff10?.gold)))} | patches ${[...E.groupBy(gs,g=>g.patch)].map(([p,x])=>p+":"+x.length).join(" ")} | datas ${new Date(gs.at(-1)?.start).toISOString().slice(0,10)}→${new Date(gs[0]?.start).toISOString().slice(0,10)}`);
  console.log(`   item3 em ${E.fmtClock(E.describe(gs.map(g=>g.order[2]?.t)).median)} | ouro time no 3º item ${Math.round(E.mean(gs.map(g=>E.teamDiffAt(g,g.order[2].t)?.goldDiff)))} | WR por patch 16.21: ${pct(E.winRate(gs.filter(g=>g.patch==="16.21")).rate)} (${gs.filter(g=>g.patch==="16.21").length})`);
}
console.log("média tanques inimigos geral", f1(E.mean(all.map(tanks))), "magos", f1(E.mean(all.map(ap))));
const cmp = (lbl, a, b) => {
  const c = E.compareBuilds(all, { items: a, mode: "seq" }, { items: b, mode: "seq" }, meta);
  console.log(`\n>> ${lbl}: A ${c.a.games.length} ${pct(c.a.summary.rate)} | B ${c.b.games.length} ${pct(c.b.summary.rate)} | bruto ${E.pctTxt(c.wrDiff?.diff,1)} [${E.pctTxt(c.wrDiff?.ci[0])};${E.pctTxt(c.wrDiff?.ci[1])}] | ajust ${E.pctTxt(c.byGold.adjusted?.diff,1)} [${E.pctTxt(c.byGold.adjusted?.ci[0])};${E.pctTxt(c.byGold.adjusted?.ci[1])}] | key ${E.itemName(meta,c.a.keyItem)} x ${E.itemName(meta,c.b.keyItem)}`);
  console.log("   estratos ouro:", c.byGold.rows.map((r) => `${r.key} ${r.a.wins}/${r.a.n} x ${r.b.wins}/${r.b.n}`).join(" · "), "| duração:", c.byDuration.rows.map((r) => `${r.key} ${r.a.wins}/${r.a.n} x ${r.b.wins}/${r.b.n}`).join(" · "));
  console.log("   métricas:", c.metrics.map((m) => `${m.label} ${m.a?.toFixed(2)} x ${m.b?.toFixed(2)}${m.reliable ? "*" : ""}`).join(" | "));
};
cmp("1) Ecl 4º vs DdM 4º", B1, B2);
cmp("2) Ecl build vs Hid>BC>DdM", B1, B3);
cmp("2b) mesma profundidade Col>Hid>LDR vs Hid>BC>DdM", B0, B3);
cmp("3) DdM build vs Hid>BC>DdM", B2, B3);
const hbd = all.filter((g) => E.matchesBuild(g, { items: B3, mode: "seq" }) === true);
console.log("\nHid>BC>DdM jogos:", hbd.map((g) => `${new Date(g.start).toISOString().slice(0,10)} ${g.patch} ${g.win?"V":"D"} ${g.k}/${g.d}/${g.a} vs ${g.oppChamp} tanques ${tanks(g)} itens ${g.order.map(o=>E.itemName(meta,o.id)).join(">")}`).join("\n  "));
