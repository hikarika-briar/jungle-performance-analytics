// ----------------------------------------------------------------------------
// Rumo ao Challenger: compara o seu jogo com o de jogadores de referência.
// Os dados dos jogadores vêm do coletor (modo --referencias) num arquivo próprio,
// que nunca se mistura com as suas partidas.
// ----------------------------------------------------------------------------
import * as E from "./engine.js";

export const REF_SCHEMA = "jungle-performance-analytics-referencias";
export const KEEP_PER_PLAYER = 80;
export const MIN_GAMES_PER_PLAYER = 8;
export const isRefsFile = (raw) => !!raw && typeof raw === "object" && raw.schema === REF_SCHEMA;

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const share = (arr, pred) => (arr.length ? arr.filter(pred).length / arr.length : null);

export function validateRefs(raw) {
  if (!isRefsFile(raw)) throw new Error("Este não é o arquivo de jogadores de referência. Gere com o atualizar_referencias.bat (arquivo saida\\referencias_challenger.json).");
  if (!Array.isArray(raw.players)) throw new Error("O arquivo não tem a lista de jogadores ('players').");
  return true;
}

// A lista de jogadores segue o arquivo novo (quem saiu do referencias.txt sai daqui).
// As partidas de quem continua são somadas às anteriores, sem duplicar.
export function mergeRefs(base, incoming) {
  validateRefs(incoming);
  const old = new Map((base?.players || []).map((p) => [p.puuid, p]));
  const report = { players: 0, added: 0, total: 0, removed: 0 };
  const players = [];
  for (const p of incoming.players) {
    if (!p || !p.puuid || !Array.isArray(p.matches)) continue;
    const prev = old.get(p.puuid);
    const map = new Map((prev?.matches || []).map((m) => [m.matchId, m]));
    for (const m of p.matches) {
      if (!m || !m.matchId || !m.me) continue;
      const had = map.get(m.matchId);
      if (!had) report.added++;
      if (!had || (!had.timeline && m.timeline)) map.set(m.matchId, m);
    }
    const matches = [...map.values()].sort((a, b) => (b.gameStart || 0) - (a.gameStart || 0)).slice(0, KEEP_PER_PLAYER);
    report.total += matches.length;
    report.players++;
    players.push({ riotId: p.riotId || p.listedAs, listedAs: p.listedAs || p.riotId, puuid: p.puuid, matches });
  }
  const keep = new Set(players.map((p) => p.puuid));
  report.removed = [...old.keys()].filter((k) => !keep.has(k)).length;
  return {
    refs: {
      schema: REF_SCHEMA, schemaVersion: 1,
      generatedAt: incoming.generatedAt || new Date().toISOString(),
      queue: incoming.queue || 420,
      notFound: incoming.notFound || [],
      players,
      meta: E.mergeMeta(base?.meta, incoming.meta || {}),
    },
    report,
  };
}

// O mesmo arquivo de referências é preparado uma vez só (as abas reaproveitam as partidas prontas).
let PREP_CACHE = { refs: null, out: null };
export function prepareRefs(refs) {
  if (!refs || !Array.isArray(refs.players)) return null;
  if (PREP_CACHE.refs === refs) return PREP_CACHE.out;
  const out = prepareRefsNow(refs);
  PREP_CACHE = { refs, out };
  return out;
}
function prepareRefsNow(refs) {
  const meta = refs.meta || {};
  const queue = refs.queue || 420;
  const players = refs.players.map((p) => {
    const { games } = E.prepare({ meta, player: { puuid: p.puuid }, matches: p.matches });
    return {
      id: p.puuid,
      riotId: p.riotId || p.listedAs,
      server: p.server || "BR",
      games: games.filter((g) => !g.remake && g.position === "JUNGLE" && g.queueId === queue),
    };
  }).filter((p) => p.games.length);
  return { players, meta, generatedAt: refs.generatedAt, notFound: refs.notFound || [] };
}

