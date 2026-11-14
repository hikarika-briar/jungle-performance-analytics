// ============================================================================
// Early game: estratégia de início, cronograma de decisões e eventos padrão do jungler,
// partida a partida, para comparar você com os Challengers. Funções puras.
// Dados da Riot: quadros de minuto em minuto (posição, farm de selva, ouro, nível) e eventos
// com o segundo exato (abates, objetivos, compras, wards).
// ============================================================================
import { mean, lerpPos } from "./engine.js";
import { mapRegion } from "./match_report.js";
import { halfOf, pathingFor } from "./habits.js";

const F = { t: 0, gold: 1, cur: 2, xp: 3, level: 4, cs: 5, jcs: 6, x: 7, y: 8 };
const CAMP_CS = 4;
const LANES = ["top", "mid", "bot"];
// Tempos medidos nas partidas coletadas (patch 16): dragão aos 5:00 e a cada 5 min depois de abatido,
// vastilarvas aos 8:00 (uma leva de 3), arauto aos 15:00.
export const SPAWN = { dragon: 300, dragonRespawn: 300, grubs: 480, grubsEnd: 885, herald: 900 };

// Onde o jungler estava num quadro de minuto.
export const PLACE = {
  base: "Base", top: "Top lane", mid: "Mid lane", bot: "Bot lane", rio: "Rio",
  selvaTop: "Sua selva · lado do topo", selvaBot: "Sua selva · lado do bot", inimiga: "Selva inimiga",
};
export const PLACE_KEYS = ["selvaBot", "selvaTop", "rio", "inimiga", "top", "mid", "bot", "base"];
export function placeOf(x, y, team) {
  let r = mapRegion(x, y);
  if (!r) return null;
  // A faixa da mid lane encosta nos campos do meio: só conta como mid quem está perto da rota
  // (atravessar entre um campo e outro não é ida à lane).
  if (r.zone === "mid" && Math.abs(x - y) / Math.SQRT2 > 650) r = Math.abs(x + y - 14850) < 1500 ? { zone: "river" } : { zone: "jungle", side: x + y < 14850 ? 100 : 200 };
  if (r.zone === "base") return r.side === team ? "base" : "inimiga";
  if (r.zone === "jungle") return r.side === team ? (halfOf(x, y) === "top" ? "selvaTop" : "selvaBot") : "inimiga";
  if (r.zone === "river") return "rio";
  return r.zone;
}

// Estratégias de início. A ordem exata dos campos não aparece nos dados (posição só de minuto em
// minuto), então cada uma é definida pelo que dá para medir: campos antes da 1ª jogada numa lane,
// o momento dessa jogada, a ward do nível 1 e o que o jungler fez depois do clear.
export const STRATS = [
  { key: "fullGank", label: "Full clear focado em gank", short: "Full clear + gank", desc: "Faz os 6 campos e já vai para uma lane, antes do primeiro recall." },
  { key: "fullFarm", label: "Full clear focado em farm", short: "Full clear + farm", desc: "Faz os 6 campos e segue para aronguejo, recall ou mais farm. O primeiro gank vem depois." },
  { key: "reset", label: "3 campos e recall", short: "3 campos + recall", desc: "Faz um lado da selva, volta à base antes dos 3:20 para comprar e depois faz o outro lado." },
  { key: "gank3", label: "3 campos e gank", short: "3 campos + gank", desc: "Até 3 campos e uma jogada numa lane antes dos 3:10." },
  { key: "ward3", label: "Ward na selva inimiga + 3 campos e gank", short: "Ward inimiga + 3 campos", desc: "Ward no nível 1 dentro da selva inimiga, até 3 campos e gank antes dos 3:10." },
  { key: "parcial", label: "4 a 5 campos e gank", short: "4–5 campos + gank", desc: "Para o clear no meio para gankar ou disputar o rio." },
  { key: "lvl2", label: "Gank nível 2", short: "Gank nível 2", desc: "1 ou 2 campos e uma lane antes dos 2:15." },
  { key: "invade", label: "Invade nível 1", short: "Invade nível 1", desc: "Começa roubando um campo da selva inimiga." },
  { key: "outro", label: "Início interrompido", short: "Interrompido", desc: "Morte, recall cedo ou clear lento: não fechou um padrão até os 4:00." },
];
export const STRAT_LABEL = Object.fromEntries(STRATS.map((s) => [s.key, s.label]));
export const STRAT_SHORT = Object.fromEntries(STRATS.map((s) => [s.key, s.short]));

