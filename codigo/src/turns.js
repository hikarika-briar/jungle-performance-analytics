// ============================================================================
// Turnos de uma partida. Um turno vai do início da partida (ou da saída da base / do
// renascimento) até o recall ou a morte. Para cada turno: o que rendeu (campos, ouro,
// abates, objetivos, ouro sobre o jungler inimigo) e como terminou.
// Funções puras (os testes rodam no Node).
// ============================================================================
import { baseVisits, placeOf } from "./early.js";
import { mapRegion } from "./match_report.js";

const F = { t: 0, gold: 1, cur: 2, xp: 3, level: 4, cs: 5, jcs: 6, x: 7, y: 8 };
const CAMP_CS = 4;
const FOUNTAIN = { 100: { x: 560, y: 560 }, 200: { x: 14250, y: 14300 } };
// Tempo base de renascimento por nível (antes do aumento do fim de jogo)
const BRW = [10, 10, 12, 12, 14, 16, 20, 25, 28, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50, 52.5];
export function respawnTime(level, t) {
  const base = BRW[Math.max(1, Math.min(18, level || 1)) - 1];
  const m = t / 60;
  const factor = m <= 15 ? 1 : 1 + Math.min(0.5, (m - 15) * 0.0283);
  return base * factor;
}

// Valor de uma coluna da linha do tempo num instante (linear entre os registros de minuto)
export function frameAt(rows, t, col) {
  if (!rows || !rows.length) return null;
  let a = null, b = null;
  for (const r of rows) { if (r[F.t] <= t) a = r; else { b = r; break; } }
  if (!a) return b ? b[col] ?? null : null;
  if (!b || a[col] == null || b[col] == null) return a[col] ?? null;
  const k = (t - a[F.t]) / Math.max(1, b[F.t] - a[F.t]);
  return a[col] + (b[col] - a[col]) * k;
}

const ZONE = { top: "top", mid: "mid", bot: "bot", rio: "rio", selvaTop: "selva", selvaBot: "selva", inimiga: "selva inimiga", base: "base" };
const LANE_TXT = { top: "top", mid: "mid", bot: "bot" };
const fmtK = (v) => `${(Math.abs(v) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
const clock = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, "0")}`;

// Fins de turno: mortes e recalls (compras na base que não vêm depois de uma morte; ou o jogador
// visto na base sem ter morrido). Devolve a lista de turnos.
export function gameTurns(g, meta) {
  const tl = g?.raw?.timeline;
  const me = g?.raw?.me;
  if (!tl || !me || !(tl.me || []).length) return [];
  const pid = me.pid, team = me.teamId;
  const frames = tl.me, opp = tl.opp || [];
  const oppPid = g.raw.opp?.pid ?? null;
  const kills = (tl.kills || []).slice().sort((a, b) => a[0] - b[0]);
  const dur = g.duration || (frames[frames.length - 1]?.[F.t] ?? 0);
  const visits = baseVisits(tl, pid);
  const deaths = kills.filter((k) => k[2] === pid);
  const items = (tl.items || []).slice().sort((a, b) => a[0] - b[0]);
  const part = (p) => (g.participants || []).find((x) => x.pid === p) || null;

  // Fins: mortes, recalls por compra e idas à base vistas no registro de minuto (sem compra)
  const ends = deaths.map((k) => ({ t: k[0], kind: "morte", k }));
  for (const v of visits) if (v.kind === "recall") ends.push({ t: v.t, kind: "recall", visit: v });
  for (const r of frames) {
    if (r[F.t] < 120 || placeOf(r[F.x], r[F.y], team) !== "base") continue;
    const t = r[F.t] - 15;
    const near = ends.some((e) => Math.abs(e.t - t) < 75) || deaths.some((k) => k[0] < r[F.t] && r[F.t] - k[0] < 90) || visits.some((v) => Math.abs(v.t - r[F.t]) < 75);
    if (!near) ends.push({ t, kind: "recall", visit: null, seen: true });
  }
  ends.sort((a, b) => a.t - b.t);

  const out = [];
  let start = 0, startFrom = "inicio", lastEnd = 0;
  const push = (end, kind, info) => {
    // recall logo depois de sair da base não vira turno; morte sempre vira (mesmo curta)
    if (end - start < 15 && kind === "recall") { start = Math.max(start, end); return; }
    out.push(buildTurn({ g, meta, frames, opp, kills, items, pid, oppPid, team, part, start, end, kind, info, startFrom, idx: out.length + 1 }));
    lastEnd = end;
  };
  for (const e of ends) {
    if (e.t >= dur - 2) break;
    if (e.kind === "morte" && e.t <= start + 1) start = Math.max(lastEnd + 1, e.t - 10); // a saída estimada passou da morte
    else if (e.t <= start + 1) continue;
    if (e.kind === "morte") {
      push(e.t, "morte", { k: e.k });
      const lvl = Math.round(frameAt(frames, e.t, F.level) || 1);
      const back = e.t + respawnTime(lvl, e.t);
      const v = visits.find((x) => x.t >= e.t && x.t <= back + 45);
      start = Math.max(back, v ? v.end + 2 : back);
      startFrom = "renascer";
    } else {
      push(e.t, "recall", { visit: e.visit, seen: !!e.seen });
      start = (e.visit ? e.visit.end : e.t + 10) + 2;
      startFrom = "base";
    }
  }
  if (dur - start >= 15) push(dur, "fim", {});
  return out;
}

