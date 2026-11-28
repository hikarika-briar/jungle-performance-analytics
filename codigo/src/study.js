// ============================================================================
// Partidas para estudar: vitórias disputadas dos Challengers em que o jungler fez a
// diferença, a rota dos dois junglers no início e os momentos que decidiram a partida.
// Funções puras (os testes rodam no Node).
// ============================================================================
import { teamDiffAt, approxPos, champDisplay, OBJECTIVE_LABELS, objectiveType } from "./engine.js";
import { matchRatings, junglerDuel, mapRegion } from "./match_report.js";
import { habitProfile, halfOf } from "./habits.js";
import { earlyProfile, oppStrategy, strategyLabel, strategyKey, routeEvents } from "./early.js";

const fmtK = (v) => `${(Math.abs(v) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;

// Curva de ouro do time (você menos o inimigo), minuto a minuto
export function teamCurve(g) {
  const rows = g.raw?.timeline?.team || [];
  return rows.map((r) => ({ t: r[0], d: g.teamId === 100 ? r[1] - r[2] : r[2] - r[1] }));
}

// Quão disputada foi a partida e o que o jungler fez nela.
export function studyScore(g) {
  if (!g.win || !g.hasTL || (g.duration || 0) < 20 * 60) return null;
  const curve = teamCurve(g);
  if (curve.length < 15) return null;
  const upTo = (t) => curve.filter((p) => p.t <= t);
  const worst = Math.min(...curve.map((p) => p.d));           // o pior momento do time
  const best20 = Math.max(...upTo(1200).map((p) => p.d));     // maior vantagem até os 20
  const d15 = teamDiffAt(g, 900)?.goldDiff ?? null;
  const d20 = teamDiffAt(g, 1200)?.goldDiff ?? null;
  const stomp = best20 >= 6000 && worst > -800;
  if (stomp) return null;
  const comeback = worst <= -1500;
  const close = d20 != null && Math.abs(d20) <= 2500;
  if (!comeback && !close) return null;
  const r = matchRatings(g)?.byPid.get(g.raw.me.pid);
  const elite = (g.elite || []).filter((e) => e.me).length;
  let score = (r?.score ?? 5.5) * 1.2 + Math.min(4, Math.max(0, -worst) / 1500) + (close ? 1 : 0) + Math.min(2, elite * 0.35) + (g.kp || 0) * 2;
  if (r?.badge === "MVP") score += 1;
  return { score, worst, d15, d20, best20, comeback, close, rating: r || null, elite };
}

export function studyGames(prep, meta, { champ = null, limit = 5, perPlayer = 2 } = {}) {
  if (!prep) return [];
  const cands = [];
  for (const pl of prep.players) {
    for (const g of pl.games) {
      if (champ && g.champ !== champ) continue;
      const s = studyScore(g);
      if (s) cands.push({ g, player: pl, ...s });
    }
  }
  cands.sort((a, b) => b.score - a.score);
  // Segunda passada só nos melhores: o duelo de junglers (mais caro) entra na nota final.
  const top = cands.slice(0, 40).map((c) => {
    const duel = junglerDuel({ ...c.g, subject: shortName(c.player.riotId) }, prep.meta || meta, c.player.games);
    const net = duel ? duel.won.length - duel.lost.length : 0;
    return { ...c, duel, final: c.score + net * 0.45 };
  }).sort((a, b) => b.final - a.final);
  const out = [], per = {};
  for (const c of top) {
    if ((per[c.player.id] || 0) >= perPlayer) continue;
    per[c.player.id] = (per[c.player.id] || 0) + 1;
    out.push({ ...c, reasons: studyReasons(c) });
    if (out.length >= limit) break;
  }
  return out;
}

// Partidas de destaque: as melhores atuações recentes de cada jogador de referência (nota do jungler,
// vitória, ouro contra o jungler aos 10, objetivos e participação), no máximo uma por jogador.
export function highlightGames(players, { limit = 5, perPlayer = 1, recent = 12, days: maxDays = 14 } = {}) {
  const all = [];
  let now = 0;
  for (const pl of players || []) for (const g of pl.games) if ((g.start || 0) > now) now = g.start;
  // Só partidas recentes (últimos 14 dias da coleta); se faltar, vale qualquer data.
  const fresh = (g) => now - (g.start || 0) <= maxDays * 86400000;
  const enough = (players || []).filter((pl) => pl.games.some(fresh)).length >= Math.min(limit, (players || []).length) || perPlayer > 1;
  for (const pl of players || []) {
    const games = pl.games.filter((g) => g.hasTL && (g.duration || 0) >= 15 * 60 && (!enough || fresh(g))).sort((a, b) => b.start - a.start).slice(0, recent);
    for (const g of games) {
      const r = matchRatings(g)?.byPid.get(g.raw.me.pid) || null;
      const d10 = g.early?.diff10?.gold ?? null;
      const elite = (g.elite || []).filter((e) => e.me).length;
      const curve = teamCurve(g);
      const worst = curve.length ? Math.min(...curve.map((p) => p.d)) : 0;
      const days = Math.max(0, (now - g.start) / 86400000);
      const score = (r?.score ?? 5.5) * 1.3 + (g.win ? 2.5 : 0) + (r?.badge === "MVP" ? 1 : 0) + Math.min(2, elite * 0.35) + (g.kp || 0) * 1.5
        + (d10 != null ? Math.max(-1, Math.min(1.5, d10 / 1500)) : 0) + (g.win && worst <= -1500 ? 0.8 : 0) - Math.min(3, days * 0.25);
      all.push({ g, player: pl, score, rating: r, d10, elite, worst });
    }
  }
  const wins = all.filter((c) => c.g.win);
  const cands = (wins.length >= limit ? wins : all).sort((a, b) => b.score - a.score);
  const out = [], per = {};
  for (const c of cands) {
    if ((per[c.player.id] || 0) >= perPlayer) continue;
    per[c.player.id] = (per[c.player.id] || 0) + 1;
    out.push({ ...c, reasons: highlightReasons(c) });
    if (out.length >= limit) break;
  }
  return out;
}

function highlightReasons(c) {
  const out = [];
  if (c.rating?.score != null) out.push({ tone: "good", text: `Nota ${c.rating.score.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}${c.rating.badge ? ` · ${c.rating.badge}` : ` · ${c.rating.place}º lugar`}` });
  if (c.d10 != null && Math.abs(c.d10) >= 300) out.push(c.d10 > 0 ? { tone: "good", text: `+${fmtK(c.d10)} de ouro sobre o jungler aos 10` } : { tone: "warn", text: `${fmtK(c.d10)} de ouro atrás do jungler aos 10` });
  if (c.g.win && c.worst <= -1500) out.push({ tone: "warn", text: `Virada: o time chegou a ficar ${fmtK(c.worst)} atrás` });
  if (c.elite >= 3) out.push({ tone: "dim", text: `${c.elite} objetivos épicos` });
  if ((c.g.kp || 0) >= 0.65) out.push({ tone: "dim", text: `${Math.round(c.g.kp * 100)}% de participação nos abates` });
  return out.slice(0, 3);
}

export function shortName(riotId) { return String(riotId || "").split("#")[0].trim() || "Challenger"; }

function studyReasons(c) {
  const out = [];
  if (c.comeback) out.push({ tone: "warn", text: `Virada: o time chegou a ficar ${fmtK(c.worst)} atrás` });
  else if (c.close) out.push({ tone: "dim", text: `Equilibrada aos 20 (${c.d20 >= 0 ? "+" : "−"}${fmtK(c.d20)})` });
  if (c.rating?.score != null) out.push({ tone: "good", text: `Nota ${c.rating.score.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}${c.rating.badge ? ` · ${c.rating.badge}` : ` · ${c.rating.place}º lugar`}` });
  if (c.duel) out.push({ tone: "good", text: `Superou o jungler em ${c.duel.won.length} de ${c.duel.rows.length} pontos` });
  if (c.elite >= 4) out.push({ tone: "dim", text: `${c.elite} objetivos épicos` });
  return out;
}

// Rota dos dois junglers minuto a minuto (posição e farm) e os abates de cada um no início.
export function junglerPaths(g, upTo = 360) {
  const tl = g.raw?.timeline;
  if (!tl) return null;
  const pts = (rows) => (rows || []).filter((r) => r[0] <= upTo + 5 && r[7] != null).map((r) => ({ t: r[0], x: r[7], y: r[8], camps: (r[6] || 0) / 4 }));
  const me = pts(tl.me), opp = pts(tl.opp);
  const mePid = g.raw.me.pid, oppPid = g.raw.opp?.pid;
  const kills = (tl.kills || []).filter((k) => k[0] <= upTo && k[4] != null).map(([t, killer, victim, assists, x, y]) => ({ t, x, y, killer, victim, assists: assists || [],
    who: killer === mePid || (assists || []).includes(mePid) ? "me" : killer === oppPid || (assists || []).includes(oppPid) ? "opp" : victim === mePid ? "me-death" : victim === oppPid ? "opp-death" : null })).filter((k) => k.who);
  const ward = (tl.wards || []).find((w) => w[1] === 0 && w[2] !== "UNDEFINED" && w[0] <= upTo);
  const wardPos = ward ? approxPos(tl.me, ward[0]) : null;
  const oppWard = (tl.wards || []).find((w) => w[1] === 1 && w[2] !== "UNDEFINED" && w[0] <= upTo);
  return { me, opp, kills, ward: ward && wardPos ? { t: ward[0], ...wardPos } : null, oppWardT: oppWard ? oppWard[0] : null, upTo, events: routeEvents(g, upTo + 60) };
}

// Leitura da rota: o que os dados confirmam e o que é inferência.
export function routeReading(g, meta) {
  const p = habitProfile(g, meta);
  if (!p) return [];
  const V = g.subject || "Você";
  const oName = g.raw.opp ? champDisplay(meta, g.raw.opp.championName, g.raw.opp.championId) : "o jungler inimigo";
  const side = { top: "da top lane", bot: "da bot lane" };
  const lane = { top: "top lane", mid: "mid lane", bot: "bot lane" };
  const out = [];
  // Estratégias de início: as mesmas do Early Game, para os dois junglers
  const ep = earlyProfile(g), po = oppStrategy(g);
  const pa = ep ? { strat: ep.strat, prio: ep.prio, label: strategyLabel(strategyKey(ep)), startCamp: p.pathing?.startCamp } : null;
  const low = (t) => t.charAt(0).toLowerCase() + t.slice(1);
  if (pa?.label) out.push({ kind: "dado", text: `${g.subject ? `Estratégia do ${V}` : "Sua estratégia"}: ${low(pa.label)}${pa.startCamp ? ` (começou no ${pa.startCamp.name})` : ""}.` });
  if (po?.label) out.push({ kind: "dado", text: `Estratégia do ${oName}: ${low(po.label)}${po.startCamp ? ` (começou no ${po.startCamp.name})` : ""}.` });
  if (p.ward1 != null) out.push({ kind: "dado", text: p.ward1 ? `Colocou uma ward antes de 1:35 (${Math.floor(p.ward1T / 60)}:${String(Math.round(p.ward1T % 60)).padStart(2, "0")}).` : "Não colocou ward no nível 1." });
  if (p.firstTd) {
    const z = { top: "topo", mid: "meio", bot: "bot" }[p.firstTd.zone];
    out.push({ kind: "dado", text: `Primeiro abate em lane: ${z}, aos ${Math.floor(p.firstTd.t / 60)}:${String(Math.round(p.firstTd.t % 60)).padStart(2, "0")}.` });
  }
  if (p.oppAtGank && p.firstTd && p.firstTd.zone !== "mid") {
    const far = p.gankFar;
    out.push({ kind: "dado", text: `No minuto do gank, o ${oName} estava do lado ${side[p.oppAtGank.half]}${far ? ", longe da jogada" : ", perto da jogada"}.` });
    if (far) out.push({ kind: "leitura", text: `Leitura provável: gankou o lado oposto ao do ${oName}, sem risco de counter-gank. Se a ward ou o início do inimigo mostrou o lado dele, o gank foi planejado.` });
    else if (!(pa?.prio && po?.prio && pa.prio === po.prio)) out.push({ kind: "leitura", text: `Leitura provável: gank do mesmo lado do ${oName}, com risco de luta de 2 contra 2; costuma depender de a lane ter prioridade e do inimigo estar sem recursos.` });
  }
  if ((pa?.strat === "gank3" || pa?.strat === "ward3") && pa.prio && pa.prio !== "mid") out.push({ kind: "leitura", text: `Leitura provável: 3 campos e gank na ${lane[pa.prio]}, aceitando o risco de tomar invasão do outro lado da selva. Saber onde o ${oName} começou (ward, primeiro campo dele) reduz esse risco.` });
  if (pa?.strat === "fullGank" && pa.prio && pa.prio !== "mid") out.push({ kind: "leitura", text: `Leitura provável: full clear focado em gank, terminando perto da ${lane[pa.prio]} para chegar com nível e sem deixar campos para o inimigo roubar.` });
  if (pa?.strat === "fullFarm") out.push({ kind: "leitura", text: "Leitura provável: full clear focado em farm, priorizando nível, aronguejo e o primeiro item antes de gankar." });
  if (pa?.strat === "reset") out.push({ kind: "leitura", text: "Leitura provável: 3 campos e recall, para comprar cedo e fazer o outro lado da selva com item; o primeiro gank vem depois." });
  if (pa?.prio && po?.prio && pa.prio !== "mid" && po.prio !== "mid") {
    if (pa.prio === po.prio) out.push({ kind: "leitura", text: `Os dois deram prio para a ${lane[pa.prio]}: chance de counter-gank logo no primeiro turno.` });
    else out.push({ kind: "leitura", text: `Prios em lanes opostas (${lane[pa.prio]} × ${lane[po.prio]}): nenhum dos dois conseguia responder ao gank do outro; o normal é trocar pressão ou objetivo.` });
  }
  return out;
}

// Momentos que decidiram a partida: as maiores subidas do ouro do time em janelas de 2 minutos,
// com o que o jungler fez em cada uma.
export function decisiveMoments(g, meta, n = 3) {
  const curve = teamCurve(g);
  if (curve.length < 6) return [];
  const pid = g.raw.me.pid;
  const parts = new Map((g.participants || []).map((p) => [p.pid, p]));
  const name = (q) => { const p = parts.get(q); return p ? champDisplay(meta, p.championName, p.championId) : "?"; };
  const kills = g.raw.timeline.kills || [];
  const wins = [];
  for (let i = 2; i < curve.length; i++) {
    const a = curve[i - 2], b = curve[i];
    wins.push({ from: a.t, to: b.t, gain: b.d - a.d, before: a.d, after: b.d });
  }
  wins.sort((x, y) => (g.win ? y.gain - x.gain : x.gain - y.gain));
  const chosen = [];
  for (const w of wins) {
    if (chosen.some((c) => Math.abs(c.from - w.from) < 150)) continue;
    if (Math.abs(w.gain) < 800) break;
    const inW = (t) => t > w.from - 10 && t <= w.to;
    const ks = kills.filter((k) => inW(k[0]));
    const mine = ks.filter((k) => k[1] === pid || (k[3] || []).includes(pid));
    const myTeam = g.teamId;
    const teamK = ks.filter((k) => parts.get(k[2])?.teamId !== myTeam).length, teamD = ks.filter((k) => parts.get(k[2])?.teamId === myTeam).length;
    const el = (g.elite || []).filter((e) => inW(e.t));
    const bl = (g.buildings || []).filter((b) => inW(b.t));
    const what = [];
    if (teamK || teamD) what.push(`${teamK} × ${teamD} em abates`);
    const objCount = new Map();
    for (const e of el) {
      const k = `${OBJECTIVE_LABELS[objectiveType(e)] || e.type} ${e.mine ? "do time" : "do inimigo"}`;
      objCount.set(k, (objCount.get(k) || 0) + 1);
    }
    for (const [k, c] of objCount) what.push(`${c > 1 ? c + "× " : ""}${k}`);
    const towers = bl.filter((b) => b.byMyTeam).length, lost = bl.filter((b) => !b.byMyTeam).length;
    if (towers) what.push(`${towers} estrutura${towers > 1 ? "s" : ""} derrubada${towers > 1 ? "s" : ""}`);
    if (lost) what.push(`${lost} perdida${lost > 1 ? "s" : ""}`);
    const deaths = ks.filter((k) => k[2] === pid).length;
    const role = mine.length ? `participou de ${mine.length} abate${mine.length > 1 ? "s" : ""} (${[...new Set(mine.map((k) => name(k[2])))].join(", ")})` : el.some((e) => e.me) ? "fez o objetivo" : deaths ? "morreu na janela" : "não participou dos abates";
    const where = mine[0] ? mapRegion(mine[0][4], mine[0][5])?.zone : null;
    chosen.push({ ...w, what, role, where, involved: mine.length > 0 || el.some((e) => e.me) });
    if (chosen.length >= n) break;
  }
  return chosen.sort((a, b) => a.from - b.from);
}

export { halfOf };
