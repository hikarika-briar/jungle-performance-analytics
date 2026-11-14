// ============================================================================
// Coach: banimento recomendado e matchups difíceis contra o jungler inimigo, com o que fazer.
// Tudo sai das suas partidas (o seu elo) + a dificuldade de cada matchup no guia de matchups
// de Briar do L0ganJG (rank 1 Briar) no onetricks.gg.
// ============================================================================
import { champDisplay } from "./engine.js";
import { classOf, norm } from "./classes.js";
import { earlyProfile, placeOf } from "./early.js";

export const BRIAR_GUIDE_URL = "https://www.onetricks.gg/pt/guide/72bc8gw/rank-1-briar-jungle-guide-all-matchups-included?tab=matchup";
export const TIER_LABEL = { "S+": "cuidado extremo", S: "muito cuidado", A: "um pouco de cuidado", B: "equilibrada", C: "leve vantagem", D: "grande vantagem", F: "vantagem extrema" };
const RAW_TIERS = {
  "S+": ["Elise", "Bel'Veth", "Volibear", "Gwen"],
  S: ["Taliyah", "Nidalee", "Kha'Zix", "Lee Sin", "Rek'Sai", "Viego", "Hecarim", "Wukong", "Poppy"],
  A: ["Gragas", "Karthus", "Graves", "Master Yi", "Zac", "Ekko", "Kindred", "Diana", "Ivern", "Brand", "Morgana", "Zyra"],
  B: ["Nocturne", "Pantheon", "Jax", "Fiddlesticks", "Kayn", "Qiyana", "Rengar", "Naafiri", "Trundle"],
  C: ["Talon", "Xin Zhao", "Cho'Gath", "Olaf", "Jayce", "Ambessa", "Jarvan IV", "Shaco", "Sejuani", "Zaahen"],
  D: ["Zed", "Udyr", "Malphite", "Lillia", "Shyvana", "Warwick", "Amumu", "Evelynn", "Rammus"],
  F: ["Nunu & Willump", "Maokai", "Sylas", "Sion", "Skarner", "Vi", "Dr. Mundo", "Nasus"],
};
const TIER_BY = new Map(Object.entries(RAW_TIERS).flatMap(([t, names]) => names.map((n) => [norm(n), t])));
export function briarTier(key, name) { return TIER_BY.get(norm(key)) || TIER_BY.get(norm(name)) || null; }

