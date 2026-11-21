// ============================================================================
// Hábitos de jungle: rota inicial, ritmo por fase, prioridade de objetivos e de lado.
// Tudo sai da timeline da Riot: quadros de minuto em minuto (posição e farm de selva)
// e eventos (abates, objetivos, torres, placas e wards). Funções puras.
// ============================================================================
import { mean, startCampAt, pathingLabel } from "./engine.js";
const median = (v) => { const a = [...v].sort((x, y) => x - y); const n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : null; };
import { mapRegion } from "./match_report.js";
import { firstRecallMin } from "./challenger.js";

const F = { t: 0, gold: 1, level: 4, cs: 5, jcs: 6, x: 7, y: 8 };
const CAMP_CS = 4; // cada campo da selva vale 4 de farm
const LANES = new Set(["top", "mid", "bot"]);
const POS_ORDER = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

// Lado do mapa: acima da diagonal da base azul à base vermelha fica o lado do topo, para os dois times
// (a rota do topo é a de cima e da esquerda; a do bot, a de baixo e da direita).
export const halfOf = (x, y) => (x == null || y == null ? null : y > x ? "top" : "bot");

// Listas pequenas e editáveis de contexto de lane (a API não traz mobilidade nem estilo de suporte).
export const ENGAGE_SUPPORTS = ["Leona", "Nautilus", "Blitzcrank", "Thresh", "Rell", "Rakan", "Alistar", "Pyke", "Maokai", "Poppy", "Braum", "TahmKench", "Amumu", "Zac", "Taric"];
export const IMMOBILE_ADCS = ["Ashe", "Jhin", "MissFortune", "Varus", "Jinx", "Aphelios", "Sivir", "Caitlyn", "Senna", "Ziggs", "Swain", "Karthus", "Seraphine", "Smolder", "Mel", "Twitch", "KogMaw"];
export const CC_TOPS = ["Malphite", "Ornn", "Sion", "Shen", "Poppy", "Sejuani", "Maokai", "Cho'Gath", "Chogath", "Yasuo", "Renekton", "Sett", "Ambessa", "KSante", "Rell", "Zac", "Nautilus", "Leona", "Skarner", "Volibear", "Gragas", "Galio", "Jayce", "Rumble", "Kennen"];

// Pathing inicial de um jungler: primeiro campo, campos antes da primeira ida a uma lane (até 3:30)
// e a lane dessa primeira ida (abate, morte ou presença na lane no minuto, até os 10).
export function pathingFor(frames, rawKills, pid, team) {
  if (!frames || !frames.length) return null;
  const f1 = frameAt(frames, 1);
  const startCamp = f1 && f1[F.x] != null ? startCampAt(f1[F.x], f1[F.y], team) : null;
  const laneOf = (x, y) => { const z = mapRegion(x, y)?.zone; return LANES.has(z) ? z : null; };
  const ev = (rawKills || []).filter((k) => k[0] <= 600 && (k[1] === pid || k[2] === pid || (k[3] || []).includes(pid)) && laneOf(k[4], k[5]))
    .map((k) => ({ t: k[0], zone: laneOf(k[4], k[5]), kind: k[2] === pid ? "morte" : "abate" }));
  // presença só conta nas lanes laterais: atravessar a mid lane entre um campo e outro é normal
  const visit = frames.find((r) => r[F.t] >= 150 && r[F.t] <= 600 && ["top", "bot"].includes(laneOf(r[F.x], r[F.y])));
  if (visit) ev.push({ t: visit[F.t], zone: laneOf(visit[F.x], visit[F.y]), kind: "visita" });
  const first = ev.sort((a, b) => a.t - b.t)[0] || null;
  const clearEnd = Math.min(first ? first.t : 210, 210);
  const prev = [...frames].reverse().find((r) => r[F.t] <= clearEnd + 0.5);
  const campsBefore = prev && prev[F.t] >= 60 ? (prev[F.jcs] || 0) / CAMP_CS : null;
  const clear = campsBefore == null ? null : campsBefore <= 3 ? "ate3" : campsBefore < 6 ? "4a5" : "full";
  const prio = first ? first.zone : null;
  return { startCamp, campsBefore, clear, prio, first, key: clear ? `${clear}|${prio || "none"}` : null, label: pathingLabel(clear, prio), short: pathingLabel(clear, prio, true) };
}