// As suas partidas vistas pelo lado do jungler inimigo: a linha de base do seu elo.
export function opponentGames(myGames, meta) {
  const out = [];
  for (const g of myGames) {
    const m = g.raw;
    if (!m || !m.opp || !m.me) continue;
    let tl = null;
    if (m.timeline && (m.timeline.opp || []).length) {
      tl = { ...m.timeline, me: m.timeline.opp, opp: m.timeline.me || [], items: [] };
    }
    const teamKills = (m.participants || []).filter((p) => p.teamId === m.opp.teamId).reduce((s, p) => s + (p.k || 0), 0);
    const og = E.prepareGame({ ...m, matchId: m.matchId + ":adv", me: m.opp, opp: m.me, teamKills, timeline: tl, oppView: true }, meta);
    if (og) out.push(og);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Métricas por partida
// ---------------------------------------------------------------------------
const chal = (g, k) => { const v = g.raw.me?.challenges?.[k]; return isNum(v) ? v : null; };
const frame = (g, m) => (g.raw.timeline?.me || []).find((r) => Math.round(r[0] / 60) === m) || null;
const csAt = (g, m) => { const r = frame(g, m); return r ? (r[5] || 0) + (r[6] || 0) : null; };
const takedownsBefore = (g, t) => (g.myEvents ? [...g.myEvents.kills, ...g.myEvents.assists].filter((e) => e.t < t).length : null);
const deathsBefore = (g, t) => (g.myEvents ? g.myEvents.deaths.filter((e) => e.t < t).length : null);
const teamElite = (g, type, pred = () => true) => (g.elite ? g.elite.filter((e) => e.type === type && pred(e)).length : null);

export function firstRecallMin(g) {
  if (g.raw.oppView || !g.raw.timeline) return null;
  const buys = (g.raw.timeline.items || []).filter((e) => e[1] === "P" && e[0] > 100).sort((a, b) => a[0] - b[0]);
  return buys.length ? buys[0][0] / 60 : null;
}
export function level6Min(g) {
  const r = (g.raw.timeline?.me || []).find((x) => (x[4] || 0) >= 6);
  return r ? r[0] / 60 : null;
}

// better: "higher" | "lower" | "neutral" (estilo, sem melhor ou pior)
export const GROUPS = [
  ["early", "Início de jogo (até 15 min)"],
  ["obj", "Objetivos"],
  ["farm", "Farm e economia"],
  ["fight", "Lutas e mortes"],
  ["vision", "Visão"],
];
export const METRICS = [
  { key: "firstClear", group: "early", label: "Farm aos 4 min", short: "Farm aos 4'", fmt: "dec1", better: "higher",
    tip: "Farm total no minuto 4: mostra o tamanho do primeiro clear.", f: (g) => csAt(g, 4),
    look: "a rota do primeiro clear e quantos campos eles limpam antes do primeiro gank ou da primeira escuttle" },
  { key: "jcs10", group: "early", label: "Farm de selva até os 10 min", short: "Selva até 10'", fmt: "dec1", better: "higher",
    tip: "Monstros da selva abatidos nos 10 primeiros minutos (dado da Riot).", f: (g) => chal(g, "jungleCsBefore10Minutes"),
    look: "como eles encaixam os ganks entre os campos, sem deixar a selva parada" },
  { key: "lvl6", group: "early", label: "Minuto do nível 6", short: "Nível 6", fmt: "dec1", better: "lower", unit: "min",
    tip: "Primeiro minuto em que aparece com nível 6 (precisão de 1 minuto).", f: level6Min,
    look: "o quanto eles priorizam farm e experiência antes de forçar a primeira luta grande" },
  { key: "recall", group: "early", label: "Primeiro recall", short: "1º recall", fmt: "dec1", better: "neutral", unit: "min",
    tip: "Minuto da primeira compra depois do início da partida. É estilo: não existe certo ou errado sozinho.", f: firstRecallMin },
  { key: "td10", group: "early", label: "Abates + assistências antes dos 10 min", short: "Abates até 10'", fmt: "dec2", better: "higher",
    tip: "Participação em abates nos 10 primeiros minutos.", f: (g) => takedownsBefore(g, 600),
    look: "quando eles escolhem gankar: em que minuto, em qual rota e o que a rota inimiga tinha acabado de fazer" },
  { key: "earlyGanks", group: "early", label: "Abates em rotas no início (ganks)", short: "Ganks com abate", fmt: "dec2", better: "higher",
    tip: "Abates em jogadores de rota no início, como jungler (dado da Riot).", f: (g) => chal(g, "killsOnLanersEarlyJungleAsJungler"),
    look: "o posicionamento antes do gank: por onde entram e se esperam o feitiço da rota inimiga sair" },
  { key: "gold10", mirror: true, group: "early", label: "Ouro vs. jungler aos 10", short: "Ouro vs jg 10'", fmt: "int", better: "higher",
    tip: "Seu ouro menos o do jungler inimigo no minuto 10.", f: (g) => g.early?.diff10?.gold ?? null,
    look: "como eles saem do início de jogo à frente do jungler inimigo: farm, escuttles e onde trocam lado do mapa" },
  { key: "xp10", mirror: true, group: "early", label: "Experiência vs. jungler aos 10", short: "XP vs jg 10'", fmt: "int", better: "higher",
    tip: "Sua experiência menos a do jungler inimigo no minuto 10.", f: (g) => g.early?.diff10?.xp ?? null,
    look: "quanto tempo eles passam farmando e quanto passam esperando em rota" },
  { key: "gold15", mirror: true, group: "early", label: "Ouro vs. jungler aos 15", short: "Ouro vs jg 15'", fmt: "int", better: "higher",
    tip: "Seu ouro menos o do jungler inimigo no minuto 15.", f: (g) => g.early?.diff15?.gold ?? null,
    look: "o que eles fazem entre os minutos 10 e 15: farm, invasão ou pressão nos objetivos" },
  { key: "team15", mirror: true, group: "early", label: "Ouro do time aos 15", short: "Time aos 15'", fmt: "int", better: "higher", partial: true,
    tip: "Diferença de ouro do time inteiro no minuto 15. Depende do time, não só do jungler.", f: (g) => E.teamDiffAt(g, 900)?.goldDiff ?? null },
  { key: "deaths15", group: "early", label: "Mortes antes dos 15 min", short: "Mortes até 15'", fmt: "dec2", better: "lower",
    tip: "Mortes nos 15 primeiros minutos.", f: (g) => deathsBefore(g, 900),
    look: "quando eles desistem de uma jogada: o momento em que recuam em vez de insistir" },
  { key: "invade", group: "early", label: "Campos roubados da selva inimiga", short: "Invasão", fmt: "dec1", better: "neutral",
    tip: "Monstros abatidos na selva inimiga (dado da Riot). É estilo de jogo.", f: (g) => chal(g, "enemyJungleMonsterKills") },
  { key: "scuttle", group: "early", label: "Escuttles por partida", short: "Escuttles", fmt: "dec2", better: "higher",
    tip: "Arautos-do-rio (escuttles) abatidos na partida (dado da Riot).", f: (g) => chal(g, "scuttleCrabKills"),
    look: "o timing da escuttle: quando eles chegam no rio e com qual rota do lado" },

  { key: "objPart", group: "obj", label: "Participação nos objetivos do time", short: "Part. objetivos", fmt: "pct", better: "higher",
    tip: "Dos objetivos que o seu time pegou, em quantos você abateu ou ajudou.", f: (g) => {
      if (!g.elite) return null; const mine = g.elite.filter((e) => e.mine); return mine.length ? mine.filter((e) => e.me).length / mine.length : null; },
    look: "como eles se posicionam antes do objetivo nascer e quanto tempo antes chegam ao fosso" },
  { key: "dragons", mirror: true, group: "obj", label: "Dragões do time por partida", short: "Dragões", fmt: "dec2", better: "higher", partial: true,
    tip: "Dragões (incluindo Ancião) que o seu time pegou.", f: (g) => teamElite(g, "DRAGON", (e) => e.mine) },
  { key: "enemyDrag15", mirror: true, group: "obj", label: "Dragões inimigos antes dos 15 min", short: "Drag. inimigos 15'", fmt: "dec2", better: "lower", partial: true,
    tip: "Dragões que o time inimigo pegou nos 15 primeiros minutos.", f: (g) => teamElite(g, "DRAGON", (e) => !e.mine && e.t < 900),
    look: "o que eles fazem quando não dá para disputar o dragão: qual objetivo trocam e em que lado do mapa" },
  { key: "grubs", mirror: true, group: "obj", label: "Vastilarvas do time por partida", short: "Vastilarvas", fmt: "dec2", better: "higher", partial: true,
    tip: "Vastilarvas que o seu time abateu.", f: (g) => teamElite(g, "HORDE", (e) => e.mine) },
  { key: "picks", group: "obj", label: "Pick-offs antes de objetivos", short: "Pick-offs", fmt: "dec2", better: "lower",
    tip: "Morreu sozinho, sem troca, 15 s ou mais antes de um objetivo do inimigo.", f: (g) => E.pickoffsBeforeObjectives(g),
    look: "por onde eles andam no minuto antes do objetivo e quanta visão colocam antes de entrar no rio" },

  { key: "csMin", group: "farm", label: "Farm por minuto", short: "CS/min", fmt: "dec1", better: "higher",
    tip: "Tropas e monstros por minuto, na partida toda.", f: (g) => g.csMin,
    look: "os momentos em que eles voltam a farmar entre uma luta e outra" },
  { key: "farm1525", group: "farm", label: "Farm por minuto dos 15 aos 25", short: "CS/min 15–25'", fmt: "dec1", better: "higher",
    tip: "Farm no meio de jogo, quando o mapa abre.", f: (g) => { if (g.durMin < 25.5) return null; const a = csAt(g, 15), b = csAt(g, 25); return a == null || b == null ? null : (b - a) / 10; },
    look: "como eles mantêm o farm no meio de jogo pegando campos e ondas no caminho dos objetivos" },
  { key: "goldMin", group: "farm", label: "Ouro por minuto", short: "Ouro/min", fmt: "int", better: "higher",
    tip: "Ouro ganho por minuto na partida.", f: (g) => g.goldMin },

  { key: "deaths", group: "fight", label: "Mortes por partida", short: "Mortes", fmt: "dec1", better: "lower",
    tip: "Mortes na partida.", f: (g) => g.d,
    look: "as lutas que eles não pegam: quando recuam e deixam o objetivo ir" },
  { key: "kp", group: "fight", label: "Participação em abates", short: "KP", fmt: "pct", better: "higher",
    tip: "Abates + assistências sobre os abates do time.", f: (g) => g.kp,
    look: "como eles chegam nas lutas do time a tempo" },
  { key: "dmgMin", group: "fight", label: "Dano a campeões por minuto", short: "Dano/min", fmt: "int", better: "neutral",
    tip: "Depende muito do campeão. Fica como estilo.", f: (g) => g.dmgMin },
  { key: "soloKills", group: "fight", label: "Abates solo", short: "Abates solo", fmt: "dec2", better: "neutral",
    tip: "Abates sem ajuda de aliados (dado da Riot). É estilo.", f: (g) => chal(g, "soloKills") },

  { key: "visionMin", group: "vision", champDep: true, label: "Placar de visão por minuto", short: "Visão/min", fmt: "dec2", better: "higher",
    tip: "Placar de visão dividido pela duração. Depende muito do campeão: Lee Sin e campeões de visão sobem; Briar e Hecarim ficam naturalmente baixos. Por isso não entra no Coach Challenger.", f: (g) => (isNum(g.vision) && g.durMin > 0 ? g.vision / g.durMin : null),
    look: "onde eles colocam sentinelas antes dos objetivos e quando trocam o amuleto pela lente" },
  { key: "controlWards", group: "vision", label: "Sentinelas de controle colocadas", short: "Controle", fmt: "dec1", better: "neutral",
    tip: "Sentinelas de controle colocadas na partida (dado da Riot). Fica como estilo: entre os Challengers de referência, alguns quase não usam, e o Lee Sin usa muitas para pular com o W.", f: (g) => chal(g, "controlWardsPlaced"),
    look: "em quais recalls eles compram sentinela de controle e onde ela vai" },
  { key: "wardKills", group: "vision", champDep: true, label: "Sentinelas inimigas destruídas", short: "Ward kills", fmt: "dec1", better: "higher",
    tip: "Sentinelas inimigas destruídas (dado da Riot). Varia muito com o campeão, então não entra no Coach Challenger.", f: (g) => chal(g, "wardTakedowns"),
    look: "quando eles limpam a visão inimiga antes de um objetivo ou de um gank" },
];
export const THEMES = {
  mortes: "Mortes e jogo forçado", farm: "Farm e ritmo", rio: "Rio e objetivos", inicio: "Início de jogo", lutas: "Presença nas lutas", visao: "Visão",
};
const THEME_OF = {
  deaths15: "mortes", picks: "mortes", deaths: "mortes",
  firstClear: "farm", jcs10: "farm", lvl6: "farm", csMin: "farm", farm1525: "farm", goldMin: "farm",
  scuttle: "rio", objPart: "rio", invade: "rio",
  td10: "inicio", earlyGanks: "inicio", gold10: "inicio", xp10: "inicio", gold15: "inicio",
  kp: "lutas", visionMin: "visao", controlWards: "visao", wardKills: "visao",
};
for (const m of METRICS) m.theme = THEME_OF[m.key] || m.group;
export const METRIC = Object.fromEntries(METRICS.map((m) => [m.key, m]));

// Comportamento à frente e atrás: taxas, não médias por partida.
export const BEHAVIOR = [
  { key: "conversion", mirror: true, label: "Vitórias com o time 2.000 à frente aos 15", fmt: "pct", better: "higher", tip: "De cada 10 partidas em que o time estava 2.000 de ouro à frente aos 15 min, quantas terminaram em vitória." },
  { key: "comeback", mirror: true, label: "Viradas com o time 2.000 atrás aos 15", fmt: "pct", better: "higher", tip: "De cada 10 partidas em que o time estava 2.000 de ouro atrás aos 15 min, quantas terminaram em vitória." },
  { key: "lossSignals", theme: "mortes", short: "Derrotas com 2+ sinais", label: "Derrotas com 2 ou mais sinais de jogo forçado", fmt: "pct", better: "lower", tip: "Mesmos 4 sinais da Revisão de derrotas, calculados com o farm normal de cada jogador.",
    look: "como eles jogam as derrotas: quanto continuam farmando e quantas lutas recusam depois que o time fica para trás" },
  { key: "afterBehind", theme: "mortes", short: "Mortes com o time 3k atrás", label: "Mortes depois de o time ficar 3.000 atrás", fmt: "dec1", better: "lower", tip: "Média de mortes a partir do momento em que o time ficou 3.000 de ouro atrás, só nas partidas em que isso aconteceu.",
    f: (g) => { const s = E.gameSignals(g, null); return s && s.behindAt != null ? s.afterBehind : null; },
    look: "o que eles fazem quando o time fica 3.000 de ouro atrás: onde farmam, quando recuam e quais lutas deixam passar" },
  { key: "redeaths", theme: "mortes", short: "Mortes em sequência", label: "Mortes em sequência (até 90 s) por partida", fmt: "dec2", better: "lower", tip: "Quantas vezes por partida morreu de novo até 90 s depois da morte anterior.",
    f: (g) => E.gameSignals(g, null)?.redeaths ?? null,
    look: "o que eles fazem logo depois de renascer: se voltam direto para a mesma briga ou fazem um campo, uma onda ou uma sentinela antes" },
];

export function groupStats(games) {
  const values = {};
  for (const m of METRICS) {
    const v = games.map(m.f).filter(isNum);
    values[m.key] = { mean: v.length ? v.reduce((s, x) => s + x, 0) / v.length : null, n: v.length };
  }
  const tl = games.filter((g) => g.hasTL && g.myEvents);
  const normal = E.normalFarm1525(games);
  const sig = new Map(tl.map((g) => [g.id, E.gameSignals(g, normal)]));
  const t15 = (g) => E.teamDiffAt(g, 900)?.goldDiff;
  const ahead = tl.filter((g) => t15(g) >= 2000), behind = tl.filter((g) => t15(g) <= -2000);
  const losses = tl.filter((g) => !g.win);
  const wentBehind = tl.filter((g) => sig.get(g.id)?.behindAt != null);
  const behavior = {
    conversion: { value: ahead.length ? ahead.filter((g) => g.win).length / ahead.length : null, n: ahead.length, x: ahead.filter((g) => g.win).length },
    comeback: { value: behind.length ? behind.filter((g) => g.win).length / behind.length : null, n: behind.length, x: behind.filter((g) => g.win).length },
    lossSignals: { value: share(losses, (g) => sig.get(g.id).on.length >= 2), n: losses.length, x: losses.filter((g) => sig.get(g.id).on.length >= 2).length },
    afterBehind: { value: E.mean(wentBehind.map((g) => sig.get(g.id).afterBehind)), n: wentBehind.length },
    redeaths: { value: E.mean(tl.map((g) => sig.get(g.id).redeaths)), n: tl.length },
  };
  const wr = E.winRate(games);
  return { n: games.length, nTL: tl.length, wr, kda: E.aggregateKDA(games), values, behavior };
}

const RATE_MIN_N = 5;
function playerValue(st, key) {
  if (METRIC[key]) { const v = st.values[key]; return v && v.n >= MIN_GAMES_PER_PLAYER ? v.mean : null; }
  const b = st.behavior[key]; return b && b.n >= RATE_MIN_N ? b.value : null;
}

export function band(playerStats, key) {
  const vals = playerStats.map((p) => ({ id: p.id, v: playerValue(p.stats, key) })).filter((x) => isNum(x.v));
  const d = E.describe(vals.map((x) => x.v));
  // "center" é o valor de comparação dos Challengers: a média entre os jogadores (cada um pesa igual).
  return { ...d, center: d.mean, values: vals };
}

export function positionOf(my, b, better) {
  if (!isNum(my) || !b || !b.n) return null;
  if (better === "neutral") return { status: "estilo", z: 0, beats: null, of: b.n };
  const iqr = isNum(b.p75) && isNum(b.p25) ? b.p75 - b.p25 : 0;
  const spread = Math.max(iqr, Math.abs(b.center || 0) * 0.1, 1e-6);
  const sign = better === "lower" ? -1 : 1;
  const z = (sign * (my - b.center)) / spread;
  const worseThanAll = better === "lower" ? my > b.max : my < b.min;
  const beats = b.values.filter((x) => (better === "lower" ? my < x.v : my > x.v)).length;
  return { status: z >= 0 ? "nivel" : worseThanAll ? "abaixo" : "faixa", z, beats, of: b.n };
}

// ---------------------------------------------------------------------------
// Filtro de campeões das referências
// ---------------------------------------------------------------------------
export function champTags(meta, g) {
  return meta?.champions?.[String(g.champId)]?.tags || [];
}
export function filterRefGames(prep, champFilter, meta) {
  if (!prep) return [];
  return prep.players.map((p) => ({
    ...p,
    games: p.games.filter((g) => {
      if (champFilter === "all") return true;
      if (champFilter === "noLee") return g.champ !== "LeeSin";
      if (champFilter === "fighter") { const t = champTags(meta, g); return t.includes("Fighter") || t.includes("Assassin"); }
      return g.champ === champFilter;
    }),
  }));
}
export function refChampionOptions(prep) {
  const count = new Map();
  for (const p of prep?.players || []) for (const g of p.games) count.set(g.champ, (count.get(g.champ) || 0) + 1);
  return [...count.entries()].filter(([, n]) => n >= 5).sort((a, b) => b[1] - a[1]);
}

// ---------------------------------------------------------------------------
// Estilo de jogo e semelhança
// ---------------------------------------------------------------------------
export const STYLE = [
  { key: "td10", tag: "Agressivo no início", dir: 1 },
  { key: "earlyGanks", tag: "Ganker", dir: 1 },
  { key: "invade", tag: "Invasor", dir: 1 },
  { key: "csMin", tag: "Farmador", dir: 1 },
  { key: "objPart", tag: "Joga pelos objetivos", dir: 1 },
  { key: "visionMin", tag: "Controle de visão", dir: 1 },
  { key: "deaths", tag: "Joga seguro", dir: -1 },
  { key: "kp", tag: "Presente nas lutas", dir: 1 },
  { key: "dmgMin", tag: "Muito dano", dir: 1 },
];

export function styleProfiles(entities) {
  // entities: [{id, label, stats, isMe}] — a escala vem só das referências
  const refs = entities.filter((e) => !e.isMe);
  const scale = {};
  for (const s of STYLE) {
    const v = refs.map((e) => e.stats.values[s.key]?.mean).filter(isNum);
    const d = E.describe(v);
    scale[s.key] = { mean: d.mean, sd: d.sd && d.sd > 0 ? d.sd : null };
  }
  const zOf = (e) => Object.fromEntries(STYLE.map((s) => {
    const v = e.stats.values[s.key]?.mean, sc = scale[s.key];
    return [s.key, isNum(v) && sc.sd ? (v - sc.mean) / sc.sd : null];
  }));
  const out = entities.map((e) => {
    const z = zOf(e);
    const tags = STYLE.map((s) => ({ tag: s.tag, score: isNum(z[s.key]) ? z[s.key] * s.dir : null }))
      .filter((t) => isNum(t.score) && t.score >= 0.7).sort((a, b) => b.score - a.score).slice(0, 3).map((t) => t.tag);
    return { ...e, z, tags };
  });
  const me = out.find((e) => e.isMe);
  if (me) {
    for (const e of out) {
      if (e.isMe) continue;
      const diffs = STYLE.map((s) => (isNum(me.z[s.key]) && isNum(e.z[s.key]) ? (me.z[s.key] - e.z[s.key]) ** 2 : null)).filter(isNum);
      e.distance = diffs.length >= 4 ? Math.sqrt(diffs.reduce((a, b) => a + b, 0) / diffs.length) : null;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Curvas minuto a minuto e momento das ações
// ---------------------------------------------------------------------------
export function minuteCurves(games, maxMin = 25) {
  const rows = [];
  const tl = games.filter((g) => g.raw.timeline && (g.raw.timeline.me || []).length);
  for (let m = 1; m <= maxMin; m++) {
    const gd = [], xd = [], cs = [], tg = [];
    for (const g of tl) {
      if (g.durMin < m) continue;
      const a = (g.raw.timeline.me || []).find((r) => Math.round(r[0] / 60) === m);
      const b = (g.raw.timeline.opp || []).find((r) => Math.round(r[0] / 60) === m);
      if (a) cs.push((a[5] || 0) + (a[6] || 0));
      if (a && b) { gd.push(a[1] - b[1]); xd.push(a[3] - b[3]); }
      const t = E.teamDiffAt(g, m * 60);
      if (t) tg.push(t.goldDiff);
    }
    rows.push({ m, gold: E.mean(gd), xp: E.mean(xd), cs: E.mean(cs), team: E.mean(tg), n: gd.length });
  }
  return rows;
}

export function eventTiming(games, bin = 2, maxMin = 30) {
  const tl = games.filter((g) => g.myEvents);
  const out = [];
  for (let b = 0; b < maxMin; b += bin) {
    const alive = tl.filter((g) => g.durMin > b);
    const lo = b * 60, hi = (b + bin) * 60;
    const td = alive.reduce((s, g) => s + [...g.myEvents.kills, ...g.myEvents.assists].filter((e) => e.t >= lo && e.t < hi).length, 0);
    const dd = alive.reduce((s, g) => s + g.myEvents.deaths.filter((e) => e.t >= lo && e.t < hi).length, 0);
    out.push({ label: `${b}–${b + bin}`, from: b, takedowns: alive.length ? td / alive.length : null, deaths: alive.length ? dd / alive.length : null, n: alive.length });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Partidas de referência para assistir (melhores exemplos de uma métrica)
// ---------------------------------------------------------------------------
export function exampleGames(players, key, k = 3) {
  const m = METRIC[key] || BEHAVIOR.find((b) => b.key === key);
  if (!m || !m.f || m.better === "neutral") return [];
  const all = [];
  for (const p of players) for (const g of p.games) { const v = m.f(g); if (isNum(v)) all.push({ player: p, g, v }); }
  const wins = all.filter((x) => x.g.win);
  const pool = wins.length >= k ? wins : all;
  pool.sort((a, b) => (m.better === "lower" ? a.v - b.v : b.v - a.v) || b.g.start - a.g.start);
  const out = [], seen = new Set();
  for (const x of pool) { if (seen.has(x.player.id)) continue; seen.add(x.player.id); out.push(x); if (out.length >= k) break; }
  for (const x of pool) { if (out.length >= k) break; if (!out.includes(x)) out.push(x); }
  return out;
}

// ---------------------------------------------------------------------------
// Comparação completa
// ---------------------------------------------------------------------------
export function compare(myGames, refPlayers, oppGames) {
  const players = refPlayers.filter((p) => p.games.length >= MIN_GAMES_PER_PLAYER)
    .map((p) => ({ ...p, stats: groupStats(p.games) }));
  const me = groupStats(myGames);
  const elo = oppGames && oppGames.length ? groupStats(oppGames) : null;
  const refGames = players.flatMap((p) => p.games);
  const pooled = groupStats(refGames);
  const rows = METRICS.map((m) => {
    const b = band(players, m.key);
    const my = me.values[m.key].mean;
    return { ...m, me: my, meN: me.values[m.key].n, elo: elo && !m.mirror ? elo.values[m.key].mean : null, band: b, pos: positionOf(my, b, m.better) };
  });
  const behavior = BEHAVIOR.map((m) => {
    const b = band(players, m.key);
    const my = me.behavior[m.key];
    return { ...m, me: my.value, meN: my.n, meX: my.x, elo: elo && !m.mirror ? elo.behavior[m.key].value : null, eloN: elo && !m.mirror ? elo.behavior[m.key].n : 0,
      band: b, pooled: pooled.behavior[m.key], pos: my.n >= RATE_MIN_N ? positionOf(my.value, b, m.better) : null };
  });
  // Challengers jogando o seu campeão principal (quando houver partidas suficientes)
  const mainChamp = topChamps(myGames, 1)[0] || null;
  const mainGames = mainChamp ? refPlayers.flatMap((p) => p.games.filter((g) => g.champ === mainChamp.champ)) : [];
  const main = mainGames.length >= 5 ? { champ: mainChamp.champ, champId: mainChamp.champId, n: mainGames.length,
    players: refPlayers.filter((p) => p.games.some((g) => g.champ === mainChamp.champ)).map((p) => p.riotId), stats: groupStats(mainGames) } : null;
  for (const r of rows) { r.main = main ? main.stats.values[r.key].mean : null; r.mainN = main ? main.stats.values[r.key].n : 0; }
  for (const r of behavior) { r.main = main ? main.stats.behavior[r.key].value : null; r.mainN = main ? main.stats.behavior[r.key].n : 0; }

  const controllable = [
    ...rows.filter((r) => r.pos && r.better !== "neutral" && !r.partial && !r.champDep && r.meN >= 10),
    ...behavior.filter((r) => r.pos && !r.mirror && r.meN >= 10),
  ];
  const gaps = controllable.filter((r) => r.pos.status !== "nivel").sort((a, b) => a.pos.z - b.pos.z);
  const strengths = controllable.filter((r) => r.pos.status === "nivel").sort((a, b) => b.pos.z - a.pos.z);
  const byTheme = new Map();
  for (const r of gaps) { const t = r.theme || r.group; if (!byTheme.has(t)) byTheme.set(t, []); byTheme.get(t).push(r); }
  const focus = [...byTheme.entries()].map(([theme, list]) => ({ theme, label: THEMES[theme] || theme, lead: list[0], related: list.slice(1) }))
    .sort((a, b) => a.lead.pos.z - b.lead.pos.z);
  const style = styleProfiles([
    { id: "me", label: "Você", stats: me, isMe: true },
    ...players.map((p) => ({ id: p.id, label: p.riotId, stats: p.stats, games: p.games })),
  ]);
  const similar = style.filter((e) => !e.isMe && isNum(e.distance)).sort((a, b) => a.distance - b.distance);
  return {
    players, me, elo, pooled, rows, behavior, gaps, strengths, focus, main, style, similar,
    curves: { me: minuteCurves(myGames), refs: minuteCurves(refGames), elo: oppGames ? minuteCurves(oppGames).map((r) => ({ ...r, gold: null, xp: null, team: null })) : null },
    timing: { me: eventTiming(myGames), refs: eventTiming(refGames), elo: oppGames ? eventTiming(oppGames) : null },
    nRefGames: refGames.length,
  };
}

export function topChamps(games, k = 3) {
  const c = new Map();
  for (const g of games) { const o = c.get(g.champ) || { champ: g.champ, champId: g.champId, n: 0, w: 0 }; o.n++; if (g.win) o.w++; c.set(g.champ, o); }
  return [...c.values()].sort((a, b) => b.n - a.n).slice(0, k);
}

export function opggUrl(riotId, server = "BR") {
  if (!riotId || !riotId.includes("#")) return null;
  const [name, tag] = [riotId.slice(0, riotId.lastIndexOf("#")), riotId.slice(riotId.lastIndexOf("#") + 1)];
  const region = String(server || "BR").toLowerCase();
  return `https://www.op.gg/summoners/${region}/${encodeURIComponent(name)}-${encodeURIComponent(tag)}`;
}