export const NEXT = { aronguejo: "Aronguejo", base: "Recall", morte: "Morreu", farm: "Volta a farmar", invade: "Invade", lane: "Fica na lane", outraLane: "Outra lane", objetivo: "Objetivo", nada: "Sem registro" };
export const NEXT_KEYS = ["aronguejo", "farm", "base", "outraLane", "lane", "invade", "objetivo", "morte"];
export const CLEAR_NEXT = { lane: "Gank", aronguejo: "Aronguejo", base: "Recall", farm: "Segue farmando", invade: "Invade", objetivo: "Objetivo", morte: "Morreu" };
export const CLEAR_NEXT_KEYS = ["lane", "aronguejo", "base", "farm", "invade", "objetivo", "morte"];
export const AFTER = { gankDireto: "Gank direto", farmGank: "Campos e depois gank", objetivo: "Objetivo", invade: "Invade", farm: "Só farm" };
export const AFTER_KEYS = ["gankDireto", "farmGank", "objetivo", "invade", "farm"];
const OBJ_NAME = { DRAGON: "Dragão", HORDE: "Vastilarvas", RIFTHERALD: "Arauto" };

const frameAtMin = (rows, m) => (rows || []).find((r) => Math.round(r[F.t] / 60) === m) || null;
const floorFrame = (rows, t) => { let best = null; for (const r of rows) if (r[F.t] <= t + 0.5) best = r; return best; };
const ceilFrame = (rows, t) => rows.find((r) => r[F.t] >= t - 0.5) || null;
// Campos feitos até um instante: o farm do quadro anterior mais o que dá tempo de fazer até ali
// (cerca de 16 s por campo), limitado ao farm do quadro seguinte.
function campsAt(rows, t) {
  const a = floorFrame(rows, t), b = ceilFrame(rows, t);
  if (!a) return null;
  const ja = a[F.jcs] || 0;
  if (!b || b === a) return ja / CAMP_CS;
  const room = ja + CAMP_CS * Math.floor((t - a[F.t]) / 16);
  return Math.min(b[F.jcs] || 0, room) / CAMP_CS;
}
function crossT(rows, cs, until = 480) {
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    if (a[F.t] > until) break;
    const ja = a[F.jcs] || 0, jb = b[F.jcs] || 0;
    if (jb >= cs && ja < cs) return a[F.t] + ((cs - ja) / Math.max(1, jb - ja)) * (b[F.t] - a[F.t]);
  }
  return null;
}

// Idas à base: grupos de compras (a compra só acontece na base). Morte nos 75 s antes = volta por morte.
export function baseVisits(tl, pid) {
  const buys = (tl.items || []).filter((e) => e[1] === "P" && e[0] > 100).map((e) => e[0]).sort((a, b) => a - b);
  const deaths = (tl.kills || []).filter((k) => k[2] === pid).map((k) => k[0]);
  const out = [];
  for (const t of buys) {
    if (out.length && t - out[out.length - 1].end < 45) { out[out.length - 1].end = t; continue; }
    out.push({ t, end: t, kind: deaths.some((d) => d < t && t - d < 75) ? "morte" : "recall" });
  }
  return out;
}

// Ações numa lane: abate, assistência ou morte numa lane; presença no topo ou no bot pelo quadro.
function laneActions(frames, kills, pid, team, from, to) {
  const out = [];
  for (const k of kills) {
    if (k[0] <= from || k[0] > to) continue;
    const inv = k[1] === pid || k[2] === pid || (k[3] || []).includes(pid);
    if (!inv) continue;
    const z = mapRegion(k[4], k[5])?.zone;
    if (LANES.includes(z)) out.push({ t: k[0], lane: z, kind: k[2] === pid ? "morte" : "abate", x: k[4], y: k[5] });
  }
  for (const r of frames) {
    if (r[F.t] <= from || r[F.t] > to) continue;
    const p = placeOf(r[F.x], r[F.y], team);
    if (p === "top" || p === "bot") out.push({ t: r[F.t], lane: p, kind: "visita", x: r[F.x], y: r[F.y] });
  }
  return out.sort((a, b) => a.t - b.t);
}

// Disponibilidade de objetivos num instante (para "abate que virou objetivo").
function dragonUp(elite, t) {
  if (t < SPAWN.dragon) return false;
  const last = elite.filter((e) => e.type === "DRAGON" && e.t <= t).sort((a, b) => b.t - a.t)[0];
  return !last || t >= last.t + SPAWN.dragonRespawn;
}
function grubsUp(elite, t) {
  return t >= SPAWN.grubs && t < SPAWN.grubsEnd && !elite.some((e) => e.type === "HORDE" && e.t <= t);
}