function frameAt(rows, minute) { return (rows || []).find((r) => Math.round(r[F.t] / 60) === minute) || null; }
function jcsAt(rows, minute) { const r = frameAt(rows, minute); return r ? r[F.jcs] || 0 : null; }

// Janelas do "Ritmo por fase" (as três primeiras também entram nos hábitos para treinar)
export const PHASES = [[0, 600, "0–10"], [600, 900, "10–15"], [900, 1200, "15–20"], [1200, 1500, "20–25"], [1500, 1800, "25–30"]];

// ----------------------------------------------------------------------------
// Perfil de hábitos de uma partida (do ponto de vista do jungler dono da partida)
// ----------------------------------------------------------------------------
export function habitProfile(g, meta) {
  const tl = g?.raw?.timeline;
  const me = g?.raw?.me;
  if (!tl || !me || !(tl.me || []).length) return null;
  const pid = me.pid, team = me.teamId;
  const frames = tl.me;
  const kills = (tl.kills || []).map(([t, killer, victim, assists, x, y]) => ({ t, killer, victim, assists: assists || [], x, y }));
  const involved = (k) => k.killer === pid || k.assists.includes(pid) || k.victim === pid;
  const takedown = (k) => k.killer === pid || k.assists.includes(pid);
  const regionOf = (o) => mapRegion(o.x, o.y);

  // Início: onde estava ao 1:00 (antes dos campos nascerem) e ward no nível 1
  const f1 = frameAt(frames, 1);
  const r1 = f1 ? mapRegion(f1[F.x], f1[F.y]) : null;
  let start = null;
  if (r1) start = r1.zone === "jungle" && r1.side !== team ? "invade" : r1.zone === "river" ? "river" : halfOf(f1[F.x], f1[F.y], team);
  const wards = Array.isArray(tl.wards) ? tl.wards.filter((w) => w[1] === 0) : null;
  const ward1 = wards ? wards.some((w) => w[0] <= 95) : null;
  const ward1T = wards ? (wards.find((w) => w[0] <= 120)?.[0] ?? null) : null;
  // Momento (interpolado entre os quadros de minuto) em que o farm de selva passou de um valor
  const crossT = (cs) => {
    for (let i = 1; i < frames.length; i++) {
      const a = frames[i - 1], b = frames[i];
      if ((b[F.jcs] || 0) >= cs && (a[F.jcs] || 0) < cs) {
        const ja = a[F.jcs] || 0, jb = b[F.jcs] || 0;
        return a[F.t] + ((cs - ja) / Math.max(1, jb - ja)) * (b[F.t] - a[F.t]);
      }
      if (b[F.t] > 420) break;
    }
    return null;
  };

  // Campos por minuto e primeiro gank (abate, assistência ou morte numa lane até os 10 min)
  const camps = (m) => { const v = jcsAt(frames, m); return v == null ? null : v / CAMP_CS; };
  const laneEv = kills.filter((k) => involved(k) && k.t <= 600 && LANES.has(regionOf(k)?.zone)).sort((a, b) => a.t - b.t);
  const firstLane = laneEv[0] || null;
  const firstLaneTd = laneEv.find(takedown) || null;
  // primeira visita a uma lane pelos quadros de minuto (gank sem abate também aparece aqui)
  const visit = frames.find((r) => r[F.t] >= 150 && r[F.t] <= 600 && ["top", "bot"].includes(mapRegion(r[F.x], r[F.y])?.zone)) || null;
  const firstAction = [firstLane && { t: firstLane.t, zone: regionOf(firstLane).zone, kind: takedown(firstLane) ? "abate" : "morte" }, visit && { t: visit[F.t], zone: mapRegion(visit[F.x], visit[F.y]).zone, kind: "visita" }]
    .filter(Boolean).sort((a, b) => a.t - b.t)[0] || null;
  // Primeiro clear: farm de selva no último minuto antes da 1ª ida a uma lane, limitado a 3:30
  // (depois disso já é o segundo clear ou recall).
  const clearEnd = Math.min(firstAction ? firstAction.t : 210, 210);
  const campsBefore = (() => {
    const prev = [...frames].reverse().find((r) => r[F.t] <= clearEnd + 0.5);
    return prev && prev[F.t] >= 60 ? (prev[F.jcs] || 0) / CAMP_CS : null;
  })();
  const firstClear = campsBefore == null ? null : campsBefore <= 3 ? "ate3" : campsBefore < 6 ? "4a5" : "full";

  // Lado do mapa nos primeiros 8 minutos: quadros + abates (fora da base)
  const sidePts = [];
  for (const r of frames) { if (r[F.t] < 90 || r[F.t] > 480) continue; const z = mapRegion(r[F.x], r[F.y]); if (z && z.zone !== "base") sidePts.push(halfOf(r[F.x], r[F.y], team)); }
  for (const k of kills) { if (k.t > 480 || !involved(k)) continue; const z = regionOf(k); if (z && z.zone !== "base" && z.zone !== "mid") sidePts.push(halfOf(k.x, k.y, team), halfOf(k.x, k.y, team)); }
  const topShare = sidePts.length ? sidePts.filter((s) => s === "top").length / sidePts.length : null;
  const earlySide = topShare == null ? null : topShare >= 0.6 ? "top" : topShare <= 0.4 ? "bot" : "ambos";

  // Fases
  const phases = PHASES.map(([a, b, label]) => {
    if ((g.duration || 0) < b - 60) return { label, ok: false };
    const ja = a === 0 ? 0 : jcsAt(frames, a / 60), jb = jcsAt(frames, b / 60);
    const fr = frames.filter((r) => r[F.t] > a && r[F.t] <= b);
    const enemyJg = fr.filter((r) => { const z = mapRegion(r[F.x], r[F.y]); return z && z.zone === "jungle" && z.side !== team; }).length;
    const inWin = (t) => t > a && t <= b;
    const el = (g.elite || []).filter((e) => inWin(e.t));
    const bl = (tl.buildings || []).filter((x) => inWin(x[0]) && x[4] !== team);
    return {
      label, ok: true,
      camps: ja != null && jb != null ? (jb - ja) / CAMP_CS : null,
      laneTd: kills.filter((k) => inWin(k.t) && takedown(k) && LANES.has(regionOf(k)?.zone)).length,
      takedowns: kills.filter((k) => inWin(k.t) && takedown(k)).length,
      deaths: kills.filter((k) => inWin(k.t) && k.victim === pid).length,
      objectives: el.filter((e) => e.me).length,
      teamObjectives: el.filter((e) => e.mine).length,
      towers: Array.isArray(tl.plates) ? bl.filter((x) => x[5] === pid || (x[8] || []).includes(pid)).length : null,
      plates: Array.isArray(tl.plates) ? tl.plates.filter((p) => inWin(p[0]) && p[1] === pid).length : null,
      enemyJungle: fr.length ? enemyJg / fr.length : null,
    };
  });

  // Objetivos
  const mineEl = (g.elite || []).filter((e) => e.mine).sort((a, b) => a.t - b.t);
  const firstObj = (g.elite || []).filter((e) => e.mine && e.t <= 900).sort((a, b) => a.t - b.t)[0];
  const grubsTeam = mineEl.filter((e) => e.type === "HORDE").length;
  const grubsAll = (g.elite || []).filter((e) => e.type === "HORDE").length;
  const dragons20 = mineEl.filter((e) => e.type === "DRAGON" && e.t <= 1200).length;
  const dragonsAll20 = (g.elite || []).filter((e) => e.type === "DRAGON" && e.t <= 1200).length;

  // Contexto de lanes (para a prioridade de lado)
  const lanes = laneContext(g, meta);

  // Resultado da lane do primeiro gank aos 10 min (ouro do aliado contra o adversário da mesma posição)
  const prioZone = firstLaneTd ? regionOf(firstLaneTd).zone : firstAction ? firstAction.zone : null;
  const prio = prioZone ? laneOutcome(g, prioZone, 10, meta) : null;

  // Jungle tracking: onde estava o jungler inimigo a 1:00 e no 1º gank (posição do minuto mais próximo).
  const oppFrames = tl.opp || [];
  const near = (rows, t) => { let best = null, gap = Infinity; for (const r of rows) { const d = Math.abs(r[F.t] - t); if (d < gap) { gap = d; best = r; } } return best && gap <= 40 && best[F.x] != null ? best : null; };
  const o1 = frameAt(oppFrames, 1);
  const oppStart = o1 && o1[F.x] != null ? halfOf(o1[F.x], o1[F.y]) : null;
  let gankFar = null, oppAtGank = null;
  if (firstLaneTd && (regionOf(firstLaneTd).zone === "top" || regionOf(firstLaneTd).zone === "bot")) {
    const of = near(oppFrames, firstLaneTd.t);
    if (of) {
      oppAtGank = { half: halfOf(of[F.x], of[F.y]), dist: Math.hypot(of[F.x] - firstLaneTd.x, of[F.y] - firstLaneTd.y), t: of[F.t] };
      gankFar = oppAtGank.half !== regionOf(firstLaneTd).zone && oppAtGank.dist > 6000;
    }
  }
  const control15 = Array.isArray(tl.wards) ? tl.wards.filter((w) => w[1] === 0 && w[2] === "CONTROL_WARD" && w[0] <= 900).length : null;
  const oracle = (tl.items || []).find((e) => e[1] === "P" && e[2] === 3364);
  const oracleT = Array.isArray(tl.wards) ? (oracle ? oracle[0] : null) : null;

  return {
    id: g.id, win: !!g.win, team, start, ward1, ward1T, firstClear, campsBefore,
    tCamps3: crossT(3 * CAMP_CS), tCamps6: crossT(6 * CAMP_CS),
    camps2: camps(2), camps3: camps(3), camps4: camps(4),
    firstAction, firstTd: firstLaneTd ? { t: firstLaneTd.t, zone: regionOf(firstLaneTd).zone } : null,
    crab: me.challenges?.initialCrabCount ?? null,
    scuttles: me.challenges?.scuttleCrabKills ?? null,
    recall: firstRecallMin(g),
    topShare, earlySide, phases,
    firstObjective: firstObj ? firstObj.type : "nenhum",
    grubsTeam, grubsAll, dragons20, dragonsAll20,
    lanes, prioZone, prio,
    oppStart, oppAtGank, gankFar, control15, oracleT, hasOracle: Array.isArray(tl.wards) ? !!oracle : null,
    pathing: pathingFor(frames, tl.kills, pid, team),
    oppPathing: g.raw.opp ? pathingFor(oppFrames, tl.kills, g.raw.opp.pid, g.raw.opp.teamId) : null,
  };
}

