// ============================================================================
// Relatório de uma partida: nota de cada jogador, duelo de junglers e as jogadas
// de cada jungler com a resposta do outro. Funções puras (os testes rodam no Node).
// Coordenadas: as da API da Riot (0 a ~14.900; time azul embaixo à esquerda).
// ============================================================================
import { mean, champDisplay, OBJECTIVE_LABELS, objectiveType, voiceOf } from "./engine.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const dist = (a, b) => (a && b && a.x != null && b.x != null ? Math.hypot(a.x - b.x, a.y - b.y) : Infinity);

// ----------------------------------------------------------------------------
// Regiões do mapa
// ----------------------------------------------------------------------------
// Rotas como linhas (do lado azul ao vermelho) e os campos da selva que ficam perto delas,
// para o sapo e o krug não contarem como lane.
const LANE_PATHS = {
  top: [[1100, 4600], [1100, 12400], [2400, 13750], [10200, 13800]],
  bot: [[4600, 1050], [12400, 1050], [13750, 2400], [13800, 10200]],
  mid: [[4300, 4300], [10500, 10600]],
};
const LANE_WIDTH = { top: 1500, bot: 1500, mid: 1100 };
const BLUE_CAMPS = [[2100, 8450], [3820, 7930], [3780, 6440], [6950, 5400], [7770, 4040], [8390, 2700]];
const CAMPS = [...BLUE_CAMPS, ...BLUE_CAMPS.map(([x, y]) => [14780 - x, 14890 - y])];
function segDist(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
const pathDist = (x, y, pts) => Math.min(...pts.slice(1).map((p, i) => segDist(x, y, pts[i], p)));

export function mapRegion(x, y) {
  if (x == null || y == null) return null;
  if (x < 4800 && y < 4800 && x + y < 7800) return { zone: "base", side: 100 };
  if (x > 10100 && y > 10100 && x + y > 21900) return { zone: "base", side: 200 };
  const nearCamp = CAMPS.some(([cx, cy]) => Math.hypot(x - cx, y - cy) < 750);
  if (!nearCamp) {
    let best = null, bd = Infinity;
    for (const [lane, pts] of Object.entries(LANE_PATHS)) { const d = pathDist(x, y, pts); if (d <= LANE_WIDTH[lane] && d < bd) { bd = d; best = lane; } }
    if (best) return { zone: best, side: null };
  }
  if (Math.abs(x + y - 14850) < 1500) return { zone: "river", side: null };
  return { zone: "jungle", side: x + y < 14850 ? 100 : 200 };
}

export function regionLabel(r, viewTeam, V) {
  if (!r) return "";
  if (r.zone === "base") return r.side === viewTeam ? `na ${V ? V.base : "sua base"}` : "na base inimiga";
  if (r.zone === "jungle") return r.side === viewTeam ? `na ${V ? V.jungle : "sua selva"}` : "na selva inimiga";
  return { top: "no topo", mid: "no meio", bot: "no bot", river: "no rio" }[r.zone] || "";
}
const LANES = new Set(["top", "mid", "bot"]);

// ----------------------------------------------------------------------------
// Nota da partida (1 a 10) de cada jogador, comparando os 10 entre si.
// 5,5 = média desta partida. Pesos por posição; o que não veio nos dados sai da conta.
// ----------------------------------------------------------------------------
export const RATING_WEIGHTS = {
  JUNGLE: { combat: 0.28, damage: 0.16, economy: 0.14, vision: 0.1, objectives: 0.22, frontline: 0.1 },
  TOP: { combat: 0.26, damage: 0.22, economy: 0.2, vision: 0.06, objectives: 0.1, frontline: 0.16 },
  MIDDLE: { combat: 0.28, damage: 0.28, economy: 0.2, vision: 0.06, objectives: 0.08, frontline: 0.1 },
  BOTTOM: { combat: 0.26, damage: 0.3, economy: 0.24, vision: 0.06, objectives: 0.1, frontline: 0.04 },
  UTILITY: { combat: 0.3, damage: 0.1, economy: 0.04, vision: 0.3, objectives: 0.06, frontline: 0.2 },
};
export const RATING_LABELS = { combat: "combate (abates, mortes e participação)", damage: "dano a campeões", economy: "ouro", vision: "visão", objectives: "dano a objetivos", frontline: "linha de frente (dano recebido e controle)" };

function zscores(vals) {
  const ok = vals.filter((v) => v != null);
  if (ok.length < 6) return vals.map(() => null);
  const m = mean(ok);
  const sd = Math.sqrt(mean(ok.map((v) => (v - m) ** 2))) || 0;
  return vals.map((v) => (v == null ? null : sd ? clamp((v - m) / sd, -2.5, 2.5) : 0));
}

export function matchRatings(g) {
  const ps = g.participants || [];
  if (ps.length < 6) return null;
  const teamKills = {};
  for (const t of g.teams || []) teamKills[t.teamId] = t.objectives?.champion?.kills ?? null;
  for (const p of ps) if (teamKills[p.teamId] == null) teamKills[p.teamId] = ps.filter((q) => q.teamId === p.teamId).reduce((s, q) => s + (q.k || 0), 0);
  const full = (p) => (g.raw?.me?.pid === p.pid ? { ...p, ...g.raw.me } : g.raw?.opp?.pid === p.pid ? { ...p, ...g.raw.opp } : p);
  const rows = ps.map(full);
  const comp = {
    combat: [zscores(rows.map((p) => ((p.k || 0) + 0.7 * (p.a || 0)) / ((p.d || 0) + 1))), zscores(rows.map((p) => (teamKills[p.teamId] ? ((p.k || 0) + (p.a || 0)) / teamKills[p.teamId] : null)))],
    damage: [zscores(rows.map((p) => num(p.dmg)))],
    economy: [zscores(rows.map((p) => num(p.gold)))],
    vision: [zscores(rows.map((p) => num(p.vision)))],
    objectives: [zscores(rows.map((p) => num(p.objDmg)))],
    frontline: [zscores(rows.map((p) => (num(p.dmgTaken) == null ? null : (p.dmgTaken || 0) + (p.selfMitigated || 0)))), zscores(rows.map((p) => num(p.cc)))],
  };
  const out = rows.map((p, i) => {
    const w = RATING_WEIGHTS[p.position] || RATING_WEIGHTS.MIDDLE;
    let s = 0, wsum = 0;
    const parts = {};
    for (const [k, list] of Object.entries(comp)) {
      const zs = list.map((z) => z[i]).filter((z) => z != null);
      if (!zs.length) continue;
      const z = mean(zs);
      parts[k] = z;
      s += w[k] * z; wsum += w[k];
    }
    const score = wsum ? clamp(5.5 + (1.7 * s) / wsum, 1, 10) : null;
    return { pid: p.pid, teamId: p.teamId, win: !!p.win, score: score == null ? null : Math.round(score * 10) / 10, parts };
  });
  const ranked = [...out].filter((r) => r.score != null).sort((a, b) => b.score - a.score);
  ranked.forEach((r, i) => { r.place = i + 1; });
  const mvp = ranked.find((r) => r.win), ace = ranked.find((r) => !r.win);
  if (mvp) mvp.badge = "MVP";
  if (ace) ace.badge = "ACE";
  return { byPid: new Map(out.map((r) => [r.pid, r])), list: out };
}

// ----------------------------------------------------------------------------
// Jogadas de um jungler e a resposta do outro
// ----------------------------------------------------------------------------
const FX = 7, FY = 8; // colunas x, y dos quadros por minuto

function posAt(rows, t, maxGap = 40) {
  let best = null, gap = Infinity;
  for (const r of rows || []) { const d = Math.abs(r[0] - t); if (d < gap) { gap = d; best = r; } }
  return best && gap <= maxGap && best[FX] != null ? { x: best[FX], y: best[FY], t: best[0] } : null;
}

function context(g, meta) {
  const tl = g.raw?.timeline;
  if (!tl) return null;
  const parts = new Map((g.participants || []).map((p) => [p.pid, p]));
  const team = (pid) => parts.get(pid)?.teamId ?? null;
  const name = (pid) => {
    if (pid === g.raw?.me?.pid) return voiceOf(g).s;
    const p = parts.get(pid);
    return p ? (meta ? champDisplay(meta, p.championName, p.championId) : p.championName) : "?";
  };
  const kills = (tl.kills || []).map(([t, killer, victim, assists, x, y]) => ({ t, killer, victim, assists: assists || [], x: num(x), y: num(y) }));
  const elite = (tl.elite || []).map((r, i) => ({ t: r[0], type: r[1], sub: r[2], team: r[3] || team(r[4]), killer: r[4], assists: r[5] || [], x: g.elite?.[i]?.x ?? null, y: g.elite?.[i]?.y ?? null }));
  const buildings = (g.buildings || []).map((b) => ({ ...b, team: b.ownerTeam === 100 ? 200 : 100 }));
  return { tl, parts, team, name, kills, elite, buildings };
}

const objName = (e) => OBJECTIVE_LABELS[objectiveType({ type: e.type, sub: e.sub })] || e.type;
const bldName = (b) => b.type === "INHIBITOR_BUILDING" ? "um inibidor" : b.towerType === "NEXUS_TURRET" ? "uma torre do nexus" : "uma torre";

// Jogadas do jungler `jpid`: abates com participação dele antes dos 20 min (agrupados por luta)
// e os objetivos épicos do time dele (a partida inteira).
export function junglerPlays(g, jpid, upTo = 1200, meta) {
  const c = context(g, meta);
  if (!c || !jpid) return [];
  const jteam = c.team(jpid);
  const plays = [];
  const ks = c.kills.filter((k) => k.t <= upTo && c.team(k.victim) !== jteam && (k.killer === jpid || k.assists.includes(jpid)));
  for (const k of ks) {
    const last = plays[plays.length - 1];
    if (last && last.kind === "kill" && k.t - last.tEnd <= 20 && dist(last, k) <= 3500) { last.victims.push(k.victim); last.tEnd = k.t; continue; }
    plays.push({ kind: "kill", t: k.t, tEnd: k.t, x: k.x, y: k.y, victims: [k.victim], killer: k.killer });
  }
  for (const e of c.elite) {
    if (e.team !== jteam) continue;
    const withJ = e.killer === jpid || e.assists.includes(jpid);
    const prev = plays.find((p) => p.kind === "objective" && p.type === e.type && e.t - p.tEnd <= 60);
    if (prev) { prev.count++; prev.tEnd = e.t; prev.withJungler = prev.withJungler || withJ; continue; }
    plays.push({ kind: "objective", type: e.type, count: 1, t: e.t, tEnd: e.t, x: e.x, y: e.y, objective: objName(e), withJungler: withJ });
  }
  return plays.sort((a, b) => a.t - b.t).map((p) => ({ ...p, region: mapRegion(p.x, p.y) }));
}

// Como o jungler `rpid` respondeu a uma jogada do outro time. Os textos são do ponto de vista
// de quem lê (viewTeam): "sua selva" é sempre a selva do dono do painel.
export function responseTo(g, play, rpid, rFrames, viewTeam, meta) {
  const c = context(g, meta);
  const rteam = c.team(rpid);
  const view = viewTeam ?? rteam;
  const V = voiceOf(g);
  const teamWord = rteam === view ? V.team : "o time dele";
  const t = play.t;
  const takedown = (k) => k.killer === rpid || k.assists.includes(rpid);
  const where = (o) => regionLabel(mapRegion(o.x, o.y), view, V);
  const wasTarget = play.kind === "kill" && play.victims.includes(rpid);
  // 1) Lutou no local
  const fight = c.kills.filter((k) => k.t >= t - 25 && k.t <= play.tEnd + 20 && dist(k, play) <= 3500 && (takedown(k) || k.victim === rpid));
  const got = fight.find((k) => takedown(k) && c.team(k.victim) !== rteam);
  if (got) {
    if (wasTarget) return { kind: "counter", ok: true, t: got.t, text: `Revidou na luta: abateu ${c.name(got.victim)}` };
    return { kind: play.kind === "kill" ? "counter" : "contest", ok: true, t: got.t, text: play.kind === "kill" ? `Counter-gank: abateu ${c.name(got.victim)} ${ago(got.t - t, "depois")}` : `Contestou: abateu ${c.name(got.victim)} no local` };
  }
  if (wasTarget) return { kind: "target", ok: false, target: true, text: "Foi o alvo da jogada" };
  const died = fight.find((k) => k.victim === rpid);
  if (died) return { kind: "fought", ok: true, partial: true, t: died.t, text: `Foi para a luta, mas morreu para ${c.name(died.killer)}` };
  // 2) Troca de objetivo (vale como resposta quando o jungler participou)
  const trades = c.elite.filter((e) => e.team === rteam && e.t >= t - 50 && e.t <= play.tEnd + 60 && dist(e, play) > 5000);
  const eTrade = trades.find((e) => e.killer === rpid || e.assists.includes(rpid));
  if (eTrade) return { kind: "trade", ok: true, t: eTrade.t, text: `Troca: fez ${objName(eTrade)} do outro lado` };
  const bTrade = c.buildings.find((b) => b.team === rteam && b.killer === rpid && b.t >= t - 40 && b.t <= play.tEnd + 60 && dist(b, play) > 5000);
  if (bTrade) return { kind: "trade", ok: true, t: bTrade.t, text: `Troca: derrubou ${bldName(bTrade)} ${where(bTrade)}` };
  // 3) Abate do outro lado do mapa
  const cross = c.kills.find((k) => takedown(k) && c.team(k.victim) !== rteam && k.t >= t - 30 && k.t <= play.tEnd + 60 && dist(k, play) > 5000);
  if (cross) return { kind: "cross", ok: true, t: cross.t, text: `Do outro lado: abateu ${c.name(cross.victim)} ${where(cross)}` };
  // 4) Entrou na selva do outro time logo depois
  for (const r of rFrames || []) {
    if (r[0] <= t || r[0] > t + 75) continue;
    const reg = mapRegion(r[FX], r[FY]);
    if (reg && reg.zone === "jungle" && reg.side !== rteam) return { kind: "invade", ok: true, t: r[0], text: `Invadiu: estava ${regionLabel(reg, view, V)} logo depois` };
  }
  // 5) Morto na hora
  const dead = c.kills.filter((k) => k.victim === rpid && k.t >= t - 45 && k.t < t).pop();
  if (dead) return { kind: "dead", ok: false, dead: true, t: dead.t, text: `Estava morto (morreu ${ago(t - dead.t, "antes")})` };
  // 6) Estava perto, sem luta
  const p = posAt(rFrames, t);
  if (p && dist(p, play) <= 4000) return { kind: "near", ok: false, partial: true, t: p.t, text: "Estava por perto, mas sem luta" };
  if (trades.length) return { kind: "team-trade", ok: false, partial: true, t: trades[0].t, text: `${teamWord[0].toUpperCase() + teamWord.slice(1)} fez ${objName(trades[0])}, sem o jungler` };
  return { kind: "none", ok: false, text: "Sem resposta" };
}

function ago(d, word) {
  const s = Math.round(Math.abs(d));
  return s < 2 ? "na hora" : s < 60 ? `${s} s ${word}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} ${word}`;
}

const joinPt = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`);

export function playDescription(g, play, viewTeam, meta) {
  const c = context(g, meta);
  const reg = regionLabel(play.region, viewTeam, voiceOf(g));
  if (play.kind === "kill") {
    const vs = [...new Set(play.victims)].map((v) => c.name(v));
    return `${vs.length > 1 ? "Abates em" : "Abate em"} ${joinPt(vs)} ${reg}`.trim();
  }
  return `${play.objective}${play.count > 1 ? ` (${play.count})` : ""}${play.withJungler ? "" : ", sem o jungler"}`;
}

export function playsAndResponses(g, meta) {
  const c = context(g, meta);
  const me = g.raw?.me, opp = g.raw?.opp;
  if (!c || !me || !opp) return null;
  const myFrames = c.tl.me || [], oppFrames = c.tl.opp || [];
  const theirs = junglerPlays(g, opp.pid, 1200, meta).map((p) => ({ ...p, text: playDescription(g, p, me.teamId, meta), response: responseTo(g, p, me.pid, myFrames, me.teamId, meta) }));
  const mine = junglerPlays(g, me.pid, 1200, meta).map((p) => ({ ...p, text: playDescription(g, p, me.teamId, meta), response: responseTo(g, p, opp.pid, oppFrames, me.teamId, meta) }));
  const score = (list) => {
    const live = list.filter((p) => !p.response.dead && !p.response.target);
    return { n: list.length, live: live.length, answered: live.filter((p) => p.response.ok).length, dead: list.length - live.length };
  };
  return { theirs, mine, theirsScore: score(theirs), mineScore: score(mine) };
}

// ----------------------------------------------------------------------------
// Duelo de junglers: onde você superou e onde tomou gap
// ----------------------------------------------------------------------------
function eliteBy(c, pid) { return c.elite.filter((e) => e.killer === pid || e.assists.includes(pid)).length; }
function laneTakedowns(c, pid, upTo) {
  return c.kills.filter((k) => k.t <= upTo && (k.killer === pid || k.assists.includes(pid)) && LANES.has(mapRegion(k.x, k.y)?.zone)).length;
}
function regionsOf(c, pid, upTo) {
  const out = { top: 0, mid: 0, bot: 0, jungle: 0, river: 0 };
  for (const k of c.kills) {
    if (k.t > upTo || !(k.killer === pid || k.assists.includes(pid))) continue;
    const r = mapRegion(k.x, k.y);
    if (r && out[r.zone] != null) out[r.zone]++;
  }
  return out;
}

const fmtInt = (v) => (v == null ? "—" : Math.round(v).toLocaleString("pt-BR"));
const fmtDec = (v, d = 1) => (v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }));
const fmtPct = (v) => (v == null ? "—" : `${Math.round(v * 100)}%`);

export function junglerDuel(g, meta, history = []) {
  const me = g.raw?.me, opp = g.raw?.opp;
  if (!me || !opp) return null;
  const c = context(g, meta);
  const V = voiceOf(g);
  const oName = champDisplay(meta, opp.championName, opp.championId);
  const myChamp = champDisplay(meta, g.champ, g.champId);
  const teamK = (team) => (g.teams || []).find((t) => t.teamId === team)?.objectives?.champion?.kills ?? (g.participants || []).filter((p) => p.teamId === team).reduce((s, p) => s + (p.k || 0), 0);
  const kp = (p) => { const tk = teamK(p.teamId); return tk ? ((p.k || 0) + (p.a || 0)) / tk : null; };
  const dm = g.durMin || 1;
  const pr = c ? playsAndResponses(g, meta) : null;
  const past = (history || []).filter((x) => x.id !== g.id && x.champ === g.champ).slice(0, 30);
  const habit = (f) => { const v = past.map(f).filter((x) => x != null && Number.isFinite(x)); return v.length >= 5 ? mean(v) : null; };
  const at15 = (rows) => { const r = (rows || []).find((x) => Math.round(x[0] / 60) === 15); return r ? r[1] : null; };
  const metrics = [
    { key: "dmg", group: "Lutas", label: "Dano a campeões", me: me.dmg, opp: opp.dmg, fmt: fmtInt,
      text: (a, b) => `${V.S} causou ${fmtInt(a)} de dano a campeões; o ${oName}, ${fmtInt(b)}.`, habit: habit((x) => x.dmg) },
    { key: "kp", group: "Lutas", label: "Participação em abates", me: kp(me), opp: kp(opp), fmt: fmtPct,
      text: (a, b) => `${V.S} esteve em ${fmtPct(a)} dos abates do ${V.team}; o ${oName}, em ${fmtPct(b)} dos do time dele.`, habit: habit((x) => x.kp) },
    { key: "deaths", group: "Lutas", label: "Mortes", me: me.d, opp: opp.d, better: "lower", fmt: fmtInt,
      text: (a, b) => `${V.S} morreu ${fmtInt(a)} ${a === 1 ? "vez" : "vezes"}; o ${oName}, ${fmtInt(b)}.`, habit: habit((x) => x.d) },
    { key: "ganks", group: "Pressão de mapa", label: "Abates nas rotas até os 15", me: c ? laneTakedowns(c, me.pid, 900) : null, opp: c ? laneTakedowns(c, opp.pid, 900) : null, fmt: fmtInt,
      text: (a, b) => `Até os 15 minutos ${V.s} participou de ${fmtInt(a)} abates nas rotas; o ${oName}, de ${fmtInt(b)}.`, habit: null,
      extra: c ? { me: regionsOf(c, me.pid, 900), opp: regionsOf(c, opp.pid, 900) } : null },
    { key: "objectives", group: "Objetivos", label: "Objetivos épicos", me: c ? eliteBy(c, me.pid) : null, opp: c ? eliteBy(c, opp.pid) : null, fmt: fmtInt,
      text: (a, b) => `${V.S} participou de ${fmtInt(a)} objetivos épicos (dragão, arauto, vastilarvas, barão); o ${oName}, de ${fmtInt(b)}.`, habit: habit((x) => (x.elite ? x.elite.filter((e) => e.me).length : null)) },
    { key: "invade", group: "Pressão de mapa", label: "Monstros da selva inimiga", me: me.challenges?.enemyJungleMonsterKills ?? null, opp: opp.challenges?.enemyJungleMonsterKills ?? null, fmt: fmtInt,
      text: (a, b) => `${V.S} pegou ${fmtInt(a)} monstros da selva do ${oName}; o ${oName} pegou ${fmtInt(b)} da ${V.jungle}.`, habit: habit((x) => x.raw?.me?.challenges?.enemyJungleMonsterKills ?? null) },
    { key: "gold15", group: "Economia", label: "Ouro aos 15", me: at15(c?.tl.me), opp: at15(c?.tl.opp), fmt: fmtInt,
      text: (a, b) => `Aos 15 minutos ${V.s} tinha ${fmtInt(a)} de ouro; o ${oName}, ${fmtInt(b)}.`, habit: habit((x) => x.early?.at15?.gold ?? null) },
    { key: "csMin", group: "Economia", label: "Farm por minuto", me: ((me.cs || 0) + (me.jcs || 0)) / dm, opp: ((opp.cs || 0) + (opp.jcs || 0)) / dm, fmt: (v) => fmtDec(v, 1),
      text: (a, b) => `${fmtDec(a, 1)} de farm por minuto contra ${fmtDec(b, 1)} do ${oName}.`, habit: habit((x) => x.csMin) },
    { key: "vision", group: "Visão", label: "Placar de visão", me: me.vision, opp: opp.vision, fmt: fmtInt,
      text: (a, b) => `Placar de visão ${fmtInt(a)} contra ${fmtInt(b)} do ${oName}.`, habit: habit((x) => x.vision) },
  ];
  if (pr && (pr.theirsScore.live || pr.mineScore.live)) {
    const a = pr.theirsScore.live ? pr.theirsScore.answered / pr.theirsScore.live : null;
    const b = pr.mineScore.live ? pr.mineScore.answered / pr.mineScore.live : null;
    metrics.push({ key: "resp", group: "Pressão de mapa", label: "Respostas às jogadas do outro", me: a, opp: b, fmt: fmtPct,
      text: () => `${V.S} respondeu ${pr.theirsScore.answered} de ${pr.theirsScore.live} jogadas do ${oName}; o ${oName} respondeu ${pr.mineScore.answered} de ${pr.mineScore.live} ${V.ref ? `das jogadas do ${V.s}` : "das suas"}.`, habit: null });
  }
  const rows = metrics.filter((m) => m.me != null && m.opp != null).map((m) => {
    const better = m.better || "higher";
    const big = Math.max(Math.abs(m.me), Math.abs(m.opp));
    const rel = big ? (m.me - m.opp) / big : 0;
    const signed = better === "lower" ? -rel : rel;
    const verdict = big === 0 || Math.abs(rel) < 0.08 ? "even" : signed > 0 ? "won" : "lost";
    // Peso de cada ponto na ordem dos cards (contagens pequenas pesam menos: 0 × 2 abates é pouco dado).
    const weight = { objectives: 1.25, deaths: 1.15, dmg: 1, gold15: 1, kp: 1, resp: 1, csMin: 0.9, ganks: 0.9, vision: 0.7, invade: 0.6 }[m.key] ?? 1;
    const strength = Math.abs(rel) * weight * (big < 3 && m.fmt === fmtInt ? 0.7 : 1);
    return { ...m, rel, strength, verdict, sentence: m.text(m.me, m.opp),
      habitText: m.habit != null ? `${V.habit} com ${myChamp}: ${m.fmt(m.habit)}.` : null };
  });
  const won = rows.filter((r) => r.verdict === "won").sort((a, b) => b.strength - a.strength);
  const lost = rows.filter((r) => r.verdict === "lost").sort((a, b) => b.strength - a.strength);
  const even = rows.filter((r) => r.verdict === "even");
  return { oppName: oName, myChamp, rows, won, lost, even, plays: pr, voice: V };
}