// Estratégia de início de um jungler: o mesmo critério para você, para os Challengers e para o
// jungler inimigo (que só tem posição e abates, sem compras: o recall sai do quadro na base).
function classifyStart({ frames, kills, pid, team, visits, ward1Place, startCamp, p2 }) {
  const recall1 = visits[0] || null;
  const acts = laneActions(frames, kills, pid, team, 90, 600);
  const first = acts[0] || null;
  const firstResult = first ? (acts.some((a) => a.kind === "abate" && a.t >= first.t - 1 && a.t <= first.t + 30) ? "abate" : acts.some((a) => a.kind === "morte" && a.t >= first.t - 1 && a.t <= first.t + 30) ? "morte" : "sem") : null;
  const campsFirst = first ? campsAt(frames, first.t) : null;
  const t3 = crossT(frames, 3 * CAMP_CS), t6 = crossT(frames, 6 * CAMP_CS);
  const before = (t) => !recall1 || t < recall1.t;
  // Recall antes de qualquer lane e com no máximo 4 campos: reset de meia selva
  const campsRecall = recall1 ? campsAt(frames, recall1.t - 10) : null;
  const earlyReset = recall1 && recall1.kind === "recall" && recall1.t <= 200 && campsRecall != null && campsRecall <= 4.25 && (!first || first.t > recall1.t);
  let strat;
  if (startCamp === "invade" && p2 === "inimiga") strat = "invade";
  else if (earlyReset) strat = "reset";
  else if (first && first.t <= 135 && campsFirst != null && campsFirst <= 2.25 && before(first.t)) strat = "lvl2";
  else if (first && first.t <= 190 && campsFirst != null && campsFirst <= 3.25 && before(first.t)) strat = ward1Place === "inimiga" ? "ward3" : "gank3";
  else if (first && first.t <= 225 && campsFirst != null && campsFirst < 5.75 && before(first.t)) strat = "parcial";
  else if (t6 != null && t6 <= 240) strat = first && first.t <= Math.max(t6, 170) + 70 && first.t <= 300 && before(first.t) ? "fullGank" : "fullFarm";
  else strat = "outro";
  const prio = first && (strat !== "fullFarm" && strat !== "outro") ? first.lane : null;
  return { acts, first, firstResult, campsFirst, t3, t6, strat, prio };
}

// Estratégia do jungler inimigo numa partida sua (aproximada: recall pelo quadro na base).
export function oppStrategy(g) {
  const tl = g?.raw?.timeline, o = g?.raw?.opp;
  if (!tl || !o || !(tl.opp || []).length) return null;
  const frames = tl.opp, kills = tl.kills || [], pid = o.pid, team = o.teamId;
  const visits = frameVisits(frames, kills, pid, team);
  const f1 = frameAtMin(frames, 1), f2 = frameAtMin(frames, 2);
  const p1 = f1 ? placeOf(f1[F.x], f1[F.y], team) : null, p2 = f2 ? placeOf(f2[F.x], f2[F.y], team) : null;
  const w1 = (tl.wards || []).find((w) => w[1] === 1 && w[0] <= 100);
  const ward1Place = w1 ? (p1 === "inimiga" ? "inimiga" : p1 === "rio" ? "rio" : "propria") : null;
  const path = pathingFor(frames, kills, pid, team);
  const c = classifyStart({ frames, kills, pid, team, visits, ward1Place, startCamp: path?.startCamp?.key || null, p2 });
  const key = c.prio ? `${c.strat}|${c.prio}` : c.strat;
  return { ...c, key, label: strategyLabel(key), startCamp: path?.startCamp || null };
}

// Idas à base pelo quadro (para quem não tem compras na timeline, como o jungler inimigo).
function frameVisits(frames, kills, pid, team) {
  const deaths = kills.filter((k) => k[2] === pid).map((k) => k[0]);
  const visits = [];
  for (const r of frames) {
    if (r[F.t] < 110 || placeOf(r[F.x], r[F.y], team) !== "base") continue;
    const t = r[F.t] - 20;
    if (visits.length && t - visits[visits.length - 1].t < 70) continue;
    visits.push({ t, end: t, kind: deaths.some((d) => d < r[F.t] && r[F.t] - d < 75) ? "morte" : "recall" });
  }
  return visits;
}

// Ritmo do início de cada jungler, com tempo e lugar: onde começou, quando fechou os campos,
// a 1ª jogada numa lane e a 1ª ida à base. Para o mapa "Rota dos dois junglers".
const FOUNTAIN = { 100: { x: 560, y: 560 }, 200: { x: 14250, y: 14300 } };
const LANE_PT = { top: "top", mid: "mid", bot: "bot" };
export function routeEvents(g, upTo = 420) {
  const tl = g?.raw?.timeline;
  if (!tl) return null;
  const out = { me: [], opp: [] };
  const sides = [["me", g.raw.me, tl.me, true], ["opp", g.raw.opp, tl.opp, false]];
  for (const [who, p, frames, mine] of sides) {
    if (!p || !(frames || []).length) continue;
    const pid = p.pid, team = p.teamId, kills = tl.kills || [];
    const path = pathingFor(frames, kills, pid, team);
    const visits = mine ? baseVisits(tl, pid) : frameVisits(frames, kills, pid, team);
    const c = classifyStart({ frames, kills, pid, team, visits, ward1Place: null, startCamp: path?.startCamp?.key || null, p2: null });
    const list = [];
    const f1 = frameAtMin(frames, 1);
    if (f1 && f1[F.x] != null) list.push({ k: "start", t: 60, x: f1[F.x], y: f1[F.y], label: path?.startCamp?.name ? `no ${path.startCamp.name}` : "início" });
    const clearT = c.t6 != null && c.t6 <= upTo ? c.t6 : null;
    if (clearT != null) { const q = lerpPos(frames, clearT); if (q) list.push({ k: "clear", t: clearT, ...q, label: "6 campos" }); }
    else if (c.t3 != null && c.t3 <= upTo) { const q = lerpPos(frames, c.t3); if (q) list.push({ k: "clear", t: c.t3, ...q, label: "3 campos" }); }
    if (c.first && c.first.t <= upTo) {
      const res = c.firstResult === "abate" ? " com abate" : c.firstResult === "morte" ? " e morreu" : "";
      list.push({ k: "first", t: c.first.t, x: c.first.x, y: c.first.y, label: `${c.first.kind === "visita" ? "na" : "gank"} ${LANE_PT[c.first.lane] || c.first.lane}${res}` });
    }
    const r1 = visits[0];
    if (r1 && r1.t <= upTo + 60) list.push({ k: "recall", t: r1.t, ...FOUNTAIN[team], label: r1.kind === "morte" ? "base (depois de morrer)" : "1º recall" });
    out[who] = list.sort((a, b) => a.t - b.t);
  }
  return out;
}