function byPos(g, team) {
  const out = {};
  for (const p of g.participants || []) if (p.teamId === team && p.position) out[p.position] = p;
  return out;
}
const champName = (meta, p) => (p ? meta?.champions?.[String(p.championId)]?.name || p.championName : "—");

export function laneContext(g, meta) {
  const team = g.raw.me.teamId, foe = team === 100 ? 200 : 100;
  const a = byPos(g, team), b = byPos(g, foe);
  const tags = (p) => (p ? (meta?.champions?.[String(p.championId)]?.tags || []) : []);
  const key = (p) => p?.championName || "";
  const fighter = (p) => { const t = tags(p); return t[0] === "Fighter" || (t.includes("Fighter") && !t.includes("Tank")); };
  return {
    allyEngageSup: ENGAGE_SUPPORTS.includes(key(a.UTILITY)),
    enemyImmobileAdc: IMMOBILE_ADCS.includes(key(b.BOTTOM)),
    enemyEngageSup: ENGAGE_SUPPORTS.includes(key(b.UTILITY)),
    topDuel: fighter(a.TOP) && fighter(b.TOP),
    allyCcTop: CC_TOPS.includes(key(a.TOP)) || tags(a.TOP).includes("Tank"),
    enemyTankTop: tags(b.TOP).includes("Tank"),
    allyMidAssassin: tags(a.MIDDLE).includes("Assassin"),
    champs: Object.fromEntries(POS_ORDER.map((p) => [p, [champName(meta, a[p]), champName(meta, b[p])]])),
  };
}

