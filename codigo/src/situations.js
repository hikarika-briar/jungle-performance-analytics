// ============================================================================
// Situações de lane por classe: quem está no topo e no suporte de cada lado (pela subclasse
// da wiki) e para onde o jungler foi primeiro, com a win rate de cada escolha.
// ============================================================================
import { laneClasses, subLabel } from "./classes.js";
import { earlyProfile } from "./early.js";

export const SIDES = ["top", "mid", "bot"];
export const SIDE_LABEL = { top: "Top", mid: "Mid", bot: "Bot" };

// Uma linha por partida: lado do 1º gank (estratégias do Early Game) e as classes das lanes.
export function situationRow(g, meta) {
  const p = earlyProfile(g);
  if (!p) return null;
  const lc = laneClasses(g, meta);
  const sub = (x) => x?.sub || null;
  return {
    id: g.id, win: !!g.win, team: p.team,
    side: p.first ? p.first.lane : null, kill: p.firstResult === "abate",
    top: [sub(lc.TOP[0]), sub(lc.TOP[1])], sup: [sub(lc.UTILITY[0]), sub(lc.UTILITY[1])], mid: [sub(lc.MIDDLE[0]), sub(lc.MIDDLE[1])], jg: [sub(lc.JUNGLE[0]), sub(lc.JUNGLE[1])],
  };
}

const wr = (l) => (l.length ? l.filter((r) => r.win).length / l.length : null);
// cond: { topA, topB, supA, supB } (subclasses; vazio = qualquer)
export function matching(rows, cond) {
  return rows.filter((r) => (!cond.topA || r.top[0] === cond.topA) && (!cond.topB || r.top[1] === cond.topB)
    && (!cond.supA || r.sup[0] === cond.supA) && (!cond.supB || r.sup[1] === cond.supB));
}
// Para onde foi o 1º gank e quanto ganhou em cada lado
export function sideSplit(rows) {
  const withSide = rows.filter((r) => r.side);
  const n = withSide.length;
  const out = { n, total: rows.length, wr: wr(rows) };
  for (const s of SIDES) { const sub = withSide.filter((r) => r.side === s); out[s] = { n: sub.length, share: n ? sub.length / n : null, wr: wr(sub), kill: sub.length ? sub.filter((r) => r.kill).length / sub.length : null }; }
  return out;
}
// Lado recomendado: o de maior win rate entre os que têm amostra; empate técnico = o mais comum.
export function bestSide(sp, minN = 10) {
  const ok = SIDES.filter((s) => sp[s].n >= minN);
  if (!ok.length) return null;
  const byWr = [...ok].sort((a, b) => sp[b].wr - sp[a].wr);
  const common = [...SIDES].sort((a, b) => sp[b].n - sp[a].n)[0];
  return { best: byWr[0], common, gap: ok.length > 1 ? sp[byWr[0]].wr - sp[byWr[ok.length - 1]].wr : 0, clear: ok.length > 1 && sp[byWr[0]].wr - sp[byWr[1]].wr >= 0.05 };
}
// Situações mais comuns de uma lane ("top" ou "sup"): pares aliado × inimigo
export function commonPairs(rows, lane, limit = 6) {
  const m = new Map();
  for (const r of rows) { const [a, b] = r[lane]; if (!a || !b) continue; const k = `${a}|${b}`; if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return [...m.entries()].map(([k, list]) => { const [a, b] = k.split("|"); return { key: k, a, b, n: list.length, label: `${subLabel(a)} × ${subLabel(b)}` }; })
    .sort((x, y) => y.n - x.n).slice(0, limit);
}
export function subsPresent(rows, lane, idx) {
  const c = {};
  for (const r of rows) { const s = r[lane][idx]; if (s) c[s] = (c[s] || 0) + 1; }
  return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([s]) => s);
}