function buildTurn({ g, meta, frames, opp, kills, items, pid, oppPid, team, part, start, end, kind, info, startFrom, idx }) {
  const inT = (t) => t > start && t <= end + 0.5;
  const val = (col, t) => frameAt(frames, t, col);
  const gold0 = val(F.gold, start), gold1 = val(F.gold, end);
  const jcs0 = val(F.jcs, start), jcs1 = val(F.jcs, end);
  const cs0 = val(F.cs, start), cs1 = val(F.cs, end);
  const lv0 = val(F.level, start), lv1 = val(F.level, end);
  const og0 = frameAt(opp, start, F.gold), og1 = frameAt(opp, end, F.gold);
  const gvj = gold0 != null && gold1 != null && og0 != null && og1 != null ? (gold1 - og1) - (gold0 - og0) : null;
  const myK = kills.filter((k) => inT(k[0]) && k[1] === pid);
  const myA = kills.filter((k) => inT(k[0]) && k[1] !== pid && (k[3] || []).includes(pid));
  const elite = (g.elite || []).filter((e) => inT(e.t));
  const objMine = elite.filter((e) => e.mine), objEnemy = elite.filter((e) => !e.mine);
  const towers = (g.buildings || []).filter((b) => inT(b.t) && b.byMyTeam && b.type !== "INHIBITOR_BUILDING").length;
  // Lanes onde jogou (abate, assistência ou morte numa lane)
  const lanes = new Set();
  for (const k of kills) {
    if (!inT(k[0]) || !(k[1] === pid || k[2] === pid || (k[3] || []).includes(pid))) continue;
    const z = mapRegion(k[4], k[5])?.zone;
    if (LANE_TXT[z]) lanes.add(LANE_TXT[z]);
  }
  // Rota: os registros de minuto dentro do turno, com o começo (base ou campo) e o fim
  const path = [];
  const fpos = FOUNTAIN[team];
  if (startFrom !== "inicio") path.push({ t: start, x: fpos.x, y: fpos.y, base: true });
  for (const r of frames) if (r[F.t] > start && r[F.t] < end && r[F.x] != null) path.push({ t: r[F.t], x: r[F.x], y: r[F.y], m: Math.round(r[F.t] / 60) });
  const zones = [...new Set(path.filter((p) => !p.base).map((p) => ZONE[placeOf(p.x, p.y, team)]).filter((z) => z && z !== "base"))];

  const turn = {
    i: idx, start, end, dur: end - start, kind, startFrom,
    camps: jcs0 != null && jcs1 != null ? Math.max(0, (jcs1 - jcs0) / CAMP_CS) : null,
    cs: cs0 != null && cs1 != null ? Math.max(0, cs1 - cs0) : null,
    gold: gold0 != null && gold1 != null ? Math.max(0, gold1 - gold0) : null,
    gvj, level: [lv0 != null ? Math.floor(lv0) : null, lv1 != null ? Math.floor(lv1 + 0.001) : null],
    kills: myK.length, assists: myA.length,
    objMine: objMine.map((e) => ({ t: e.t, type: e.type, sub: e.sub || null, me: !!e.me })), objEnemy: objEnemy.map((e) => ({ t: e.t, type: e.type, sub: e.sub || null })),
    towers, lanes: [...lanes], zones, path,
  };

  if (kind === "morte") {
    const k = info.k;
    const killer = part(k[1]);
    const enemies = 1 + (k[3] || []).length;
    const zone = placeOf(k[4], k[5], team);
    const jg = oppPid != null && (k[1] === oppPid || (k[3] || []).includes(oppPid));
    // Troca: abates do seu time nos 15 s em volta da morte
    const myTeamPids = new Set((g.participants || []).filter((p) => p.teamId === team).map((p) => p.pid));
    const traded = kills.filter((x) => Math.abs(x[0] - k[0]) <= 15 && myTeamPids.has(x[1]) && x[2] !== pid).length;
    const lostAfter = (g.elite || []).filter((e) => !e.mine && e.t > k[0] && e.t <= k[0] + 60);
    turn.death = { t: k[0], x: k[4], y: k[5], killer: killer ? { champ: killer.championName, champId: killer.championId } : null, enemies, zone: ZONE[zone] || null, jg, traded, lostAfter: lostAfter.map((e) => ({ t: e.t, type: e.type, sub: e.sub || null })) };
    turn.endPos = { x: k[4], y: k[5] };
    if (k[4] != null && k[5] != null) turn.path.push({ t: k[0], x: k[4], y: k[5], death: true });
  } else if (kind === "recall") {
    const v = info.visit;
    const buys = v ? items.filter((e) => e[0] >= v.t - 0.5 && e[0] <= v.end + 0.5) : [];
    const P = buys.filter((e) => e[1] === "P"), D = buys.filter((e) => e[1] === "D"), U = buys.filter((e) => e[1] === "U");
    const cost = (id) => meta?.items?.[String(id)]?.gold ?? 0;
    const spent = Math.max(0, P.reduce((s, e) => s + cost(e[2]), 0) - D.filter((d) => P.some((p) => Math.abs(p[0] - d[0]) < 1.2)).reduce((s, e) => s + cost(e[2]), 0) - U.reduce((s, e) => s + cost(e[2]), 0));
    const bought = [...new Set(P.map((e) => e[2]))].filter((id) => !U.some((u) => u[2] === id)).sort((a, b) => cost(b) - cost(a));
    turn.recall = { t: v ? v.t : end, spent: v ? spent : null, bought, seen: !!info.seen };
    turn.endPos = { ...FOUNTAIN[team] };
  }
  turn.reading = readTurn(turn, meta);
  return turn;
}