// Ouro do seu jogador de uma lane contra o adversário da mesma posição, num minuto.
export function laneOutcome(g, zone, minute = 10, meta) {
  const pos = { top: "TOP", mid: "MIDDLE", bot: "BOTTOM" }[zone];
  if (!pos) return null;
  const team = g.raw.me.teamId;
  const ally = (g.participants || []).find((p) => p.teamId === team && p.position === pos);
  const foe = (g.participants || []).find((p) => p.teamId !== team && p.position === pos);
  const sup = zone === "bot" ? [(g.participants || []).find((p) => p.teamId === team && p.position === "UTILITY"), (g.participants || []).find((p) => p.teamId !== team && p.position === "UTILITY")] : null;
  if (!ally || !foe) return null;
  const snap = g.raw.timeline?.lanes?.[String(minute)];
  const goldOf = (p) => (snap ? snap.find((r) => r[0] === p.pid)?.[1] ?? null : null);
  const kills = g.raw.timeline?.kills || [];
  const deathsOf = (p) => (p ? kills.filter((k) => k[2] === p.pid && k[0] <= minute * 60).length : 0);
  const ga = goldOf(ally), gb = goldOf(foe);
  return {
    zone, minute, ally: champName(meta, ally), foe: champName(meta, foe),
    goldDiff: ga != null && gb != null ? ga - gb : null,
    allyDeaths: deathsOf(ally) + (sup ? deathsOf(sup[0]) : 0),
    foeDeaths: deathsOf(foe) + (sup ? deathsOf(sup[1]) : 0),
  };
}