// ----------------------------------------------------------------------------
// Perfil de early game de uma partida (ponto de vista do jungler dono da partida)
// ----------------------------------------------------------------------------
const CACHE = new WeakMap();
export function earlyProfile(g) {
  if (g && CACHE.has(g)) return CACHE.get(g);
  const p = buildProfile(g);
  if (g) CACHE.set(g, p);
  return p;
}
function buildProfile(g) {
  const tl = g?.raw?.timeline;
  const me = g?.raw?.me;
  if (!tl || !me || !(tl.me || []).length || (g.duration || 0) < 600) return null;
  const pid = me.pid, team = me.teamId;
  const frames = tl.me;
  const kills = tl.kills || [];
  const elite = (g.elite || []).slice().sort((a, b) => a.t - b.t);
  const opp = tl.opp || [];
  const path = pathingFor(frames, kills, pid, team);
  const visits = baseVisits(tl, pid);
  const recall1 = visits[0] || null, recall2 = visits[1] || null;

  // Ward do nível 1 e onde ela caiu (pela posição a 1:00, o quadro mais perto)
  const myWards = (tl.wards || []).filter((w) => w[1] === 0).sort((a, b) => a[0] - b[0]);
  const ward1 = myWards.find((w) => w[0] <= 100) || null;
  const f1 = frameAtMin(frames, 1), f2 = frameAtMin(frames, 2);
  const p1 = f1 ? placeOf(f1[F.x], f1[F.y], team) : null;
  const p2 = f2 ? placeOf(f2[F.x], f2[F.y], team) : null;
  const ward1Place = ward1 ? (p1 === "inimiga" ? "inimiga" : p1 === "rio" ? "rio" : "propria") : null;
  const startSide = p1 === "selvaTop" ? "top" : p1 === "selvaBot" ? "bot" : p1 === "rio" ? "rio" : p1 === "inimiga" ? "inimiga" : null;
  const startCamp = path?.startCamp?.key || null;
  const startType = ["blue", "red"].includes(startCamp) ? "buff" : ["sapo", "lobos", "galinhas", "pedras"].includes(startCamp) ? "pequeno" : startCamp;

  const { acts, first, firstResult, campsFirst, t3, t6, strat, prio } = classifyStart({ frames, kills, pid, team, visits, ward1Place, startCamp, p2 });

  // O que fez em seguida, a partir de um instante (até ~100 s): o primeiro que aparecer.
  const gotCrab = (me.challenges?.initialCrabCount ?? 1) >= 1;
  const stepAfter = (t0, t1, lane) => {
    const cand = [];
    const v = visits.find((b) => b.t > t0 && b.t <= t1);
    if (v) cand.push({ t: v.t, k: v.kind === "morte" ? "morte" : "base" });
    const ob = elite.find((e) => e.mine && e.t > t0 && e.t <= t1);
    if (ob) cand.push({ t: ob.t, k: "objetivo" });
    const death = kills.find((k) => k[2] === pid && k[0] > t0 + 3 && k[0] <= t1);
    // depois do clear, uma morte numa lane é um gank que deu errado: conta como gank
    if (death && (lane || !acts.some((a) => a.kind === "morte" && a.t === death[0]))) cand.push({ t: death[0], k: "morte" });
    for (let i = 1; i < frames.length; i++) {
      const a = frames[i - 1], b = frames[i];
      if (b[F.t] <= t0 + 5 || b[F.t] > t1 + 30) continue;
      const pl = placeOf(b[F.x], b[F.y], team), gain = (b[F.jcs] || 0) - (a[F.jcs] || 0);
      const t = Math.max(t0 + 1, b[F.t] - 25);
      // aronguejo: farm de um campo (4 a 8) com o jungler no rio no minuto ou no minuto anterior
      const nearRiver = pl === "rio" || placeOf(a[F.x], a[F.y], team) === "rio";
      if (nearRiver && gain >= CAMP_CS && gain <= 2 * CAMP_CS && gotCrab && b[F.t] >= 200 && b[F.t] <= 360) cand.push({ t, k: "aronguejo" });
      else if (pl === "inimiga") cand.push({ t, k: "invade" });
      else if ((pl === "selvaTop" || pl === "selvaBot") && gain >= CAMP_CS) cand.push({ t, k: "farm" });
      else if (LANES.includes(pl)) {
        // na mesma lane do gank, só conta como "fica na lane" quem ainda está lá 45 s depois
        if (!lane) cand.push({ t: b[F.t], k: "lane" });
        else if (pl !== lane) cand.push({ t: b[F.t], k: "outraLane" });
        else if (b[F.t] - t0 >= 45) cand.push({ t: b[F.t], k: "lane" });
      }
      else if (pl === "base") cand.push({ t: b[F.t], k: "base" });
    }
    for (const a of acts) {
      if (a.t > t1) continue;
      if (lane && a.kind === "morte") continue; // morte já entra acima
      if (lane && a.t > t0 + 20 && a.lane !== lane) cand.push({ t: a.t, k: "outraLane" });
      else if (!lane && a.t > t0) cand.push({ t: a.t, k: "lane" });
    }
    cand.sort((a, b) => a.t - b.t);
    return cand[0]?.k || "nada";
  };
  // Logo depois da 1ª jogada numa lane e logo depois dos 6 campos
  const next = first ? stepAfter(first.t, first.t + 100, first.lane) : null;
  const afterClear = t6 != null && t6 <= 240 && (!first || first.t > t6 - 5) ? stepAfter(t6 - 5, t6 + 80, null) : null;

  // Depois do 1º recall (até 3 min): gank direto, campos e gank, objetivo, invade ou só farm
  let after = null;
  if (recall1 && recall1.t < 720) {
    const t0 = recall1.end, t1 = t0 + 180;
    const la = laneActions(frames, kills, pid, team, t0 + 15, t1)[0] || null;
    const ob = elite.find((e) => e.mine && e.t > t0 && e.t <= t1) || null;
    const inv = frames.find((r) => r[F.t] > t0 && r[F.t] <= t1 && placeOf(r[F.x], r[F.y], team) === "inimiga") || null;
    const start = ceilFrame(frames, t0 + 20);
    const ev = [la && { t: la.t, k: "lane" }, ob && { t: ob.t, k: "objetivo" }, inv && { t: inv[F.t], k: "invade" }].filter(Boolean).sort((a, b) => a.t - b.t)[0];
    const campsTo = (t) => { const c = campsAt(frames, t); return start && c != null ? Math.max(0, c - (start[F.jcs] || 0) / CAMP_CS) : null; };
    if (!ev) after = { k: "farm", t: null };
    else if (ev.k === "objetivo") after = { k: "objetivo", t: ob.t, obj: ob.type };
    else if (ev.k === "invade") after = { k: "invade", t: inv[F.t] };
    else {
      const c = campsTo(la.t);
      const won = laneActions(frames, kills, pid, team, la.t - 1, la.t + 30).some((a) => a.kind === "abate");
      after = { k: c != null && c >= 1.5 ? "farmGank" : "gankDireto", t: la.t, lane: la.lane, camps: c, kill: won };
    }
  }

  // Abate que vira objetivo: primeiro abate seu com o objetivo vivo em cada janela
  const conv = [];
  const seen = new Set();
  for (const k of kills) {
    const t = k[0];
    if (t < SPAWN.dragon || t > 840) continue;
    if (!(k[1] === pid || (k[3] || []).includes(pid))) continue;
    const z = mapRegion(k[4], k[5]);
    if (!z || z.zone === "base" || z.zone === "mid") continue;
    const side = halfOf(k[4], k[5]);
    if (side === "bot" && dragonUp(elite, t)) {
      const cycle = `D${elite.filter((e) => e.type === "DRAGON" && e.t <= t).length}`;
      if (seen.has(cycle)) continue; seen.add(cycle);
      const d = elite.find((e) => e.type === "DRAGON" && e.t > t && e.t <= t + 90);
      conv.push({ obj: "DRAGON", t, got: !!(d && d.mine), lost: !!(d && !d.mine) });
    } else if (side === "top" && grubsUp(elite, t)) {
      if (seen.has("H")) continue; seen.add("H");
      const d = elite.find((e) => e.type === "HORDE" && e.t > t && e.t <= t + 90);
      conv.push({ obj: "HORDE", t, got: !!(d && d.mine), lost: !!(d && !d.mine) });
    }
  }

  // Eventos padrão
  const oracle = (tl.items || []).find((e) => e[1] === "P" && (e[2] === 3364 || e[2] === 3363));
  const control = myWards.find((w) => w[2] === "CONTROL_WARD");
  const lvl6 = frames.find((r) => (r[F.level] || 0) >= 6);
  const lvl6T = lvl6 ? (() => { const i = frames.indexOf(lvl6); const a = frames[i - 1]; return a ? a[F.t] + 30 : lvl6[F.t]; })() : null;
  const firstKill = acts.find((a) => a.kind === "abate") || null;
  const drag1 = elite.find((e) => e.type === "DRAGON" && e.mine), grubs1 = elite.find((e) => e.type === "HORDE" && e.mine);
  const goldAt = (rows, m) => { const r = frameAtMin(rows, m); return r ? r[F.gold] : null; };
  const gd = (m) => { const a = goldAt(frames, m), b = goldAt(opp, m); return a != null && b != null ? a - b : null; };
  const deaths = (t) => kills.filter((k) => k[2] === pid && k[0] <= t).length;
  // Minuto a minuto (1 a 10): onde estava
  const minutes = [];
  for (let m = 1; m <= 10; m++) { const r = frameAtMin(frames, m); minutes.push(r ? placeOf(r[F.x], r[F.y], team) : null); }
  const gankLanes8 = acts.filter((a) => a.t <= 480 && a.kind !== "visita").length;
  const pts = [];
  for (let m = 1; m <= 10; m++) { const r = frameAtMin(frames, m); if (r && r[F.x] != null) pts.push([m, r[F.x], r[F.y]]); }

  return {
    id: g.id, win: !!g.win, team, champ: g.champ,
    strat, prio, startSide, startCamp, startType,
    ward1T: ward1 ? ward1[0] : null, ward1Place, hasWard1: Array.isArray(tl.wards) ? !!ward1 : null,
    firstWardT: myWards[0]?.[0] ?? null,
    t3, t6, first: first ? { t: first.t, lane: first.lane, kind: first.kind } : null, firstResult, campsFirst,
    next, afterClear, after,
    recall1: recall1 ? recall1.t : null, recall1Kind: recall1?.kind || null, recall2: recall2 ? recall2.t : null,
    conv,
    oracleT: oracle ? oracle[0] : null, controlT: control ? control[0] : null,
    lvl6T, firstKillT: firstKill ? firstKill.t : null,
    crab: me.challenges?.initialCrabCount ?? null,
    drag1T: drag1 ? drag1.t : null, grubs1T: grubs1 ? grubs1.t : null,
    gd5: gd(5), gd8: gd(8), gd10: gd(10),
    deaths6: deaths(360), deaths10: deaths(600),
    minutes, gankLanes8, pts,
  };
}

