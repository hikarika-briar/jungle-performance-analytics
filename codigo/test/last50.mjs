import fs from "node:fs";
import * as E from "../src/engine.js";
const raw = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const P = E.prepare(raw); const meta = P.meta;
const pool = E.applyFilters(P.games, { ...E.DEFAULT_FILTERS, period: "all" }).pool; // Briar, solo, jungle, sem remake
const L = pool.slice(0, 50), prev = pool.slice(50, 100), all = pool;
const f1 = (v) => (v == null || Number.isNaN(v) ? "—" : v.toFixed(1)), f2 = (v) => (v == null ? "—" : v.toFixed(2)), pct = (v) => E.pctTxt(v, 0);
const sum = (a) => a.reduce((s, x) => s + x, 0);
console.log("Últimas 50:", new Date(L.at(-1).start).toLocaleString("pt-BR"), "→", new Date(L[0].start).toLocaleString("pt-BR"));
// Você x jungler inimigo nas mesmas partidas
const oppKP = (g) => { const tk = sum(g.participants.filter((p) => p.teamId !== g.teamId).map((p) => p.k)); return g.opp && tk ? (g.opp.k + g.opp.a) / tk : null; };
const oppCs = (g) => (g.opp ? ((g.opp.cs || 0) + (g.opp.jcs || 0)) / g.durMin : null);
const row = (label, me, op) => console.log(label.padEnd(26), "você", me, "| jungler inimigo", op);
row("abates/mortes/assist.", `${f1(E.mean(L.map((g) => g.k)))}/${f1(E.mean(L.map((g) => g.d)))}/${f1(E.mean(L.map((g) => g.a)))}`, `${f1(E.mean(L.map((g) => g.opp?.k)))}/${f1(E.mean(L.map((g) => g.opp?.d)))}/${f1(E.mean(L.map((g) => g.opp?.a)))}`);
row("KDA agregado", f2(E.aggregateKDA(L).value), f2((sum(L.map((g) => g.opp.k)) + sum(L.map((g) => g.opp.a))) / sum(L.map((g) => g.opp.d))));
row("part. em abates", pct(E.mean(L.map((g) => g.kp))), pct(E.mean(L.map(oppKP))));
row("ouro/min", Math.round(E.mean(L.map((g) => g.goldMin))), Math.round(E.mean(L.map((g) => g.opp.gold / g.durMin))));
row("farm/min", f2(E.mean(L.map((g) => g.csMin))), f2(E.mean(L.map(oppCs))));
row("dano/min", Math.round(E.mean(L.map((g) => g.dmgMin))), Math.round(E.mean(L.map((g) => g.opp.dmg / g.durMin))));
row("visão/min", f2(E.mean(L.map((g) => g.vision / g.durMin))), f2(E.mean(L.map((g) => (g.opp.vision ?? 0) / g.durMin))));
row("dano recebido/min", Math.round(E.mean(L.map((g) => g.dmgTaken / g.durMin))), Math.round(E.mean(L.map((g) => g.opp.dmgTaken / g.durMin))));
const mortesMd = E.meanDiff(L.map((g) => g.d), L.map((g) => g.opp.d)); console.log("diferença de mortes (você − inimigo):", f2(mortesMd.diff), "IC", mortesMd.ci.map(f2).join(" a "));
const goldMd = E.meanDiff(L.map((g) => g.goldMin), L.map((g) => g.opp.gold / g.durMin)); console.log("diferença ouro/min:", Math.round(goldMd.diff), "IC", goldMd.ci.map((x) => Math.round(x)).join(" a "));
console.log("ouro vs jungler aos 10/15/20:", [10, 15, 20].map((m) => Math.round(E.mean(L.map((g) => E.playerDiffAt(g, m * 60)?.gold)))).join(" / "), "| mais ouro que o jungler inimigo no fim:", L.filter((g) => g.gold > g.opp.gold).length, "de 50");
// Participação: sua parte nas mortes do time
const teamDeaths = (g) => sum(g.participants.filter((p) => p.teamId === g.teamId).map((p) => p.d));
console.log("sua fatia das mortes do time:", pct(E.mean(L.map((g) => g.d / Math.max(1, teamDeaths(g))))), "(1/5 do time seria 20%) | jungler inimigo:", pct(E.mean(L.map((g) => g.opp.d / Math.max(1, sum(g.participants.filter((p) => p.teamId !== g.teamId).map((p) => p.d)))))));
// Comparação com as 50 anteriores
console.log("\n50 anteriores:", E.pctTxt(E.winRate(prev).rate), "| mortes", f1(E.mean(prev.map((g) => g.d))), "kp", pct(E.mean(prev.map((g) => g.kp))), "ouro/min", Math.round(E.mean(prev.map((g) => g.goldMin))), "cs", f2(E.mean(prev.map((g) => g.csMin))));
console.log("últimas 50:  ", E.pctTxt(E.winRate(L).rate), "| mortes", f1(E.mean(L.map((g) => g.d))), "kp", pct(E.mean(L.map((g) => g.kp))), "ouro/min", Math.round(E.mean(L.map((g) => g.goldMin))), "cs", f2(E.mean(L.map((g) => g.csMin))));
// Derrotas "positivas"
const losses = L.filter((g) => !g.win), wins = L.filter((g) => g.win);
const posL = losses.filter((g) => g.k > g.d), negL = losses.filter((g) => g.k <= g.d);
console.log(`\nDerrotas: ${losses.length} | positivas (abates > mortes): ${posL.length} | negativas: ${negL.length}`);
for (const [lbl, gs] of [["derrotas positivas", posL], ["derrotas negativas", negL], ["vitórias", wins]]) {
  console.log(` ${lbl.padEnd(20)} n=${gs.length} KDA ${f2(E.aggregateKDA(gs)?.value)} mortes ${f1(E.mean(gs.map((g) => g.d)))} fatia mortes do time ${pct(E.mean(gs.map((g) => g.d / Math.max(1, teamDeaths(g)))))} | ouro vs jungler 10' ${Math.round(E.mean(gs.map((g) => g.early?.diff10?.gold)))} | ouro time 15' ${Math.round(E.mean(gs.map((g) => E.teamDiffAt(g, 900)?.goldDiff)))} 20' ${Math.round(E.mean(gs.map((g) => E.teamDiffAt(g, 1200)?.goldDiff)))} | pick-offs ${f2(E.mean(gs.map((g) => E.pickoffsBeforeObjectives(g))))} | duração ${f1(E.mean(gs.map((g) => g.durMin)))} | mortes depois dos 20' ${f1(E.mean(gs.map((g) => g.myEvents?.deaths.filter((d) => d.t >= 1200).length)))}`);
}
const posLtime = posL.map((g) => ({ d: g.d, td: teamDeaths(g), g15: E.teamDiffAt(g, 900)?.goldDiff, my10: g.early?.diff10?.gold, ahead20: (E.teamDiffAt(g, 1200)?.goldDiff ?? 0) > 0 }));
console.log(" derrotas positivas com o time à frente aos 20':", posLtime.filter((x) => x.ahead20).length, "de", posL.length, "| você à frente do jungler aos 10':", posLtime.filter((x) => x.my10 > 0).length);
// Tilt: sessões (intervalo > 90 min entre partidas abre nova sessão)
const asc = [...L].sort((a, b) => a.start - b.start);
const sessions = []; let cur = [];
for (const g of asc) { if (cur.length && g.start - (cur.at(-1).start + cur.at(-1).duration * 1000) > 90 * 60000) { sessions.push(cur); cur = []; } cur.push(g); }
if (cur.length) sessions.push(cur);
console.log("\nSessões:", sessions.map((s) => `${new Date(s[0].start).toLocaleDateString("pt-BR")} ${s.length}j ${s.filter((g) => g.win).length}V-${s.filter((g) => !g.win).length}D [${s.map((g) => (g.win ? "V" : "D")).join("")}]`).join("\n  "));
const byIdx = { "1ª-3ª da sessão": [], "4ª-6ª": [], "7ª+": [] };
for (const s of sessions) s.forEach((g, i) => (i < 3 ? byIdx["1ª-3ª da sessão"] : i < 6 ? byIdx["4ª-6ª"] : byIdx["7ª+"]).push(g));
for (const [k, gs] of Object.entries(byIdx)) console.log(` ${k}: ${gs.length}j WR ${pct(E.winRate(gs).rate)} mortes ${f1(E.mean(gs.map((g) => g.d)))} KDA ${f2(E.aggregateKDA(gs)?.value)} pick-offs ${f2(E.mean(gs.map((g) => E.pickoffsBeforeObjectives(g))))}`);
const afterLoss = [], afterWin = [], after2L = [];
for (const s of sessions) s.forEach((g, i) => { if (i === 0) return; (s[i - 1].win ? afterWin : afterLoss).push(g); if (i >= 2 && !s[i - 1].win && !s[i - 2].win) after2L.push(g); });
for (const [k, gs] of [["depois de vitória", afterWin], ["depois de derrota", afterLoss], ["depois de 2+ derrotas seguidas", after2L]]) console.log(` ${k}: ${gs.length}j WR ${pct(E.winRate(gs).rate)} mortes ${f1(E.mean(gs.map((g) => g.d)))} KDA ${f2(E.aggregateKDA(gs)?.value)} ouro vs jungler 10' ${Math.round(E.mean(gs.map((g) => g.early?.diff10?.gold)))} pick-offs ${f2(E.mean(gs.map((g) => E.pickoffsBeforeObjectives(g))))}`);
// KDA baixo e derrota
const lowKda = L.filter((g) => g.kda < 1.5);
console.log(`\nPartidas com KDA < 1,5: ${lowKda.length} (WR ${pct(E.winRate(lowKda).rate)}) | mortes nelas ${f1(E.mean(lowKda.map((g) => g.d)))} | ouro do time aos 15' ${Math.round(E.mean(lowKda.map((g) => E.teamDiffAt(g, 900)?.goldDiff)))}`);
// Objetivos e early nas 50
const es = E.earlyStats(L); console.log("early aos 10:", JSON.stringify({ dGold: Math.round(es.rows[1].dGold), dXp: Math.round(es.rows[1].dXp), dLvl: f2(es.rows[1].dLevel) }), "| 1º dragão do time", pct(es.firstDragonTeam), "| vastilarvas", pct(es.firstGrubsTeam));
const od = E.objectiveDeathStats(L); console.log("mortes antes de objetivos (50):", od.rows.map((r) => `${r.short} ${r.n}`).join(", "), "| total mortes", od.totalDeaths);
const ob = E.objectiveStats(L); console.log("objetivos/partida:", ob.perType.map((o) => `${o.label} ${f2(o.team)} x ${f2(o.enemy)}`).join(" | "));
console.log("mortes por fase (50):", E.deathStats(L).phases.map((p) => `${p.label} ${f2(p.perGame)}`).join(" | "));