// ----------------------------------------------------------------------------
// Resumo de um conjunto de partidas
// ----------------------------------------------------------------------------
const share = (list, pred) => (list.length ? list.filter(pred).length / list.length : null);
const wr = (list) => (list.length ? list.filter((p) => p.win).length / list.length : null);
const avg = (list, f) => { const v = list.map(f).filter((x) => x != null && Number.isFinite(x)); return v.length ? mean(v) : null; };
const med = (list, f) => { const v = list.map(f).filter((x) => x != null && Number.isFinite(x)); return v.length ? median(v) : null; };

export function distOf(profiles, f, keys) {
  const ps = profiles.filter(Boolean);
  const n = ps.length;
  return keys.map((k) => { const sub = ps.filter((p) => f(p) === k); return { key: k, n: sub.length, share: n ? sub.length / n : null, wr: wr(sub) }; });
}
export const START_CAMP_KEYS = ["blue", "red", "sapo", "lobos", "galinhas", "pedras", "rio", "invade"];

export function habitSummary(profiles) {
  const ps = profiles.filter(Boolean);
  const n = ps.length;
  const dist = (f, keys) => keys.map((k) => { const sub = ps.filter((p) => f(p) === k); return { key: k, n: sub.length, share: n ? sub.length / n : null, wr: wr(sub) }; });
  const known = (f) => ps.filter((p) => f(p) != null);
  const phases = PHASES.map(([, , label], i) => {
    const sub = ps.map((p) => p.phases[i]).filter((x) => x && x.ok);
    return {
      label, n: sub.length,
      camps: avg(sub, (x) => x.camps), laneTd: avg(sub, (x) => x.laneTd), takedowns: avg(sub, (x) => x.takedowns), deaths: avg(sub, (x) => x.deaths),
      objectives: avg(sub, (x) => x.objectives), towers: avg(sub, (x) => x.towers), plates: avg(sub, (x) => x.plates), enemyJungle: avg(sub, (x) => x.enemyJungle),
    };
  });
  return {
    n,
    start: dist((p) => p.start, ["top", "bot", "river", "invade"]),
    startCamp: dist((p) => p.pathing?.startCamp?.key || null, START_CAMP_KEYS),
    ward1: (() => { const k = known((p) => p.ward1); return k.length ? { n: k.length, share: share(k, (p) => p.ward1), wrYes: wr(k.filter((p) => p.ward1)), wrNo: wr(k.filter((p) => !p.ward1)) } : null; })(),
    camps3: avg(ps, (p) => p.camps3), camps4: avg(ps, (p) => p.camps4),
    firstClear: dist((p) => p.firstClear, ["ate3", "4a5", "full"]),
    firstGankT: med(ps, (p) => p.firstTd?.t), firstActionT: med(ps, (p) => p.firstAction?.t),
    firstGankSide: dist((p) => p.firstTd?.zone || null, ["top", "mid", "bot"]),
    crab: avg(ps, (p) => p.crab), recall: med(ps, (p) => p.recall),
    tCamps3: med(ps, (p) => p.tCamps3), tCamps6: med(ps, (p) => p.tCamps6), ward1T: med(ps, (p) => p.ward1T),
    gankFar: (() => { const k = ps.filter((p) => p.gankFar != null); return k.length ? { n: k.length, share: share(k, (p) => p.gankFar), wrYes: wr(k.filter((p) => p.gankFar)), wrNo: wr(k.filter((p) => !p.gankFar)) } : null; })(),
    control15: avg(ps, (p) => p.control15),
    oracleT: med(ps, (p) => p.oracleT), oracleShare: (() => { const k = ps.filter((p) => p.hasOracle != null); return k.length ? share(k, (p) => p.hasOracle) : null; })(),
    earlySide: dist((p) => p.earlySide, ["top", "ambos", "bot"]),
    phases,
    firstObjective: dist((p) => p.firstObjective, ["DRAGON", "HORDE", "RIFTHERALD", "nenhum"]),
    grubsTeam: avg(ps, (p) => p.grubsTeam), grubsShare: avg(ps.filter((p) => p.grubsAll > 0), (p) => p.grubsTeam / p.grubsAll),
    dragons20: avg(ps, (p) => p.dragons20), dragonsShare: avg(ps.filter((p) => p.dragonsAll20 > 0), (p) => p.dragons20 / p.dragonsAll20),
    prioAhead: (() => { const k = ps.filter((p) => p.prio && p.prio.goldDiff != null); return k.length ? { n: k.length, share: share(k, (p) => p.prio.goldDiff > 0), wrAhead: wr(k.filter((p) => p.prio.goldDiff > 0)), wrBehind: wr(k.filter((p) => p.prio.goldDiff <= 0)) } : null; })(),
  };
}

