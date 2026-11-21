import fs from "node:fs";
import * as E from "../src/engine.js";
const raw = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const P = E.prepare(raw); const meta = P.meta;
const all = E.applyFilters(P.games, { ...E.DEFAULT_FILTERS, period: "all" }).current; // Briar, 420, JUNGLE, sem remake
const N = (id) => E.itemName(meta, id), RN = (id) => E.runeName(meta, id);
const pct = (v) => E.pctTxt(v, 0), f1 = (v) => (v == null ? "—" : v.toFixed(1)), f2 = (v) => (v == null ? "—" : v.toFixed(2));
const wr = (gs) => { const w = E.winRate(gs); return `${w.n}j ${pct(w.rate)} [${pct(w.ci?.[0])}–${pct(w.ci?.[1])}]`; };
const proc = (gs) => { const s = E.summarize(gs); return `mortes ${f1(s.deaths)} · kda ${f2(s.kda?.value)} · cs ${f2(s.csMin)} · dano ${Math.round(s.dmgMin||0)} · kp ${pct(s.kp)} · dur ${f1(s.durMin)}`; };
console.log("TOTAL:", all.length, "jogos", E.fmtClock(0), new Date(all.at(-1).start).toISOString().slice(0,10), "→", new Date(all[0].start).toISOString().slice(0,10));
const byPatch = E.groupBy(all, (g) => g.patch); console.log("por patch:", [...byPatch].map(([p, x]) => `${p}:${x.length}`).join(" "));
for (const n of [30, 50]) { const r = all.slice(0, n); console.log(`últimas ${n}: ${new Date(r.at(-1).start).toISOString().slice(0,10)} → ${new Date(r[0].start).toISOString().slice(0,10)} patches ${[...new Set(r.map(g=>g.patch))].join(",")}`); }

function section(label, gs) {
  console.log(`\n================ ${label}: ${gs.length} jogos · ${wr(gs)} · ${proc(gs)}`);
  // RUNAS
  console.log("-- runa-chave:", E.keystoneStats(gs, meta).map((k) => `${k.name} ${k.n}j ${pct(k.rate)}`).join(" | "));
  console.log("-- árvore secundária:", [...E.groupBy(gs, (g) => g.subStyle)].map(([s, x]) => `${RN(s)}: ${wr(x)}`).join(" | "));
  for (const slot of [1, 2, 3]) console.log(`-- primária slot ${slot}:`, [...E.groupBy(gs, (g) => g.runes.primary?.[slot])].map(([id, x]) => `${RN(id)}: ${wr(x)} · ${proc(x)}`).join("\n      "));
  console.log("-- secundárias (par):", [...E.groupBy(gs, (g) => (g.runes.secondary || []).slice().sort().join("+"))].sort((a,b)=>b[1].length-a[1].length).slice(0,6).map(([k, x]) => `${k.split("+").map(RN).join(" + ")}: ${wr(x)}`).join("\n      "));
  console.log("-- fragmentos:", [...E.groupBy(gs, (g) => (g.runes.shards || []).join("-"))].sort((a,b)=>b[1].length-a[1].length).slice(0,5).map(([k, x]) => `${k.split("-").map((s) => (meta.shards||{})[s] || s).join("/")}: ${wr(x)}`).join("\n      "));
  console.log("-- páginas completas:", E.runePageStats(gs, meta).slice(0, 5).map((p) => `${[...p.runes.primary, "|", ...p.runes.secondary].map((x) => x === "|" ? "|" : RN(x)).join(", ")}: ${p.n}j ${pct(p.rate)}`).join("\n      "));
  // ORDEM
  const os = E.orderStats(gs, meta, 5);
  for (const sl of os.bySlot) console.log(`-- ${sl.slot}º item (${sl.reached}j, mediana ${E.fmtClock(sl.time.median)}):`, sl.items.slice(0, 5).map((i) => `${i.name} ${i.n}j ${pct(i.rate)} @${E.fmtClock(i.medianT)}`).join(" | "));
  const seq3 = E.comboStats(gs, meta, { size: 3, mode: "seq", minN: 3 }).rows.slice(0, 8);
  console.log("-- sequências de 3:", seq3.map((r) => `${r.items.map(N).join(" > ")}: ${r.n}j ${pct(r.rate)}`).join("\n      "));
  const seq4 = E.comboStats(gs, meta, { size: 4, mode: "seq", minN: 2 }).rows.slice(0, 8);
  console.log("-- sequências de 4:", seq4.map((r) => `${r.items.map(N).join(" > ")}: ${r.n}j ${pct(r.rate)}`).join("\n      "));
  console.log("-- botas:", [...E.groupBy(gs, (g) => g.boots)].map(([b, x]) => `${b ? N(b) : "sem bota"}: ${wr(x)}`).join(" | "));
}
const recent = all.slice(0, 50);
section("HISTÓRICO TOTAL", all);
section("RECENTE (últimas 50)", recent);

