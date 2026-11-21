// ============================================================================
// JUNGLE PERFORMANCE ANALYTICS — motor de análise (funções puras)
// Camadas: dados brutos (arquivo do coletor) -> partidas normalizadas (Game)
//          -> métricas -> (a interface desenha) -> recomendações.
// Nada aqui depende do navegador; os testes rodam no Node.
// ============================================================================

export const SCHEMA = "jungle-performance-analytics";

export const QUEUE_NAMES = {
  420: "Ranqueada Solo/Duo", 440: "Ranqueada Flex", 400: "Normal (Escolha)",
  430: "Normal (às cegas)", 480: "Swiftplay", 490: "Partida Rápida", 700: "Clash",
  450: "ARAM", 1700: "Arena", 1710: "Arena", 1740: "Arena", 1750: "Arena", 900: "URF",
};
export const NORMAL_QUEUES = [400, 430, 480, 490];

// Posições fixas no Summoner's Rift (coordenadas da API da Riot). Servem quando o coletor
// não gravou a posição do evento (versões até a 1.6 guardavam só a posição dos abates).
export const OBJECTIVE_PITS = { DRAGON: [9866, 4414], BARON_NASHOR: [5007, 10471], RIFTHERALD: [5007, 10471], HORDE: [5007, 10471] };
export const BUILDING_SPOTS = {
  100: {
    TOP_LANE: { OUTER_TURRET: [981, 10441], INNER_TURRET: [1512, 6699], BASE_TURRET: [1169, 4287], INHIB: [1171, 3571] },
    MID_LANE: { OUTER_TURRET: [5846, 6396], INNER_TURRET: [5048, 4812], BASE_TURRET: [3651, 3696], INHIB: [3203, 3208] },
    BOT_LANE: { OUTER_TURRET: [10504, 1029], INNER_TURRET: [6919, 1483], BASE_TURRET: [4281, 1253], INHIB: [3452, 1236] },
    NEXUS: [[1748, 2270], [2177, 1807]],
  },
  200: {
    TOP_LANE: { OUTER_TURRET: [4318, 13875], INNER_TURRET: [7943, 13411], BASE_TURRET: [10481, 13650], INHIB: [11261, 13676] },
    MID_LANE: { OUTER_TURRET: [8955, 8510], INNER_TURRET: [9767, 10113], BASE_TURRET: [11134, 11207], INHIB: [11598, 11667] },
    BOT_LANE: { OUTER_TURRET: [13866, 4505], INNER_TURRET: [13327, 8226], BASE_TURRET: [13624, 10572], INHIB: [13604, 11316] },
    NEXUS: [[12611, 13084], [13052, 12612]],
  },
};

export const CLASS_LABELS = {
  Assassin: "Assassinos", Fighter: "Lutadores", Tank: "Tanques", Mage: "Magos",
  Marksman: "Atiradores", Support: "Suportes", HighCC: "Alto controle de grupo",
};
// Lista manual (não vem da Riot) de junglers com muito controle de grupo.
// Pode ser corrigida pelo usuário na aba Matchups.
export const DEFAULT_HIGH_CC = [
  "Amumu", "Sejuani", "Zac", "Maokai", "Rammus", "JarvanIV", "Nunu", "Skarner",
  "Poppy", "Vi", "Rell", "Ivern", "Lillia", "Warwick", "Fiddlesticks", "Nautilus",
  "Volibear", "Hecarim", "Gragas", "Zyra", "Elise", "Morgana",
];

// ----------------------------------------------------------------------------
// Estatística básica
// ----------------------------------------------------------------------------

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

export function mean(values) {
  const v = values.filter(isNum);
  if (!v.length) return null;
  return v.reduce((s, x) => s + x, 0) / v.length;
}

export function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function describe(values) {
  const v = values.filter(isNum).sort((a, b) => a - b);
  const n = v.length;
  if (!n) return { n: 0, mean: null, median: null, sd: null, p10: null, p25: null, p75: null, p90: null, min: null, max: null, cv: null };
  const m = v.reduce((s, x) => s + x, 0) / n;
  const sd = n > 1 ? Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1)) : null;
  return {
    n, mean: m, median: quantile(v, 0.5), sd,
    p10: quantile(v, 0.1), p25: quantile(v, 0.25), p75: quantile(v, 0.75), p90: quantile(v, 0.9),
    min: v[0], max: v[n - 1], cv: sd != null && m ? sd / Math.abs(m) : null,
  };
}