// Para onde vão primeiro (lado do 1º gank) em cada contexto de lane.
export const LANE_CONDITIONS = [
  { key: "allyEngageSup", label: "Seu suporte tem engage (Leona, Nautilus, Rell…)", hint: "bot com setup de gank" },
  { key: "enemyImmobileAdc", label: "Atirador inimigo com pouca mobilidade", hint: "alvo fácil no bot" },
  { key: "topDuel", label: "Top é duelo de lutadores", hint: "lane de snowball" },
  { key: "allyCcTop", label: "Seu top tem controle de grupo", hint: "top com setup de gank" },
  { key: "enemyTankTop", label: "Top inimigo é tanque", hint: "pouco retorno em gankar o top" },
  { key: "enemyEngageSup", label: "Suporte inimigo tem engage", hint: "bot inimigo pode punir seu gank" },
];

export function sidePriority(profiles) {
  const ps = profiles.filter((p) => p && p.firstTd && (p.firstTd.zone === "top" || p.firstTd.zone === "bot"));
  return LANE_CONDITIONS.map((c) => {
    const sub = ps.filter((p) => p.lanes[c.key]);
    const top = sub.filter((p) => p.firstTd.zone === "top"), bot = sub.filter((p) => p.firstTd.zone === "bot");
    return { ...c, n: sub.length, botShare: sub.length ? bot.length / sub.length : null, wrBot: wr(bot), wrTop: wr(top), nBot: bot.length, nTop: top.length };
  });
}