function cmp(label, gs, a, b, mode = "set") {
  const c = E.compareBuilds(gs, { items: a, mode }, { items: b, mode }, meta);
  const m = Object.fromEntries(c.metrics.map((x) => [x.key, x]));
  const show = (k, d = 1) => `${m[k].a?.toFixed(d)} vs ${m[k].b?.toFixed(d)}${m[k].reliable ? "*" : ""}`;
  console.log(`\n>> ${label}: A ${c.a.games.length}j ${pct(c.a.summary.rate)} | B ${c.b.games.length}j ${pct(c.b.summary.rate)} | bruto ${E.pctTxt(c.wrDiff?.diff,1)} IC[${E.pctTxt(c.wrDiff?.ci[0],0)};${E.pctTxt(c.wrDiff?.ci[1],0)}] | ajustado ouro ${E.pctTxt(c.byGold.adjusted?.diff,1)} IC[${E.pctTxt(c.byGold.adjusted?.ci[0],0)};${E.pctTxt(c.byGold.adjusted?.ci[1],0)}]`);
  console.log(`   ouro time na compra ${Math.round(c.a.context.teamGold.mean??NaN)} vs ${Math.round(c.b.context.teamGold.mean??NaN)} · conclusão ${E.fmtClock(c.a.context.completion.median)} vs ${E.fmtClock(c.b.context.completion.median)} · mortes ${show("deaths")} · cs ${show("csMin",2)} · dano ${show("dmgMin",0)} · kp ${show("kp",2)} · dur ${show("durMin")}`);
  console.log(`   estratos ouro: ${c.byGold.rows.map((r) => `${r.key} A ${r.a.wins}/${r.a.n} B ${r.b.wins}/${r.b.n}`).join(" · ")}`);
  console.log(`   mortes/10min depois da compra: A ${f2(c.a.context.after.d)} B ${f2(c.b.context.after.d)} · abates/10 depois: A ${f2(c.a.context.after.k)} B ${f2(c.b.context.after.k)}`);
  console.log(`   patches A: ${c.a.patches.map(p=>p.patch+":"+p.n).join(" ")} | B: ${c.b.patches.map(p=>p.patch+":"+p.n).join(" ")}`);
}
const COL = 6676, HYD = 3748, LDR = 3036, ECL = 6692, DDA = 6333, ISB = 6673, GA = 3026;
for (const [lbl, gs] of [["TOTAL", all], ["RECENTE", recent]]) {
  console.log(`\n######## COMPARAÇÕES ${lbl}`);
  cmp("1º item Coletora vs Eclipse (ordem)", gs, [COL], [ECL], "seq");
  cmp("Eclipse vs DdM (qualquer)", gs, [ECL], [DDA]);
  cmp("Col+Hidra+Eclipse vs Col+Hidra+DdM", gs, [COL, HYD, ECL], [COL, HYD, DDA]);
  cmp("3º: Col>Hid>LDR vs Col>Hid>DdM (ordem)", gs, [COL, HYD, LDR], [COL, HYD, DDA], "seq");
  cmp("Col+Hid+LDR+Ecl vs Col+Hid+LDR+DdM", gs, [COL, HYD, LDR, ECL], [COL, HYD, LDR, DDA]);
}
