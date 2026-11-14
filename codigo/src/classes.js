// ============================================================================
// Classes e subclasses dos campeões (classificação da wiki oficial do League of Legends,
// wiki.leagueoflegends.com/en-us/Champion_classes), traduzidas, e atributos por nível
// (do Data Dragon, quando o coletor 2.3+ manda os atributos junto com os campeões).
// ============================================================================

export const CLASSES = {
  controller: { label: "Controlador", en: "Controller" },
  fighter: { label: "Lutador", en: "Fighter" },
  mage: { label: "Mago", en: "Mage" },
  marksman: { label: "Atirador", en: "Marksman" },
  slayer: { label: "Matador", en: "Slayer" },
  tank: { label: "Tanque", en: "Tank" },
  specialist: { label: "Especialista", en: "Specialist" },
};

export const SUBCLASSES = {
  enchanter: { cls: "controller", label: "Encantador", en: "Enchanter", desc: "Fortalece e protege os aliados com cura, escudo e velocidade. Frágil e com pouco dano: brilha com o time junto." },
  catcher: { cls: "controller", label: "Agarrador", en: "Catcher", desc: "Prende inimigos com controle de grupo à distância. Abre lutas e pune quem se posiciona mal." },
  juggernaut: { cls: "fighter", label: "Colosso", en: "Juggernaut", desc: "Muito dano e resistência de perto, pouca mobilidade. Vence lutas longas, mas é fácil de chutar de longe." },
  diver: { cls: "fighter", label: "Mergulhador", en: "Diver", desc: "Entra na linha de trás com mobilidade e aguenta um pouco. Bom para gank e para pegar alvos frágeis." },
  burst: { cls: "mage", label: "Explosivo", en: "Burst", desc: "Muito dano de uma vez com habilidades. Mata alvos frágeis rápido, mas sofre se errar a combinação." },
  battlemage: { cls: "mage", label: "Mago de batalha", en: "Battlemage", desc: "Dano contínuo em área de perto ou média distância. Forte em lutas longas no meio do inimigo." },
  artillery: { cls: "mage", label: "Artilharia", en: "Artillery", desc: "Dano de muito longe. Frágil e com pouca mobilidade quando alguém chega perto." },
  marksman: { cls: "marksman", label: "Atirador", en: "Marksman", desc: "Dano contínuo com ataques básicos à distância. Frágil no início e depende de itens." },
  assassin: { cls: "slayer", label: "Assassino", en: "Assassin", desc: "Mata um alvo frágil rápido e sai. Fraco em lutas longas e contra controle de grupo." },
  skirmisher: { cls: "slayer", label: "Duelista", en: "Skirmisher", desc: "Dano sustentado e ferramentas de defesa. Ganha duelos e lutas longas contra quem chega perto." },
  vanguard: { cls: "tank", label: "Vanguarda", en: "Vanguard", desc: "Tanque que inicia as lutas com controle de grupo." },
  warden: { cls: "tank", label: "Guardião", en: "Warden", desc: "Tanque que protege os aliados e afasta quem chega perto." },
  specialist: { cls: "specialist", label: "Especialista", en: "Specialist", desc: "Estilo próprio, que não se encaixa nas outras classes." },
};
export const SUBCLASS_KEYS = Object.keys(SUBCLASSES);

// Lista por subclasse, como na wiki (alguns campeões estão em duas)
const LIST = {
  enchanter: ["Janna", "Karma", "Lulu", "Milio", "Nami", "Renata Glasc", "Senna", "Seraphine", "Sona", "Soraka", "Taric", "Yuumi"],
  catcher: ["Bard", "Blitzcrank", "Ivern", "Jhin", "Morgana", "Neeko", "Pyke", "Rakan", "Thresh", "Zyra"],
  juggernaut: ["Aatrox", "Darius", "Dr. Mundo", "Garen", "Illaoi", "Mordekaiser", "Nasus", "Sett", "Skarner", "Trundle", "Udyr", "Urgot", "Volibear", "Yorick"],
  diver: ["Ambessa", "Briar", "Camille", "Diana", "Elise", "Hecarim", "Irelia", "Jarvan IV", "Lee Sin", "Olaf", "Pantheon", "Rek'Sai", "Renekton", "Rengar", "Shyvana", "Vi", "Warwick", "Wukong", "Xin Zhao"],
  burst: ["Ahri", "Annie", "Aurora", "Brand", "Karma", "LeBlanc", "Lissandra", "Lux", "Neeko", "Orianna", "Seraphine", "Sylas", "Syndra", "Twisted Fate", "Veigar", "Vex", "Zoe"],
  battlemage: ["Anivia", "Aurelion Sol", "Cassiopeia", "Karthus", "Malzahar", "Rumble", "Ryze", "Swain", "Taliyah", "Viktor", "Vladimir"],
  artillery: ["Hwei", "Jayce", "Lux", "Mel", "Varus", "Vel'Koz", "Xerath", "Ziggs"],
  marksman: ["Akshan", "Aphelios", "Ashe", "Caitlyn", "Corki", "Draven", "Ezreal", "Jhin", "Jinx", "Kai'Sa", "Kalista", "Kindred", "Kog'Maw", "Lucian", "Miss Fortune", "Samira", "Senna", "Sivir", "Smolder", "Teemo", "Tristana", "Twitch", "Varus", "Vayne", "Xayah", "Yunara", "Zeri"],
  assassin: ["Akali", "Akshan", "Aurora", "Diana", "Ekko", "Evelynn", "Fizz", "Kassadin", "Katarina", "Kha'Zix", "LeBlanc", "Locke", "Naafiri", "Nocturne", "Pyke", "Qiyana", "Rengar", "Shaco", "Talon", "Yone", "Zed"],
  skirmisher: ["Ambessa", "Bel'Veth", "Fiora", "Gwen", "Jax", "K'Sante", "Kayn", "Kled", "Lillia", "Master Yi", "Nilah", "Riven", "Sylas", "Tryndamere", "Viego", "Yasuo", "Yone", "Zaahen"],
  vanguard: ["Alistar", "Amumu", "Gragas", "Leona", "Malphite", "Maokai", "Nautilus", "Nunu & Willump", "Ornn", "Rammus", "Rell", "Sejuani", "Sion", "Skarner", "Zac"],
  warden: ["Braum", "Galio", "K'Sante", "Poppy", "Shen", "Tahm Kench", "Taric"],
  specialist: ["Azir", "Cho'Gath", "Fiddlesticks", "Gangplank", "Gnar", "Graves", "Heimerdinger", "Kayle", "Kennen", "Nidalee", "Quinn", "Singed", "Teemo", "Zilean"],
};

