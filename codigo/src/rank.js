// Elo: nomes, escala contínua, histórico (coletor + pontos informados) e variação de PDL.
export const TIERS = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"];
export const TIER_PT = {
  IRON: "Ferro", BRONZE: "Bronze", SILVER: "Prata", GOLD: "Ouro", PLATINUM: "Platina", EMERALD: "Esmeralda",
  DIAMOND: "Diamante", MASTER: "Mestre", GRANDMASTER: "Grão-Mestre", CHALLENGER: "Desafiante",
};
export const TIER_COLOR = {
  IRON: "#8a7d76", BRONZE: "#b8794f", SILVER: "#a9bccb", GOLD: "#e3b453", PLATINUM: "#4fd1c5", EMERALD: "#2fcf7e",
  DIAMOND: "#7ea6ff", MASTER: "#c77bf2", GRANDMASTER: "#ef5a5a", CHALLENGER: "#f4d06f",
};
const DIV = { I: 1, II: 2, III: 3, IV: 4 };
const APEX = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"]);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

export function normTier(t) { const u = String(t || "").toUpperCase(); return TIERS.includes(u) ? u : null; }
export function isApex(t) { return APEX.has(normTier(t)); }

// Escala em "PDL corridos": cada divisão vale 100, cada elo abaixo de Mestre vale 400.
export function rankValue(p) {
  const tier = normTier(p?.tier);
  if (!tier) return null;
  const lp = isNum(p.lp) ? p.lp : 0;
  if (APEX.has(tier)) return 7 * 400 + lp;
  const idx = TIERS.indexOf(tier);
  const div = DIV[String(p.rank || "IV").toUpperCase()] || 4;
  return idx * 400 + (4 - div) * 100 + Math.max(0, Math.min(100, lp));
}
export function valueToRank(v) {
  if (!isNum(v)) return null;
  if (v >= 2800) return { tier: "MASTER", rank: "I", lp: Math.round(v - 2800) };
  const idx = Math.max(0, Math.floor(v / 400));
  const rem = v - idx * 400;
  const div = 4 - Math.min(3, Math.floor(rem / 100));
  return { tier: TIERS[idx], rank: ["", "I", "II", "III", "IV"][div], lp: Math.round(rem % 100) };
}
export function rankLabel(p, { lp = true } = {}) {
  const tier = normTier(p?.tier);
  if (!tier) return "Sem elo";
  const name = TIER_PT[tier];
  const div = APEX.has(tier) ? "" : ` ${p.rank || ""}`;
  return `${name}${div}${lp && isNum(p.lp) ? ` · ${p.lp} PDL` : ""}`.trim();
}
export function nextStep(p) {
  const tier = normTier(p?.tier);
  if (!tier) return null;
  if (APEX.has(tier)) return null;
  const div = DIV[String(p.rank || "IV").toUpperCase()] || 4;
  const missing = Math.max(0, 100 - (p.lp || 0));
  if (div > 1) return { label: `${TIER_PT[tier]} ${["", "I", "II", "III"][div - 1]}`, missing };
  const nt = TIERS[TIERS.indexOf(tier) + 1];
  return { label: APEX.has(nt) ? TIER_PT[nt] : `${TIER_PT[nt]} IV`, missing };
}

// Pontos do histórico: os do coletor (dataset.rank.history) e os que você marcou (prefs.rankManual).
export function rankHistory(dataset, manual) {
  const pts = [];
  for (const h of dataset?.rank?.history || []) {
    const v = rankValue(h);
    if (v != null && h.t) pts.push({ ...h, t: Date.parse(h.t), v, source: h.source || "coletor" });
  }
  for (const m of manual || []) {
    const v = rankValue(m);
    const t = typeof m.t === "number" ? m.t : Date.parse(m.t);
    if (v != null && isNum(t)) pts.push({ ...m, t, v, source: "manual" });
  }
  return pts.sort((a, b) => a.t - b.t);
}
export function currentRank(dataset, history) {
  const cur = dataset?.rank?.current?.RANKED_SOLO_5x5;
  if (cur && normTier(cur.tier)) return { ...cur, source: "coletor" };
  const last = history[history.length - 1];
  return last ? { tier: last.tier, rank: last.rank, lp: last.lp, wins: last.wins, losses: last.losses, source: last.source, t: last.t } : null;
}

// Um ponto por mês: o último registro do mês.
export function monthly(history) {
  const map = new Map();
  for (const p of history) {
    const d = new Date(p.t);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    map.set(k, { ...p, month: k });
  }
  return [...map.values()];
}

// Variação de PDL entre o começo do período e agora (precisa de um ponto antes ou no início do período).
export function lpDelta(history, fromT, toleranceDays = 14) {
  if (!history.length) return null;
  const before = history.filter((p) => p.t <= fromT + 6 * 3600e3 && p.t >= fromT - toleranceDays * 86400e3);
  const start = before.length ? before[before.length - 1] : null;
  const end = history[history.length - 1];
  if (!start || !end || end.t <= start.t) return null;
  return { delta: end.v - start.v, from: start, to: end };
}

export const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export function monthLabel(t) { const d = new Date(t); return `${MONTHS_PT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`; }
