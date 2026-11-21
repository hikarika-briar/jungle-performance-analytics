// Dados FICTÍCIOS para o modo demonstração. Mesmo formato do coletor.
// Nada aqui representa partidas reais do jogador.
import { SCHEMA } from "./engine.js";

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CHAMPS = {
  Briar: [233, "Briar", ["Fighter", "Assassin"]], Viego: [234, "Viego", ["Assassin", "Fighter"]], LeeSin: [64, "Lee Sin", ["Fighter", "Assassin"]],
  Graves: [104, "Graves", ["Marksman"]], Khazix: [121, "Kha'Zix", ["Assassin"]], Nidalee: [76, "Nidalee", ["Assassin", "Mage"]],
  Kindred: [203, "Kindred", ["Marksman"]], Elise: [60, "Elise", ["Mage", "Fighter"]], XinZhao: [5, "Xin Zhao", ["Fighter", "Assassin"]],
  JarvanIV: [59, "Jarvan IV", ["Tank", "Fighter"]], Vi: [254, "Vi", ["Fighter", "Assassin"]], Sejuani: [113, "Sejuani", ["Tank", "Fighter"]],
  Hecarim: [120, "Hecarim", ["Fighter", "Tank"]], Kayn: [141, "Kayn", ["Fighter", "Assassin"]], Nocturne: [56, "Nocturne", ["Assassin", "Fighter"]],
  Diana: [131, "Diana", ["Fighter", "Mage"]], Ekko: [245, "Ekko", ["Assassin", "Mage"]], MonkeyKing: [62, "Wukong", ["Fighter", "Tank"]],
  Lillia: [876, "Lillia", ["Fighter", "Mage"]], Zac: [154, "Zac", ["Tank", "Fighter"]], Rengar: [107, "Rengar", ["Assassin", "Fighter"]],
  Belveth: [200, "Bel'Veth", ["Fighter"]], Talon: [91, "Talon", ["Assassin"]], Naafiri: [950, "Naafiri", ["Assassin", "Fighter"]],
  Amumu: [32, "Amumu", ["Tank", "Mage"]], Warwick: [19, "Warwick", ["Fighter", "Tank"]],
  Ahri: [103, "Ahri", ["Mage", "Assassin"]], Jinx: [222, "Jinx", ["Marksman"]], Thresh: [412, "Thresh", ["Support", "Fighter"]],
  Darius: [122, "Darius", ["Fighter", "Tank"]], Ezreal: [81, "Ezreal", ["Marksman", "Mage"]], Leona: [89, "Leona", ["Tank", "Support"]],
  Garen: [86, "Garen", ["Fighter", "Tank"]], Lux: [99, "Lux", ["Mage", "Support"]], Orianna: [61, "Orianna", ["Mage", "Support"]],
  Kaisa: [145, "Kai'Sa", ["Marksman"]], Nautilus: [111, "Nautilus", ["Tank", "Support"]], Aatrox: [266, "Aatrox", ["Fighter", "Tank"]],
  Sylas: [517, "Sylas", ["Mage", "Assassin"]], Caitlyn: [51, "Caitlyn", ["Marksman"]], Lulu: [117, "Lulu", ["Support", "Mage"]],
  Renekton: [58, "Renekton", ["Fighter", "Tank"]], Viktor: [112, "Viktor", ["Mage"]], Ashe: [22, "Ashe", ["Marksman", "Support"]],
  Rakan: [497, "Rakan", ["Support"]], Gwen: [887, "Gwen", ["Fighter", "Assassin"]], KSante: [897, "K'Sante", ["Tank", "Fighter"]],
  Jhin: [202, "Jhin", ["Marksman"]], Braum: [201, "Braum", ["Support", "Tank"]], Yone: [777, "Yone", ["Assassin", "Fighter"]],
};
const ENEMY_JG = ["LeeSin", "Viego", "Graves", "Khazix", "Nidalee", "Kindred", "Elise", "XinZhao", "JarvanIV", "Vi", "Sejuani", "Hecarim",
  "Kayn", "Nocturne", "Diana", "Ekko", "MonkeyKing", "Lillia", "Zac", "Rengar", "Belveth", "Talon", "Naafiri", "Amumu", "Warwick", "Briar"];
