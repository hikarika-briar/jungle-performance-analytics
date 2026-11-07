import fs from "node:fs";
import * as E from "../src/engine.js";
const raw = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const P = E.prepare(raw);
const all = E.applyFilters(P.games, { ...E.DEFAULT_FILTERS, period: "all" }).pool.filter((g) => g.myEvents);
const tg = (g, s) => E.teamDiffAt(g, s)?.goldDiff;
const csAt = (g, m) => { const r = g.raw.timeline.me.find((x) => Math.round(x[0] / 60) === m); return r ? r[5] + r[6] : null; };
const avg = E.mean(all.filter((g) => g.durMin >= 25.5).map((g) => (csAt(g, 25) - csAt(g, 15)) / 10));
const feats = (g) => {
  const d = g.myEvents.deaths.map((x) => x.t);
  const gaps = d.slice(1).map((t, i) => t - d[i]);
  const behindT = (g.raw.timeline.team || []).find((r) => (g.teamId === 100 ? r[1] - r[2] : r[2] - r[1]) <= -3000)?.[0] ?? null;
  const farm = g.durMin >= 25.5 ? (csAt(g, 25) - csAt(g, 15)) / 10 / avg : null;
  return {
    seq90: gaps.filter((x) => x <= 90).length, seq120: gaps.filter((x) => x <= 120).length,
    afterBehind: behindT == null ? 0 : d.filter((t) => t >= behindT).length,
    farmLow: farm != null && farm < 0.75, picks: E.pickoffsBeforeObjectives(g) || 0,
    soloDeathsBehind: E.classifyObjectiveDeaths(g).filter((x) => x.cat === "pick" && (x.gold ?? 0) < -1500).length,
  };
};
const W = all.filter((g) => g.win), Lo = all.filter((g) => !g.win);
const rate = (gs, f) => (gs.filter(f).length / gs.length * 100).toFixed(0) + "%";
const tests = {
  "2+ mortes em até 90 s uma da outra": (g) => feats(g).seq90 >= 2,
  "3+ mortes em até 120 s": (g) => feats(g).seq120 >= 3,
  "5+ mortes depois do time ficar 3k atrás": (g) => feats(g).afterBehind >= 5,
  "farm 15–25 abaixo de 75%": (g) => feats(g).farmLow,
  "2+ pick-offs antes de objetivo": (g) => feats(g).picks >= 2,
  "pick-off com o time atrás": (g) => feats(g).soloDeathsBehind >= 1,
};
console.log("marcador".padEnd(42), "derrotas", "vitórias");
for (const [k, f] of Object.entries(tests)) console.log(k.padEnd(42), rate(Lo, f).padStart(8), rate(W, f).padStart(8));
// Combinação: pelo menos 2 sinais
const sig = (g) => Object.values(tests).filter((f) => f(g)).length;
for (const n of [1, 2, 3]) console.log(`${n}+ sinais`.padEnd(42), rate(Lo, (g) => sig(g) >= n).padStart(8), rate(W, (g) => sig(g) >= n).padStart(8));
// Dentro das derrotas "começou mal": comparar quem tem sinais (mortes) — ver o comportamento
const L50 = E.applyFilters(P.games, { ...E.DEFAULT_FILTERS, period: "all" }).pool.slice(0, 50).filter((g) => !g.win);
console.log("\nÚltimas 50 derrotas com 2+ sinais:", L50.filter((g) => sig(g) >= 2).map((g) => `${new Date(g.start).toLocaleDateString("pt-BR")} vs ${g.oppChamp} ${g.k}/${g.d}/${g.a} [${Object.entries(tests).filter(([, f]) => f(g)).map(([k]) => k).join("; ")}]`).join("\n  "));