// Nome normalizado (sem acento, espaço ou apóstrofo) -> subclasses. Alguns nomes do Data Dragon são diferentes.
const ALIAS = { wukong: "monkeyking", nunuwillump: "nunu", nunuewillump: "nunu", jadenunu: "nunu", renataglasc: "renata" };
export const norm = (s) => {
  const k = String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
  return ALIAS[k] || k;
};
const BY_CHAMP = (() => {
  const m = new Map();
  for (const [sub, names] of Object.entries(LIST)) for (const n of names) { const k = norm(n); if (!m.has(k)) m.set(k, []); m.get(k).push(sub); }
  return m;
})();

// Subclasse mais natural para cada posição, quando o campeão tem duas.
const POS_PREF = {
  UTILITY: ["enchanter", "catcher", "warden", "vanguard", "burst", "artillery", "battlemage", "marksman", "specialist", "juggernaut", "diver", "assassin", "skirmisher"],
  TOP: ["juggernaut", "diver", "skirmisher", "vanguard", "warden", "specialist", "battlemage", "burst", "assassin", "artillery", "marksman", "catcher", "enchanter"],
  JUNGLE: ["diver", "skirmisher", "assassin", "juggernaut", "vanguard", "warden", "specialist", "battlemage", "burst", "marksman", "catcher", "artillery", "enchanter"],
  MIDDLE: ["burst", "battlemage", "artillery", "assassin", "skirmisher", "specialist", "marksman", "diver", "juggernaut", "catcher", "vanguard", "warden", "enchanter"],
  BOTTOM: ["marksman", "artillery", "battlemage", "burst", "enchanter", "catcher", "specialist", "assassin", "skirmisher", "diver", "juggernaut", "vanguard", "warden"],
};
// Sem a lista da wiki (campeão novo): a classe do Data Dragon dá uma aproximação.
const TAG_SUB = { Fighter: "diver", Tank: "vanguard", Mage: "burst", Assassin: "assassin", Marksman: "marksman", Support: "enchanter" };

export function subclassesOf(key, name) {
  return BY_CHAMP.get(norm(key)) || BY_CHAMP.get(norm(name)) || null;
}
// Subclasse de um campeão numa posição: { sub, cls, label, clsLabel, approx }
export function classOf(meta, keyOrName, championId, position) {
  const c = championId != null ? meta?.champions?.[String(championId)] : null;
  const key = keyOrName || c?.key;
  let subs = subclassesOf(key, c?.name);
  let approx = false;
  if (!subs || !subs.length) {
    const t = (c?.tags || []).map((x) => TAG_SUB[x]).filter(Boolean);
    if (!t.length) return null;
    subs = t; approx = true;
  }
  const pref = POS_PREF[position] || null;
  const sub = pref ? [...subs].sort((a, b) => pref.indexOf(a) - pref.indexOf(b))[0] : subs[0];
  const S = SUBCLASSES[sub];
  return { sub, cls: S.cls, label: S.label, en: S.en, clsLabel: CLASSES[S.cls].label, all: subs, approx };
}
export const subLabel = (sub) => SUBCLASSES[sub]?.label || sub;
export const subTitle = (sub) => (SUBCLASSES[sub] ? `${SUBCLASSES[sub].label} (${SUBCLASSES[sub].en})` : sub);

// Atributos num nível (fórmula de crescimento do jogo).
export function statAt(base, growth, level) {
  if (base == null) return null;
  const n = level - 1;
  return base + (growth || 0) * n * (0.7025 + 0.0175 * n);
}
export function champStats(meta, championId) {
  const s = meta?.champions?.[String(championId)]?.stats;
  if (!s) return null;
  return {
    hp1: s.hp, hp18: statAt(s.hp, s.hpperlevel, 18),
    ad1: s.attackdamage, ad18: statAt(s.attackdamage, s.attackdamageperlevel, 18),
    ar1: s.armor, ar18: statAt(s.armor, s.armorperlevel, 18),
    mr1: s.spellblock, mr18: statAt(s.spellblock, s.spellblockperlevel, 18),
    ms: s.movespeed, range: s.attackrange,
  };
}

// Campeões de uma partida por posição, com a subclasse de cada um: { TOP: [aliado, inimigo], ... }
export function laneClasses(g, meta) {
  const team = g.raw?.me?.teamId ?? g.teamId;
  const out = {};
  for (const pos of ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]) {
    const a = (g.participants || []).find((p) => p.teamId === team && p.position === pos);
    const b = (g.participants || []).find((p) => p.teamId !== team && p.position === pos);
    out[pos] = [a ? classOf(meta, a.championName, a.championId, pos) : null, b ? classOf(meta, b.championName, b.championId, pos) : null];
  }
  return out;
}