const JG_WEIGHT = { LeeSin: 9, Viego: 8, Graves: 7, Khazix: 7, XinZhao: 5, JarvanIV: 5, Vi: 5, Kayn: 6, Nidalee: 4, Elise: 3, Sejuani: 3, Hecarim: 4,
  Nocturne: 3, Diana: 3, Ekko: 3, MonkeyKing: 3, Lillia: 3, Zac: 3, Rengar: 3, Belveth: 2, Talon: 2, Naafiri: 2, Amumu: 2, Warwick: 2, Kindred: 3, Briar: 2 };
const TOPS = ["Darius", "Garen", "Aatrox", "Renekton", "Gwen", "KSante"], MIDS = ["Ahri", "Sylas", "Orianna", "Viktor", "Yone", "Lux"];
const ADCS = ["Jinx", "Ezreal", "Kaisa", "Caitlyn", "Ashe", "Jhin"], SUPS = ["Thresh", "Leona", "Nautilus", "Lulu", "Rakan", "Braum"];

const ITEMS = {
  6676: ["A Coletora", 3000, true], 3748: ["Hidra Titânica", 3300, true], 6673: ["Arco-Escudo Imortal", 3000, true],
  6692: ["Eclipse", 2900, true], 6333: ["Dança da Morte", 3300, true], 3156: ["Mandíbula de Malmortius", 3100, true],
  3153: ["Espada do Rei Destruído", 3200, true], 3036: ["Lembranças do Lorde Dominik", 3000, true], 3026: ["Anjo Guardião", 3200, true],
  3053: ["Manopla de Sterak", 3200, true], 3071: ["Cutelo Negro", 3000, true], 6694: ["Rancor de Serylda", 3200, true],
  3047: ["Botas Galvanizadas de Aço", 1200, false, true], 3111: ["Passos de Mercúrio", 1250, false, true],
  1036: ["Espada Longa", 350], 1037: ["Picareta", 875], 3077: ["Tiamat", 1200], 3133: ["Martelo de Guerra de Caulfield", 1100],
  1102: ["Mascote da selva (inicial)", 450], 3364: ["Lente do Oráculo", 0], 2003: ["Poção de Vida", 50], 1001: ["Botas", 300],
};
const RUNES = {
  8010: ["Conquistador", 8000, 0], 8008: ["Ritmo Fatal", 8000, 0], 8112: ["Eletrocutar", 8100, 0], 9923: ["Chuva de Lâminas", 8100, 0],
  9111: ["Triunfo", 8000, 1], 9104: ["Lenda: Espontaneidade", 8000, 2], 8014: ["Golpe de Misericórdia", 8000, 3], 8299: ["Até a Morte", 8000, 3],
  8143: ["Impacto Repentino", 8100, 1], 8139: ["Gosto de Sangue", 8100, 1], 8105: ["Caçador Incansável", 8100, 3], 8135: ["Caçador de Tesouros", 8100, 3],
  8444: ["Segundo Fôlego", 8400, 2], 8451: ["Revitalizar", 8400, 3],
};
const STYLES = { 8000: "Precisão", 8100: "Dominação", 8400: "Determinação" };