// Diferenças que mais pesam: viram "hábitos para treinar".
// Cada hábito comparado com os Challengers: status (no nível, perto, longe), gravidade e o que fazer.
const TIPS = {
  camps3: "Seu primeiro clear está mais lento. Vale treinar a rota de 6 campos (smite no campo certo, kiting) até fechar perto dos 3:00.",
  clear6: "Seu full clear fecha mais tarde que o deles. Vale treinar a rota de 6 campos, com smite no campo certo e kiting, até fechar perto dos 3:05.",
  firstGank: "Os Challengers chegam à primeira jogada um pouco antes. Vale olhar a lane já durante o clear para chegar quando ela tiver prioridade.",
  crab: "Disputar o aronguejo do lado em que o clear terminou dá rio e visão para o primeiro objetivo.",
  ward1: "Uma ward no nível 1 na entrada da selva inimiga mostra onde o jungler começou.",
  deaths010: "Antes dos 10 eles morrem menos. Recomendo entrar nas lutas sabendo onde o jungler inimigo está e com a lane pronta para seguir.",
  deaths1015: "Dos 10 aos 15 você morre mais. Depois do primeiro item, vale evitar entrar na selva inimiga sem visão e sem a lane do lado.",
  obj15: "Dos 10 aos 15 eles participam de mais objetivos. Depois do recall, vale planejar o próximo dragão ou vastilarva e chegar antes, com a lane do lado.",
  drag: "Eles ficam com mais dragões até os 20. Quando o bot tem prioridade, vale puxar o jogo para o lado do dragão.",
  grubs: "Eles ficam com mais vastilarvas. Quando o topo tem prioridade, vale fazer as vastilarvas logo que nascem.",
  enemyJg: "Eles passam mais tempo na selva inimiga dos 10 aos 15. Com as lanes à frente, vale invadir para negar campos.",
  camps1520: "Dos 15 aos 20 você farma menos. Entre um objetivo e outro, vale limpar os campos do seu lado para não ficar atrás em ouro.",
  plates: "Eles derrubam mais placas dos 10 aos 15. Depois de um gank que deu certo, vale ficar e ajudar a lane nas placas.",
  gankFar: "Eles dão o primeiro gank mais vezes no lado oposto ao do jungler inimigo. Vale olhar onde ele começou (ward no nível 1, farm dele, quem apareceu primeiro) e gankar do outro lado, sem risco de counter.",
  oracle: "Eles trocam o amuleto pela Lente do Oráculo bem antes. Vale trocar no primeiro ou segundo recall para limpar as wards antes dos objetivos e dos ganks.",
  control15: "Eles colocam mais sentinelas de controle até os 15. Vale comprar uma no primeiro recall e usar na entrada do próximo objetivo.",
  prio: "A lane do seu primeiro gank termina os 10 minutos atrás com mais frequência. Vale priorizar lanes com controle de grupo e voltar para cobrir depois do gank.",
};