const OBJ = { DRAGON: "dragão", HORDE: "vastilarvas", RIFTHERALD: "Arauto", BARON_NASHOR: "Barão", ATAKHAN: "Atakhan" };
const objTxt = (list) => { const c = {}; for (const o of list) { const k = OBJ[o.type] || "objetivo"; c[k] = (c[k] || 0) + 1; } return Object.entries(c).map(([k, n]) => (n > 1 ? `${n}× ${k}` : k)).join(", "); };

// Leitura do turno: nota simples (o que rendeu menos o que custou) e uma frase.
export function readTurn(t) {
  let score = t.kills * 1 + t.assists * 0.6 + t.objMine.filter((o) => o.me).length * 1.2 + t.objMine.filter((o) => !o.me).length * 0.4 + t.towers * 0.4 + (t.camps || 0) * 0.12;
  if (t.gvj != null) score += Math.max(-2, Math.min(2, t.gvj / 600));
  const good = [], bad = [];
  if (t.kills || t.assists) good.push(`${t.kills ? `${t.kills} abate${t.kills > 1 ? "s" : ""}` : ""}${t.kills && t.assists ? " e " : ""}${t.assists ? `${t.assists} assistência${t.assists > 1 ? "s" : ""}` : ""}`);
  if (t.objMine.length) good.push(objTxt(t.objMine));
  if (t.towers) good.push(`${t.towers} torre${t.towers > 1 ? "s" : ""}`);
  if (t.camps >= 2) good.push(`${Math.round(t.camps)} campos`);
  if (t.gvj != null && Math.abs(t.gvj) >= 250) (t.gvj > 0 ? good : bad).push(`${t.gvj > 0 ? "+" : "−"}${fmtK(t.gvj)} de ouro ${t.gvj > 0 ? "sobre" : "para"} o jungler`);
  if (t.objEnemy.length) { bad.push(`${objTxt(t.objEnemy)} do inimigo`); score -= 0.6 * t.objEnemy.length; }
  let endTxt = "";
  if (t.kind === "morte") {
    const d = t.death;
    score -= 2;
    if (!d.traded) score -= 0.8;
    if (d.lostAfter.length) score -= 1;
    endTxt = `Morreu${d.zone ? ` (${d.zone})` : ""}${d.enemies > 1 ? ` para ${d.enemies} inimigos` : ""}${d.jg ? ", com o jungler inimigo na jogada" : ""}${d.traded ? `; o time trocou ${d.traded} abate${d.traded > 1 ? "s" : ""}` : "; sem troca"}${d.lostAfter.length ? `; ${objTxt(d.lostAfter)} do inimigo logo depois` : ""}.`;
  } else if (t.kind === "recall") {
    const r = t.recall;
    if (r.spent != null && r.spent >= 1100) score += 0.5;
    if (r.spent != null && r.spent < 500 && t.dur > 150) score -= 0.4;
    endTxt = r.seen ? "Voltou à base." : `Recall${r.spent != null ? ` gastando ${fmtK(r.spent)} de ouro` : ""}.`;
  } else endTxt = "Fim da partida.";
  const tone = score >= 1.5 ? "good" : score <= -1 ? "bad" : "neutral";
  const lead = tone === "good" ? "Turno produtivo" : tone === "bad" ? "Turno caro" : "Turno equilibrado";
  return { score, tone, lead, good, bad, endTxt, text: `${lead}: ${good.length ? good.join(", ") : "pouco rendimento"}${bad.length ? `; ${bad.join(", ")}` : ""}. ${endTxt}` };
}

export function turnLabel(t) {
  return `${clock(t.start)}–${clock(t.end)}`;
}
