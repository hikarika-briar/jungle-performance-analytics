// ============================================================================
// Matchups por classe: melhor e pior classe de jungler inimigo, partidas para revisar
// e o ciclo de classes da wiki oficial do League of Legends (Champion classes → Interaction).
// Funções puras (os testes rodam no Node).
// ============================================================================
import { classOf, SUBCLASSES, CLASSES } from "./classes.js";
import { matchRatings } from "./match_report.js";

const mean = (a) => { const v = a.filter((x) => typeof x === "number" && Number.isFinite(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const fmtK = (v) => `${(Math.abs(v) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;

// Ciclo no sentido das setas. Cada classe costuma ganhar das duas seguintes e sofrer contra as duas anteriores.
export const CYCLE = ["tank", "slayer", "mage", "marksman", "fighter"];
// Seta que sai de cada classe para a próxima, com o atributo-chave (wiki: tankiness, gap closer, burst, kiting, sustained damage)
export const ARROW = {
  fighter: { label: "resistência", en: "tankiness" },
  tank: { label: "aproximação", en: "gap closer" },
  slayer: { label: "dano explosivo", en: "burst" },
  mage: { label: "kite", en: "kiting" },
  marksman: { label: "dano contínuo", en: "sustained damage" },
};
const at = (i) => CYCLE[(i + CYCLE.length) % CYCLE.length];
export function strongAgainst(cls) { const i = CYCLE.indexOf(cls); return i < 0 ? [] : [at(i + 1), at(i + 2)]; }
export function weakAgainst(cls) { const i = CYCLE.indexOf(cls); return i < 0 ? [] : [at(i - 1), at(i - 2)]; }
// Atributos de uma classe: a seta que chega e a seta que sai
export function attributesOf(cls) { const i = CYCLE.indexOf(cls); return i < 0 ? [] : [ARROW[at(i - 1)].label, ARROW[cls].label]; }

// Textos do guia (traduzidos e adaptados da wiki, com o olhar de quem joga na selva)
export const CLASS_GUIDE = {
  tank: {
    desc: "Muito resistentes, com controle de grupo e algum jeito de chegar perto. A Vanguarda inicia as lutas; o Guardião protege o time e afasta quem chega perto.",
    strong: "Aguenta o dano explosivo de Matadores e Magos e chega neles com facilidade: o combo deles não mata, e o controle de grupo do tanque pune.",
    weak: "Sofre contra o dano contínuo de Lutadores e Atiradores: em luta longa, perde vida aos poucos sem conseguir matar ninguém.",
    briar: "Vantagem pelo ciclo: o seu dano contínuo derrete a resistência dele. Lute depois que ele usar o controle de grupo, não antes.",
  },
  fighter: {
    desc: "Misturam dano e resistência e lutam de perto. O Colosso aguenta muito e tem pouca mobilidade; o Mergulhador entra na linha de trás. A Briar é Lutadora (Mergulhadora).",
    strong: "Ganha de Tanques, porque o dano contínuo vence a resistência, e de Matadores, porque aguenta o primeiro combo e revida.",
    weak: "Sofre contra Magos e Atiradores, que lutam de longe e recuando (kite): sem chegar perto, o Lutador não causa dano.",
    briar: "Espelho de classe: ganha quem chega com mais nível e vida. Contra Colossos, não troque parado na frente deles; contra Mergulhadores, descubra o lado do início para fazer counter-gank.",
  },
  slayer: {
    desc: "Mobilidade para chegar perto e dano explosivo. O Assassino mata um alvo frágil e sai; o Duelista ganha duelos e lutas longas.",
    strong: "Caça Magos e Atiradores: chega neles antes que consigam reagir e mata de uma vez.",
    weak: "Sofre contra Lutadores e Tanques, que aguentam o dano de uma vez e revidam quando ele fica sem as habilidades.",
    briar: "Vantagem pelo ciclo: você aguenta o primeiro combo e revida. Cuidado com os Duelistas em luta longa e com o Assassino pegando você sozinha na selva.",
  },
  mage: {
    desc: "Dano com habilidades: explosivo de uma vez, contínuo em área (Mago de batalha) ou de muito longe (Artilharia).",
    strong: "Ganha de Atiradores, porque o dano explosivo chega antes do dano contínuo, e de Lutadores, porque luta recuando e não deixa chegar perto.",
    weak: "Sofre contra Tanques, que aguentam o dano e chegam perto, e contra Matadores, que chegam rápido e matam antes do combo.",
    briar: "Desvantagem pelo ciclo: ele luta recuando. Chegue por um ângulo sem visão e entre depois que ele usar as habilidades principais.",
  },
  marksman: {
    desc: "Dano contínuo com ataques básicos à distância, que cresce com os itens. Frágeis, principalmente no início.",
    strong: "Ganha de Lutadores e Tanques: atira de longe, recua, e o dano contínuo derrete quem é resistente.",
    weak: "Sofre contra Matadores e Magos, que matam de uma vez antes do dano contínuo fazer efeito.",
    briar: "Desvantagem pelo ciclo, mas ele é frágil de perto: force a luta curta quando ele estiver sem a fuga e não persiga em linha reta.",
  },
  controller: {
    desc: "Não são feitos para o 1x1: fortalecem os aliados (Encantador) ou prendem inimigos (Agarrador). No ciclo, ficam no meio: o controle de grupo e a proteção deles mudam a luta contra qualquer classe.",
    strong: "Mudam as lutas em grupo com escudo, cura e controle de grupo, e abrem jogadas para o time inteiro.",
    weak: "Pouco dano e frágeis quando pegos sozinhos: um gank ou uma invasão bem cronometrada pune muito.",
    briar: "Pegue sozinho e cedo: invasão e gank no lado dele, antes de ele ter o time por perto.",
  },
  specialist: {
    desc: "Não se encaixam nas outras classes: cada um tem uma regra própria (Fiddlesticks, Nidalee, Quinn, Graves, Kayle...). Ficam fora do ciclo.",
    strong: "Têm uma força bem específica que pune quem não conhece o campeão: o medo do Fiddlesticks, o dano de longe da Nidalee, a mobilidade da Quinn.",
    weak: "Fora daquela força, costumam ser previsíveis. Aqui vale estudar o campeão, não a classe.",
    briar: "Cada um tem uma regra: veja a nota do campeão no guia de matchups de Briar e revise 2 derrotas contra ele.",
  },
};
// Campeões populares de cada subclasse, para reconhecer rápido
export const SUB_EXAMPLES = {
  enchanter: ["Lulu", "Janna", "Nami"], catcher: ["Thresh", "Blitzcrank", "Morgana"],
  juggernaut: ["Volibear", "Darius", "Illaoi"], diver: ["Vi", "Jarvan IV", "Lee Sin"],
  burst: ["Ahri", "Syndra", "LeBlanc"], battlemage: ["Karthus", "Taliyah", "Vladimir"], artillery: ["Xerath", "Ziggs", "Vel'Koz"],
  marksman: ["Jinx", "Kindred", "Caitlyn"],
  assassin: ["Kha'Zix", "Rengar", "Evelynn"], skirmisher: ["Master Yi", "Viego", "Bel'Veth"],
  vanguard: ["Sejuani", "Zac", "Rammus"], warden: ["Poppy", "Braum", "Shen"],
  specialist: ["Fiddlesticks", "Nidalee", "Graves"],
};
// Junglers de cada classe que mais aparecem
export const JUNGLE_EXAMPLES = {
  fighter: ["Vi", "Jarvan IV", "Volibear", "Lee Sin"], slayer: ["Kha'Zix", "Viego", "Master Yi", "Rengar"],
  tank: ["Sejuani", "Zac", "Rammus", "Maokai"], mage: ["Karthus", "Taliyah", "Brand", "Zyra"],
  marksman: ["Kindred"], controller: ["Ivern", "Morgana"], specialist: ["Fiddlesticks", "Nidalee", "Graves", "Quinn"],
};
// Como cada classe joga: o que quer e como se protege
export const CLASS_PLAY = {
  tank: { wants: "Iniciar a luta, segurar a linha de frente e prender quem é frágil para o time matar.", protects: "Com vida, armadura e resistência mágica: aguenta o dano enquanto o controle de grupo trabalha." },
  fighter: { wants: "Luta longa de perto: entrar em quem está ao alcance e ficar batendo até o fim.", protects: "Com cura, escudo e a resistência dos itens. O Mergulhador entra e sai; o Colosso fica e aguenta." },
  slayer: { wants: "Pegar um alvo frágil sozinho, matar rápido e sair (Assassino) ou ganhar o duelo (Duelista).", protects: "Com mobilidade e surpresa: entra de onde não tem visão e espera o controle de grupo inimigo sair." },
  mage: { wants: "Causar dano com habilidades antes da luta começar e controlar a área com ela.", protects: "Com distância e controle de grupo: mantém quem chega perto longe, recuando enquanto causa dano." },
  marksman: { wants: "Dano contínuo de longe e seguro, crescendo com os itens até dominar as lutas longas.", protects: "Com alcance e posicionamento atrás do time; usa a fuga e o kite para nunca ficar parado perto do inimigo." },
  controller: { wants: "Proteger os aliados (escudo, cura, velocidade) ou prender um inimigo para abrir a jogada.", protects: "Ficando perto do time: sozinho tem pouco dano e pouca vida, então depende de quem está ao lado." },
  specialist: { wants: "Jogar do jeito próprio dele: emboscada (Fiddlesticks), dano de longe e invasão (Nidalee), farm rápido e luta curta (Graves).", protects: "Cada um tem a sua ferramenta: medo, forma de felino, mobilidade da Quinn. Conhecer o campeão vale mais que a classe." },
};
// Por que cada classe ganha ou sofre contra as outras (interações do ciclo, explicadas)
export const CLASS_RELATIONS = {
  tank: {
    strong: { slayer: "O combo do Matador não mata o Tanque, e o controle de grupo pune quando ele entra.", mage: "Aguenta o dano explosivo e tem como chegar perto do Mago." },
    weak: { fighter: "O dano contínuo do Lutador derrete a resistência numa luta longa.", marksman: "O Atirador bate de longe sem parar, e o Tanque não consegue alcançar." },
  },
  fighter: {
    strong: { tank: "O dano contínuo vence a resistência do Tanque.", slayer: "Aguenta o primeiro combo do Matador e revida quando ele fica sem habilidades." },
    weak: { marksman: "O Atirador atira recuando (kite) e o Lutador não chega perto.", mage: "O Mago controla a distância e causa dano antes do Lutador chegar." },
  },
  slayer: {
    strong: { mage: "Chega perto antes do combo e mata de uma vez.", marksman: "Atirador frágil e sem a fuga morre no primeiro combo." },
    weak: { tank: "Não consegue matar o Tanque e fica preso no controle de grupo.", fighter: "O Lutador aguenta o combo e ganha a luta longa." },
  },
  mage: {
    strong: { marksman: "O dano explosivo de longe mata o Atirador antes do dano contínuo dele fazer efeito.", fighter: "Luta recuando e não deixa o Lutador chegar perto." },
    weak: { slayer: "O Matador chega rápido e mata antes do Mago reagir.", tank: "O Tanque aguenta o dano e chega perto mesmo assim." },
  },
  marksman: {
    strong: { fighter: "Atira recuando (kite) e o Lutador nunca alcança.", tank: "O dano contínuo derrete a resistência do Tanque." },
    weak: { mage: "O dano explosivo de longe pune o Atirador frágil.", slayer: "O Matador chega e mata no primeiro combo." },
  },
  controller: {
    strong: { slayer: "Escudo e controle de grupo salvam o alvo que o Matador queria matar.", fighter: "Prende o Lutador antes de ele alcançar a linha de trás." },
    weak: { mage: "O Mago causa dano de longe antes do Controlador proteger alguém." },
    alone: "Sozinho, qualquer classe pune: tem pouca vida e pouco dano, então um gank ou uma invasão no lado dele costuma dar abate.",
    labels: { strong: "Atrapalha", weak: "Sofre contra" },
  },
  specialist: {
    examples: {
      Fiddlesticks: "Emboscada: espera sem ser visto e entra com medo em área. Visão de controle e sentinelas acabam com a surpresa.",
      Nidalee: "Dano de longe com a lança e invasão cedo. Ganha muito se você ficar parado no rio; perde quando é forçada a lutar de perto.",
      Graves: "Farm muito rápido e luta curta forte. Rouba campos e aparece com nível; difícil de enfrentar de perto no começo.",
      Quinn: "Mobilidade enorme e ganks rápidos. Fraca se for pega sem a forma de pássaro.",
    },
  },
};

export const CLASS_ORDER = ["fighter", "slayer", "tank", "mage", "marksman", "controller", "specialist"];
// Campeão que ilustra cada classe no menu (arte de carregamento do Data Dragon)
export const CLASS_ART = { controller: "Lulu", fighter: "Briar", mage: "Lux", marksman: "Jinx", slayer: "Zed", tank: "Leona", specialist: "Teemo" };

// Agrupa as suas partidas pela classe (level "cls") ou subclasse (level "sub") do jungler inimigo.
export function groupByClass(games, meta, level = "sub") {
  const m = new Map();
  for (const g of games) {
    if (!g.oppChamp) continue;
    const c = classOf(meta, g.oppChamp, g.oppChampId, "JUNGLE");
    if (!c) continue;
    const key = level === "cls" ? c.cls : c.sub;
    if (!m.has(key)) m.set(key, { key, cls: c.cls, games: [] });
    m.get(key).games.push(g);
  }
  return [...m.values()].map((x) => {
    const gs = x.games;
    const wins = gs.filter((g) => g.win).length;
    const k = gs.reduce((s, g) => s + (g.k || 0), 0), d = gs.reduce((s, g) => s + (g.d || 0), 0), a = gs.reduce((s, g) => s + (g.a || 0), 0);
    const champs = new Map();
    for (const g of gs) { const c = champs.get(g.oppChamp) || { champ: g.oppChamp, champId: g.oppChampId, n: 0, w: 0 }; c.n++; if (g.win) c.w++; champs.set(g.oppChamp, c); }
    return {
      key: x.key, level, cls: x.cls,
      label: level === "cls" ? CLASSES[x.key].label : SUBCLASSES[x.key].label,
      en: level === "cls" ? CLASSES[x.key].en : SUBCLASSES[x.key].en,
      clsLabel: CLASSES[x.cls].label,
      games: gs, n: gs.length, wins, losses: gs.length - wins, rate: gs.length ? wins / gs.length : null,
      kda: (k + a) / Math.max(1, d), deaths: d / Math.max(1, gs.length), kp: mean(gs.map((g) => g.kp)),
      gd10: mean(gs.map((g) => g.early?.diff10?.gold)),
      champs: [...champs.values()].sort((p, q) => q.n - p.n || q.w - p.w),
    };
  }).sort((p, q) => q.n - p.n);
}

// Melhor e pior: win rate suavizado pela sua média (poucas partidas puxam para a média).
export function bestWorst(rows, overall, minN = 4) {
  const ov = overall ?? 0.5;
  for (const need of [minN, 3, 2]) {
    const el = rows.filter((r) => r.n >= need);
    if (el.length < 2) continue;
    const sc = (r) => (r.wins + 3 * ov) / (r.n + 3);
    const sorted = [...el].sort((p, q) => sc(q) - sc(p) || q.n - p.n);
    const best = sorted[0], worst = sorted[sorted.length - 1];
    if (best.key === worst.key) continue;
    return { best: best.rate >= ov ? best : null, worst: worst.rate < ov ? worst : null, minN: need };
  }
  return { best: null, worst: null, minN };
}

// Partidas em destaque: 3 vitórias para repetir e 2 derrotas para revisar (das contra o pior matchup primeiro).
export function reviewGames(games, meta, { worstKey = null, level = "sub", wins: nW = 3, losses: nL = 2 } = {}) {
  const rows = games.filter((g) => g.oppChamp && g.raw?.me).map((g) => {
    const c = classOf(meta, g.oppChamp, g.oppChampId, "JUNGLE");
    const r = matchRatings(g)?.byPid.get(g.raw.me.pid) || null;
    const pid = g.raw.me.pid;
    const d10 = (g.raw.timeline?.kills || []).filter((k) => k[2] === pid && k[0] < 600).length;
    return { g, c, r, d10, gd10: g.early?.diff10?.gold ?? null, worst: !!(worstKey && c && (level === "cls" ? c.cls : c.sub) === worstKey) };
  });
  const pick = (list, n) => { const out = [], seen = new Set(); for (const x of list) { if (seen.has(x.g.oppChamp)) continue; seen.add(x.g.oppChamp); out.push(x); if (out.length >= n) break; } return out; };
  const wins = pick(rows.filter((x) => x.g.win).sort((a, b) => (b.r?.score ?? 0) - (a.r?.score ?? 0) || (b.gd10 ?? 0) - (a.gd10 ?? 0)), nW);
  const lossScore = (x) => (x.worst ? 2 : 0) + (x.gd10 != null && x.gd10 < 0 ? Math.min(2, -x.gd10 / 1000) : 0) + x.d10 * 0.6 + (x.r ? Math.max(0, 6 - x.r.score) * 0.3 : 0);
  const losses = pick(rows.filter((x) => !x.g.win).sort((a, b) => lossScore(b) - lossScore(a)), nL);
  const reasons = (x) => {
    const out = [];
    if (x.g.win) {
      if (x.r?.score != null) out.push({ tone: "good", text: `Nota ${x.r.score.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}${x.r.badge ? ` · ${x.r.badge}` : ""}` });
      if (x.gd10 != null && x.gd10 >= 300) out.push({ tone: "good", text: `+${fmtK(x.gd10)} de ouro sobre o jungler aos 10` });
      if (x.d10 === 0) out.push({ tone: "dim", text: "Nenhuma morte até os 10" });
    } else {
      if (x.worst && x.c) out.push({ tone: "warn", text: `Contra ${x.c.label} (seu pior matchup)` });
      if (x.gd10 != null && x.gd10 <= -300) out.push({ tone: "warn", text: `${fmtK(x.gd10)} de ouro atrás do jungler aos 10` });
      if (x.d10 >= 2) out.push({ tone: "warn", text: `${x.d10} mortes antes dos 10` });
      if (!out.length && x.r?.score != null) out.push({ tone: "dim", text: `Nota ${x.r.score.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}` });
    }
    return out.slice(0, 3);
  };
  return [...wins, ...losses].map((x) => ({ ...x, reasons: reasons(x) }));
}