// ----------------------------------------------------------------------------
// Resumos
// ----------------------------------------------------------------------------
const wr = (list) => (list.length ? list.filter((p) => p.win).length / list.length : null);
const sorted = (v) => v.filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b);
export function quant(v, p) { const a = sorted(v); if (!a.length) return null; const i = (a.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return a[lo] + (a[hi] - a[lo]) * (i - lo); }
const band = (v) => { const a = sorted(v); return a.length ? { n: a.length, p25: quant(a, 0.25), p50: quant(a, 0.5), p75: quant(a, 0.75) } : null; };
export function dist(list, f, keys) {
  const n = list.filter((p) => f(p) != null).length;
  return keys.map((k) => { const sub = list.filter((p) => f(p) === k); return { key: k, n: sub.length, share: n ? sub.length / n : null, wr: wr(sub) }; });
}
const share = (list, pred) => (list.length ? list.filter(pred).length / list.length : null);
const avg = (list, f) => { const v = list.map(f).filter((x) => x != null && Number.isFinite(x)); return v.length ? mean(v) : null; };

export const strategyKey = (p) => (p.prio ? `${p.strat}|${p.prio}` : p.strat);
export function strategyLabel(key) {
  const [s, prio] = key.split("|");
  return prio ? `${STRAT_LABEL[s]} com prio para a ${prio} lane` : STRAT_LABEL[s];
}

// Estratégias (com a lane da prio) e a win rate de cada uma.
export function strategyTable(list, minN = 1) {
  const map = new Map();
  const add = (k, p) => { if (!map.has(k)) map.set(k, []); map.get(k).push(p); };
  for (const p of list) { add(p.strat, p); if (p.prio) add(strategyKey(p), p); }
  const n = list.length || 1;
  return [...map.entries()].map(([key, sub]) => ({ key, strat: key.split("|")[0], prio: key.split("|")[1] || null, label: strategyLabel(key), n: sub.length, share: sub.length / n, wr: wr(sub) }))
    .filter((x) => x.n >= minN);
}

// Resumo de um conjunto de partidas (todas ou só as de uma estratégia)
export function earlySummary(list) {
  const ps = list.filter(Boolean);
  const firsts = ps.filter((p) => p.first);
  const convD = ps.flatMap((p) => p.conv.filter((c) => c.obj === "DRAGON"));
  const convH = ps.flatMap((p) => p.conv.filter((c) => c.obj === "HORDE"));
  const firstConv = (obj) => { const k = ps.map((p) => ({ p, c: p.conv.find((c) => c.obj === obj) })).filter((x) => x.c); return { yes: wr(k.filter((x) => x.c.got).map((x) => x.p)), no: wr(k.filter((x) => !x.c.got).map((x) => x.p)), nYes: k.filter((x) => x.c.got).length, nNo: k.filter((x) => !x.c.got).length }; };
  const withWard = ps.filter((p) => p.hasWard1 != null);
  return {
    n: ps.length, wr: wr(ps),
    strat: dist(ps, (p) => p.strat, STRATS.map((s) => s.key)),
    startSide: dist(ps, (p) => p.startSide, ["bot", "top", "rio", "inimiga"]),
    startType: dist(ps, (p) => p.startType, ["buff", "pequeno", "rio", "invade"]),
    startCamp: dist(ps, (p) => p.startCamp, ["red", "blue", "galinhas", "pedras", "sapo", "lobos", "rio", "invade"]),
    ward1: withWard.length ? share(withWard, (p) => p.hasWard1) : null,
    ward1Deep: withWard.length ? share(withWard, (p) => p.ward1Place === "inimiga") : null,
    ward1T: band(ps.map((p) => p.ward1T)), firstWardT: band(ps.map((p) => p.firstWardT)),
    t3: band(ps.map((p) => p.t3)), t6: band(ps.map((p) => p.t6)),
    firstT: band(firsts.map((p) => p.first.t)),
    firstLane: dist(firsts, (p) => p.first.lane, LANES),
    firstResult: dist(firsts, (p) => p.firstResult, ["abate", "sem", "morte"]),
    next: dist(firsts, (p) => p.next, NEXT_KEYS),
    gankDeath: share(firsts, (p) => p.firstResult === "morte" || p.next === "morte"),
    afterClear: dist(ps.filter((p) => p.afterClear), (p) => p.afterClear, CLEAR_NEXT_KEYS),
    recall1: band(ps.map((p) => p.recall1)), recall2: band(ps.map((p) => p.recall2)),
    recallDeath: share(ps.filter((p) => p.recall1Kind), (p) => p.recall1Kind === "morte"),
    after: dist(ps.filter((p) => p.after), (p) => p.after.k, AFTER_KEYS),
    afterLane: dist(ps.filter((p) => p.after && (p.after.k === "gankDireto" || p.after.k === "farmGank")), (p) => p.after.lane, LANES),
    afterKill: share(ps.filter((p) => p.after && p.after.lane), (p) => p.after.kill),
    afterT: band(ps.filter((p) => p.after?.t != null).map((p) => p.after.t)),
    afterObj: dist(ps.filter((p) => p.after?.k === "objetivo"), (p) => p.after.obj, ["DRAGON", "HORDE", "RIFTHERALD"]),
    convDragon: convD.length ? { n: convD.length, got: convD.filter((c) => c.got).length / convD.length, lost: convD.filter((c) => c.lost).length / convD.length, ...firstConv("DRAGON") } : null,
    convGrubs: convH.length ? { n: convH.length, got: convH.filter((c) => c.got).length / convH.length, lost: convH.filter((c) => c.lost).length / convH.length, ...firstConv("HORDE") } : null,
    oracleT: band(ps.map((p) => p.oracleT)), oracleBy10: share(ps, (p) => p.oracleT != null && p.oracleT <= 600),
    controlT: band(ps.map((p) => p.controlT)), controlBy10: share(ps, (p) => p.controlT != null && p.controlT <= 600),
    lvl6T: band(ps.map((p) => p.lvl6T)), firstKillT: band(ps.map((p) => p.firstKillT)),
    drag1T: band(ps.map((p) => p.drag1T)), grubs1T: band(ps.map((p) => p.grubs1T)),
    crab: avg(ps, (p) => p.crab), crabShare: share(ps.filter((p) => p.crab != null), (p) => p.crab >= 1),
    gd5: avg(ps, (p) => p.gd5), gd8: avg(ps, (p) => p.gd8), gd10: avg(ps, (p) => p.gd10),
    ahead8: share(ps.filter((p) => p.gd8 != null), (p) => p.gd8 > 0),
    deaths6: avg(ps, (p) => p.deaths6), deaths10: avg(ps, (p) => p.deaths10),
    gankLanes8: avg(ps, (p) => p.gankLanes8),
    minutes: Array.from({ length: 10 }, (_, i) => dist(ps.filter((p) => p.minutes[i]), (p) => p.minutes[i], PLACE_KEYS)),
  };
}

// Estratégia dos Challengers que mais ganha (com amostra mínima).
export function bestStrategy(chal, minN = 40) {
  const rows = strategyTable(chal, minN).filter((r) => r.strat !== "outro");
  const withPrio = rows.filter((r) => r.prio);
  return (withPrio.length ? withPrio : rows).sort((a, b) => b.wr - a.wr || b.n - a.n)[0] || null;
}
export function filterStrategy(list, key) {
  if (!key || key === "ALL") return list;
  const [s, prio] = key.split("|");
  return list.filter((p) => p.strat === s && (!prio || p.prio === prio));
}

// ----------------------------------------------------------------------------
// Comparação de eventos (pontos críticos do topo da página)
// ----------------------------------------------------------------------------
const TIPS = {
  deepWard: "Uma ward no nível 1 dentro da selva inimiga (no campo em que o jungler dele costuma começar) mostra o lado do início dele e define para onde gankar sem risco.",
  clear6: "Seu full clear fecha depois do deles. Vale treinar a rota de 6 campos com smite no campo certo para chegar na lane ou no aronguejo antes do jungler inimigo.",
  firstKill: "O primeiro gank deles termina em abate com mais frequência. Vale escolher a lane com controle de grupo ou com o inimigo empurrado, e chegar pelo lado oposto ao jungler inimigo.",
  firstDeath: "Você morre mais no primeiro gank ou logo depois dele. Depois do gank, vale sair pela sua selva ou pelo rio com visão em vez de ficar na lane ou seguir para outra briga com pouca vida.",
  crab: "Eles pegam o aronguejo do lado em que o clear terminou. Depois do full clear ou do gank, vale passar no rio antes do recall.",
  oracle: "Eles trocam o amuleto pela Lente do Oráculo bem antes. Vale trocar no primeiro ou segundo recall para limpar as wards antes do dragão e dos ganks.",
  control: "Eles colocam uma sentinela de controle antes dos 10 com mais frequência. Vale comprar uma no primeiro recall e usar no rio do próximo objetivo.",
  dragConv: "Depois de um abate no lado do bot com o dragão vivo, eles fazem o dragão mais vezes. Abate no bot é o momento de puxar o time para o dragão.",
  grubConv: "Depois de um abate no lado do topo com as vastilarvas vivas, eles fazem as vastilarvas mais vezes.",
  gold8: "Aos 8 minutos eles estão à frente do jungler inimigo com mais frequência. O ouro vem de farm mais rápido, aronguejo e ganks que dão abate.",
  deaths6: "Você morre mais nos primeiros 6 minutos. No início, vale evitar lutas na selva inimiga sem saber onde ele está.",
  lvl6: "Eles chegam ao nível 6 antes. Farm de selva contínuo entre os ganks acelera o nível.",
};
export function earlyChecks(me, ch) {
  if (!me?.n || !ch?.n) return [];
  const p0 = (v) => `${Math.round(v * 100)}%`;
  const clk = (v) => `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, "0")}`;
  const n2 = (v) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  const gold = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.round(Math.abs(v)).toLocaleString("pt-BR")}`;
  const sh = (d, k) => d.find((x) => x.key === k)?.share ?? null;
  // [chave, título, unidade, você, Challengers, formato, melhor, tolerância "no nível", tolerância "perto", peso]
  const list = [
    ["deepWard", "Ward nível 1 na selva inimiga", "das partidas", me.ward1Deep, ch.ward1Deep, p0, "higher", 0.04, 0.12, 0.8],
    ["clear6", "Full clear", "mediana do tempo dos 6 campos", me.t6?.p50, ch.t6?.p50, clk, "lower", 6, 18, 1],
    ["firstKill", "1º gank com abate", "dos primeiros ganks", sh(me.firstResult, "abate"), sh(ch.firstResult, "abate"), p0, "higher", 0.04, 0.1, 1],
    ["firstDeath", "Morte no 1º gank ou logo depois", "até 1 min e 40 s depois do gank", me.gankDeath, ch.gankDeath, p0, "lower", 0.03, 0.08, 0.9],
    ["crab", "Aronguejo no início", "das partidas", me.crabShare, ch.crabShare, p0, "higher", 0.05, 0.12, 0.7],
    ["oracle", "Troca para a Lente do Oráculo", "mediana do minuto da troca", me.oracleT?.p50, ch.oracleT?.p50, clk, "lower", 45, 150, 0.7],
    ["control", "Sentinela de controle até os 10", "das partidas", me.controlBy10, ch.controlBy10, p0, "higher", 0.05, 0.15, 0.8],
    ["dragConv", "Abate no bot vira dragão", "dos abates com dragão vivo", me.convDragon?.got, ch.convDragon?.got, p0, "higher", 0.04, 0.1, 1],
    ["grubConv", "Abate no topo vira vastilarvas", "dos abates com vastilarvas vivas", me.convGrubs?.got, ch.convGrubs?.got, p0, "higher", 0.04, 0.1, 0.8],
    ["gold8", "Ouro × jungler inimigo aos 8", "média da diferença", me.gd8, ch.gd8, gold, "higher", 60, 200, 1],
    ["deaths6", "Mortes até os 6", "por partida", me.deaths6, ch.deaths6, n2, "lower", 0.05, 0.15, 0.9],
    ["lvl6", "Nível 6", "mediana do tempo", me.lvl6T?.p50, ch.lvl6T?.p50, clk, "lower", 10, 30, 0.6],
  ];
  return list.filter(([, , , a, b]) => a != null && b != null).map(([key, title, unit, a, b, fmt, better, tolA, tolB, weight]) => {
    const diff = better === "higher" ? a - b : b - a; // positivo = você melhor
    const status = diff >= -tolA ? "nivel" : diff >= -tolB ? "perto" : "longe";
    const severity = diff < -tolB * 1.6 ? "alta" : diff < -tolB ? "media" : null;
    return { key, title, unit, me: a, ch: b, fmt, good: diff / tolB, score: (-diff / tolB) * weight, status, severity, tip: TIPS[key] };
  });
}
