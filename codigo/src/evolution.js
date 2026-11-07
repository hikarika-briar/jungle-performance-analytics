// Evolução (v2): o seu jogo em blocos de partidas, comparado com a média dos Challengers.
import * as E from "./engine.js";
import * as CH from "./challenger.js";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

// Métricas que entram no "nível Challenger" (dependem de você; sem time, sem campeão, sem estilo).
export const LEVEL_KEYS = ["gold10", "xp10", "gold15", "td10", "earlyGanks", "jcs10", "firstClear", "lvl6", "scuttle", "deaths15", "objPart", "picks", "csMin", "farm1525", "goldMin", "deaths", "kp", "redeaths", "afterBehind", "lossSignals"];
// Métricas mostradas uma a uma (as mais ligadas aos seus focos primeiro).
export const TRACK_KEYS = ["deaths", "redeaths", "deaths15", "picks", "lossSignals", "afterBehind", "gold10", "jcs10", "csMin", "kp", "objPart", "scuttle"];

export function metricDef(key) {
  return CH.METRIC[key] || CH.BEHAVIOR.find((b) => b.key === key) || null;
}

export function refMedians(prep) {
  if (!prep || !prep.players?.length) return null;
  const players = prep.players.filter((p) => p.games.length >= CH.MIN_GAMES_PER_PLAYER).map((p) => ({ ...p, stats: CH.groupStats(p.games) }));
  if (!players.length) return null;
  const out = {};
  for (const k of LEVEL_KEYS.concat(TRACK_KEYS)) out[k] = CH.band(players, k).center;
  return { medians: out, nPlayers: players.length };
}

function valueOf(st, key) {
  if (CH.METRIC[key]) return st.values[key]?.mean ?? null;
  return st.behavior[key]?.value ?? null;
}
const atLevel = (v, med, better) => isNum(v) && isNum(med) && (better === "lower" ? v <= med : v >= med);

// Blocos do mais antigo ao mais recente. mode: "games" (blocos de `size` partidas) ou "month".
export function blocks(pool, { size = 20, mode = "games" } = {}) {
  const asc = [...pool].sort((a, b) => a.start - b.start);
  const out = [];
  if (mode === "month") {
    const map = new Map();
    for (const g of asc) { const d = new Date(g.start); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; if (!map.has(k)) map.set(k, []); map.get(k).push(g); }
    for (const [k, gs] of map) if (gs.length >= 5) out.push({ key: k, games: gs });
  } else {
    for (let i = asc.length; i > 0; i -= size) {
      const gs = asc.slice(Math.max(0, i - size), i);
      if (gs.length >= Math.ceil(size * 0.6)) out.unshift({ key: `${gs[0].start}`, games: gs });
    }
  }
  return out;
}

export function evolutionSeries(pool, ref, opts) {
  const bl = blocks(pool, opts);
  return bl.map((b, i) => {
    const st = CH.groupStats(b.games);
    const vals = {};
    for (const k of new Set(LEVEL_KEYS.concat(TRACK_KEYS))) vals[k] = valueOf(st, k);
    let level = null, total = null;
    if (ref) {
      const ks = LEVEL_KEYS.filter((k) => isNum(vals[k]) && isNum(ref.medians[k]));
      total = ks.length;
      level = ks.filter((k) => atLevel(vals[k], ref.medians[k], metricDef(k).better)).length;
    }
    return { idx: i + 1, from: b.games[0].start, to: b.games[b.games.length - 1].start, n: b.games.length, month: opts?.mode === "month" ? b.key : null, wr: st.wr.rate, level, total, vals };
  });
}

// Tendência de cada métrica: janela recente × anterior (sem sobreposição), com IC quando dá.
export function trendOf(key, pool, window, median) {
  const m = metricDef(key);
  const recent = pool.slice(0, window), previous = pool.slice(window, window * 2);
  if (!m || previous.length < Math.min(10, window)) return null;
  let a, b, ci = null;
  if (m.f) {
    const va = recent.map(m.f), vb = previous.map(m.f);
    const r = E.meanDiff(va, vb);
    a = E.mean(va); b = E.mean(vb); ci = r.ci;
  } else {
    a = valueOf(CH.groupStats(recent), key); b = valueOf(CH.groupStats(previous), key);
  }
  if (!isNum(a) || !isNum(b)) return null;
  const better = m.better;
  const improved = better === "lower" ? a < b : a > b;
  const sig = ci ? (ci[0] > 0 || ci[1] < 0) : false;
  // Mudança pequena (menos de 3% da referência) conta como estável.
  const scale = Math.max(Math.abs(b), Math.abs(median ?? 0), 1e-9);
  const tiny = Math.abs(a - b) / scale < 0.03;
  let status;
  if (isNum(median) && atLevel(a, median, better)) status = "nivel";
  else if (tiny) status = "estavel";
  else if (improved) status = sig ? "aproximando" : "leve";
  else status = sig ? "afastando" : "piorou-leve";
  const gapNow = isNum(median) ? (better === "lower" ? a - median : median - a) : null;
  const gapBefore = isNum(median) ? (better === "lower" ? b - median : median - b) : null;
  const c = closeness(gapBefore, gapNow);
  // Tamanho da mudança em relação à média dos Challengers (para comparar métricas de unidades diferentes).
  if (c) c.rel = isNum(median) && Math.abs(median) > 1e-9 ? (c.gB - c.gN) / Math.abs(median) : c.v;
  return { a, b, ci, sig, status, gapNow, gapBefore, nA: recent.length, nB: previous.length, closeness: c };
}

// Quanto da distância para a média Challenger foi fechada (+) ou aberta (−), de −1 a 1. null quando os dois lados já estão no nível.
export function closeness(gapBefore, gapNow) {
  if (!isNum(gapBefore) || !isNum(gapNow)) return null;
  const gB = Math.max(0, gapBefore), gN = Math.max(0, gapNow);
  if (gB === 0 && gN === 0) return { v: 0, kind: "nivel", gB, gN };
  if (gN < gB) return { v: (gB - gN) / gB, kind: gN === 0 ? "chegou" : "perto", gB, gN };
  if (gN > gB) return { v: -(gN - gB) / gN, kind: gB === 0 ? "saiu" : "longe", gB, gN };
  return { v: 0, kind: "igual", gB, gN };
}

export const STATUS_LABEL = {
  nivel: ["No nível Challenger", "good"], aproximando: ["Aproximando", "good"], leve: ["Melhorando, sem confirmação", "mid"],
  afastando: ["Afastando", "bad"], "piorou-leve": ["Piorando, sem confirmação", "warn"], estavel: ["Estável", "neutral"],
};

export function monthlyWinRate(pool) {
  const map = new Map();
  for (const g of [...pool].sort((a, b) => a.start - b.start)) {
    const d = new Date(g.start); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!map.has(k)) map.set(k, []); map.get(k).push(g);
  }
  return [...map].map(([k, gs]) => { const w = E.winRate(gs); return { key: k, n: gs.length, wins: w.wins, losses: w.losses, rate: w.rate, ci: w.ci, deaths: E.mean(gs.map((g) => g.d)) }; });
}