export function makeDemoDataset(now = Date.now()) {
  const r = rng(20261102);
  const norm = () => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const wpick = (obj) => { const tot = Object.values(obj).reduce((s, x) => s + x, 0); let x = r() * tot; for (const [k, w] of Object.entries(obj)) { x -= w; if (x <= 0) return k; } return Object.keys(obj)[0]; };
  const pois = (l) => { const L = Math.exp(-Math.max(0.05, l)); let k = 0, p = 1; do { k++; p *= r(); } while (p > L); return k - 1; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const N = 190;
  const matches = [];
  let t = now - 3600 * 1000 * 5;
  for (let i = 0; i < N; i++) {
    t -= (r() < 0.25 ? 20 : 4) * 3600 * 1000 * (0.4 + r());
    const ageDays = (now - t) / 86400000;
    const champKey = r() < 0.72 ? "Briar" : r() < 0.5 ? "Viego" : "LeeSin";
    const queueId = r() < 0.76 ? 420 : r() < 0.5 ? 440 : r() < 0.6 ? 400 : 490;
    const patchIdx = Math.floor(ageDays / 14);
    const patch = `16.${Math.max(9, 21 - patchIdx)}`;
    const remake = r() < 0.02;
    const skillTrend = (150 - ageDays) / 150 * 0.35; // melhora gradual (fictícia)
    const a10 = norm() * 0.95 + 0.12 + skillTrend * 0.6;
    const winP = 1 / (1 + Math.exp(-(0.1 + 1.05 * a10 + norm() * 0.7)));
    const win = remake ? r() < 0.5 : r() < winP;
    const durMin = remake ? 3.4 : clamp(29 + norm() * 5.2 + (win ? -1 : 0.5), 17, 45);
    const duration = Math.round(durMin * 60);
    const teamId = r() < 0.5 ? 100 : 200;
    const enemy = 300 - teamId;
    const oppKey = wpick(JG_WEIGHT);
    const late = durMin > 30 ? 1 : 0;

    // Itens completos e tempos
    let path;
    if (champKey === "Briar") {
      const fourthEclipseP = clamp((ageDays < 60 ? 0.62 : 0.22) + (a10 > 0.5 ? 0.22 : a10 < -0.3 ? -0.18 : 0), 0.05, 0.95);
      path = [6676, 3748, 6673, r() < fourthEclipseP ? 6692 : 6333, pick([3156, 3153, 3036, 3026, 3053])];
      if (r() < 0.12) [path[1], path[2]] = [path[2], path[1]];
    } else if (champKey === "Viego") path = [3153, 3053, 6333, 3026, 3036];
    else path = [6692, 3071, 3053, 6333, 3026];
    path = [...new Set(path)];
    const first = 10.6 - a10 * 0.9 + norm() * 0.6;
    const times = path.map((_, k) => (first + k * (6.6 + norm() * 0.6) - (win ? 0.3 * k : 0)) * 60);
    const done = remake ? [] : path.map((id, k) => ({ id, t: Math.round(times[k]) })).filter((x) => x.t < duration - 20);
    const bootsId = r() < 0.6 ? 3047 : 3111;
    const bootsT = Math.round((13.5 + norm()) * 60);
    const finalItems = [...done.map((x) => x.id)];
    if (!remake && bootsT < duration) finalItems.splice(Math.min(2, finalItems.length), 0, bootsId);
    while (finalItems.length > 6) finalItems.pop();
    const items = [...finalItems.slice(0, 6)];
    while (items.length < 6) items.push(0);
    items.push(3364);

    // Estatísticas finais
    const k = remake ? 0 : pois(5 + 1.6 * a10 + (win ? 2 : 0));
    const d = remake ? 0 : pois(Math.max(0.6, 4.4 - 1.1 * a10 - (win ? 1.6 : 0)));
    const a = remake ? 0 : pois(5.5 + (win ? 2.5 : 0));
    const csMinT = clamp(6.7 + 0.28 * a10 + norm() * 0.55 - late * 0.25 + skillTrend * 0.4, 4.2, 9.2);
    const csTot = Math.round(csMinT * durMin);
    const laneCs = Math.round(csTot * (0.06 + r() * 0.05));
    const goldMin = 420 + 42 * a10 + (win ? 34 : 0) + norm() * 22;
    const dmgMin = clamp(720 + 130 * a10 + norm() * 110 + (finalItems.includes(6692) ? 35 : 0), 300, 1500);
    const teamKills = k + a + pois(3);
    const ks = champKey === "Briar" ? wpick({ 8010: 55, 8008: 25, 8112: 10, 9923: 10 }) : wpick({ 8010: 60, 8112: 25, 9923: 15 });
    const keystone = Number(ks);
    const primaryStyle = RUNES[keystone][1];
    const subStyle = primaryStyle === 8000 ? (r() < 0.75 ? 8100 : 8400) : 8000;
    const primary = primaryStyle === 8000 ? [keystone, 9111, 9104, r() < 0.7 ? 8014 : 8299] : [keystone, r() < 0.6 ? 8143 : 8139, 8135, 8105];
    const secondary = subStyle === 8100 ? [8143, 8105] : subStyle === 8400 ? [8444, 8451] : [9111, 8014];
    const riotId = ageDays > 110 ? "KD o Pai do Ynga#BR1" : "Hikarika#BRIAR";

    const me = {
      pid: teamId === 100 ? 2 : 7, puuid: "DEMO-PUUID", riotId, teamId, championId: CHAMPS[champKey][0], championName: champKey,
      position: "JUNGLE", individualPosition: "JUNGLE", win, k, d, a, cs: laneCs, jcs: csTot - laneCs,
      gold: Math.round(goldMin * durMin), goldSpent: Math.round(goldMin * durMin * 0.95), dmg: Math.round(dmgMin * durMin),
      dmgTaken: Math.round((900 + norm() * 120) * durMin), vision: Math.round(durMin * (0.9 + r() * 0.5)), level: clamp(Math.round(9 + durMin / 4), 6, 18),
      items, spells: [11, 4], runes: { primaryStyle, subStyle, primary, secondary, shards: [5005, 5008, 5011] },
      earlySurrender: remake, challenges: {},
    };
    const oppWin = !win;
    const opp = {
      pid: teamId === 100 ? 7 : 2, riotId: "", teamId: enemy, championId: CHAMPS[oppKey][0], championName: oppKey, position: "JUNGLE", win: oppWin,
      k: pois(5 - 1.2 * a10), d: pois(4 + 1.0 * a10), a: pois(6), cs: 15, jcs: Math.round((6.4 - 0.25 * a10) * durMin), gold: Math.round((410 - 30 * a10) * durMin),
      dmg: Math.round(650 * durMin), dmgTaken: Math.round(850 * durMin), vision: 20, level: me.level, items: [0, 0, 0, 0, 0, 0, 3364], spells: [11, 4],
      runes: { primaryStyle: 8000, subStyle: 8100, primary: [8010, 9111, 9104, 8014], secondary: [8143, 8105], shards: [5005, 5008, 5011] }, challenges: {},
    };
    const participants = [];
    const laneSets = [TOPS, null, MIDS, ADCS, SUPS];
    const positions = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
    for (const team of [100, 200]) {
      for (let p = 0; p < 5; p++) {
        const pid = (team === 100 ? 1 : 6) + p;
        const isMe = pid === me.pid, isOpp = pid === opp.pid;
        const key = isMe ? champKey : isOpp ? oppKey : pick(laneSets[p]);
        participants.push({ pid, teamId: team, championId: CHAMPS[key][0], championName: key, position: positions[p],
          k: isMe ? k : isOpp ? opp.k : pois(4), d: isMe ? d : isOpp ? opp.d : pois(4), a: isMe ? a : isOpp ? opp.a : pois(6),
          gold: Math.round(400 * durMin), dmg: Math.round(800 * durMin), cs: Math.round((p === 4 ? 1.2 : 7.2) * durMin), level: me.level,
          items: [0, 0, 0, 0, 0, 0, 0], spells: [4, 14], win: team === teamId ? win : !win });
      }
    }

    // Timeline (90% das partidas)
    let timeline = null;
    if (!remake && r() < 0.9) {
      const mins = Math.floor(duration / 60);
      const meRows = [], oppRows = [], teamRows = [];
      let cMe = 0, cOpp = 0, gMe = 500, gOpp = 500, xMe = 0, xOpp = 0;
      const fadeStart = 15 + r() * 8;
      const endAdv = (win ? 1 : -1) * (1500 + r() * 8500);
      const swing = norm() * 3200; // viradas no meio do jogo
      for (let m = 0; m <= mins + 1; m++) {
        const ts = Math.min(m * 60, duration);
        if (m > 0) {
          const rate = m <= 1 ? 0.5 : m <= 10 ? 6.6 + 0.35 * a10 : m <= fadeStart ? csMinT + 0.2 : csMinT - 0.5 + norm() * 0.3;
          cMe += Math.max(0, rate + norm() * 0.6);
          cOpp += Math.max(0, (m <= 10 ? 6.6 - 0.3 * a10 : 6.2) + norm() * 0.6);
          gMe += goldMin * (m <= 10 ? 0.92 + 0.06 * a10 : 1.03) + norm() * 15;
          gOpp += (m <= 10 ? goldMin * (0.92 - 0.06 * a10) : 400) + norm() * 15;
          xMe += 330 + 26 * a10 + m * 20 + norm() * 20;
          xOpp += 330 - 26 * a10 + m * 20 + norm() * 20;
        }
        const lvl = (x) => clamp(Math.floor(1 + Math.sqrt(x / 90)), 1, 18);
        meRows.push([ts, Math.round(gMe), Math.round(150 + r() * 900), Math.round(xMe), lvl(xMe), Math.round(cMe * 0.08), Math.round(cMe * 0.92), Math.round(2000 + r() * 11000), Math.round(2000 + r() * 11000)]);
        oppRows.push([ts, Math.round(gOpp), Math.round(150 + r() * 900), Math.round(xOpp), lvl(xOpp), Math.round(cOpp * 0.06), Math.round(cOpp * 0.94), Math.round(2000 + r() * 11000), Math.round(2000 + r() * 11000)]);
        const pr = clamp((ts - 600) / Math.max(60, duration - 600), 0, 1);
        const adv = (m <= 10 ? a10 * 1400 * (m / 10) : a10 * 1400 + (endAdv - a10 * 1400) * pr * pr + swing * Math.sin(Math.PI * pr)) + norm() * 700;
        const base = 2500 + 2050 * m;
        const myTeamGold = Math.round(base + adv / 2), enTeamGold = Math.round(base - adv / 2);
        const myXp = Math.round(1800 * m + adv / 3), enXp = Math.round(1800 * m - adv / 3);
        teamRows.push(teamId === 100 ? [ts, myTeamGold, enTeamGold, myXp, enXp] : [ts, enTeamGold, myTeamGold, enXp, myXp]);
      }
      const itemEv = [[60, "P", 1102], [62, "P", 2003]];
      for (const x of done) {
        itemEv.push([x.t - 200, "P", 1036], [x.t - 1, "D", 1036], [x.t, "P", x.id]);
      }
      if (bootsT < duration) itemEv.push([bootsT - 300, "P", 1001], [bootsT, "P", bootsId]);
      if (done.length >= 4 && r() < 0.15) {
        const x = done[3];
        itemEv.push([x.t - 30, "P", x.id], [x.t - 25, "U", x.id, 0]); // compra desfeita
      }
      const myTeamPids = participants.filter((p) => p.teamId === teamId).map((p) => p.pid);
      const enPids = participants.filter((p) => p.teamId !== teamId).map((p) => p.pid);
      const kills = [];
      const randT = () => Math.round(150 + r() * (duration - 170));
      for (let q = 0; q < k; q++) kills.push([randT(), me.pid, pick(enPids), [pick(myTeamPids.filter((p) => p !== me.pid))], Math.round(1000 + r() * 12000), Math.round(1000 + r() * 12000), 300, 0]);
      for (let q = 0; q < d; q++) {
        const nearDragon = r() < 0.3;
        kills.push([randT(), pick(enPids), me.pid, [pick(enPids)], nearDragon ? 9600 + Math.round(norm() * 600) : Math.round(1000 + r() * 12000), nearDragon ? 4500 + Math.round(norm() * 600) : Math.round(1000 + r() * 12000), 300, 0]);
      }
      for (let q = 0; q < a; q++) kills.push([randT(), pick(myTeamPids.filter((p) => p !== me.pid)), pick(enPids), [me.pid], Math.round(1000 + r() * 12000), Math.round(1000 + r() * 12000), 300, 0]);
      kills.sort((x, y) => x[0] - y[0]);
      const elite = [];
      const advAt = (ts) => { const row = teamRows[Math.min(teamRows.length - 1, Math.floor(ts / 60))]; return teamId === 100 ? row[1] - row[2] : row[2] - row[1]; };
      const takeBy = (ts) => (r() < 1 / (1 + Math.exp(-advAt(ts) / 1800)) ? teamId : enemy);
      const killerOf = (team) => (team === teamId ? (r() < 0.82 ? me.pid : pick(myTeamPids)) : opp.pid);
      const asst = (team) => (team === teamId ? myTeamPids.filter(() => r() < 0.5) : []);
      for (let ts = 360; ts < duration - 30; ts += 300 + Math.round(r() * 60)) {
        const team = takeBy(ts);
        elite.push([ts, "DRAGON", pick(["FIRE_DRAGON", "WATER_DRAGON", "EARTH_DRAGON", "AIR_DRAGON", "CHEMTECH_DRAGON", "HEXTECH_DRAGON"]), team, killerOf(team), asst(team)]);
      }
      if (duration > 420) { const team = takeBy(400); elite.push([400 + Math.round(r() * 60), "HORDE", null, team, killerOf(team), asst(team)]); }
      if (duration > 950) { const team = takeBy(900); elite.push([900 + Math.round(r() * 90), "RIFTHERALD", null, team, killerOf(team), asst(team)]); }
      if (duration > 1260 && r() < 0.7) { const team = takeBy(1260); elite.push([1260 + Math.round(r() * 90), "ATAKHAN", null, team, killerOf(team), asst(team)]); }
      if (duration > 1600) { const team = takeBy(1600); elite.push([1600 + Math.round(r() * (duration - 1650)), "BARON_NASHOR", null, team, killerOf(team), asst(team)]); }
      elite.sort((x, y) => x[0] - y[0]);
      const buildings = [];
      for (let q = 0; q < 6; q++) {
        const ts = Math.round(600 + r() * (duration - 700));
        const owner = takeBy(ts) === teamId ? enemy : teamId;
        buildings.push([ts, "TOWER_BUILDING", pick(["TOP_LANE", "MID_LANE", "BOT_LANE"]), "OUTER_TURRET", owner, 0]);
      }
      buildings.push([duration - 60, "INHIBITOR_BUILDING", "MID_LANE", null, win ? enemy : teamId, 0]);
      buildings.sort((x, y) => x[0] - y[0]);
      timeline = { frameInterval: 60000, frameCols: [], me: meRows, opp: oppRows, team: teamRows, items: itemEv.sort((x, y) => x[0] - y[0]),
        kills, elite, buildings, souls: [] };
    }

    const myTeamObj = { dragon: { first: r() < 0.5 + a10 * 0.15, kills: 2 }, baron: { first: win && r() < 0.6, kills: win ? 1 : 0 }, tower: { first: r() < 0.5, kills: 6 } };
    matches.push({
      matchId: `DEMO_${100000 + i}`, platformId: "BR1", gameCreation: Math.round(t) - 60000, gameStart: Math.round(t), gameEnd: Math.round(t) + duration * 1000,
      duration, gameVersion: `${patch}.500.1`, patch, queueId, mapId: 11, gameMode: "CLASSIC", remake, teamKills, me, opp, oppIdentifiedBy: "position",
      participants, teams: [{ teamId, win, objectives: myTeamObj, bans: [] }, { teamId: enemy, win: !win, objectives: { dragon: { first: !myTeamObj.dragon.first, kills: 1 } }, bans: [] }],
      timeline,
    });
  }

  const meta = {
    ddragonVersion: null,
    items: Object.fromEntries(Object.entries(ITEMS).map(([id, [name, gold, completed, boots]]) => [id, { name, gold, completed: !!completed, boots: !!boots, tags: [] }])),
    champions: Object.fromEntries(Object.entries(CHAMPS).map(([key, [id, name, tags]]) => [String(id), { key, name, tags }])),
    runes: Object.fromEntries(Object.entries(RUNES).map(([id, [name, style, slot]]) => [id, { name, style, slot }])),
    runeStyles: Object.fromEntries(Object.entries(STYLES).map(([id, name]) => [id, { name }])),
    spells: { 11: { name: "Golpear" }, 4: { name: "Flash" }, 14: { name: "Incendiar" } },
    shards: { 5005: "Velocidade de Ataque", 5008: "Força Adaptativa", 5011: "Vida", 5001: "Vida escalável", 5007: "Aceleração de Habilidade", 5010: "Velocidade de Movimento", 5013: "Tenacidade e Resist. a Lentidão" },
    icons: { item: {}, champion: {}, rune: {}, spell: {} },
  };
  return {
    schema: SCHEMA, schemaVersion: 1, source: "demo", generatedAt: new Date(now).toISOString(),
    player: { puuid: "DEMO-PUUID", puuids: ["DEMO-PUUID"], riotId: "Hikarika#BRIAR", platform: "BR1", region: "americas", namesSeen: ["Hikarika#BRIAR", "KD o Pai do Ynga#BR1"] },
    stats: { matches: N }, meta, matches,
  };
}