export function wilson(x, n, z = 1.96) {
  if (!n) return null;
  const p = x / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

// Intervalo de Newcombe (híbrido de Wilson) para diferença de proporções
export function proportionDiff(x1, n1, x2, n2) {
  if (!n1 || !n2) return null;
  const p1 = x1 / n1, p2 = x2 / n2;
  const [l1, u1] = wilson(x1, n1);
  const [l2, u2] = wilson(x2, n2);
  const d = p1 - p2;
  return {
    diff: d,
    ci: [d - Math.sqrt((p1 - l1) ** 2 + (u2 - p2) ** 2), d + Math.sqrt((u1 - p1) ** 2 + (p2 - l2) ** 2)],
  };
}

const T975 = [0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16,
  2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];
export function tCrit(df) {
  if (!isNum(df) || df < 1) return 12.706;
  if (df <= 30) return T975[Math.floor(df)];
  return 1.96 + 2.5 / df;
}

// Diferença de médias (Welch) com IC de 95%
export function meanDiff(a, b) {
  const A = describe(a), B = describe(b);
  if (A.n < 2 || B.n < 2) return { diff: A.mean != null && B.mean != null ? A.mean - B.mean : null, ci: null, nA: A.n, nB: B.n };
  const va = (A.sd ** 2) / A.n, vb = (B.sd ** 2) / B.n;
  const se = Math.sqrt(va + vb);
  const diff = A.mean - B.mean;
  if (se === 0) return { diff, ci: [diff, diff], nA: A.n, nB: B.n };
  const df = (va + vb) ** 2 / ((va * va) / (A.n - 1) + (vb * vb) / (B.n - 1));
  const t = tCrit(df);
  return { diff, ci: [diff - t * se, diff + t * se], nA: A.n, nB: B.n };
}

export function sampleLevel(n) {
  if (n < 10) return { level: 0, label: "Amostra muito pequena", short: "muito pequena" };
  if (n < 20) return { level: 1, label: "Amostra limitada", short: "limitada" };
  if (n < 50) return { level: 2, label: "Amostra moderada", short: "moderada" };
  return { level: 3, label: "Amostra maior", short: "maior" };
}

export const excludesZero = (ci) => !!ci && (ci[0] > 0 || ci[1] < 0);

// ----------------------------------------------------------------------------
// Carregar e mesclar arquivos
// ----------------------------------------------------------------------------

export function validateDataset(raw) {
  if (!raw || typeof raw !== "object") throw new Error("O arquivo não contém JSON válido.");
  if (raw.kind === "jpa-backup") return "backup";
  if (raw.schema !== SCHEMA) {
    throw new Error("Este arquivo não foi gerado pelo coletor do Jungle Performance Analytics (campo 'schema' ausente ou diferente).");
  }
  if (!Array.isArray(raw.matches)) throw new Error("O arquivo não tem a lista de partidas ('matches').");
  if (!raw.player || !(raw.player.puuid || (raw.player.puuids || []).length)) {
    throw new Error("O arquivo não identifica o jogador (PUUID ausente).");
  }
  return "dataset";
}

export function mergeMeta(a = {}, b = {}) {
  const out = { ...a, ...b };
  for (const k of ["items", "champions", "runes", "runeStyles", "spells", "shards"]) {
    out[k] = { ...(a[k] || {}), ...(b[k] || {}) };
  }
  out.icons = {};
  for (const k of ["item", "champion", "rune", "spell"]) {
    out.icons[k] = { ...((a.icons || {})[k] || {}), ...((b.icons || {})[k] || {}) };
  }
  if (a.visual || b.visual) {
    const va = a.visual || {}, vb = b.visual || {};
    out.visual = { ...va, ...vb, splash: { ...(va.splash || {}), ...(vb.splash || {}) }, emblems: { ...(va.emblems || {}), ...(vb.emblems || {}) }, profileIcon: vb.profileIcon || va.profileIcon };
  }
  return out;
}

// Mescla por matchId. Nunca duplica. Uma versão com timeline substitui uma sem.
export function mergeDatasets(base, incoming) {
  validateDataset(incoming);
  const report = { added: 0, updated: 0, unchanged: 0, rejected: 0, total: incoming.matches.length };
  if (!base) {
    const seen = new Map();
    for (const m of incoming.matches) {
      if (!m || !m.matchId || !m.me) { report.rejected++; continue; }
      if (seen.has(m.matchId)) { report.unchanged++; continue; }
      seen.set(m.matchId, m);
      report.added++;
    }
    return { dataset: slimDataset({ ...incoming, matches: [...seen.values()] }), report };
  }
  const basePuuids = new Set([base.player.puuid, ...(base.player.puuids || [])].filter(Boolean));
  const incPuuids = new Set([incoming.player.puuid, ...(incoming.player.puuids || [])].filter(Boolean));
  const samePlayer = [...incPuuids].some((p) => basePuuids.has(p));
  if (!samePlayer) {
    const err = new Error("Este arquivo é de outra conta (PUUID diferente). Para trocar de conta, limpe os dados primeiro.");
    err.code = "other_player";
    throw err;
  }
  const map = new Map(base.matches.map((m) => [m.matchId, m]));
  for (const m of incoming.matches) {
    if (!m || !m.matchId || !m.me) { report.rejected++; continue; }
    const old = map.get(m.matchId);
    if (!old) { map.set(m.matchId, m); report.added++; continue; }
    if (!old.timeline && m.timeline) { map.set(m.matchId, m); report.updated++; continue; }
    report.unchanged++;
  }
  const matches = [...map.values()].sort((a, b) => (b.gameStart || 0) - (a.gameStart || 0));
  const namesSeen = [...new Set([...(incoming.player.namesSeen || []), ...(base.player.namesSeen || [])])];
  const dataset = {
    ...base,
    source: base.source === "demo" ? incoming.source : base.source,
    generatedAt: incoming.generatedAt || base.generatedAt,
    player: {
      ...base.player, ...incoming.player,
      puuids: [...new Set([...basePuuids, ...incPuuids])],
      namesSeen,
    },
    stats: {
      ...(incoming.stats || {}),
      timelineUnavailable: [...new Set([...((base.stats || {}).timelineUnavailable || []), ...((incoming.stats || {}).timelineUnavailable || [])])],
    },
    meta: mergeMeta(base.meta, incoming.meta),
    profile: incoming.profile || base.profile,
    rank: mergeRank(base.rank, incoming.rank),
    matches,
  };
  return { dataset: slimDataset(dataset), report };
}

function mergeRank(a, b) {
  if (!a && !b) return undefined;
  const seen = new Map();
  for (const h of [...((a && a.history) || []), ...((b && b.history) || [])]) if (h && h.t) seen.set(h.t, h);
  const cur = b && b.current && Object.keys(b.current).length ? b.current : (a && a.current) || {};
  return { current: cur, history: [...seen.values()].sort((x, y) => Date.parse(x.t) - Date.parse(y.t)) };
}

// v2: guarda só partidas do Summoner's Rift (ARAM e Arena não entram em nenhuma análise).
export function riftOnly(ds) {
  if (!ds || !Array.isArray(ds.matches)) return ds;
  return slimDataset({ ...ds, matches: ds.matches.filter((m) => m.mapId === 11 || SR_QUEUES.includes(m.queueId)) });
}

// Mantém só os ícones usados nas partidas do Summoner's Rift (mapa 11).
// Ícones de Arena e outros modos inflavam o arquivo salvo sem uso nas análises.
export const SR_QUEUES = [400, 420, 430, 440, 480, 490, 700];
export function slimDataset(ds) {
  if (!ds || !ds.meta || !ds.meta.icons) return ds;
  const isSR = (m) => m.mapId === 11 || SR_QUEUES.includes(m.queueId);
  const used = { item: new Set(), champion: new Set(), rune: new Set(), spell: new Set() };
  for (const m of ds.matches || []) {
    if (!isSR(m)) continue;
    for (const who of [m.me, m.opp]) {
      if (!who) continue;
      used.champion.add(String(who.championId));
      (who.items || []).forEach((i) => i && used.item.add(String(i)));
    }
    for (const p of m.participants || []) used.champion.add(String(p.championId));
    for (const ev of (m.timeline && m.timeline.items) || []) if (ev[2]) used.item.add(String(ev[2]));
    const r = m.me.runes || {};
    [...(r.primary || []), ...(r.secondary || []), r.primaryStyle, r.subStyle].forEach((x) => x && used.rune.add(String(x)));
    (m.me.spells || []).forEach((x) => x && used.spell.add(String(x)));
  }
  const icons = {};
  for (const k of ["item", "champion", "rune", "spell"]) {
    icons[k] = Object.fromEntries(Object.entries(ds.meta.icons[k] || {}).filter(([id]) => used[k].has(id)));
  }
  return { ...ds, meta: { ...ds.meta, icons } };
}

// ----------------------------------------------------------------------------
// Normalização: registro do coletor -> Game (com campos derivados)
// ----------------------------------------------------------------------------

export function itemInfo(meta, id) {
  return (meta && meta.items && meta.items[String(id)]) || null;
}
export function isCompletedItem(meta, id) {
  const it = itemInfo(meta, id);
  return !!(it && it.completed);
}
export function isBoots(meta, id) {
  const it = itemInfo(meta, id);
  return !!(it && it.boots);
}

// Ordem de itens completos pela timeline (desfaz compras com ITEM_UNDO)
export function completionOrder(itemEvents, meta) {
  if (!Array.isArray(itemEvents)) return null;
  const events = [...itemEvents].sort((a, b) => a[0] - b[0]);
  const seq = [];
  for (const ev of events) {
    const [t, type, id] = ev;
    if (type === "P" && isCompletedItem(meta, id)) seq.push({ id, t });
    else if (type === "U" && id && isCompletedItem(meta, id)) {
      for (let i = seq.length - 1; i >= 0; i--) {
        if (seq[i].id === id) { seq.splice(i, 1); break; }
      }
    }
  }
  const seen = new Set();
  return seq.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
}

const FC = { t: 0, totalGold: 1, currentGold: 2, xp: 3, level: 4, cs: 5, jcs: 6, x: 7, y: 8 };

function frameAtMinute(rows, minute) {
  if (!rows || !rows.length) return null;
  for (const r of rows) if (Math.round(r[FC.t] / 60) === minute) return r;
  return null;
}
function frameAtOrBefore(rows, tSec) {
  if (!rows || !rows.length) return null;
  let best = null;
  for (const r of rows) { if (r[FC.t] <= tSec + 0.5) best = r; else break; }
  return best;
}
function snap(r) {
  if (!r) return null;
  return { gold: r[FC.totalGold], xp: r[FC.xp], level: r[FC.level], cs: (r[FC.cs] || 0) + (r[FC.jcs] || 0), jcs: r[FC.jcs] };
}
function diffSnap(a, b) {
  if (!a || !b) return null;
  return { gold: a.gold - b.gold, xp: a.xp - b.xp, level: a.level - b.level, cs: a.cs - b.cs };
}

export function prepareGame(m, meta, puuids) {
  const me = m.me;
  if (!me) return null;
  const durMin = (m.duration || 0) / 60;
  const tl = m.timeline || null;
  const finalItems = (me.items || []).slice(0, 6).filter(Boolean);
  const finalCompleted = finalItems.filter((id) => isCompletedItem(meta, id));
  const boots = finalItems.find((id) => isBoots(meta, id)) || null;
  const order = tl ? completionOrder(tl.items, meta) : null;
  const pid = me.pid;
  const myTeam = me.teamId;
  const teamKills = isNum(m.teamKills) ? m.teamKills : null;
  const runes = me.runes || {};
  const keystone = (runes.primary || [])[0] || null;

  let early = null, myEvents = null, elite = null, buildings = null;
  if (tl) {
    const at = (mm) => snap(frameAtMinute(tl.me, mm));
    const atOpp = (mm) => snap(frameAtMinute(tl.opp, mm));
    early = {};
    for (const mm of [5, 10, 15, 20]) {
      const a = at(mm), b = atOpp(mm);
      early["at" + mm] = a;
      early["opp" + mm] = b;
      early["diff" + mm] = diffSnap(a, b);
    }
    myEvents = { kills: [], deaths: [], assists: [] };
    for (const k of tl.kills || []) {
      const [t, killer, victim, assists, x, y] = k;
      if (killer === pid) myEvents.kills.push({ t, victim, x, y });
      if (victim === pid) myEvents.deaths.push({ t, killer, x, y, assists });
      if ((assists || []).includes(pid)) myEvents.assists.push({ t, victim, x, y });
    }
    const teamOfPid = new Map((m.participants || []).map((p) => [p.pid, p.teamId]));
    elite = (tl.elite || []).map(([t, type, sub, killerTeam, killer, assists, ex, ey]) => {
      const team = killerTeam || teamOfPid.get(killer) || null;
      const pit = ex != null && ey != null ? [ex, ey] : OBJECTIVE_PITS[type] || null;
      return { t, type, sub, team, mine: team === myTeam, me: killer === pid || (assists || []).includes(pid), x: pit ? pit[0] : null, y: pit ? pit[1] : null };
    });
    const nexusSeen = {};
    buildings = (tl.buildings || []).map(([t, type, lane, towerType, ownerTeam, killer, bx, by]) => {
      let pos = bx != null && by != null ? [bx, by] : null;
      if (!pos) {
        const spot = (BUILDING_SPOTS[ownerTeam] || {})[lane] || {};
        if (type === "INHIBITOR_BUILDING") pos = spot.INHIB || null;
        else if (towerType === "NEXUS_TURRET") {
          const i = (nexusSeen[ownerTeam] = (nexusSeen[ownerTeam] || 0) + 1) - 1;
          pos = (BUILDING_SPOTS[ownerTeam] || {}).NEXUS?.[i % 2] || null;
        } else pos = spot[towerType] || null;
      }
      return { t, type, lane, towerType, ownerTeam, killer, byMyTeam: ownerTeam !== myTeam, x: pos ? pos[0] : null, y: pos ? pos[1] : null };
    });
  }

  const patch = m.patch || "?";
  return {
    id: m.matchId,
    raw: m,
    start: m.gameStart || m.gameCreation || 0,
    duration: m.duration || 0,
    durMin,
    patch,
    queueId: m.queueId,
    remake: !!m.remake,
    puuidOk: !puuids || puuids.size === 0 || !me.puuid || puuids.has(me.puuid),
    riotIdAtGame: me.riotId || "",
    side: me.teamId === 100 ? "blue" : me.teamId === 200 ? "red" : null,
    teamId: myTeam,
    win: !!me.win,
    champ: me.championName,
    champId: me.championId,
    position: me.position || "",
    k: me.k || 0, d: me.d || 0, a: me.a || 0,
    kda: ((me.k || 0) + (me.a || 0)) / Math.max(1, me.d || 0),
    perfect: (me.d || 0) === 0,
    cs: (me.cs || 0) + (me.jcs || 0),
    laneCs: me.cs || 0,
    jungleCs: me.jcs || 0,
    csMin: durMin > 0 ? ((me.cs || 0) + (me.jcs || 0)) / durMin : null,
    gold: me.gold || 0,
    goldMin: durMin > 0 ? (me.gold || 0) / durMin : null,
    dmg: me.dmg || 0,
    dmgMin: durMin > 0 ? (me.dmg || 0) / durMin : null,
    dmgTaken: me.dmgTaken || 0,
    vision: me.vision ?? null,
    level: me.level || null,
    kp: teamKills ? ((me.k || 0) + (me.a || 0)) / teamKills : null,
    teamKills,
    opp: m.opp || null,
    oppChamp: m.opp ? m.opp.championName : null,
    oppChampId: m.opp ? m.opp.championId : null,
    oppHow: m.oppIdentifiedBy || null,
    finalItems, finalCompleted, boots,
    runes, keystone, primaryStyle: runes.primaryStyle || null, subStyle: runes.subStyle || null,
    runePage: runes.primary ? [runes.primaryStyle, ...(runes.primary || []), runes.subStyle, ...(runes.secondary || [])].join("-") : null,
    spells: me.spells || [],
    hasTL: !!tl,
    order,
    early,
    myEvents,
    elite,
    buildings,
    teams: m.teams || [],
    participants: m.participants || [],
  };
}

export function prepare(dataset) {
  if (!dataset) return { games: [], meta: {}, player: null };
  const meta = dataset.meta || {};
  const puuids = new Set([dataset.player?.puuid, ...(dataset.player?.puuids || [])].filter(Boolean));
  const games = [];
  for (const m of dataset.matches || []) {
    const g = prepareGame(m, meta, puuids);
    if (g && g.puuidOk) games.push(g);
  }
  games.sort((a, b) => b.start - a.start);
  return { games, meta, player: dataset.player };
}

// Valor de time (ouro, xp) no instante t, a partir dos snapshots por minuto
export function teamDiffAt(g, tSec) {
  const tl = g.raw.timeline;
  if (!tl || !tl.team || !tl.team.length) return null;
  let row = null;
  for (const r of tl.team) { if (r[0] <= tSec + 0.5) row = r; else break; }
  if (!row) return null;
  const goldDiff = g.teamId === 100 ? row[1] - row[2] : row[2] - row[1];
  const xpDiff = g.teamId === 100 ? row[3] - row[4] : row[4] - row[3];
  return { t: row[0], goldDiff, xpDiff };
}
export function playerDiffAt(g, tSec) {
  const tl = g.raw.timeline;
  if (!tl) return null;
  const a = snap(frameAtOrBefore(tl.me, tSec));
  const b = snap(frameAtOrBefore(tl.opp, tSec));
  return diffSnap(a, b);
}

// ----------------------------------------------------------------------------
// Filtros globais
// ----------------------------------------------------------------------------

export const DEFAULT_FILTERS = {
  period: "last50", // last10 last20 last50 last100 d7 d30 d90 custom all
  from: "", to: "",
  champion: "ALL",
  queue: "420", // 420 | 440 | normal | all
  position: "JUNGLE",
  patches: [],
  result: "all",
  oppJungler: "",
  duration: "all", // lt25 | 25to32 | gt32
  slotItem: { slot: 0, item: 0 },
  anyItem: 0,
  keystone: 0,
  side: "all",
  timeline: "all",
  includeRemakes: false,
};

const DAY = 86400000;

export function attributeFilter(g, f) {
  if (!f.includeRemakes && g.remake) return false;
  if (f.champion && f.champion !== "ALL" && g.champ !== f.champion) return false;
  if (f.queue && f.queue !== "all") {
    if (f.queue === "normal") { if (!NORMAL_QUEUES.includes(g.queueId)) return false; }
    else if (String(g.queueId) !== String(f.queue)) return false;
  }
  if (f.position && f.position !== "ALL" && g.position !== f.position) return false;
  if (f.patches && f.patches.length && !f.patches.includes(g.patch)) return false;
  if (f.result === "win" && !g.win) return false;
  if (f.result === "loss" && g.win) return false;
  if (f.oppJungler && g.oppChamp !== f.oppJungler) return false;
  if (f.duration === "lt25" && !(g.durMin < 25)) return false;
  if (f.duration === "25to32" && !(g.durMin >= 25 && g.durMin <= 32)) return false;
  if (f.duration === "gt32" && !(g.durMin > 32)) return false;
  if (f.slotItem && f.slotItem.slot && f.slotItem.item) {
    if (!g.order) return false; // ordem só existe com timeline
    const x = g.order[f.slotItem.slot - 1];
    if (!x || x.id !== Number(f.slotItem.item)) return false;
  }
  if (f.anyItem && !g.finalItems.includes(Number(f.anyItem))) return false;
  if (f.keystone && g.keystone !== Number(f.keystone)) return false;
  if (f.side !== "all" && g.side !== f.side) return false;
  if (f.timeline === "with" && !g.hasTL) return false;
  if (f.timeline === "without" && g.hasTL) return false;
  return true;
}

export const PERIOD_LABELS = {
  last10: "Últimas 10 partidas", last20: "Últimas 20 partidas", last50: "Últimas 50 partidas",
  last100: "Últimas 100 partidas", d7: "Últimos 7 dias", d30: "Últimos 30 dias", d90: "Últimos 90 dias",
  custom: "Período personalizado", all: "Todo o histórico",
};

function parseDay(s, endOfDay) {
  if (!s) return null;
  const [y, mo, d] = s.split("-").map(Number);
  if (!y || !mo || !d) return null;
  return endOfDay ? new Date(y, mo - 1, d, 23, 59, 59, 999).getTime() : new Date(y, mo - 1, d).getTime();
}

// Atributos primeiro, período depois (ex.: "últimas 50" = 50 partidas de Briar na Solo/Duo)
export function applyFilters(games, f, now = Date.now()) {
  const remakesExcluded = f.includeRemakes ? 0 : games.filter((g) => g.remake && attributeFilter(g, { ...f, includeRemakes: true })).length;
  const pool = games.filter((g) => attributeFilter(g, f)); // já ordenado (recente -> antigo)
  let current = pool, previous = null, prevLabel = null;
  const p = f.period;
  const lastN = { last10: 10, last20: 20, last50: 50, last100: 100 }[p];
  if (lastN) {
    current = pool.slice(0, lastN);
    previous = pool.slice(lastN, lastN * 2);
    prevLabel = `${lastN} partidas anteriores`;
  } else if (p === "d7" || p === "d30" || p === "d90") {
    const days = { d7: 7, d30: 30, d90: 90 }[p];
    const a = now - days * DAY;
    current = pool.filter((g) => g.start >= a && g.start <= now);
    previous = pool.filter((g) => g.start >= a - days * DAY && g.start < a);
    prevLabel = `${days} dias anteriores`;
  } else if (p === "custom") {
    const a = parseDay(f.from, false), b = parseDay(f.to, true);
    current = pool.filter((g) => (a == null || g.start >= a) && (b == null || g.start <= b));
    if (a != null && b != null && b > a) {
      const len = b - a;
      previous = pool.filter((g) => g.start >= a - len && g.start < a);
      prevLabel = "período anterior de mesmo tamanho";
    }
  }
  return { current, previous: previous && previous.length ? previous : null, prevLabel, pool, remakesExcluded };
}

// ----------------------------------------------------------------------------
// Métricas
// ----------------------------------------------------------------------------

export function winRate(games) {
  const n = games.length;
  const wins = games.filter((g) => g.win).length;
  return { n, wins, losses: n - wins, rate: n ? wins / n : null, ci: wilson(wins, n) };
}

// KDA agregado = (abates + assistências) / mortes, somando todas as partidas.
// Com zero mortes no total, divide por 1 (convenção usada pelas plataformas).
export function aggregateKDA(games) {
  if (!games.length) return null;
  const k = games.reduce((s, g) => s + g.k, 0), a = games.reduce((s, g) => s + g.a, 0), d = games.reduce((s, g) => s + g.d, 0);
  return { value: (k + a) / Math.max(1, d), perfect: d === 0 };
}

export function summarize(games) {
  const wr = winRate(games);
  const avg = (f) => mean(games.map(f));
  return {
    n: games.length,
    ...wr,
    kda: aggregateKDA(games),
    kills: avg((g) => g.k), deaths: avg((g) => g.d), assists: avg((g) => g.a),
    csMin: avg((g) => g.csMin), goldMin: avg((g) => g.goldMin), dmgMin: avg((g) => g.dmgMin),
    kp: avg((g) => g.kp), durMin: avg((g) => g.durMin),
    withTL: games.filter((g) => g.hasTL).length,
  };
}

export function rollingSeries(gamesDesc, window = 10) {
  const asc = [...gamesDesc].reverse();
  const out = [];
  for (let i = 0; i < asc.length; i++) {
    const w = asc.slice(Math.max(0, i - window + 1), i + 1);
    const g = asc[i];
    out.push({
      idx: i + 1,
      id: g.id,
      start: g.start,
      win: g.win ? 1 : 0,
      wrRoll: w.length >= Math.min(window, 5) ? w.filter((x) => x.win).length / w.length : null,
      kda: g.kda,
      kdaRoll: aggregateKDA(w).value,
      csMin: g.csMin,
      csRoll: mean(w.map((x) => x.csMin)),
      goldMin: g.goldMin,
      goldRoll: mean(w.map((x) => x.goldMin)),
      rollN: w.length,
    });
  }
  return out;
}

export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function byDay(games) {
  const map = new Map();
  for (const g of games) {
    const k = dayKey(g.start);
    const e = map.get(k) || { day: k, wins: 0, losses: 0 };
    if (g.win) e.wins++; else e.losses++;
    map.set(k, e);
  }
  return [...map.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export function groupBy(games, keyFn) {
  const map = new Map();
  for (const g of games) {
    const k = keyFn(g);
    if (k == null || k === "") continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(g);
  }
  return map;
}

export function rowStats(games) {
  const s = summarize(games);
  return {
    n: s.n, wins: s.wins, losses: s.losses, rate: s.rate, ci: s.ci,
    kda: s.kda ? s.kda.value : null, deaths: s.deaths, csMin: s.csMin, goldMin: s.goldMin,
    dmgMin: s.dmgMin, durMin: s.durMin, kp: s.kp, sample: sampleLevel(s.n),
  };
}

export function championStats(games) {
  return [...groupBy(games, (g) => g.champ)].map(([champ, gs]) => ({ champ, champId: gs[0].champId, ...rowStats(gs) }))
    .sort((a, b) => b.n - a.n);
}

export function consistency(games) {
  const metrics = {
    csMin: describe(games.map((g) => g.csMin)),
    goldMin: describe(games.map((g) => g.goldMin)),
    dmgMin: describe(games.map((g) => g.dmgMin)),
    deaths: describe(games.map((g) => g.d)),
    kda: describe(games.map((g) => g.kda)),
    kp: describe(games.map((g) => g.kp)),
  };
  const share = (pred, valid = () => true) => {
    const pool = games.filter(valid);
    if (!pool.length) return null;
    const x = pool.filter(pred).length;
    return { x, n: pool.length, rate: x / pool.length, ci: wilson(x, pool.length) };
  };
  const thresholds = [
    { label: "CS/min ≥ 7,0", ...share((g) => g.csMin >= 7, (g) => isNum(g.csMin)) },
    { label: "CS/min ≥ 6,0", ...share((g) => g.csMin >= 6, (g) => isNum(g.csMin)) },
    { label: "3 mortes ou menos", ...share((g) => g.d <= 3) },
    { label: "KDA ≥ 3,0", ...share((g) => g.kda >= 3) },
    { label: "Participação em abates ≥ 60%", ...share((g) => g.kp >= 0.6, (g) => isNum(g.kp)) },
  ];
  return { metrics, thresholds };
}

// ----------------------------------------------------------------------------
// Builds e itens
// ----------------------------------------------------------------------------

export function itemName(meta, id) {
  const it = itemInfo(meta, id);
  return it ? it.name : `Item ${id}`;
}

export function itemStats(games, meta, { completedOnly = true } = {}) {
  const map = new Map();
  for (const g of games) {
    const set = new Set(g.finalItems);
    for (const id of set) {
      if (completedOnly && !isCompletedItem(meta, id) && !isBoots(meta, id)) continue;
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(g);
    }
  }
  return [...map].map(([id, gs]) => ({
    id, name: itemName(meta, id), boots: isBoots(meta, id), ...rowStats(gs),
    medianDone: describe(gs.map((g) => (g.order || []).find((o) => o.id === id)?.t)).mean,
  })).sort((a, b) => b.n - a.n);
}

// Combinações: "seq" = primeiros N itens completos na ordem (exige timeline);
// "set" = conjunto de itens completos no inventário final (qualquer ordem).
export function comboStats(games, meta, { size = 3, mode = "seq", minN = 2 } = {}) {
  const map = new Map();
  let evaluable = 0;
  for (const g of games) {
    let key;
    if (mode === "seq") {
      if (!g.order || g.order.length < size) continue;
      key = g.order.slice(0, size).map((o) => o.id).join(">");
    } else {
      if (g.finalCompleted.length < size) continue;
      // todas as combinações de tamanho `size` do inventário final
      const items = [...new Set(g.finalCompleted)].sort((a, b) => a - b);
      for (const c of combinations(items, size)) {
        const k = c.join("+");
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(g);
      }
      evaluable++;
      continue;
    }
    evaluable++;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(g);
  }
  const rows = [...map].map(([key, gs]) => ({
    key,
    items: key.split(/[>+]/).map(Number),
    mode,
    ...rowStats(gs),
  })).filter((r) => r.n >= minN).sort((a, b) => b.n - a.n || (b.rate ?? 0) - (a.rate ?? 0));
  return { rows, evaluable };
}

function combinations(arr, k) {
  const out = [];
  const rec = (start, acc) => {
    if (acc.length === k) { out.push([...acc]); return; }
    for (let i = start; i < arr.length; i++) { acc.push(arr[i]); rec(i + 1, acc); acc.pop(); }
  };
  rec(0, []);
  return out;
}

export function orderStats(games, meta, slots = 5) {
  const tlGames = games.filter((g) => g.order);
  const bySlot = [];
  for (let s = 0; s < slots; s++) {
    const reached = tlGames.filter((g) => g.order.length > s);
    const items = [...groupBy(reached, (g) => g.order[s].id)].map(([id, gs]) => ({
      id, name: itemName(meta, id), n: gs.length, share: gs.length / (reached.length || 1),
      medianT: describe(gs.map((g) => g.order[s].t)).mean, ...winRate(gs),
    })).sort((a, b) => b.n - a.n);
    bySlot.push({
      slot: s + 1, reached: reached.length, ofTL: tlGames.length,
      time: describe(reached.map((g) => g.order[s].t)),
      items,
      winRateReached: winRate(reached),
    });
  }
  return { tlGames: tlGames.length, noTL: games.length - tlGames.length, bySlot };
}

export function matchesBuild(g, def) {
  if (!def || !def.items || !def.items.length) return false;
  if (def.mode === "seq") {
    if (!g.order) return null; // não avaliável sem timeline
    return def.items.every((id, i) => g.order[i] && g.order[i].id === id);
  }
  const set = new Set(g.finalItems);
  return def.items.every((id) => set.has(id));
}

function perTen(events, from, to) {
  const len = (to - from) / 60;
  if (len < 3) return null;
  return (events.filter((e) => e.t >= from && e.t < to).length / len) * 10;
}

export function contextAtCompletion(g, itemId) {
  if (!g.order) return null;
  const o = g.order.find((x) => x.id === itemId);
  if (!o) return null;
  const team = teamDiffAt(g, o.t);
  const pl = playerDiffAt(g, o.t);
  const ev = g.myEvents || { kills: [], deaths: [], assists: [] };
  const end = g.duration;
  return {
    t: o.t,
    teamGold: team ? team.goldDiff : null,
    oppGold: pl ? pl.gold : null,
    oppLevel: pl ? pl.level : null,
    before: { k: perTen(ev.kills, 0, o.t), d: perTen(ev.deaths, 0, o.t), a: perTen(ev.assists, 0, o.t) },
    after: { k: perTen(ev.kills, o.t, end), d: perTen(ev.deaths, o.t, end), a: perTen(ev.assists, o.t, end) },
  };
}

const goldBucket = (v) => (v == null ? null : v < -1500 ? "atrás" : v > 1500 ? "à frente" : "equilibrado");
const durBucket = (m) => (m < 25 ? "< 25 min" : m <= 32 ? "25–32 min" : "> 32 min");

function stratify(A, B, keyFn, order) {
  const keys = order || [...new Set([...A, ...B].map(keyFn).filter((k) => k != null))].sort();
  const rows = [];
  let wSum = 0, rdSum = 0, varSum = 0;
  for (const k of keys) {
    const a = A.filter((g) => keyFn(g) === k), b = B.filter((g) => keyFn(g) === k);
    const wa = winRate(a), wb = winRate(b);
    rows.push({ key: k, a: wa, b: wb });
    if (a.length && b.length) {
      const w = (a.length * b.length) / (a.length + b.length);
      const pa = wa.rate, pb = wb.rate;
      const pa2 = (wa.wins + 0.5) / (a.length + 1), pb2 = (wb.wins + 0.5) / (b.length + 1);
      wSum += w;
      rdSum += w * (pa - pb);
      varSum += w * w * ((pa2 * (1 - pa2)) / a.length + (pb2 * (1 - pb2)) / b.length);
    }
  }
  const unknownA = A.filter((g) => keyFn(g) == null).length, unknownB = B.filter((g) => keyFn(g) == null).length;
  if (!wSum) return { rows, adjusted: null, unknownA, unknownB };
  const rd = rdSum / wSum;
  const se = Math.sqrt(varSum) / wSum;
  return { rows, adjusted: { diff: rd, ci: [rd - 1.96 * se, rd + 1.96 * se] }, unknownA, unknownB };
}

const METRIC_DEFS = [
  { key: "deaths", label: "Mortes por partida", f: (g) => g.d, better: "lower", fmt: "dec1" },
  { key: "csMin", label: "Farm por minuto", f: (g) => g.csMin, better: "higher", fmt: "dec2" },
  { key: "goldMin", label: "Ouro por minuto", f: (g) => g.goldMin, better: "higher", fmt: "int" },
  { key: "dmgMin", label: "Dano a campeões por minuto", f: (g) => g.dmgMin, better: "higher", fmt: "int" },
  { key: "kp", label: "Participação em abates", f: (g) => g.kp, better: "higher", fmt: "pct" },
  { key: "durMin", label: "Duração da partida (min)", f: (g) => g.durMin, better: null, fmt: "dec1" },
];

export function compareBuilds(games, defA, defB, meta, { excludeOverlap = true } = {}) {
  const evalA = games.map((g) => [g, matchesBuild(g, defA)]);
  const evalB = games.map((g) => [g, matchesBuild(g, defB)]);
  const notEvaluable = games.filter((g, i) => evalA[i][1] === null || evalB[i][1] === null).length;
  let A = evalA.filter(([, v]) => v === true).map(([g]) => g);
  let B = evalB.filter(([, v]) => v === true).map(([g]) => g);
  const idsB = new Set(B.map((g) => g.id));
  const overlap = A.filter((g) => idsB.has(g.id));
  if (excludeOverlap && overlap.length) {
    const ov = new Set(overlap.map((g) => g.id));
    A = A.filter((g) => !ov.has(g.id));
    B = B.filter((g) => !ov.has(g.id));
  }
  const side = (gs, def, other) => {
    const s = summarize(gs);
    const diffItems = def.items.filter((id) => !other.items.includes(id));
    const keyItem = diffItems[diffItems.length - 1] ?? def.items[def.items.length - 1];
    const contexts = gs.map((g) => contextAtCompletion(g, keyItem)).filter(Boolean);
    const timing = def.items.map((id) => ({
      id, name: itemName(meta, id),
      time: describe(gs.map((g) => (g.order || []).find((o) => o.id === id)?.t)),
    }));
    const avgCtx = (f) => mean(contexts.map(f));
    return {
      games: gs, summary: s, sample: sampleLevel(gs.length), keyItem, keyItemName: itemName(meta, keyItem), timing,
      context: {
        n: contexts.length,
        completion: describe(contexts.map((c) => c.t)),
        teamGold: describe(contexts.map((c) => c.teamGold)),
        oppGold: describe(contexts.map((c) => c.oppGold)),
        oppLevel: describe(contexts.map((c) => c.oppLevel)),
        before: { k: avgCtx((c) => c.before.k), d: avgCtx((c) => c.before.d), a: avgCtx((c) => c.before.a) },
        after: { k: avgCtx((c) => c.after.k), d: avgCtx((c) => c.after.d), a: avgCtx((c) => c.after.a) },
        aheadShare: contexts.filter((c) => c.teamGold != null).length
          ? contexts.filter((c) => c.teamGold > 1500).length / contexts.filter((c) => c.teamGold != null).length : null,
      },
      patches: [...groupBy(gs, (g) => g.patch)].map(([p, x]) => ({ patch: p, n: x.length })).sort((a, b) => b.patch.localeCompare(a.patch)),
    };
  };
  const a = side(A, defA, defB), b = side(B, defB, defA);
  const wrDiff = proportionDiff(a.summary.wins, A.length, b.summary.wins, B.length);
  const metrics = METRIC_DEFS.map((md) => {
    const r = meanDiff(A.map(md.f), B.map(md.f));
    return { ...md, a: mean(A.map(md.f)), b: mean(B.map(md.f)), diff: r.diff, ci: r.ci, reliable: excludesZero(r.ci) };
  });
  const ctxKeyA = (g) => goldBucket(contextAtCompletion(g, a.keyItem)?.teamGold);
  const ctxKeyB = (g) => goldBucket(contextAtCompletion(g, b.keyItem)?.teamGold);
  const byGold = stratifyPair(A, B, ctxKeyA, ctxKeyB, ["atrás", "equilibrado", "à frente"]);
  const byDuration = stratify(A, B, (g) => durBucket(g.durMin), ["< 25 min", "25–32 min", "> 32 min"]);
  const byPatch = stratify(A, B, (g) => g.patch);

  const notes = buildVerdict({ a, b, wrDiff, byGold, byDuration, metrics, overlap: overlap.length, excludeOverlap, notEvaluable, defA, defB });
  return { a, b, wrDiff, metrics, overlap: overlap.length, notEvaluable, byGold, byDuration, byPatch, notes };
}

function stratifyPair(A, B, keyA, keyB, order) {
  // Estratos podem depender do item-chave de cada lado
  const tag = (gs, f) => gs.map((g) => ({ g, k: f(g) }));
  const ta = tag(A, keyA), tb = tag(B, keyB);
  const rows = [];
  let wSum = 0, rdSum = 0, varSum = 0;
  for (const k of order) {
    const a = ta.filter((x) => x.k === k).map((x) => x.g), b = tb.filter((x) => x.k === k).map((x) => x.g);
    const wa = winRate(a), wb = winRate(b);
    rows.push({ key: k, a: wa, b: wb });
    if (a.length && b.length) {
      const w = (a.length * b.length) / (a.length + b.length);
      const pa2 = (wa.wins + 0.5) / (a.length + 1), pb2 = (wb.wins + 0.5) / (b.length + 1);
      wSum += w; rdSum += w * (wa.rate - wb.rate);
      varSum += w * w * ((pa2 * (1 - pa2)) / a.length + (pb2 * (1 - pb2)) / b.length);
    }
  }
  const unknownA = ta.filter((x) => x.k == null).length, unknownB = tb.filter((x) => x.k == null).length;
  if (!wSum) return { rows, adjusted: null, unknownA, unknownB };
  const rd = rdSum / wSum, se = Math.sqrt(varSum) / wSum;
  return { rows, adjusted: { diff: rd, ci: [rd - 1.96 * se, rd + 1.96 * se] }, unknownA, unknownB };
}

const pp = (x) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1).replace(".", ",")} p.p.`;

function buildVerdict({ a, b, wrDiff, byGold, metrics, overlap, excludeOverlap, notEvaluable, defA, defB }) {
  const notes = [];
  const nA = a.games.length, nB = b.games.length;
  if (!nA || !nB) {
    notes.push({ tone: "warn", text: "Uma das builds não tem partidas com os filtros atuais. Não há comparação possível." });
    return notes;
  }
  if (nA < 10 || nB < 10) {
    notes.push({ tone: "warn", text: `Amostra pequena (${nA} × ${nB} partidas). Qualquer diferença de win rate aqui pode ser acaso. Use os números como pista, não como conclusão.` });
  } else if (wrDiff && !excludesZero(wrDiff.ci)) {
    notes.push({ tone: "neutral", text: `A diferença de win rate (${pp(wrDiff.diff)}) não é conclusiva: o intervalo de 95% vai de ${pp(wrDiff.ci[0])} a ${pp(wrDiff.ci[1])} e inclui zero.` });
  } else if (wrDiff) {
    notes.push({ tone: "good", text: `A diferença de win rate (${pp(wrDiff.diff)}) é estatisticamente distinguível de zero (IC 95%: ${pp(wrDiff.ci[0])} a ${pp(wrDiff.ci[1])}).` });
  }
  if (byGold.adjusted && wrDiff) {
    const adj = byGold.adjusted;
    if (excludesZero(wrDiff.ci) && !excludesZero(adj.ci)) {
      notes.push({ tone: "warn", text: `Ajustando pelo ouro do time no momento da compra, a diferença cai para ${pp(adj.diff)} e deixa de ser conclusiva. Parte da vantagem pode vir de partidas que já estavam ganhas.` });
    } else {
      notes.push({ tone: "neutral", text: `Diferença ajustada pelo ouro do time na hora da compra: ${pp(adj.diff)} (IC 95%: ${pp(adj.ci[0])} a ${pp(adj.ci[1])}).` });
    }
  } else if (!byGold.adjusted) {
    notes.push({ tone: "neutral", text: "Sem partidas com timeline nos dois lados dentro do mesmo contexto de ouro; o ajuste por contexto não pôde ser calculado." });
  }
  const ga = a.context.teamGold.mean, gb = b.context.teamGold.mean;
  if (ga != null && gb != null && Math.abs(ga - gb) >= 1000) {
    const fav = ga > gb ? a.keyItemName : b.keyItemName;
    notes.push({ tone: "warn", text: `${fav} costuma ser fechado com o time mais à frente (diferença média de ${Math.round(Math.abs(ga - gb)).toLocaleString("pt-BR")} de ouro na hora da compra). Isso favorece o win rate dele independentemente do item.` });
  }
  const ta = a.context.completion.mean, tb = b.context.completion.mean;
  if (ta != null && tb != null && Math.abs(ta - tb) >= 180) {
    notes.push({ tone: "warn", text: `Os itens-chave são fechados em momentos diferentes (em média ${fmtClock(ta)} × ${fmtClock(tb)}). Itens comprados mais tarde aparecem só em partidas longas, o que distorce a comparação.` });
  }
  if (defA && defB && defA.items.length !== defB.items.length) {
    const deep = Math.max(defA.items.length, defB.items.length), shallow = Math.min(defA.items.length, defB.items.length);
    notes.push({ tone: "warn", text: `As builds têm número de itens diferente (${defA.items.length} × ${defB.items.length}). A build de ${deep} itens só existe em partidas que chegaram ao ${deep}º item, que costumam ser mais longas e vencer mais. Para uma comparação justa, compare as duas com ${shallow} itens (há um atalho para isso).` });
  }
  const reliable = metrics.filter((m) => m.reliable && m.better);
  if (reliable.length) {
    notes.push({ tone: "neutral", text: "Diferenças distinguíveis de zero: " + reliable.map((m) => m.label.toLowerCase()).join(", ") + "." });
  }
  if (overlap) {
    notes.push({ tone: "neutral", text: excludeOverlap
      ? `${overlap} partida(s) se encaixam nas duas builds e foram retiradas dos dois lados.`
      : `${overlap} partida(s) aparecem nos dois lados.` });
  }
  if (defA && defA.mode === "seq" && notEvaluable) {
    notes.push({ tone: "neutral", text: `${notEvaluable} partida(s) sem timeline não puderam ser avaliadas pela ordem de compra.` });
  }
  notes.push({ tone: "neutral", text: "Isto é associação, não causa: a build aparece junto com o resultado, mas o contexto da partida também influencia os dois." });
  return notes;
}

export function fmtClock(sec) {
  if (sec == null || !isNum(sec)) return "—";
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Várias builds lado a lado. Cada uma é comparada com as OUTRAS partidas que chegaram
// ao mesmo número de itens (mesma "profundidade"), para reduzir o viés de partidas longas.
export function buildTable(games, defs, meta) {
  const tl = games.filter((g) => g.order);
  return defs.map((def, i) => {
    const gs = games.filter((g) => matchesBuild(g, def) === true);
    const depth = def.items.length;
    const reached = def.mode === "seq" ? tl.filter((g) => g.order.length >= depth) : games.filter((g) => g.finalCompleted.length >= depth);
    const ids = new Set(gs.map((g) => g.id));
    const rest = reached.filter((g) => !ids.has(g.id));
    const s = summarize(gs);
    const restWR = winRate(rest);
    const last = def.items[def.items.length - 1];
    const ctxs = gs.map((g) => contextAtCompletion(g, last)).filter(Boolean);
    return {
      key: def.id || String(i), def, games: gs, summary: s, sample: sampleLevel(s.n), depth,
      rest: restWR, vsRest: proportionDiff(s.wins, s.n, restWR.wins, restWR.n),
      lastDone: describe(ctxs.map((c) => c.t)).median,
      teamGold: mean(ctxs.map((c) => c.teamGold)),
      deathsAfter: mean(ctxs.map((c) => c.after.d)),
      patches: [...new Set(gs.map((g) => g.patch))].sort((a, b) => comparePatch(b, a)),
    };
  });
}

export function patchStats(games, meta) {
  return [...groupBy(games, (g) => g.patch)].map(([patch, gs]) => {
    const firsts = [...groupBy(gs.filter((g) => g.order && g.order[0]), (g) => g.order[0].id)]
      .map(([id, x]) => ({ id, n: x.length })).sort((a, b) => b.n - a.n);
    return { patch, ...rowStats(gs), topFirst: firsts[0] ? { ...firsts[0], name: itemName(meta, firsts[0].id) } : null };
  }).sort((a, b) => comparePatch(b.patch, a.patch));
}

export function comparePatch(a, b) {
  const pa = String(a).split(".").map(Number), pb = String(b).split(".").map(Number);
  return (pa[0] - pb[0]) || (pa[1] - pb[1]);
}

// ----------------------------------------------------------------------------
// Runas
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// Ritmo dos itens de uma partida: quando cada item completo fechou, comparado com a sua
// média (mesmo campeão) e com a dos Challengers, e o que aconteceu até o próximo item.
// A média usa o mesmo item na mesma posição quando há partidas suficientes; senão, a posição.
// ----------------------------------------------------------------------------
function slotAverage(games, slot, itemId, minSame) {
  const withSlot = games.filter((x) => x.order && x.order[slot]);
  const same = withSlot.filter((x) => x.order[slot].id === itemId);
  const use = same.length >= minSame ? same : withSlot;
  if (!use.length) return null;
  return { mean: mean(use.map((x) => x.order[slot].t)), n: use.length, sameItem: use === same };
}

export function itemPacing(g, myGames, refGames = [], maxItems = 3) {
  if (!g || !g.order || !g.order.length) return null;
  const mine = (myGames || []).filter((x) => x.id !== g.id && x.champ === g.champ && x.order).slice(0, 50);
  const ev = g.myEvents || { kills: [], deaths: [], assists: [] };
  const end = g.duration || 0;
  const rows = g.order.slice(0, maxItems).map((o, i) => {
    const until = g.order[i + 1]?.t ?? end;
    const inWin = (arr) => (arr || []).filter((e) => e.t >= o.t && e.t < until).length;
    const diff = playerDiffAt(g, o.t);
    return {
      slot: i, id: o.id, t: o.t, until, nextId: g.order[i + 1]?.id ?? null,
      mine: slotAverage(mine, i, o.id, 5),
      chal: slotAverage(refGames || [], i, o.id, 8),
      after: { k: inWin(ev.kills), d: inWin(ev.deaths), a: inWin(ev.assists) },
      goldVsJg: diff ? diff.gold : null,
    };
  });
  return { rows, nMine: mine.length, nChal: (refGames || []).filter((x) => x.order && x.order.length).length };
}

// ----------------------------------------------------------------------------
// Valores das runas no fim da partida (os mesmos da aba Runas do cliente) e quanto
// cada um representa do total da partida. Texto: meta.runeStats; valores: runes.vars.
// ----------------------------------------------------------------------------
export const RUNE_KIND = {
  damage: { label: "do dano a campeões", short: "do dano", total: (me) => me.dmg },
  gold: { label: "do ouro ganho", short: "do ouro", total: (me) => me.gold },
  heal: { label: "da cura total", short: "da cura", total: (me) => me.heal },
  mitig: { label: "do dano recebido", short: "do dano recebido", total: (me) => me.dmgTaken },
  shield: { label: "", short: "de escudo", total: () => null },
};

export function runeStatKind(text) {
  const t = String(text || "").toLowerCase();
  if (/@eogvar\d@\s*%/.test(t) || /tempo|time|segundo|second|acúmulo|stack|duração|duration|almas|souls/.test(t)) return null;
  if (/torre|tower|estrutura|structure|monstro|monster|tropa|minion|súdito/.test(t)) return null;
  if (/escudo|shield/.test(t)) return "shield";
  if (/(dano|damage).*(bloquead|reduzid|mitigad|absorvid|evitad|prevent|block|reduc|mitigat|absorb)|(bloquead|reduzid|mitigad|absorvid|evitad|prevent|block|reduc|mitigat|absorb).*(dano|damage)/.test(t)) return "mitig";
  if (/cura|curad|vida restaurada|vida recuperada|heal|restor/.test(t)) return "heal";
  if (/ouro|gold/.test(t)) return "gold";
  if (/dano|damage/.test(t)) return "damage";
  return null;
}

const fmtNum = (v) => (Math.abs(v) >= 1000 || Number.isInteger(v) ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString("pt-BR");

export function fillRuneText(text, vals) {
  let first = null;
  const out = String(text).replace(/(:?)@eogvar(\d)@/g, (_, colon, n) => {
    const v = (vals || [])[Number(n) - 1];
    if (typeof v !== "number") return colon + "—";
    if (first == null) first = v;
    return colon + (colon && v >= 0 && v < 10 && Number.isInteger(v) ? "0" + v : fmtNum(v));
  });
  return { text: out, value: first };
}

export function runeContributions(g, meta) {
  const r = g.runes || {};
  const vars = r.vars || {};
  const texts = meta.runeStats || {};
  const me = g.raw?.me || {};
  const sum = {};
  const runes = [...(r.primary || []).map((id, i) => ({ id, group: "primary", slot: i })), ...(r.secondary || []).map((id, i) => ({ id, group: "secondary", slot: i }))]
    .map((x) => {
      const vals = vars[String(x.id)] || null;
      let lines = (texts[String(x.id)] || []).map((d) => ({ ...fillRuneText(d, vals), kind: runeStatKind(d), raw: d }));
      if (!lines.length && vals) lines = vals.map((v, i) => (v ? { text: `Valor ${i + 1}: ${fmtNum(v)}`, value: v, kind: null } : null)).filter(Boolean);
      // Uma contribuição por tipo em cada runa; no dano, vale a linha de dano "adicional" se houver.
      const contrib = [];
      for (const kind of [...new Set(lines.map((l) => l.kind).filter(Boolean))]) {
        const cand = lines.filter((l) => l.kind === kind && typeof l.value === "number" && l.value > 0);
        if (!cand.length) continue;
        const pick = (kind === "damage" && cand.find((l) => /adicional|bonus/i.test(l.raw || ""))) || cand[0];
        const total = RUNE_KIND[kind].total(me);
        const pct = total > 0 ? pick.value / total : null;
        contrib.push({ kind, value: pick.value, pct, total: total || null });
        sum[kind] = (sum[kind] || 0) + pick.value;
      }
      return { ...x, vals, lines, contrib };
    });
  const totals = Object.entries(sum).map(([kind, value]) => {
    const total = RUNE_KIND[kind].total(me);
    return { kind, value, total: total || null, pct: total > 0 ? value / total : null };
  });
  return { runes, totals, hasValues: Object.keys(vars).length > 0 };
}

export function runeName(meta, id) {
  if (!id) return "—";
  const r = (meta.runes || {})[String(id)] || (meta.runeStyles || {})[String(id)];
  if (r) return r.name;
  const s = (meta.shards || {})[String(id)];
  return s || `Runa ${id}`;
}

export function keystoneStats(games, meta) {
  return [...groupBy(games, (g) => g.keystone)].map(([id, gs]) => ({
    id: Number(id), name: runeName(meta, id), style: gs[0].primaryStyle, styleName: runeName(meta, gs[0].primaryStyle), ...rowStats(gs),
  })).sort((a, b) => b.n - a.n);
}

export function runePageStats(games, meta) {
  return [...groupBy(games, (g) => g.runePage)].map(([key, gs]) => ({
    key, runes: gs[0].runes, ...rowStats(gs),
  })).sort((a, b) => b.n - a.n);
}

export function minorRuneStats(games, meta) {
  const map = new Map();
  for (const g of games) {
    for (const id of [...(g.runes.primary || []).slice(1), ...(g.runes.secondary || [])]) {
      if (!id) continue;
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(g);
    }
  }
  return [...map].map(([id, gs]) => ({ id, name: runeName(meta, id), ...rowStats(gs) })).sort((a, b) => b.n - a.n);
}

export function runeBuildMatrix(games, meta, itemIds) {
  const keystones = keystoneStats(games, meta).map((k) => k.id);
  return keystones.map((ks) => ({
    keystone: ks, name: runeName(meta, ks),
    cells: itemIds.map((id) => {
      const gs = games.filter((g) => g.keystone === ks && g.finalItems.includes(id));
      return { item: id, ...winRate(gs), sample: sampleLevel(gs.length) };
    }),
  }));
}

// ----------------------------------------------------------------------------
// Early game
// ----------------------------------------------------------------------------

export function earlyStats(games) {
  const tl = games.filter((g) => g.early);
  const rows = [5, 10, 15].map((mm) => {
    const me = tl.map((g) => g.early["at" + mm]).filter(Boolean);
    const df = tl.map((g) => g.early["diff" + mm]).filter(Boolean);
    return {
      minute: mm, n: me.length, nDiff: df.length,
      gold: mean(me.map((x) => x.gold)), xp: mean(me.map((x) => x.xp)), level: mean(me.map((x) => x.level)), cs: mean(me.map((x) => x.cs)),
      dGold: mean(df.map((x) => x.gold)), dXp: mean(df.map((x) => x.xp)), dLevel: mean(df.map((x) => x.level)), dCs: mean(df.map((x) => x.cs)),
    };
  });
  const d10 = tl.filter((g) => g.early.diff10);
  const bucketWR = (defs, f) => defs.map(([label, pred]) => {
    const gs = d10.filter((g) => pred(f(g)));
    return { label, ...winRate(gs), sample: sampleLevel(gs.length) };
  });
  const level = bucketWR([
    ["2+ níveis atrás", (v) => v <= -2], ["1 nível atrás", (v) => v === -1], ["Mesmo nível", (v) => v === 0],
    ["1 nível acima", (v) => v === 1], ["2+ níveis acima", (v) => v >= 2],
  ], (g) => g.early.diff10.level);
  const gold = bucketWR([
    ["< −1000", (v) => v < -1000], ["−1000 a −300", (v) => v >= -1000 && v < -300], ["−300 a +300", (v) => v >= -300 && v <= 300],
    ["+300 a +1000", (v) => v > 300 && v <= 1000], ["> +1000", (v) => v > 1000],
  ], (g) => g.early.diff10.gold);
  const xp = bucketWR([["Atrás em experiência", (v) => v < 0], ["À frente em experiência", (v) => v > 0]], (g) => g.early.diff10.xp);
  const cs = bucketWR([["Atrás em farm", (v) => v < 0], ["Empatado", (v) => v === 0], ["À frente em farm", (v) => v > 0]], (g) => g.early.diff10.cs);
  const scatter = d10.map((g) => ({ id: g.id, x: g.early.diff10.gold, y: g.early.diff10.xp, win: g.win, opp: g.oppChamp }));
  const early10 = tl.map((g) => {
    const ev = g.myEvents || { kills: [], deaths: [], assists: [] };
    return { k: ev.kills.filter((e) => e.t < 600).length, d: ev.deaths.filter((e) => e.t < 600).length, a: ev.assists.filter((e) => e.t < 600).length };
  });
  const firstObjective = tl.map((g) => {
    const firstDrag = (g.elite || []).find((e) => e.type === "DRAGON");
    const firstGrubs = (g.elite || []).find((e) => e.type === "HORDE");
    return { drag: firstDrag ? firstDrag.mine : null, dragMe: firstDrag ? firstDrag.me : null, grubs: firstGrubs ? firstGrubs.mine : null };
  });
  const rate = (arr) => (arr.length ? arr.filter(Boolean).length / arr.length : null);
  return {
    nTL: tl.length, nNoTL: games.length - tl.length, rows, level, gold, xp, cs, scatter,
    early10: { k: mean(early10.map((x) => x.k)), d: mean(early10.map((x) => x.d)), a: mean(early10.map((x) => x.a)), n: early10.length },
    firstDragonTeam: rate(firstObjective.map((x) => x.drag).filter((x) => x != null)),
    firstDragonMe: rate(firstObjective.map((x) => x.dragMe).filter((x) => x != null)),
    firstGrubsTeam: rate(firstObjective.map((x) => x.grubs).filter((x) => x != null)),
    jungleCs10: mean(tl.map((g) => g.early.at10 ? (g.early.at10.jcs ?? null) : null)),
  };
}

// ----------------------------------------------------------------------------
// Farm e economia
// ----------------------------------------------------------------------------

export const FARM_INTERVALS = [[0, 10], [10, 15], [15, 20], [20, 25], [25, 30], [30, null]];

function valueAt(rows, minute, col) {
  const r = frameAtMinute(rows, minute);
  if (!r) return null;
  return col === "cs" ? (r[FC.cs] || 0) + (r[FC.jcs] || 0) : r[FC[col]];
}

export function intervalRates(g, col = "cs") {
  const tl = g.raw.timeline;
  if (!tl || !tl.me || !tl.me.length) return null;
  const last = tl.me[tl.me.length - 1];
  const lastMin = last[FC.t] / 60;
  return FARM_INTERVALS.map(([a, b]) => {
    const end = b == null ? Math.floor(lastMin) : b;
    if (b == null && lastMin < 32) return null;
    if (b != null && lastMin < b - 0.2) return null;
    const va = valueAt(tl.me, a, col), vb = valueAt(tl.me, end, col);
    if (va == null || vb == null || end <= a) return null;
    return (vb - va) / (end - a);
  });
}

export function farmStats(games) {
  const tl = games.filter((g) => g.hasTL);
  const intervalsFor = (gs, col) => FARM_INTERVALS.map((iv, i) => {
    const vals = gs.map((g) => intervalRates(g, col)).filter(Boolean).map((r) => r[i]);
    const d = describe(vals);
    return { label: iv[1] == null ? `${iv[0]}+ min` : `${iv[0]}–${iv[1]} min`, mean: d.mean, n: d.n };
  });
  const behind = tl.filter((g) => g.early?.diff10 && g.early.diff10.gold < 0);
  const ahead = tl.filter((g) => g.early?.diff10 && g.early.diff10.gold > 0);
  const groups = [
    ["Todas", games], ["Vitórias", games.filter((g) => g.win)], ["Derrotas", games.filter((g) => !g.win)],
    ["Começou na frente (ouro aos 10)", ahead], ["Começou atrás (ouro aos 10)", behind],
    ["Partidas longas (> 30 min)", games.filter((g) => g.durMin > 30)], ["Partidas curtas (< 25 min)", games.filter((g) => g.durMin < 25)],
  ].map(([label, gs]) => ({
    label, n: gs.length, csMin: mean(gs.map((g) => g.csMin)), goldMin: mean(gs.map((g) => g.goldMin)),
    jungleShare: mean(gs.map((g) => (g.cs ? g.jungleCs / g.cs : null))),
  }));
  const totals = {
    cs: describe(games.map((g) => g.cs)), laneCs: describe(games.map((g) => g.laneCs)), jungleCs: describe(games.map((g) => g.jungleCs)),
    csMin: describe(games.map((g) => g.csMin)), gold: describe(games.map((g) => g.gold)), goldMin: describe(games.map((g) => g.goldMin)),
  };
  // Curvas médias por minuto (até 35)
  const curve = [];
  for (let mm = 0; mm <= 35; mm++) {
    const vals = tl.map((g) => frameAtMinute(g.raw.timeline.me, mm)).filter(Boolean);
    if (vals.length < Math.max(3, tl.length * 0.2)) { if (mm > 15) break; else continue; }
    curve.push({ minute: mm, n: vals.length,
      gold: mean(vals.map((r) => r[FC.totalGold])), cs: mean(vals.map((r) => (r[FC.cs] || 0) + (r[FC.jcs] || 0))), xp: mean(vals.map((r) => r[FC.xp])) });
  }
  const cei = economicConsistency(games, ahead, behind);
  return { nTL: tl.length, cs: intervalsFor(tl, "cs"), gold: intervalsFor(tl, "totalGold"), groups, totals, curve, cei };
}

// Índice de Consistência Econômica (0–100). Fórmula própria, documentada na interface:
//   R  = regularidade entre partidas = 1 − CV(CS/min), limitado a [0, 1]
//   S  = sustentação na partida = média de (CS/min 15–25) ÷ (CS/min 0–15), limitado a [0, 1]
//   Rz = resiliência = CS/min médio quando atrás aos 10 ÷ CS/min médio quando à frente, limitado a [0, 1]
//   ICE = 100 × (0,4·R + 0,3·S + 0,3·Rz). Exige ao menos 5 partidas em cada componente.
export function economicConsistency(games, ahead, behind) {
  const clamp = (v) => (v == null ? null : Math.max(0, Math.min(1, v)));
  const cv = describe(games.map((g) => g.csMin)).cv;
  const R = games.length >= 5 && cv != null ? clamp(1 - cv) : null;
  const ratios = games.filter((g) => g.hasTL).map((g) => {
    const tl = g.raw.timeline.me;
    const c0 = valueAt(tl, 0, "cs"), c15 = valueAt(tl, 15, "cs"), c25 = valueAt(tl, 25, "cs");
    if (c0 == null || c15 == null || c25 == null) return null;
    const early = (c15 - c0) / 15, mid = (c25 - c15) / 10;
    return early > 0 ? mid / early : null;
  }).filter(isNum);
  const S = ratios.length >= 5 ? clamp(describe(ratios).mean) : null;
  const ma = mean(ahead.map((g) => g.csMin)), mb = mean(behind.map((g) => g.csMin));
  const Rz = ahead.length >= 5 && behind.length >= 5 && ma ? clamp(mb / ma) : null;
  const value = R != null && S != null && Rz != null ? 100 * (0.4 * R + 0.3 * S + 0.3 * Rz) : null;
  return { value, R, S, Rz, nR: games.length, nS: ratios.length, nAhead: ahead.length, nBehind: behind.length };
}

// ----------------------------------------------------------------------------
// Objetivos e mortes
// ----------------------------------------------------------------------------

export const OBJECTIVE_LABELS = {
  DRAGON: "Dragão", BARON_NASHOR: "Barão", RIFTHERALD: "Arauto", HORDE: "Vastilarvas", ATAKHAN: "Atakhan", ELDER_DRAGON: "Dragão Ancião",
};
const PITS = OBJECTIVE_PITS;

export function objectiveType(e) {
  return e.type === "DRAGON" && e.sub === "ELDER_DRAGON" ? "ELDER_DRAGON" : e.type;
}

export function objectiveStats(games) {
  const tl = games.filter((g) => g.elite);
  const types = ["DRAGON", "HORDE", "RIFTHERALD", "ATAKHAN", "BARON_NASHOR", "ELDER_DRAGON"];
  const perType = types.map((type) => {
    const evs = tl.flatMap((g) => g.elite.filter((e) => objectiveType(e) === type).map((e) => ({ ...e, g })));
    const mine = evs.filter((e) => e.mine);
    return {
      type, label: OBJECTIVE_LABELS[type] || type, games: tl.length,
      team: tl.length ? mine.length / tl.length : null, enemy: tl.length ? (evs.length - mine.length) / tl.length : null,
      participation: mine.length ? mine.filter((e) => e.me).length / mine.length : null, nMine: mine.length,
      medianT: describe(evs.map((e) => e.t)).mean, present: evs.length > 0,
    };
  }).filter((r) => r.present);
  // Mortes antes de objetivos conquistados (janelas de 30/60/90 s)
  const windows = [30, 60, 90].map((w) => {
    let deathsBeforeEnemy = 0, deathsBeforeAny = 0, totalDeaths = 0;
    for (const g of tl) {
      const deaths = g.myEvents?.deaths || [];
      totalDeaths += deaths.length;
      for (const d of deaths) {
        const next = g.elite.filter((e) => e.t > d.t && e.t <= d.t + w);
        if (next.length) deathsBeforeAny++;
        if (next.some((e) => !e.mine)) deathsBeforeEnemy++;
      }
    }
    return { window: w, beforeEnemy: deathsBeforeEnemy, beforeAny: deathsBeforeAny, totalDeaths, perGame: tl.length ? deathsBeforeEnemy / tl.length : null };
  });
  // Morte durante disputa: até 30 s antes do objetivo e perto do covil (posição do evento)
  let contested = 0;
  for (const g of tl) {
    for (const d of g.myEvents?.deaths || []) {
      const e = g.elite.find((x) => x.t >= d.t && x.t <= d.t + 30);
      const pit = e && PITS[e.type];
      if (pit && d.x != null && Math.hypot(d.x - pit[0], d.y - pit[1]) <= 2500) contested++;
    }
  }
  const all = games;
  const firstDragon = (g) => (g.teams.find((t) => t.teamId === g.teamId)?.objectives?.dragon?.first) ?? null;
  const assoc = [
    ["Time pegou o primeiro dragão", all.filter((g) => firstDragon(g) === true), all.filter((g) => firstDragon(g) === false)],
    ["Você participou do primeiro dragão do time", tl.filter((g) => g.elite.find((e) => e.type === "DRAGON" && e.mine)?.me === true),
      tl.filter((g) => g.elite.find((e) => e.type === "DRAGON" && e.mine)?.me === false)],
    ["Seu abate virou objetivo em até 90 s", tl.filter((g) => convertedKills(g) > 0), tl.filter((g) => convertedKills(g) === 0 && (g.myEvents.kills.length + g.myEvents.assists.length) > 0)],
    ["Nenhum pick-off antes de objetivo", tl.filter((g) => pickoffsBeforeObjectives(g) === 0), tl.filter((g) => pickoffsBeforeObjectives(g) > 0)],
    ["Inimigo pegou no máximo 1 dragão antes dos 15 min", tl.filter((g) => g.elite.filter((e) => e.type === "DRAGON" && !e.mine && e.t < 900).length <= 1), tl.filter((g) => g.elite.filter((e) => e.type === "DRAGON" && !e.mine && e.t < 900).length >= 2)],
  ].map(([label, yes, no]) => ({ label, yes: winRate(yes), no: winRate(no), diff: proportionDiff(yes.filter((g) => g.win).length, yes.length, no.filter((g) => g.win).length, no.length) }));
  return { nTL: tl.length, perType, windows, contested, assoc };
}

function convertedKills(g) {
  const takedowns = [...(g.myEvents?.kills || []), ...(g.myEvents?.assists || [])];
  let n = 0;
  for (const k of takedowns) {
    if ((g.elite || []).some((e) => e.mine && e.t > k.t && e.t <= k.t + 90) ||
        (g.buildings || []).some((b) => b.byMyTeam && b.t > k.t && b.t <= k.t + 90)) n++;
  }
  return n;
}

// MORTE CRÍTICA (critério objetivo): sua morte seguida, em até 90 s, por
// (a) objetivo épico do inimigo (dragão, arauto, vastilarvas, barão, Atakhan) ou
// (b) inibidor ou torre do nexo do seu time destruídos.
export function criticalDeaths(g) {
  const out = [];
  for (const d of g.myEvents?.deaths || []) {
    const obj = (g.elite || []).find((e) => !e.mine && e.t > d.t && e.t <= d.t + 90);
    const bld = (g.buildings || []).find((b) => !b.byMyTeam && b.t > d.t && b.t <= d.t + 90 &&
      (b.type === "INHIBITOR_BUILDING" || b.towerType === "NEXUS_TURRET"));
    if (obj || bld) out.push({ death: d, objective: obj || null, building: bld || null });
  }
  return out;
}

// ----------------------------------------------------------------------------
// Mortes antes de objetivos, por tipo (reconstruído só com eventos da partida)
// ----------------------------------------------------------------------------
// Para cada morte sua seguida, em até 90 s, por um objetivo épico, o motor olha:
//  - a luta: abates num raio de 3.000 unidades e ±20 s da sua morte
//    (quantos aliados e inimigos morreram, e se você foi o primeiro a cair);
//  - a distância até o fosso do objetivo e quanto tempo antes dele você caiu;
//  - quem pegou o objetivo e o ouro do time no momento da morte.
export const DEATH_CATEGORIES = {
  pick: { label: "Pick-off antes do objetivo", short: "Pick-off", tone: "bad", actionable: true,
    rule: "Você foi o primeiro a cair, o inimigo não perdeu ninguém na luta, a morte foi 15 s ou mais antes do objetivo e o inimigo pegou o objetivo." },
  "fight-lost": { label: "Luta perdida no objetivo", short: "Luta perdida", tone: "bad", actionable: false,
    rule: "Na luta da sua morte, seu time perdeu mais campeões do que o inimigo, e o inimigo pegou o objetivo." },
  contest: { label: "Disputa final no fosso", short: "Disputa no fosso", tone: "neutral", actionable: false,
    rule: "Você caiu perto do fosso (até 2.500 unidades) nos 15 s finais antes do objetivo: tentativa de Golpear, roubo ou contestação direta." },
  "even-trade": { label: "Troca equilibrada, objetivo perdido", short: "Troca equilibrada", tone: "neutral", actionable: false,
    rule: "Seu time abateu tantos inimigos quanto perdeu na luta, mas o inimigo ainda pegou o objetivo." },
  "lost-game": { label: "Tentativa com o jogo perdido", short: "Jogo perdido", tone: "neutral", actionable: false,
    rule: "Seu time estava 6.000 ou mais de ouro atrás no momento da morte, e o inimigo pegou o objetivo." },
  "ally-obj": { label: "Morreu, mas o time pegou o objetivo", short: "Time pegou", tone: "good", actionable: false,
    rule: "Você morreu, mas o objetivo seguinte foi do seu time." },
};
const DEATH_PITS = { DRAGON: [9866, 4414], ELDER_DRAGON: [9866, 4414], BARON_NASHOR: [5007, 10471], RIFTHERALD: [5007, 10471], HORDE: [5007, 10471] };

export function classifyObjectiveDeaths(g) {
  if (!g.myEvents || !g.elite) return [];
  const team = new Map(g.participants.map((p) => [p.pid, p.teamId]));
  const kills = (g.raw.timeline.kills || []).map(([t, killer, victim, assists, x, y]) => ({ t, killer, victim, assists: assists || [], x, y, victimTeam: team.get(victim) }));
  const near = (a, b, r) => a.x == null || b.x == null || Math.hypot(a.x - b.x, a.y - b.y) <= r;
  const out = [];
  for (const d of g.myEvents.deaths) {
    const obj = g.elite.find((e) => e.t > d.t && e.t <= d.t + 90);
    if (!obj) continue;
    const type = objectiveType(obj);
    const fight = kills.filter((k) => Math.abs(k.t - d.t) <= 20 && near(k, d, 3000));
    const allyDeaths = fight.filter((k) => k.victimTeam === g.teamId).length;
    const enemyDeaths = fight.filter((k) => k.victimTeam != null && k.victimTeam !== g.teamId).length;
    const firstDeath = !fight.some((k) => k.t < d.t && k.victimTeam === g.teamId);
    const pit = DEATH_PITS[type];
    const dist = pit && d.x != null ? Math.hypot(d.x - pit[0], d.y - pit[1]) : null;
    const gap = obj.t - d.t;
    const gold = teamDiffAt(g, d.t)?.goldDiff ?? null;
    const enemiesOnMe = 1 + (d.assists || []).length;
    let cat;
    if (!obj.mine && gold != null && gold <= -6000) cat = "lost-game";
    else if (obj.mine) cat = "ally-obj";
    else if (gap < 15 && dist != null && dist <= 2500) cat = "contest";
    else if (enemyDeaths === 0 && firstDeath && gap >= 15) cat = "pick";
    else if (enemyDeaths >= allyDeaths) cat = "even-trade";
    else cat = "fight-lost";
    out.push({
      g, t: d.t, cat, objective: obj, objectiveType: type, objectiveLabel: OBJECTIVE_LABELS[type] || type, gap, dist, gold,
      state: gold == null ? null : gold > 1500 ? "à frente" : gold < -1500 ? "atrás" : "equilibrado",
      allyDeaths, enemyDeaths, firstDeath, enemiesOnMe,
    });
  }
  return out;
}

export function objectiveDeathStats(games) {
  const tl = games.filter((g) => g.myEvents && g.elite);
  const all = tl.flatMap((g) => classifyObjectiveDeaths(g));
  const totalDeaths = tl.reduce((s, g) => s + g.myEvents.deaths.length, 0);
  const rows = Object.entries(DEATH_CATEGORIES).map(([key, def]) => {
    const list = all.filter((x) => x.cat === key);
    const gamesWith = tl.filter((g) => list.some((x) => x.g === g));
    const gamesWithout = tl.filter((g) => !list.some((x) => x.g === g));
    return {
      key, ...def, n: list.length, perGame: tl.length ? list.length / tl.length : null,
      share: all.length ? list.length / all.length : null,
      byState: ["à frente", "equilibrado", "atrás"].map((s) => list.filter((x) => x.state === s).length),
      wrWith: winRate(gamesWith), wrWithout: winRate(gamesWithout), list,
    };
  });
  const asc = [...tl].sort((a, b) => a.start - b.start);
  const picksPerGame = (gs) => gs.map((g) => classifyObjectiveDeaths(g).filter((x) => x.cat === "pick").length);
  const half = Math.floor(asc.length / 2);
  const trend = asc.length >= 20 ? meanDiff(picksPerGame(asc.slice(half)), picksPerGame(asc.slice(0, half))) : null;
  const actionable = all.filter((x) => DEATH_CATEGORIES[x.cat].actionable);
  return { nGames: tl.length, totalDeaths, beforeObjective: all.length, rows, actionable, trend, all };
}

export function pickoffsBeforeObjectives(g) {
  return g.myEvents && g.elite ? classifyObjectiveDeaths(g).filter((x) => x.cat === "pick").length : null;
}

// ----------------------------------------------------------------------------
// Revisão de derrotas: como a partida foi perdida e que comportamentos apareceram.
// Os sinais medem comportamento, não emoção: são o que costuma aparecer quando se
// força jogada com o jogo ruim. Calibrados nas partidas do próprio jogador.
// ----------------------------------------------------------------------------
export const LOSS_SIGNALS = {
  redeath: { label: "Morreu de novo logo depois de voltar", short: "Morte em sequência", rule: "2 ou mais mortes com até 90 s entre uma e outra." },
  afterBehind: { label: "Seguiu morrendo com o jogo virado", short: "Mortes com o time atrás", rule: "5 ou mais mortes depois de o seu time ficar 3.000 de ouro atrás." },
  farm: { label: "Parou de farmar", short: "Farm caiu", rule: "Farm por minuto entre 15 e 25 min abaixo de 75% do seu normal nesse trecho." },
  pickBehind: { label: "Pick-off com o time atrás", short: "Pick-off atrás", rule: "Pick-off antes de objetivo com o seu time 1.500 de ouro ou mais atrás." },
};
const csAtMin = (g, m) => { const r = (g.raw.timeline?.me || []).find((x) => Math.round(x[0] / 60) === m); return r ? (r[5] || 0) + (r[6] || 0) : null; };
export function normalFarm1525(games) {
  return mean(games.filter((g) => g.hasTL && g.durMin >= 25.5).map((g) => { const a = csAtMin(g, 15), b = csAtMin(g, 25); return a == null || b == null ? null : (b - a) / 10; }));
}
export function gameSignals(g, normal) {
  if (!g.myEvents) return null;
  const d = g.myEvents.deaths.map((x) => x.t);
  const redeaths = d.slice(1).filter((t, i) => t - d[i] <= 90).length;
  const behindRow = (g.raw.timeline.team || []).find((r) => (g.teamId === 100 ? r[1] - r[2] : r[2] - r[1]) <= -3000);
  const afterBehind = behindRow ? d.filter((t) => t >= behindRow[0]).length : 0;
  const a = csAtMin(g, 15), b = csAtMin(g, 25);
  const farmRatio = g.durMin >= 25.5 && a != null && b != null && normal ? (b - a) / 10 / normal : null;
  const pickBehind = classifyObjectiveDeaths(g).filter((x) => x.cat === "pick" && (x.gold ?? 0) <= -1500).length;
  const on = [];
  if (redeaths >= 2) on.push("redeath");
  if (afterBehind >= 5) on.push("afterBehind");
  if (farmRatio != null && farmRatio < 0.75) on.push("farm");
  if (pickBehind >= 1) on.push("pickBehind");
  return { on, redeaths, afterBehind, farmRatio, pickBehind, behindAt: behindRow ? behindRow[0] : null };
}
export const LOSS_TYPES = {
  "comecou-mal": { label: "Começou mal", rule: "Seu time 2.000 ou mais de ouro atrás aos 15 min.", review: "Reveja os primeiros 15 min (rota, primeiros objetivos, ganks) e o que você fez depois que o jogo virou." },
  "vantagem-perdida": { label: "Vantagem perdida", rule: "Seu time 1.500 ou mais à frente aos 15 ou aos 20 min, e perdeu.", review: "As mais revisáveis: procure a luta ou a morte em que a vantagem virou." },
  equilibrada: { label: "Equilibrada", rule: "Nem 2.000 atrás aos 15 nem 1.500 à frente aos 15/20.", review: "Decididas no meio e no fim: veja mortes antes de objetivos e lutas depois dos 20 min." },
};
export function lossType(g) {
  const t15 = teamDiffAt(g, 900)?.goldDiff, t20 = teamDiffAt(g, 1200)?.goldDiff;
  if (t15 == null) return null;
  if (t15 <= -2000) return "comecou-mal";
  if (t15 >= 1500 || (t20 ?? -Infinity) >= 1500) return "vantagem-perdida";
  return "equilibrada";
}
export function lossReview(games, poolForNormal) {
  const tl = games.filter((g) => g.hasTL && g.myEvents);
  const normal = normalFarm1525(poolForNormal && poolForNormal.length ? poolForNormal : games);
  const sig = new Map(tl.map((g) => [g.id, gameSignals(g, normal)]));
  const losses = tl.filter((g) => !g.win), wins = tl.filter((g) => g.win);
  const t15 = (g) => teamDiffAt(g, 900)?.goldDiff;
  const rows = losses.map((g) => ({
    g, id: g.id, type: lossType(g), signals: sig.get(g.id), t15: t15(g), t20: teamDiffAt(g, 1200)?.goldDiff ?? null,
    me10: g.early?.diff10?.gold ?? null, picks: pickoffsBeforeObjectives(g),
  }));
  const signalRates = Object.keys(LOSS_SIGNALS).map((k) => ({
    key: k, ...LOSS_SIGNALS[k],
    losses: losses.length ? losses.filter((g) => sig.get(g.id).on.includes(k)).length / losses.length : null,
    wins: wins.length ? wins.filter((g) => sig.get(g.id).on.includes(k)).length / wins.length : null,
  }));
  const two = (gs) => (gs.length ? gs.filter((g) => sig.get(g.id).on.length >= 2).length / gs.length : null);
  return {
    normal, nLosses: losses.length, nWins: wins.length, rows, signalRates,
    twoPlus: { losses: two(losses), wins: two(wins) },
    conversion: {
      ahead: winRate(tl.filter((g) => t15(g) >= 2000)), behind: winRate(tl.filter((g) => t15(g) <= -2000)),
      even: winRate(tl.filter((g) => t15(g) != null && Math.abs(t15(g)) < 2000)),
    },
    byType: Object.keys(LOSS_TYPES).map((k) => ({ key: k, ...LOSS_TYPES[k], n: rows.filter((r) => r.type === k).length, withSignals: rows.filter((r) => r.type === k && r.signals.on.length >= 2).length })),
  };
}

export function deathStats(games) {
  const tl = games.filter((g) => g.myEvents);
  const allDeaths = tl.flatMap((g) => g.myEvents.deaths.map((d) => ({ ...d, g })));
  const phase = (t) => (t < 600 ? 0 : t < 1200 ? 1 : 2);
  const phases = ["Antes dos 10 min", "10 a 20 min", "Depois dos 20 min"].map((label, i) => ({
    label, total: allDeaths.filter((d) => phase(d.t) === i).length,
    perGame: tl.length ? allDeaths.filter((d) => phase(d.t) === i).length / tl.length : null,
  }));
  const firstDeaths = tl.map((g) => g.myEvents.deaths[0]?.t).filter(isNum);
  let aheadDeaths = 0, behindDeaths = 0, knownState = 0;
  for (const d of allDeaths) {
    const diff = playerDiffAt(d.g, d.t);
    if (!diff) continue;
    knownState++;
    if (diff.gold > 0) aheadDeaths++; else if (diff.gold < 0) behindDeaths++;
  }
  const crit = tl.filter((g) => g.elite).map((g) => ({ g, n: pickoffsBeforeObjectives(g) || 0 }));
  const asc = [...crit].sort((a, b) => a.g.start - b.g.start);
  const trend = asc.map((x, i) => {
    const w = asc.slice(Math.max(0, i - 9), i + 1);
    return { idx: i + 1, start: x.g.start, value: x.n, roll: w.length >= 5 ? mean(w.map((y) => y.n)) : null };
  });
  const half = Math.floor(asc.length / 2);
  const critTrend = asc.length >= 20 ? meanDiff(asc.slice(half).map((x) => x.n), asc.slice(0, half).map((x) => x.n)) : null;
  const histogram = [];
  for (let mm = 0; mm < 45; mm += 5) {
    histogram.push({ label: `${mm}–${mm + 5}`, deaths: allDeaths.filter((d) => d.t >= mm * 60 && d.t < (mm + 5) * 60).length });
  }
  return {
    nTL: tl.length, nAll: games.length, total: games.reduce((s, g) => s + g.d, 0), avg: mean(games.map((g) => g.d)),
    phases, firstDeath: describe(firstDeaths), noDeathGames: tl.filter((g) => !g.myEvents.deaths.length).length,
    aheadDeaths, behindDeaths, knownState, critical: { total: crit.reduce((s, x) => s + x.n, 0), perGame: mean(crit.map((x) => x.n)), trend, critTrend },
    histogram,
  };
}

// Quem é o "sujeito" dos textos: você (suas partidas) ou um Challenger (partidas de referência).
export function voiceOf(g) {
  const n = g?.subject;
  if (!n) return { ref: false, S: "Você", s: "você", team: "seu time", jungle: "sua selva", base: "sua base", deaths: "Suas mortes", myDeath: "Sua morte", myKill: "Seu abate",
    plays: "Suas jogadas", did: "o que você fez", habit: "Seu habitual", avg: "sua média", avgCap: "Sua média", won: "Onde você superou", lost: "Onde você tomou gap", plan: "Seu plano de jogo" };
  return { ref: true, S: n, s: n, team: `time do ${n}`, jungle: `selva do ${n}`, base: `base do ${n}`, deaths: `Mortes do ${n}`, myDeath: `Morte do ${n}`, myKill: `Abate do ${n}`,
    plays: `Jogadas do ${n}`, did: `o que ${n} fez`, habit: `Habitual do ${n}`, avg: `média do ${n}`, avgCap: `Média do ${n}`, won: `Onde ${n} superou`, lost: `Onde ${n} tomou gap`, plan: `Plano de jogo do ${n}` };
}

// Posição aproximada num instante: a do quadro de minuto mais próximo, só quando ele está a até 15 s
// (a Riot só grava a posição a cada minuto; mais longe que isso, o local não é confiável e fica de fora).
export function approxPos(rows, t, maxGap = 15) {
  if (!rows || !rows.length) return null;
  let best = null, gap = Infinity;
  for (const r of rows) { const d = Math.abs(r[FC.t] - t); if (d < gap) { gap = d; best = r; } }
  return best && gap <= maxGap && best[FC.x] != null ? { x: best[FC.x], y: best[FC.y] } : null;
}
export function lerpPos(rows, t) {
  if (!rows || !rows.length) return null;
  let a = null, b = null;
  for (const r of rows) { if (r[FC.t] <= t) a = r; else { b = r; break; } }
  if (!a || a[FC.x] == null) return b && b[FC.x] != null ? { x: b[FC.x], y: b[FC.y] } : null;
  if (!b || b[FC.x] == null) return { x: a[FC.x], y: a[FC.y] };
  const k = (t - a[FC.t]) / Math.max(1, b[FC.t] - a[FC.t]);
  return { x: a[FC.x] + (b[FC.x] - a[FC.x]) * k, y: a[FC.y] + (b[FC.y] - a[FC.y]) * k };
}

// Campos da selva (posição da Riot) com os nomes usados no Brasil. Os do time vermelho são espelhados.
const BLUE_SIDE_CAMPS = [["sapo", "Sapo", 2100, 8450], ["blue", "Blue", 3820, 7930], ["lobos", "Lobos", 3780, 6440], ["galinhas", "Galinhas", 6950, 5400], ["red", "Red", 7770, 4040], ["pedras", "Pedras", 8390, 2700]];
export const JUNGLE_CAMPS = [...BLUE_SIDE_CAMPS.map(([k, n, x, y]) => ({ key: k, name: n, x, y, team: 100 })), ...BLUE_SIDE_CAMPS.map(([k, n, x, y]) => ({ key: k, name: n, x: 14780 - x, y: 14890 - y, team: 200 }))];
// Onde o jungler estava a 1:00 (esperando os campos nascerem): campo mais próximo, rio ou invasão.
export function startCampAt(x, y, team) {
  if (x == null || y == null) return null;
  let best = null, bd = Infinity;
  for (const c of JUNGLE_CAMPS) { const d = Math.hypot(c.x - x, c.y - y); if (d < bd) { bd = d; best = c; } }
  if (Math.abs(x + y - 14850) < 1300 && bd > 900) return { key: "rio", name: "Rio" };
  if (!best || bd > 2200) return null;
  if (best.team !== team) return { key: "invade", name: `Invasão (${best.name} inimigo)` };
  return { key: best.key, name: best.name };
}
// "Full clear com prio para a bot lane", "3 campos com prio para a top lane"...
export const CLEAR_LABEL = { ate3: "3 campos", "4a5": "4 a 5 campos", full: "Full clear" };
export const PRIO_LANE = { top: "top lane", mid: "mid lane", bot: "bot lane" };
export function pathingLabel(clear, prio, short = false) {
  const c = CLEAR_LABEL[clear];
  if (!c) return null;
  if (short) return `${c} · prio ${prio ? { top: "top", mid: "mid", bot: "bot" }[prio] : "—"}`;
  return prio ? `${c} com prio para a ${PRIO_LANE[prio]}` : `${c}, sem ida a uma lane até os 10`;
}

const WARD_TYPES = { YELLOW_TRINKET: "Ward (amuleto)", CONTROL_WARD: "Sentinela de controle", BLUE_TRINKET: "Ward azul (Alteração Clarividente)", SIGHT_WARD: "Ward" };

export function gameEvents(g, meta) {
  if (!g.hasTL) return [];
  const ev = [];
  const V = voiceOf(g);
  const tl = g.raw.timeline;
  const frames = tl.me || [];
  const part = (pid) => g.participants.find((p) => p.pid === pid) || null;
  const name = (pid) => { const p = part(pid); return p ? champDisplay(meta, p.championName, p.championId) : "?"; };
  const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  for (const k of g.raw.timeline.kills || []) {
    const [t, killer, victim, assists, x, y] = k;
    const pid = g.raw.me.pid;
    let kind = null;
    if (killer === pid) kind = "kill"; else if (victim === pid) kind = "death"; else if ((assists || []).includes(pid)) kind = "assist";
    if (!kind) {
      // Abates com participação do jungler inimigo (a jogada dele), para ver a resposta logo depois.
      const oj = g.raw.opp?.pid;
      const myTeam = g.raw.me.teamId;
      if (oj && (killer === oj || (assists || []).includes(oj)) && part(victim)?.teamId === myTeam) {
        const v = part(victim);
        const oName = champDisplay(meta, g.raw.opp.championName, g.raw.opp.championId);
        ev.push({ t, kind: "jg-enemy", x: num(x), y: num(y), champ: g.raw.opp.championName, champId: g.raw.opp.championId,
          text: `${oName} ${killer === oj ? "abateu" : "ajudou a abater"} ${champDisplay(meta, v?.championName, v?.championId)}` });
      }
      continue;
    }
    const other = part(kind === "death" ? killer : victim);
    ev.push({ t, kind, x: num(x), y: num(y), champ: other?.championName || null, champId: other?.championId ?? null,
      text: kind === "death" ? `${V.S} morreu para ${name(killer)}` : kind === "kill" ? `${V.S} abateu ${name(victim)}` : `Assistência em ${name(victim)}` });
  }
  for (const e of g.elite || []) {
    ev.push({ t: e.t, kind: e.mine ? "obj-ally" : "obj-enemy", x: num(e.x), y: num(e.y), objective: objectiveType(e),
      text: `${OBJECTIVE_LABELS[objectiveType(e)] || e.type} — ${e.mine ? V.team : "time inimigo"}${e.me ? ` (com ${V.s})` : ""}` });
  }
  for (const b of g.buildings || []) {
    const inhib = b.type === "INHIBITOR_BUILDING";
    const lane = { TOP_LANE: "do topo", MID_LANE: "do meio", BOT_LANE: "do bot" }[b.lane] || "";
    const tier = { OUTER_TURRET: "externa", INNER_TURRET: "interna", BASE_TURRET: "da base" }[b.towerType] || "";
    const what = inhib ? `Inibidor ${lane}` : b.towerType === "NEXUS_TURRET" ? "Torre do nexus" : `Torre ${tier} ${lane}`;
    const verb = b.byMyTeam ? `${inhib ? "destruído" : "destruída"} pelo ${V.team}` : inhib ? "perdido" : "perdida";
    ev.push({ t: b.t, kind: b.byMyTeam ? "bld-ally" : "bld-enemy", x: num(b.x), y: num(b.y),
      text: `${what.replace(/\s+/g, " ").trim()} ${verb}` });
  }
  for (const o of g.order || []) ev.push({ t: o.t, kind: "item", text: `Item completo: ${itemName(meta, o.id)}`, itemId: o.id });

  // Detalhes da rota: posição a 1:00, primeira ward, sentinelas de controle, full clear, troca de amuleto e recall.
  const f1 = frames.find((r) => Math.round(r[FC.t] / 60) === 1);
  if (f1 && f1[FC.x] != null) {
    const camp = startCampAt(f1[FC.x], f1[FC.y], g.raw.me.teamId);
    ev.push({ t: f1[FC.t], kind: "start", x: f1[FC.x], y: f1[FC.y], text: `Posição a 1:00: ${camp ? camp.name : "fora dos campos"} (primeiro campo)` });
  }
  const wards = Array.isArray(tl.wards) ? tl.wards.filter((w) => w[1] === 0) : [];
  const firstWard = wards.find((w) => w[2] !== "UNDEFINED");
  for (const w of wards) {
    if (w !== firstWard && w[2] !== "CONTROL_WARD") continue;
    const p = approxPos(frames, w[0]);
    ev.push({ t: w[0], kind: "ward", x: p?.x ?? null, y: p?.y ?? null, approx: true,
      text: `${w === firstWard ? "Primeira ward" : WARD_TYPES[w[2]] || "Ward"}${p ? "" : " (local não registrado)"}${w === firstWard && w[2] !== "YELLOW_TRINKET" ? ` (${(WARD_TYPES[w[2]] || "").toLowerCase()})` : ""}` });
  }
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1], b = frames[i];
    if ((b[FC.jcs] || 0) >= 24 && (a[FC.jcs] || 0) < 24 && b[FC.t] <= 330) {
      const t = a[FC.t] + ((24 - (a[FC.jcs] || 0)) / Math.max(1, (b[FC.jcs] || 0) - (a[FC.jcs] || 0))) * (b[FC.t] - a[FC.t]);
      const p = approxPos(frames, t);
      ev.push({ t, kind: "clear", x: p?.x ?? null, y: p?.y ?? null, approx: true, text: "Fechou 6 campos (full clear)" });
      break;
    }
  }
  const buys = (tl.items || []).filter((e) => e[1] === "P").sort((a, b) => a[0] - b[0]);
  const recall = buys.find((e) => e[0] > 100);
  if (recall) ev.push({ t: recall[0], kind: "recall", text: `Primeiro recall (primeira compra: ${itemName(meta, recall[2])})` });
  const trinket = buys.find((e) => e[2] === 3364 || e[2] === 3363);
  if (trinket) ev.push({ t: trinket[0], kind: "trinket", text: `Trocou o amuleto pela ${trinket[2] === 3364 ? "Lente do Oráculo" : "Alteração Clarividente"}` });
  return ev.sort((a, b) => a.t - b.t);
}

// ----------------------------------------------------------------------------
// Matchups
// ----------------------------------------------------------------------------

export function matchupStats(games) {
  return [...groupBy(games, (g) => g.oppChamp)].map(([champ, gs]) => {
    const d10 = gs.map((g) => g.early?.diff10).filter(Boolean);
    return {
      champ, champId: gs[0].oppChampId, ...rowStats(gs),
      gold10: mean(d10.map((x) => x.gold)), xp10: mean(d10.map((x) => x.xp)), level10: mean(d10.map((x) => x.level)), n10: d10.length,
    };
  }).sort((a, b) => b.n - a.n);
}

export function matchupDetail(games, champ, meta) {
  const gs = games.filter((g) => g.oppChamp === champ);
  const curve = [];
  for (let mm = 1; mm <= 25; mm++) {
    const vals = gs.map((g) => playerDiffAt(g, mm * 60)).filter(Boolean);
    if (vals.length < 2) continue;
    curve.push({ minute: mm, gold: mean(vals.map((v) => v.gold)), xp: mean(vals.map((v) => v.xp)), n: vals.length });
  }
  let losingFrom = null;
  for (let i = 0; i < curve.length; i++) {
    if (curve.slice(i).every((p) => p.gold < 0)) { losingFrom = curve[i].minute; break; }
  }
  const builds = [...groupBy(gs, (g) => g.finalCompleted.slice().sort((a, b) => a - b).join("+") || "sem itens completos")]
    .map(([key, x]) => ({ key, items: key.split("+").map(Number).filter(Boolean), ...winRate(x) })).sort((a, b) => b.n - a.n);
  const runes = keystoneStats(gs, meta);
  return { games: gs, summary: summarize(gs), curve, losingFrom, builds, runes };
}

export function championClasses(meta, champKey, champId, overrides = {}) {
  const base = (meta.champions || {})[String(champId)]?.tags || [];
  const set = new Set(base);
  const hc = overrides.highCC || DEFAULT_HIGH_CC;
  if (hc.includes(champKey)) set.add("HighCC");
  return [...set];
}

export function classStats(games, meta, overrides) {
  const map = new Map();
  for (const g of games) {
    if (!g.oppChamp) continue;
    for (const c of championClasses(meta, g.oppChamp, g.oppChampId, overrides)) {
      if (!map.has(c)) map.set(c, []);
      map.get(c).push(g);
    }
  }
  return [...map].map(([cls, gs]) => ({ cls, label: CLASS_LABELS[cls] || cls, ...rowStats(gs) })).sort((a, b) => b.n - a.n);
}

// ----------------------------------------------------------------------------
// Evolução (janelas sem sobreposição)
// ----------------------------------------------------------------------------

export const EVOLUTION_METRICS = [
  { key: "wr", label: "Win rate", type: "prop", better: "higher", fmt: "pct", outcome: true },
  { key: "deaths", label: "Mortes por partida", f: (g) => g.d, better: "lower", fmt: "dec1" },
  { key: "ka", label: "Abates + assistências por partida", f: (g) => g.k + g.a, better: "higher", fmt: "dec1" },
  { key: "csMin", label: "Farm por minuto", f: (g) => g.csMin, better: "higher", fmt: "dec2" },
  { key: "goldMin", label: "Ouro por minuto", f: (g) => g.goldMin, better: "higher", fmt: "int" },
  { key: "dmgMin", label: "Dano por minuto", f: (g) => g.dmgMin, better: "higher", fmt: "int" },
  { key: "gold10", label: "Vantagem de ouro aos 10 (vs. jungler)", f: (g) => g.early?.diff10?.gold ?? null, better: "higher", fmt: "int" },
  { key: "xp10", label: "Vantagem de experiência aos 10", f: (g) => g.early?.diff10?.xp ?? null, better: "higher", fmt: "int" },
  { key: "objPart", label: "Participação nos objetivos do time", f: (g) => objectiveParticipation(g), better: "higher", fmt: "pct" },
  { key: "picks", label: "Pick-offs antes de objetivos", f: (g) => pickoffsBeforeObjectives(g), better: "lower", fmt: "dec2" },
  { key: "item3", label: "Minuto do 3º item completo", f: (g) => (g.order && g.order[2] ? g.order[2].t / 60 : null), better: "lower", fmt: "dec1" },
];

export function objectiveParticipation(g) {
  if (!g.elite) return null;
  const mine = g.elite.filter((e) => e.mine);
  if (!mine.length) return null;
  return mine.filter((e) => e.me).length / mine.length;
}

export function compareWindows(recent, previous) {
  return EVOLUTION_METRICS.map((m) => {
    if (m.type === "prop") {
      const a = winRate(recent), b = winRate(previous);
      const d = proportionDiff(a.wins, a.n, b.wins, b.n);
      return { ...m, a: a.rate, b: b.rate, nA: a.n, nB: b.n, diff: d?.diff ?? null, ci: d?.ci ?? null, status: statusOf(d, m.better) };
    }
    const va = recent.map(m.f), vb = previous.map(m.f);
    const r = meanDiff(va, vb);
    return { ...m, a: mean(va), b: mean(vb), nA: r.nA, nB: r.nB, diff: r.diff, ci: r.ci, status: statusOf(r, m.better) };
  });
}

function statusOf(r, better) {
  if (!r || r.diff == null) return "sem-dados";
  if (!r.ci) return "inconclusivo";
  const good = better === "higher" ? r.ci[0] > 0 : r.ci[1] < 0;
  const bad = better === "higher" ? r.ci[1] < 0 : r.ci[0] > 0;
  if (good) return "melhorando";
  if (bad) return "piorando";
  return "estavel";
}

export function evolution(pool, size) {
  const recent = pool.slice(0, size), previous = pool.slice(size, size * 2);
  return { size, recent, previous, rows: previous.length ? compareWindows(recent, previous) : null };
}

// ----------------------------------------------------------------------------
// Coach analítico (regras explícitas sobre as métricas calculadas)
// ----------------------------------------------------------------------------

const PRIORITY_SCORE = { alta: 3, media: 2, baixa: 1 };

// Diferença pareada (mesma partida dos dois lados): média, IC 95% normal
export function pairedDiff(pairs) {
  const ok = pairs.filter((p) => p && isNum(p[0]) && isNum(p[1]));
  const n = ok.length;
  if (n < 2) return null;
  const d = ok.map(([a, b]) => a - b);
  const m = d.reduce((s, x) => s + x, 0) / n;
  const sd = Math.sqrt(d.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1));
  const se = sd / Math.sqrt(n);
  return { n, diff: m, ci: [m - 1.96 * se, m + 1.96 * se], a: mean(ok.map((p) => p[0])), b: mean(ok.map((p) => p[1])) };
}

export function coachDiagnostics(pool, current, meta) {
  const out = [];
  const add = (r) => out.push(r);
  // Oscilações de média entre janelas (últimas 20 × 20 anteriores) ficam na aba Evolução: aqui entram
  // só padrões que pedem uma ação concreta, calculados nas partidas do filtro.
  // 2) Concentração de mortes por fase
  const ds = deathStats(current);
  if (ds.nTL >= 10) {
    const totalDeaths = ds.phases.reduce((s, p) => s + p.total, 0);
    const mid = ds.phases[1];
    if (totalDeaths >= 15 && mid.total / totalDeaths >= 0.45) {
      add({ id: "deaths-mid", kind: "problema", title: "Muitas mortes entre 10 e 20 minutos",
        headline: { value: `${Math.round((mid.total / totalDeaths) * 100)}%`, label: "das suas mortes entre 10 e 20 min" },
        evidence: { text: `${mid.total} de ${totalDeaths} mortes (${Math.round((mid.total / totalDeaths) * 100)}%) acontecem entre 10 e 20 min.` },
        n: `${ds.nTL} partidas com timeline`, interpretation: "É a fase de primeiros itens e disputas de dragão/arauto/vastilarvas, onde uma morte custa objetivo.",
        causes: "Entrar em lutas antes do item-chave, rotação sem visão do jungler inimigo, ficar no rio depois do objetivo.",
        action: "Antes de cada objetivo entre 10 e 20 min, confirme a posição do jungler inimigo e chegue 45 s antes com visão. Evite forçar pick-off sem o item completo.",
        track: "Mortes entre 10 e 20 min por partida", scores: { impact: 3, frequency: 3, confidence: totalDeaths >= 30 ? 3 : 2, ease: 2 } });
    }
  }
  // 2b) Mortes antes de objetivos, separadas por tipo (só os tipos que dependem mais de decisão)
  const od = objectiveDeathStats(current);
  const f2 = (v) => (v == null ? "—" : v.toFixed(2).replace(".", ","));
  const pk = od.rows.find((r) => r.key === "pick");
  if (od.nGames >= 10 && pk.n >= 5 && pk.perGame >= 0.25) {
    add({ id: "pickoffs", kind: "problema", title: "Pick-offs antes de objetivos",
      headline: { value: f2(pk.perGame), label: "por partida · referência: abaixo de 0,25" },
      evidence: { text: `${pk.n} mortes em ${od.nGames} partidas (${f2(pk.perGame)} por partida) em que você caiu primeiro, sem o seu time abater ninguém naquela luta, 15 s ou mais antes de um objetivo que o inimigo pegou. Em média: ${(mean(pk.list.map((x) => x.enemiesOnMe)) || 0).toFixed(1).replace(".", ",")} inimigos na sua morte, ${Math.round(mean(pk.list.map((x) => x.gap)) || 0)} s antes do objetivo, a ${Math.round(mean(pk.list.map((x) => x.dist)) || 0).toLocaleString("pt-BR")} unidades do fosso. Partidas com pelo menos um: win rate ${pctTxt(pk.wrWith.rate)} (${pk.wrWith.n}); sem: ${pctTxt(pk.wrWithout.rate)} (${pk.wrWithout.n}).` },
      n: `${od.nGames} partidas com timeline · ${od.beforeObjective} das suas ${od.totalDeaths} mortes vieram antes de um objetivo; ${pk.n} delas são pick-offs`,
      interpretation: "Das mortes perto de objetivos, este é o tipo que mais depende de decisão individual: a luta ainda não tinha começado e não houve troca. Lutas no fosso, trocas e tentativas com o jogo perdido ficam de fora. Partidas ruins também geram mais pick-offs, então parte da diferença de win rate é consequência, não causa.",
      causes: "Entrar primeiro no rio ou na selva inimiga sem visão, colocar sentinela sozinho perto do objetivo, ser visto antes do time chegar, jungler inimigo fora do mapa.",
      action: "Nos 60 s antes de um objetivo, entre no rio junto com pelo menos um aliado ou depois de ver o jungler inimigo no mapa. Revise as partidas da lista Pick-off em Análise de Mortes.",
      track: "Pick-offs antes de objetivos por partida (referência: abaixo de 0,25)",
      scores: { impact: 3, frequency: pk.perGame >= 0.5 ? 3 : 2, confidence: pk.n >= 30 ? 3 : 2, ease: 2 } });
  }
  const lf = od.rows.find((r) => r.key === "fight-lost");
  if (od.nGames >= 10 && lf.n >= 10 && lf.perGame >= 0.4) {
    const open = lf.byState[0] + lf.byState[1];
    add({ id: "fights-lost", kind: "problema", title: "Lutas de objetivo perdidas com o jogo em aberto",
      headline: { value: f2(lf.perGame), label: "mortes em luta perdida por partida" },
      evidence: { text: `${lf.n} mortes em lutas de objetivo em que o seu time perdeu mais campeões do que o inimigo (${f2(lf.perGame)} por partida). ${open} delas com o time à frente ou equilibrado no ouro; ${lf.byState[2]} com o time atrás.` },
      n: `${od.nGames} partidas com timeline`,
      interpretation: "Aqui a decisão é do time inteiro: entrada, posição e composição pesam tanto quanto a sua jogada, e os eventos da partida não mostram de quem foi a decisão. Vale revisar só as que aconteceram com o jogo à frente ou equilibrado.",
      causes: "Entrar antes do time, contestar o objetivo com menos gente, forçar luta longa contra composição melhor em luta longa.",
      action: "Antes de entrar, conte quantos inimigos estão visíveis e quem do seu time chega primeiro. Revise as partidas da lista Luta perdida em Análise de Mortes.",
      track: "Lutas perdidas no objetivo por partida",
      scores: { impact: 2, frequency: lf.perGame >= 0.6 ? 3 : 2, confidence: lf.n >= 30 ? 3 : 2, ease: 1 } });
  }
  // 2c) Mortes em sequência e jogo forçado (comparado ao jungler inimigo nas mesmas partidas)
  const paired = current.filter((g) => g.hasTL && g.myEvents && g.raw.opp && g.raw.timeline?.kills);
  const redeathsOf = (times) => { const t = [...times].sort((a, b) => a - b); return t.slice(1).filter((x, i) => x - t[i] <= 90).length; };
  if (paired.length >= 15) {
    const pr = pairedDiff(paired.map((g) => [
      redeathsOf(g.myEvents.deaths.map((d) => d.t)),
      redeathsOf(g.raw.timeline.kills.filter((k) => k[2] === g.raw.opp.pid).map((k) => k[0])),
    ]));
    if (pr && pr.diff >= 0.25 && pr.ci[0] > 0) {
      const lw = (gs) => (gs.length ? gs.filter((g) => redeathsOf(g.myEvents.deaths.map((d) => d.t)) >= 2).length / gs.length : null);
      add({ id: "redeaths", kind: "problema", title: "Mortes em sequência: morrer de novo logo depois de voltar",
        headline: { label: "por partida · você × jungler inimigo" },
        evidence: { a: pr.a, b: pr.b, diff: pr.diff, ci: pr.ci, fmt: "dec2", labelA: "Você (por partida)", labelB: "Jungler inimigo, nas mesmas partidas" },
        n: `${pr.n} partidas com timeline`,
        interpretation: `Conta quantas vezes você morre de novo até 90 s depois da morte anterior. Duas ou mais na mesma partida aparecem em ${pctTxt(lw(paired.filter((g) => !g.win)))} das suas derrotas e em ${pctTxt(lw(paired.filter((g) => g.win)))} das vitórias. A comparação é com o jungler inimigo das mesmas partidas, então elo e patch são iguais dos dois lados.`,
        causes: "Voltar da base direto para a mesma briga ou o mesmo lado do mapa, tentar recuperar na hora o que perdeu, entrar sem o time depois de renascer.",
        action: "Depois de morrer, faça uma ação neutra antes de voltar à briga: um campo, uma onda ou uma sentinela no caminho. Revise as derrotas com o sinal Morte em sequência na Revisão de derrotas.",
        track: "Mortes em sequência por partida (referência: o jungler inimigo nas mesmas partidas)",
        scores: { impact: 3, frequency: pr.a >= 1 ? 3 : 2, confidence: pr.n >= 40 ? 3 : 2, ease: 3 } });
    }
  }
  const lr = lossReview(current, pool);
  if (lr.nLosses >= 10 && lr.twoPlus.losses >= 0.35 && lr.twoPlus.losses - (lr.twoPlus.wins || 0) >= 0.2) {
    const top = [...lr.signalRates].sort((a, b) => (b.losses || 0) - (a.losses || 0))[0];
    const n2 = Math.round(lr.twoPlus.losses * lr.nLosses);
    add({ id: "forced-play", kind: "problema", title: "Jogo forçado depois que o time fica atrás",
      headline: { value: pctTxt(lr.twoPlus.losses), label: `das derrotas · nas vitórias, ${pctTxt(lr.twoPlus.wins)}` },
      evidence: { text: `${n2} de ${lr.nLosses} derrotas (${pctTxt(lr.twoPlus.losses)}) tiveram 2 ou mais sinais de jogo forçado; nas vitórias, ${pctTxt(lr.twoPlus.wins)}. Sinal mais comum: ${top.label.toLowerCase()} (${pctTxt(top.losses)} das derrotas). Com o time 2.000 atrás aos 15 min, você venceu ${lr.conversion.behind.wins} de ${lr.conversion.behind.n}.` },
      n: `${lr.nLosses} derrotas e ${lr.nWins} vitórias com timeline`,
      interpretation: "Os sinais medem comportamento, não emoção. Partidas com o time bem atrás são difíceis de virar em qualquer elo; o que dá para controlar é não transformar uma derrota provável em uma partida de muitas mortes e pouco farm.",
      causes: "Tentar recuperar a partida numa jogada só, seguir lutando depois de o time ficar para trás, parar de farmar para caçar abates.",
      action: "Quando o time ficar 3.000 de ouro atrás, troque para o modo farm: campos, visão e luta só com número a favor. Na Revisão de derrotas, filtre as derrotas com 2+ sinais e procure o momento em que aparece o primeiro.",
      track: "Derrotas com 2+ sinais de jogo forçado (Revisão de derrotas)",
      scores: { impact: 3, frequency: lr.twoPlus.losses >= 0.45 ? 3 : 2, confidence: lr.nLosses >= 30 ? 3 : 2, ease: 2 } });
  }
  // 2d) Pontos fortes estáveis: você contra o jungler inimigo nas mesmas partidas
  if (paired.length >= 15) {
    const oppTeamKills = (g) => (g.raw.participants || []).filter((p) => p.teamId === g.raw.opp.teamId).reduce((s, p) => s + (p.k || 0), 0);
    const strengths = [
      { id: "str-gold10", title: "Início de jogo à frente do jungler inimigo", fmt: "int", unit: "ouro aos 10 min", track: "Diferença de ouro aos 10 para o jungler inimigo",
        pair: (g) => (g.early?.diff10 ? [g.early.at10.gold, g.early.opp10.gold] : null),
        text: "Você chega aos 10 minutos com mais ouro que o jungler inimigo. É a base do seu jogo: os ganks com retorno e o farm do início estão funcionando." },
      { id: "str-ganks", title: "Ganks que viram abate", fmt: "dec2", unit: "abates em ganks no início", track: "Abates em rotas no início (dado da Riot)",
        pair: (g) => { const a = g.raw.me?.challenges?.killsOnLanersEarlyJungleAsJungler, b = g.raw.opp?.challenges?.killsOnLanersEarlyJungleAsJungler; return isNum(a) && isNum(b) ? [a, b] : null; },
        text: "Você converte mais ganks do início em abate que o jungler inimigo." },
      { id: "str-goldmin", title: "Economia acima do jungler inimigo", fmt: "int", unit: "ouro por minuto", track: "Ouro por minuto",
        pair: (g) => (isNum(g.goldMin) && g.durMin > 0 && isNum(g.raw.opp?.gold) ? [g.goldMin, g.raw.opp.gold / g.durMin] : null),
        text: "Ao longo da partida inteira, você gera mais ouro por minuto que o jungler inimigo." },
      { id: "str-kp", title: "Mais presença nas lutas que o jungler inimigo", fmt: "pct", unit: "participação em abates", track: "Participação em abates",
        pair: (g) => { const tk = oppTeamKills(g); return isNum(g.kp) && tk > 0 ? [g.kp, ((g.raw.opp.k || 0) + (g.raw.opp.a || 0)) / tk] : null; },
        text: "Você participa de uma parte maior dos abates do seu time do que o jungler inimigo participa dos do time dele." },
    ];
    for (const st of strengths) {
      const pr = pairedDiff(paired.map(st.pair).filter(Boolean));
      if (!pr || pr.n < 15 || !(pr.ci[0] > 0)) continue;
      add({ id: st.id, kind: "ponto-forte", title: st.title, headline: { label: `${st.unit} · você × jungler inimigo` },
        evidence: { a: pr.a, b: pr.b, diff: pr.diff, ci: pr.ci, fmt: st.fmt, labelA: "Você", labelB: "Jungler inimigo, nas mesmas partidas" },
        n: `${pr.n} partidas com timeline`, interpretation: `${st.text} A comparação é nas mesmas partidas, então elo e patch são iguais dos dois lados.`,
        action: "Mantenha. Use como ponto de partida: as partidas em que isso aparece e você perde costumam ser as de vantagem desperdiçada.",
        track: st.track, scores: { impact: 2, frequency: 3, confidence: pr.n >= 40 ? 3 : 2, ease: 2 } });
    }
  }
  // 4) Early game: perdas de vantagem
  const es = earlyStats(current);
  const behind = es.gold.slice(0, 2).reduce((s, b) => s + b.n, 0);
  const total = es.gold.reduce((s, b) => s + b.n, 0);
  if (total >= 15 && behind / total >= 0.45) {
    add({ id: "early-behind", kind: "problema", title: "Frequentemente atrás do jungler inimigo aos 10 minutos",
      headline: { value: `${Math.round((behind / total) * 100)}%`, label: "das partidas atrás aos 10 min" },
      evidence: { text: `${behind} de ${total} partidas (${Math.round((behind / total) * 100)}%) com 300+ de ouro a menos que o jungler inimigo aos 10.` },
      n: `${total} partidas com timeline`, interpretation: "Diferença de ouro do jungler aos 10 mistura farm, abates e objetivos. Veja o farm aos 10 na aba Early Game.",
      causes: "Clear inicial lento, gank sem retorno, perder o primeiro scuttle, mortes cedo.",
      action: "Compare farm aos 5 e aos 10 com o inimigo. Se o farm empata e o ouro não, o problema são as lutas, não o clear.",
      track: "Diferença de ouro aos 10 (média)", scores: { impact: 2, frequency: 3, confidence: total >= 30 ? 3 : 2, ease: 2 } });
  }
  return scoreDiagnostics(out);
}

// Prioridade de cada diagnóstico (mesma fórmula para todos os blocos do Coach)
export function scoreDiagnostics(list) {
  for (const r of list) {
    const s = r.scores;
    r.score = s.impact * 0.35 + s.frequency * 0.25 + s.confidence * 0.25 + s.ease * 0.15;
    r.priority = r.kind !== "problema" ? "positivo" : r.score >= 2.55 ? "alta" : r.score >= 2.1 ? "media" : "baixa";
  }
  return list.sort((a, b) => (a.kind === b.kind ? b.score - a.score : a.kind === "problema" ? -1 : 1));
}


export function pctTxt(v, digits = 0) {
  if (v == null || !isNum(v)) return "—";
  return `${(v * 100).toFixed(digits).replace(".", ",")}%`;
}

export function champDisplay(meta, key, id) {
  const c = (meta.champions || {})[String(id)];
  if (c && c.name) return c.name;
  const fix = { LeeSin: "Lee Sin", MonkeyKing: "Wukong", JarvanIV: "Jarvan IV", XinZhao: "Xin Zhao", MasterYi: "Master Yi", Khazix: "Kha'Zix", KSante: "K'Sante", RekSai: "Rek'Sai", Belveth: "Bel'Veth", Chogath: "Cho'Gath", Nunu: "Nunu e Willump", TahmKench: "Tahm Kench", AurelionSol: "Aurelion Sol", DrMundo: "Dr. Mundo", Kayn: "Kayn" };
  return fix[key] || key || "—";
}

// Resumo compacto (para o assistente de IA e para exportação)
export function analyticsPacket(current, pool, meta, filtersLabel) {
  const s = summarize(current);
  const r = (v, d = 2) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);
  return {
    filtros: filtersLabel,
    partidas: s.n, comTimeline: s.withTL,
    winRate: r(s.rate, 3), winRateIC95: s.ci ? s.ci.map((x) => r(x, 3)) : null,
    kda: r(s.kda?.value), mortes: r(s.deaths), csMin: r(s.csMin), ouroMin: r(s.goldMin, 0), danoMin: r(s.dmgMin, 0), participacao: r(s.kp, 3),
    porCampeao: championStats(current).slice(0, 5).map((c) => ({ campeao: c.champ, n: c.n, wr: r(c.rate, 3) })),
    itens: itemStats(current, meta).slice(0, 12).map((i) => ({ item: i.name, n: i.n, wr: r(i.rate, 3), mortes: r(i.deaths), csMin: r(i.csMin) })),
    ordemDeCompra: orderStats(current, meta, 4).bySlot.map((s) => ({ slot: s.slot, partidas: s.reached, minutoMediano: r((s.time.median ?? 0) / 60, 1), top: s.items.slice(0, 3).map((i) => ({ item: i.name, n: i.n, wr: r(i.rate, 3) })) })),
    runasChave: keystoneStats(current, meta).slice(0, 5).map((k) => ({ runa: k.name, n: k.n, wr: r(k.rate, 3) })),
    matchups: matchupStats(current).slice(0, 10).map((m) => ({ inimigo: m.champ, n: m.n, wr: r(m.rate, 3), ouro10: r(m.gold10, 0) })),
    earlyGame: (() => { const e = earlyStats(current); return { partidas: e.nTL, aos10: e.rows[1], wrPorNivelAos10: e.level.map((b) => ({ faixa: b.label, n: b.n, wr: r(b.rate, 3) })) }; })(),
    analiseDeMortes: (() => { const d = deathStats(current); return { porFase: d.phases.map((p) => ({ fase: p.label, porPartida: r(p.perGame) })), pickOffsAntesDeObjetivosPorPartida: r(d.critical.perGame), mortesAntesDeObjetivosPorTipo: objectiveDeathStats(current).rows.map((x) => ({ tipo: x.label, total: x.n, porPartida: r(x.perGame), regra: x.rule })) }; })(),
    evolucao20: pool.length >= 40 ? compareWindows(pool.slice(0, 20), pool.slice(20, 40)).map((x) => ({ metrica: x.label, recentes: r(x.a), anteriores: r(x.b), status: x.status })) : "menos de 40 partidas no filtro",
  };
}

// ----------------------------------------------------------------------------
// v2: você contra o jungler inimigo, nas mesmas partidas (para o "frente a frente")
// ----------------------------------------------------------------------------
export function vsEnemyRows(games) {
  const tl = games.filter((g) => g.raw.opp);
  const redeathsOf = (times) => { const t = [...times].sort((a, b) => a - b); return t.slice(1).filter((x, i) => x - t[i] <= 90).length; };
  const oppTeamKills = (g) => (g.raw.participants || []).filter((p) => p.teamId === g.raw.opp.teamId).reduce((s, p) => s + (p.k || 0), 0);
  const ch = (p, k) => { const v = p?.challenges?.[k]; return isNum(v) ? v : null; };
  const defs = [
    { key: "gold10", label: "Ouro aos 10 min", fmt: "int", better: "higher", mode: "abs", scale: 1500,
      pair: (g) => (g.early?.at10 && g.early?.opp10 ? [g.early.at10.gold, g.early.opp10.gold] : null) },
    { key: "ganks", label: "Ganks que viram abate", fmt: "dec2", better: "higher", tip: "Abates em jogadores de rota no início, como jungler (dado da Riot).",
      pair: (g) => { const a = ch(g.raw.me, "killsOnLanersEarlyJungleAsJungler"), b = ch(g.raw.opp, "killsOnLanersEarlyJungleAsJungler"); return isNum(a) && isNum(b) ? [a, b] : null; } },
    { key: "goldMin", label: "Ouro por minuto", fmt: "int", better: "higher",
      pair: (g) => (g.durMin > 0 && isNum(g.raw.opp.gold) ? [g.goldMin, g.raw.opp.gold / g.durMin] : null) },
    { key: "csMin", label: "Farm por minuto", fmt: "dec1", better: "higher",
      pair: (g) => (g.durMin > 0 ? [g.csMin, ((g.raw.opp.cs || 0) + (g.raw.opp.jcs || 0)) / g.durMin] : null) },
    { key: "kp", label: "Participação em abates", fmt: "pct", better: "higher",
      pair: (g) => { const tk = oppTeamKills(g); return isNum(g.kp) && tk > 0 ? [g.kp, ((g.raw.opp.k || 0) + (g.raw.opp.a || 0)) / tk] : null; } },
    { key: "dmgMin", label: "Dano a campeões por minuto", fmt: "int", better: "higher", tip: "Depende do campeão.",
      pair: (g) => (g.durMin > 0 && isNum(g.raw.opp.dmg) ? [g.dmgMin, g.raw.opp.dmg / g.durMin] : null) },
    { key: "deaths", label: "Mortes por partida", fmt: "dec1", better: "lower", pair: (g) => [g.d, g.raw.opp.d || 0] },
    { key: "redeaths", label: "Mortes em sequência (até 90 s)", fmt: "dec2", better: "lower",
      pair: (g) => (g.myEvents && g.raw.timeline?.kills ? [redeathsOf(g.myEvents.deaths.map((d) => d.t)), redeathsOf(g.raw.timeline.kills.filter((k) => k[2] === g.raw.opp.pid).map((k) => k[0]))] : null) },
    { key: "vision", label: "Placar de visão por minuto", fmt: "dec2", better: "higher", tip: "Depende muito do campeão.",
      pair: (g) => (g.durMin > 0 && isNum(g.vision) && isNum(g.raw.opp.vision) ? [g.vision / g.durMin, g.raw.opp.vision / g.durMin] : null) },
  ];
  return defs.map((d) => {
    const pr = pairedDiff(tl.map(d.pair).filter(Boolean));
    if (!pr) return { ...d, a: null, b: null, n: 0 };
    return { ...d, a: pr.a, b: pr.b, n: pr.n, ci: pr.ci, sig: pr.ci[0] > 0 || pr.ci[1] < 0 };
  });
}

// Build de 3 itens (ordem de compra) com maior win rate no período, com amostra mínima.
export function bestBuild(games, meta) {
  const withOrder = games.filter((g) => g.order && g.order.length >= 3);
  const minN = Math.max(4, Math.round(withOrder.length * 0.1));
  const rows = comboStats(games, meta, { size: 3, mode: "seq", minN: 1 }).rows;
  const ok = rows.filter((r) => r.n >= minN).sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0) || b.n - a.n);
  const pick = ok[0] || rows[0] || null;
  if (!pick) return null;
  const gs = withOrder.filter((g) => g.order.slice(0, 3).map((o) => o.id).join(">") === pick.key);
  const ks = [...groupBy(gs, (g) => g.keystone)].sort((a, b) => b[1].length - a[1].length)[0];
  const mostUsed = [...rows].sort((a, b) => b.n - a.n)[0];
  return { ...pick, keystone: ks ? Number(ks[0]) : null, minN, evaluable: withOrder.length, alternatives: ok.slice(1, 3), mostUsed: mostUsed && mostUsed.key !== pick.key ? mostUsed : null };
}

export function recentSummary(games, n = 20) {
  const gs = games.slice(0, n);
  const wr = winRate(gs);
  return { n: gs.length, ...wr, k: mean(gs.map((g) => g.k)), d: mean(gs.map((g) => g.d)), a: mean(gs.map((g) => g.a)), kda: aggregateKDA(gs), kp: mean(gs.map((g) => g.kp)), csMin: mean(gs.map((g) => g.csMin)), seq: gs.map((g) => g.win) };
}