const F = { t: 0, x: 7, y: 8 };
const wr = (l) => (l.length ? l.filter((g) => g.win).length / l.length : null);
const avg = (v) => { const a = v.filter((x) => x != null && Number.isFinite(x)); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };
const pct = (v) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const signed = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.round(Math.abs(v)).toLocaleString("pt-BR")}`;

// Números de uma partida contra o jungler inimigo
function gameFacts(g) {
  const tl = g.raw?.timeline, me = g.raw?.me, opp = g.raw?.opp;
  const kills = tl?.kills || [];
  const myPid = me?.pid, oppPid = opp?.pid;
  const deaths10 = tl ? kills.filter((k) => k[2] === myPid && k[0] <= 600).length : null;
  const byJg10 = tl && oppPid ? kills.filter((k) => k[2] === myPid && k[0] <= 600 && (k[1] === oppPid || (k[3] || []).includes(oppPid))).length : null;
  let invade = null;
  if (tl && (tl.opp || []).length) {
    const fr = tl.opp.filter((r) => r[F.t] >= 120 && r[F.t] <= 480 && r[F.x] != null);
    if (fr.length) invade = fr.filter((r) => { const p = placeOf(r[F.x], r[F.y], me.teamId); return p === "selvaTop" || p === "selvaBot"; }).length / fr.length;
  }
  const ep = g.hasTL ? earlyProfile(g) : null;
  return { g, win: !!g.win, gd10: g.early?.diff10?.gold ?? null, deaths10, byJg10, invade, firstKill: ep?.first ? ep.firstResult === "abate" : null };
}

// Partidas usadas: o filtro, ou as últimas 100 quando o filtro tem poucas (matchup precisa de amostra)
export function matchupWindow(current, pool) {
  if (current.length >= 60) return { games: current, note: null };
  const games = (pool || current).slice(0, 100);
  return { games, note: games.length > current.length ? `O filtro tem ${current.length} partidas; para matchups usei as suas últimas ${games.length}, porque cada campeão aparece poucas vezes.` : null };
}

export function matchupDiagnostics(current, pool, meta) {
  const { games, note } = matchupWindow(current, pool);
  const jg = games.filter((g) => g.position === "JUNGLE" && g.oppChamp);
  if (jg.length < 20) return [];
  const briarShare = jg.filter((g) => g.champ === "Briar").length / jg.length;
  const useGuide = briarShare >= 0.6;
  const overall = wr(jg);
  const facts = jg.map(gameFacts);
  const base = { gd10: avg(facts.map((f) => f.gd10)), byJg10: avg(facts.map((f) => f.byJg10)), deaths10: avg(facts.map((f) => f.deaths10)), invade: avg(facts.map((f) => f.invade)), firstKill: avg(facts.map((f) => (f.firstKill == null ? null : f.firstKill ? 1 : 0))) };
  const by = new Map();
  for (const f of facts) { const k = f.g.oppChamp; if (!by.has(k)) by.set(k, []); by.get(k).push(f); }
  const rows = [...by.entries()].map(([champ, list]) => {
    const g0 = list[0].g;
    const sorted = [...list].sort((a, b) => b.g.start - a.g.start);
    const last = sorted.slice(0, 5);
    return {
      champ, champId: g0.oppChampId, name: champDisplay(meta, champ, g0.oppChampId), n: list.length, share: list.length / jg.length, wr: wr(list.map((f) => f.g)),
      lastW: last.filter((f) => f.win).length, lastN: last.length,
      gd10: avg(list.map((f) => f.gd10)), byJg10: avg(list.map((f) => f.byJg10)), deaths10: avg(list.map((f) => f.deaths10)), invade: avg(list.map((f) => f.invade)),
      firstKill: avg(list.map((f) => (f.firstKill == null ? null : f.firstKill ? 1 : 0))),
      cls: classOf(meta, champ, g0.oppChampId, "JUNGLE"), tier: useGuide ? briarTier(champ, champDisplay(meta, champ, g0.oppChampId)) : null,
    };
  });
  const rankByPick = [...rows].sort((a, b) => b.n - a.n);
  const out = [];
  const guideTxt = (r) => (r.tier ? ` No guia de matchups de Briar do L0ganJG (rank 1 Briar), ${r.name} é ${r.tier} · ${TIER_LABEL[r.tier]}.` : "");
  const nTxt = `${jg.length} partidas de jungle${note ? ` · ${note}` : ""}`;

  // 1) Banimento: muito escolhido contra você e com win rate bem abaixo da sua média
  const banCands = rows.filter((r) => r.n >= 5 && r.wr != null && r.wr <= overall - 0.08).map((r) => ({ ...r, cost: r.share * (overall - r.wr) })).sort((a, b) => b.cost - a.cost);
  const ban = banCands[0] || null;
  if (ban) {
    const pos = rankByPick.findIndex((r) => r.champ === ban.champ) + 1;
    out.push({
      id: `ban-${ban.champ}`, kind: "problema", group: "draft", champ: ban.champ, champId: ban.champId,
      title: `Banimento recomendado: ${ban.name}`,
      headline: { value: pct(ban.wr), label: `de vitórias em ${ban.n} partidas contra ${ban.name} · geral ${pct(overall)}` },
      evidence: { text: `${ban.name} aparece como jungler inimigo em ${pct(ban.share)} das suas partidas (${pos === 1 ? "o mais escolhido contra você" : `o ${pos}º mais escolhido`}). Contra ele, você ganha ${pct(ban.wr)} em ${ban.n} partidas; nos últimos ${ban.lastN} duelos, ${ban.lastW} vitória${ban.lastW === 1 ? "" : "s"}.${guideTxt(ban)}` },
      n: nTxt,
      interpretation: `Entre os junglers que aparecem com frequência no seu elo, é o que mais custa vitórias: frequência × quanto a sua win rate cai contra ele. Banir ${ban.name} tira a matchup que mais pesa no seu resultado.`,
      action: `Priorize banir ${ban.name} quando o seu time ainda tiver o banimento livre.${banCands[1] ? ` Segunda opção: ${banCands[1].name} (${pct(banCands[1].wr)} em ${banCands[1].n} partidas).` : ""}`,
      track: `Win rate contra ${ban.name} e quantas vezes ele aparece`,
      scores: { impact: 3, frequency: ban.share >= 0.08 ? 3 : 2, confidence: ban.n >= 10 ? 3 : 2, ease: 3 },
    });
  }

  // 2) Matchups difíceis com o que fazer
  const hard = rows.filter((r) => r.n >= 4 && r.wr != null && r.wr <= Math.min(0.42, overall - 0.1)).sort((a, b) => a.wr - b.wr || b.n - a.n).slice(0, 3);
  for (const r of hard) {
    const steps = [];
    if (r.byJg10 != null && base.byJg10 != null && r.byJg10 >= 0.35 && r.byJg10 >= base.byJg10 + 0.15) steps.push(`Nessas partidas ele te mata ${r.byJg10.toFixed(1).replace(".", ",")} vez(es) antes dos 10 (contra ${base.byJg10.toFixed(1).replace(".", ",")} dos outros junglers). Evite o duelo sozinho antes do nível 6 e do primeiro item; lute com a lane perto.`);
    if (r.invade != null && base.invade != null && r.invade >= 0.1 && r.invade >= base.invade * 1.35) steps.push(`Ele passa ${pct(r.invade)} dos minutos 2 a 8 na sua selva (os outros junglers, ${pct(base.invade)}). Coloque ward na entrada do seu buff perto dos 2:30 e, quando ele aparecer de um lado, faça o outro lado da selva dele.`);
    if (r.gd10 != null && base.gd10 != null && r.gd10 < -100 && r.gd10 < base.gd10 - 150) steps.push(`Você chega aos 10 com ${signed(r.gd10)} de ouro contra ele (sua média: ${signed(base.gd10)}). Garanta o full clear e o aronguejo antes de gankar; gank só com a lane pronta para seguir.`);
    if (r.firstKill != null && base.firstKill != null && r.firstKill <= base.firstKill - 0.12) steps.push(`Seu 1º gank vira abate em ${pct(r.firstKill)} dessas partidas (geral ${pct(base.firstKill)}). Escolha o lado oposto ao do início dele e a lane com controle de grupo.`);
    const clsTip = CLASS_TIP[r.cls?.sub];
    if (clsTip) steps.push(`${r.name} é ${r.cls.label.toLowerCase()} (${r.cls.en}). ${clsTip}`);
    if (!steps.length) steps.push("Revise 2 derrotas contra ele na aba Matchups: em que minuto a diferença de ouro vira e qual build teve melhor resultado.");
    out.push({
      id: `mu2-${r.champ}`, kind: "problema", group: "matchup", champ: r.champ, champId: r.champId,
      title: `Matchup difícil: ${r.name}${r.cls ? ` (${r.cls.label})` : ""}`,
      headline: { value: pct(r.wr), label: `de vitórias em ${r.n} partidas${r.tier ? ` · guia: ${r.tier} · ${TIER_LABEL[r.tier]}` : ""}` },
      evidence: { text: `Contra ${r.name} você ganha ${pct(r.wr)} em ${r.n} partidas (geral ${pct(overall)}); nos últimos ${r.lastN}, ${r.lastW} vitória${r.lastW === 1 ? "" : "s"}.${guideTxt(r)}` },
      n: nTxt,
      interpretation: "Os pontos abaixo comparam as partidas contra ele com as suas partidas contra os outros junglers, nas mesmas condições do filtro.",
      action: steps.join(" "), steps, guide: r.tier ? BRIAR_GUIDE_URL : null,
      track: `Win rate e ouro aos 10 contra ${r.name}`,
      scores: { impact: 2, frequency: r.share >= 0.06 ? 3 : 2, confidence: r.n >= 8 ? 3 : 2, ease: 2 },
    });
  }
  return out;
}

export const CLASS_TIP = {
  assassin: "Pune quem está sozinho: jogue perto das lanes com prioridade e não entre na selva dele sem visão.",
  skirmisher: "Vence lutas longas e duelos: troque rápido e saia, ou lute com um aliado por perto.",
  diver: "É forte em gank: descubra o lado do início dele (ward no nível 1, o primeiro campo que sumiu) para fazer counter-gank ou gankar do lado oposto.",
  juggernaut: "É forte de perto em luta longa e tem pouca mobilidade: use o alcance e a mobilidade para não ficar parado na frente dele.",
  vanguard: "Inicia lutas com controle de grupo: espere ele usar o controle antes de entrar.",
  warden: "Protege os aliados: o melhor momento é quando ele está longe da lane.",
  burst: "Tem muito dano de uma vez: entre depois que ele usar as habilidades.",
  battlemage: "Tem dano em área contínuo: evite lutar dentro da área dele.",
  artillery: "Pune de longe: chegue por um ângulo sem visão e não fique trocando à distância.",
  specialist: "Tem um estilo próprio: veja em 2 derrotas o que ele fez nos primeiros 6 minutos.",
  marksman: "É frágil de perto: force a luta curta quando ele estiver sem a fuga.",
  catcher: "Prende à distância: não entre na linha dele sem cobertura.",
  enchanter: "Fortalece os aliados: lutas sem os aliados dele por perto favorecem você.",
};

// Junglers mais escolhidos contra você (o seu elo) e a sua win rate contra cada um
export function pickTable(current, pool, meta, limit = 6) {
  const { games } = matchupWindow(current, pool);
  const jg = games.filter((g) => g.position === "JUNGLE" && g.oppChamp);
  const by = new Map();
  for (const g of jg) { if (!by.has(g.oppChamp)) by.set(g.oppChamp, []); by.get(g.oppChamp).push(g); }
  const useGuide = jg.length && jg.filter((g) => g.champ === "Briar").length / jg.length >= 0.6;
  return { n: jg.length, overall: wr(jg), rows: [...by.entries()].map(([champ, l]) => ({ champ, champId: l[0].oppChampId, name: champDisplay(meta, champ, l[0].oppChampId), n: l.length, share: l.length / jg.length, wr: wr(l), tier: useGuide ? briarTier(champ, champDisplay(meta, champ, l[0].oppChampId)) : null }))
    .sort((a, b) => b.n - a.n).slice(0, limit) };
}