export function habitChecks(me, ch) {
  if (!me || !ch || !me.n || !ch.n) return [];
  const n1 = (v) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const n2 = (v) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  const p0 = (v) => `${Math.round(v * 100)}%`;
  const clk = (v) => `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, "0")}`;
  const list = [
    ["camps3", "Campos aos 3:00", "campos no primeiro clear", me.camps3, ch.camps3, n1, "higher", 0.8],
    ["clear6", "Tempo do full clear", "até fechar 6 campos", me.tCamps6, ch.tCamps6, clk, "lower", 1],
    ["firstGank", "Primeira jogada numa lane", "1ª ida a uma lane", me.firstActionT, ch.firstActionT, clk, "lower", 0.6],
    ["crab", "Aronguejo no início", "aronguejos por partida", me.crab, ch.crab, n2, "higher", 0.8],
    ["ward1", "Ward no nível 1", "das partidas", me.ward1?.share, ch.ward1?.share, p0, "higher", 0.6],
    ["deaths010", "Mortes até os 10", "por partida", me.phases[0].deaths, ch.phases[0].deaths, n2, "lower", 1.1],
    ["deaths1015", "Mortes dos 10 aos 15", "por partida", me.phases[1].deaths, ch.phases[1].deaths, n2, "lower", 1],
    ["obj15", "Objetivos dos 10 aos 15", "objetivos épicos com você", me.phases[1].objectives, ch.phases[1].objectives, n2, "higher", 1],
    ["drag", "Dragões até os 20", "dos dragões da partida", me.dragonsShare, ch.dragonsShare, p0, "higher", 1],
    ["grubs", "Vastilarvas do seu time", "das vastilarvas da partida", me.grubsShare, ch.grubsShare, p0, "higher", 0.9],
    ["enemyJg", "Selva inimiga dos 10 aos 15", "dos minutos", me.phases[1].enemyJungle, ch.phases[1].enemyJungle, p0, "higher", 0.7],
    ["camps1520", "Farm dos 15 aos 20", "campos por partida", me.phases[2].camps, ch.phases[2].camps, n1, "higher", 0.8],
    ["plates", "Placas dos 10 aos 15", "placas por partida", me.phases[1].plates, ch.phases[1].plates, n2, "higher", 0.6],
    ["prio", "Lane do 1º gank à frente aos 10", "das partidas", me.prioAhead?.share, ch.prioAhead?.share, p0, "higher", 1],
    ["gankFar", "1º gank longe do jungler inimigo", "dos primeiros ganks no topo ou bot", me.gankFar?.share, ch.gankFar?.share, p0, "higher", 0.9],
    ["control15", "Sentinelas de controle até os 15", "por partida", me.control15, ch.control15, n2, "higher", 0.7],
    ["oracle", "Troca para a Lente do Oráculo", "mediana do minuto da troca", me.oracleT, ch.oracleT, clk, "lower", 0.7],
  ];
  return list.filter(([, , , a, b]) => a != null && b != null).map(([key, title, unit, a, b, fmt, better, weight]) => {
    const big = Math.max(Math.abs(a), Math.abs(b)) || 1;
    const rel = (a - b) / big; // positivo = você acima
    const good = better === "higher" ? rel : -rel; // positivo = você melhor
    const status = good >= -0.08 ? "nivel" : good >= -0.2 ? "perto" : "longe";
    const severity = good <= -0.25 ? "alta" : good <= -0.12 ? "media" : null;
    return { key, title, unit, me: a, ch: b, fmt, good, score: -good * weight, status, severity, tip: TIPS[key] };
  });
}

export function habitGaps(me, ch) {
  return habitChecks(me, ch).filter((c) => c.status !== "nivel").sort((a, b) => b.score - a.score).slice(0, 4);
}

// Pathings (campos antes da 1ª ida a uma lane + lane da prio) e a win rate de cada um.
export function startPatterns(profiles, minN = 5) {
  const ps = profiles.filter((p) => p && p.pathing && p.pathing.key);
  const map = new Map();
  for (const p of ps) {
    const k = p.pathing.key;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(p);
  }
  return [...map.entries()].map(([k, list]) => {
    const [clear, prio] = k.split("|");
    return { key: k, clear, prio: prio === "none" ? null : prio, label: pathingLabel(clear, prio === "none" ? null : prio), n: list.length, share: list.length / (ps.length || 1), wr: list.filter((p) => p.win).length / list.length };
  }).filter((x) => x.n >= minN);
}
