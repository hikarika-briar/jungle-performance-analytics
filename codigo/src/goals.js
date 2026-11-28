// Metas: métrica, alvo e progresso nas últimas partidas.
import * as E from "./engine.js";
import * as CH from "./challenger.js";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const beh = (key) => (games) => CH.groupStats(games).behavior[key]?.value ?? null;

export const GOAL_METRICS = {
  redeaths: { label: "Mortes em sequência por partida", short: "Mortes em sequência", better: "lower", fmt: "dec2", f: CH.BEHAVIOR.find((b) => b.key === "redeaths").f,
    tip: "Quantas vezes por partida você morre de novo até 90 s depois da morte anterior." },
  deaths: { label: "Mortes por partida", short: "Mortes", better: "lower", fmt: "dec1", f: (g) => g.d },
  deaths15: { label: "Mortes antes dos 15 min", short: "Mortes até 15'", better: "lower", fmt: "dec2", f: CH.METRIC.deaths15.f },
  picks: { label: "Pick-offs antes de objetivos", short: "Pick-offs", better: "lower", fmt: "dec2", f: CH.METRIC.picks.f },
  lossSignals: { label: "Derrotas com 2+ sinais de jogo forçado", short: "Jogo forçado", better: "lower", fmt: "pct", agg: beh("lossSignals"),
    tip: "Das derrotas no bloco, quantas tiveram 2 ou mais sinais da Revisão de derrotas." },
  afterBehind: { label: "Mortes depois de o time ficar 3.000 atrás", short: "Mortes atrás", better: "lower", fmt: "dec1", agg: beh("afterBehind") },
  csMin: { label: "Farm por minuto", short: "Farm/min", better: "higher", fmt: "dec1", f: CH.METRIC.csMin.f },
  jcs10: { label: "Farm de selva até os 10 min", short: "Selva até 10'", better: "higher", fmt: "dec1", f: CH.METRIC.jcs10.f },
  scuttle: { label: "Escuttles por partida", short: "Escuttles", better: "higher", fmt: "dec2", f: CH.METRIC.scuttle.f },
  controlWards: { label: "Sentinelas de controle por partida", short: "Sentinelas de controle", better: "higher", fmt: "dec1", f: CH.METRIC.controlWards.f },
  kp: { label: "Participação em abates", short: "KP", better: "higher", fmt: "pct", f: CH.METRIC.kp.f },
  gold10: { label: "Ouro contra o jungler aos 10", short: "Ouro aos 10", better: "higher", fmt: "int", f: CH.METRIC.gold10.f },
};
export const DEFAULT_GOALS = [{ key: "redeaths" }, { key: "deaths" }, { key: "lossSignals" }];
const FALLBACK_TARGET = { redeaths: 0.7, deaths: 5, deaths15: 2, picks: 0.35, lossSignals: 0.25, afterBehind: 3, csMin: 7.7, jcs10: 73, scuttle: 4, controlWards: 2, kp: 0.55, gold10: 300 };

export function goalValue(key, games) {
  const m = GOAL_METRICS[key];
  if (!m || !games.length) return null;
  if (m.agg) return m.agg(games);
  const v = games.map(m.f).filter(isNum);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

// Blocos de partidas do período, do mais antigo ao mais recente (games vem do mais recente para o mais antigo).
// Usa blocos de 10; em períodos longos, aumenta o bloco para o gráfico ter no máximo `maxPoints` pontos.
export function goalTrend(key, games, maxPoints = 20) {
  const block = Math.max(10, Math.ceil(games.length / maxPoints / 5) * 5);
  const n = Math.floor(games.length / block);
  const points = [];
  for (let i = n - 1; i >= 0; i--) {
    const gs = games.slice(i * block, (i + 1) * block);
    points.push({ idx: n - i, value: goalValue(key, gs), from: gs[gs.length - 1].start, to: gs[0].start });
  }
  return { points, block };
}

// Alvo sugerido: média dos Challengers quando houver referências; senão, o jungler inimigo nas suas partidas.
export function suggestTarget(key, cmp) {
  if (cmp) {
    const row = cmp.rows.find((r) => r.key === key) || cmp.behavior.find((r) => r.key === key);
    if (row && isNum(row.band?.center)) return { value: row.band.center, source: "média dos Challengers" };
    if (row && isNum(row.elo)) return { value: row.elo, source: "jungler inimigo nas suas partidas" };
  }
  return { value: FALLBACK_TARGET[key] ?? null, source: "valor de referência" };
}

// "Agora" = as últimas 10 partidas do período; "antes" = o resto do período.
export function goalStatus(key, games, target) {
  const m = GOAL_METRICS[key];
  const nNow = Math.min(10, games.length), nBefore = Math.max(0, games.length - 10);
  const now = goalValue(key, games.slice(0, 10));
  const start = nBefore >= 5 ? goalValue(key, games.slice(10)) : null;
  if (!isNum(now) || !isNum(target)) return { now, start, nNow, nBefore, progress: null, done: false, trend: null };
  const lower = m.better === "lower";
  const done = lower ? now <= target : now >= target;
  // "% da meta": quão perto o valor atual está do alvo (100% = na meta)
  let progress;
  if (done) progress = 1;
  else if (lower) progress = now > 0 ? Math.max(0, Math.min(1, target / now)) : 1;
  else progress = target > 0 ? Math.max(0, Math.min(1, now / target)) : 0;
  const trend = isNum(start) ? (Math.abs(now - start) < 1e-9 ? 0 : (lower ? now < start : now > start) ? 1 : -1) : null;
  return { now, start, nNow, nBefore, progress, done, trend };
}
