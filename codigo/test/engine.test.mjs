import assert from "node:assert/strict";
import fs from "node:fs";
import * as E from "../src/engine.js";
import { makeDemoDataset } from "../src/demo.js";
import * as CH from "../src/challenger.js";

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FALHOU  " + name + "\n" + e.stack); process.exitCode = 1; }
};

const fixture = JSON.parse(fs.readFileSync(new URL("./fixture_export.json", import.meta.url), "utf8"));

console.log("Integração com o arquivo do coletor");
test("arquivo do coletor é válido e prepara partidas", () => {
  assert.equal(E.validateDataset(fixture), "dataset");
  const { games } = E.prepare(fixture);
  assert.equal(games.length, 5);
  assert.deepEqual(games.map((g) => g.id), ["BR1_1", "BR1_3", "BR1_4", "BR1_5", "BR1_2"]);
});

test("partida com nome antigo (KD o Pai do Ynga) é reconhecida pelo PUUID", () => {
  const { games } = E.prepare(fixture);
  const old = games.find((g) => g.id === "BR1_2");
  assert.ok(old, "partida antiga presente");
  assert.equal(old.riotIdAtGame, "KD o Pai do Ynga#BR1");
  assert.ok(fixture.player.namesSeen.includes("KD o Pai do Ynga#BR1"));
});

test("ordem de compra respeita ITEM_UNDO e ignora componentes", () => {
  const { games } = E.prepare(fixture);
  const g = games.find((x) => x.id === "BR1_1");
  assert.deepEqual(g.order.map((o) => o.id), [6676, 3748, 6673, 6692]);
  assert.equal(g.order[3].t, 1730); // a compra das 28:20 foi desfeita; vale a de 28:50
  assert.equal(E.fmtClock(g.order[0].t), "10:20");
});

test("partida sem timeline: sem ordem, métricas de timeline nulas (não zero)", () => {
  const { games } = E.prepare(fixture);
  const g = games.find((x) => x.id === "BR1_5");
  assert.equal(g.hasTL, false);
  assert.equal(g.order, null);
  assert.equal(g.early, null);
  assert.equal(E.contextAtCompletion(g, 6676), null);
  const early = E.earlyStats([g]);
  assert.equal(early.nTL, 0);
  assert.equal(early.rows[1].gold, null);
});

test("jungler inimigo identificado pelo Golpear quando falta posição", () => {
  const { games } = E.prepare(fixture);
  const g = games.find((x) => x.id === "BR1_5");
  assert.equal(g.oppChamp, "Graves");
  assert.equal(g.oppHow, "smite");
});

test("remake fica fora por padrão", () => {
  const { games } = E.prepare(fixture);
  const f = { ...E.DEFAULT_FILTERS, period: "all", champion: "ALL", queue: "all" };
  const r = E.applyFilters(games, f);
  assert.equal(r.remakesExcluded, 1);
  assert.ok(!r.current.some((g) => g.remake));
  assert.equal(E.applyFilters(games, { ...f, includeRemakes: true }).current.length, 5);
});

test("morte antes de objetivo: pick-off é separado de luta e de troca", () => {
  const { games } = E.prepare(fixture);
  const g = games.find((x) => x.id === "BR1_1");
  const list = E.classifyObjectiveDeaths(g);
  assert.equal(list.length, 1, "uma morte seguida de objetivo");
  assert.equal(list[0].cat, "pick"); // morreu sozinho 30 s antes do dragão inimigo, sem troca
  assert.equal(list[0].enemyDeaths, 0);
  assert.equal(E.pickoffsBeforeObjectives(g), 1);
  const noTl = games.find((x) => x.id === "BR1_5");
  assert.equal(E.pickoffsBeforeObjectives(noTl), null, "sem timeline: nulo, não zero");
});

console.log("Cálculos");
test("win rate e intervalo de Wilson", () => {
  const gs = [{ win: true }, { win: true }, { win: false }, { win: true }];
  const w = E.winRate(gs);
  assert.equal(w.rate, 0.75);
  assert.equal(w.wins, 3);
  assert.ok(w.ci[0] > 0.29 && w.ci[0] < 0.31, "limite inferior ~0,30");
  assert.ok(w.ci[1] > 0.95 && w.ci[1] < 0.96, "limite superior ~0,954");
  assert.equal(E.winRate([]).rate, null);
});

test("KDA com zero mortes", () => {
  const { games } = E.prepare(fixture);
  const lee = games.find((g) => g.id === "BR1_4"); // 7/0/9
  assert.equal(lee.perfect, true);
  assert.equal(lee.kda, 16);
  assert.equal(E.aggregateKDA([lee]).value, 16);
  assert.equal(E.aggregateKDA([lee]).perfect, true);
  const two = E.aggregateKDA([{ k: 7, d: 0, a: 9 }, { k: 1, d: 4, a: 3 }]);
  assert.equal(two.value, 5); // (8+12)/4
});

test("CS = tropas + monstros, sem somar duas vezes", () => {
  const { games } = E.prepare(fixture);
  const g = games.find((x) => x.id === "BR1_1");
  assert.equal(g.cs, 40 + 150);
  assert.equal(g.laneCs + g.jungleCs, g.cs);
});

test("partida sem todos os itens completos", () => {
  const { games } = E.prepare(fixture);
  const g = games.find((x) => x.id === "BR1_5");
  assert.deepEqual(g.finalCompleted, [6676, 3748]);
  const def = { items: [6676, 3748, 6673, 6692], mode: "set" };
  assert.equal(E.matchesBuild(g, def), false);
  assert.equal(E.matchesBuild(g, { items: [6676, 3748], mode: "set" }), true);
  assert.equal(E.matchesBuild(g, { items: [6676, 3748], mode: "seq" }), null, "sem timeline: não avaliável por ordem");
});

console.log("Importação");
test("importação duplicada não duplica partidas", () => {
  const first = E.mergeDatasets(null, fixture);
  assert.equal(first.dataset.matches.length, 6 - 1); // 5 registros no arquivo
  const again = E.mergeDatasets(first.dataset, fixture);
  assert.equal(again.dataset.matches.length, 5);
  assert.equal(again.report.added, 0);
  assert.equal(again.report.unchanged, 5);
});

test("versão com timeline substitui versão sem timeline", () => {
  const noTl = JSON.parse(JSON.stringify(fixture));
  noTl.matches.forEach((m) => { m.timeline = null; });
  const a = E.mergeDatasets(null, noTl).dataset;
  const b = E.mergeDatasets(a, fixture);
  assert.equal(b.report.updated, 2);
  assert.equal(b.dataset.matches.filter((m) => m.timeline).length, 2);
});

test("arquivo de outra conta é recusado", () => {
  const other = JSON.parse(JSON.stringify(fixture));
  other.player = { puuid: "OUTRO", puuids: ["OUTRO"] };
  const base = E.mergeDatasets(null, fixture).dataset;
  assert.throws(() => E.mergeDatasets(base, other), /outra conta/);
});

test("arquivo inválido gera mensagem clara", () => {
  assert.throws(() => E.validateDataset({ foo: 1 }), /coletor/);
});

console.log("Filtros e comparações (dados de demonstração)");
const demo = makeDemoDataset(Date.UTC(2026, 10, 2, 21));
const D = E.prepare(demo);

test("demo tem partidas e nada vira NaN nos indicadores", () => {
  assert.ok(D.games.length > 150);
  const s = E.summarize(D.games.filter((g) => !g.remake));
  for (const k of ["rate", "deaths", "csMin", "goldMin", "dmgMin", "kp", "durMin"]) {
    assert.ok(Number.isFinite(s[k]), k + " finito");
  }
});

test("filtros globais mudam o resultado", () => {
  const base = { ...E.DEFAULT_FILTERS, period: "all" };
  const a = E.applyFilters(D.games, base).current;
  const viego = E.applyFilters(D.games, { ...base, champion: "Viego" }).current;
  const flex = E.applyFilters(D.games, { ...base, queue: "440" }).current;
  const wins = E.applyFilters(D.games, { ...base, result: "win" }).current;
  const blue = E.applyFilters(D.games, { ...base, side: "blue" }).current;
  assert.equal(E.DEFAULT_FILTERS.champion, "ALL", "padrão: todos os campeões");
  assert.ok(a.every((g) => g.queueId === 420 && g.position === "JUNGLE"));
  assert.ok(new Set(a.map((g) => g.champ)).size > 1, "o padrão inclui mais de um campeão");
  const briar = E.applyFilters(D.games, { ...base, champion: "Briar" }).current;
  assert.ok(briar.length > 0 && briar.every((g) => g.champ === "Briar"));
  assert.ok(viego.length > 0 && viego.every((g) => g.champ === "Viego"));
  assert.ok(flex.every((g) => g.queueId === 440));
  assert.ok(wins.every((g) => g.win));
  assert.ok(blue.every((g) => g.side === "blue"));
  const last20 = E.applyFilters(D.games, { ...base, period: "last20" });
  assert.equal(last20.current.length, 20);
  assert.equal(last20.previous.length, 20);
  assert.ok(last20.current.at(-1).start > last20.previous[0].start, "janelas não se sobrepõem");
  const slot = E.applyFilters(D.games, { ...base, slotItem: { slot: 4, item: 6692 } }).current;
  assert.ok(slot.length > 0 && slot.every((g) => g.order[3].id === 6692));
});

test("comparação entre patches", () => {
  const all = E.applyFilters(D.games, { ...E.DEFAULT_FILTERS, period: "all" }).current;
  const ps = E.patchStats(all, D.meta);
  assert.ok(ps.length >= 3);
  assert.ok(E.comparePatch(ps[0].patch, ps[1].patch) > 0, "patch mais recente primeiro");
  assert.equal(ps.reduce((s, p) => s + p.n, 0), all.length);
  const p0 = E.applyFilters(D.games, { ...E.DEFAULT_FILTERS, period: "all", patches: [ps[0].patch] }).current;
  assert.equal(p0.length, ps[0].n);
});

test("comparador de builds: Eclipse x Dança da Morte", () => {
  const all = E.applyFilters(D.games, { ...E.DEFAULT_FILTERS, period: "all" }).current;
  const A = { items: [6676, 3748, 6673, 6692], mode: "set" }, B = { items: [6676, 3748, 6673, 6333], mode: "set" };
  const c = E.compareBuilds(all, A, B, D.meta);
  assert.ok(c.a.games.length > 5 && c.b.games.length > 5);
  assert.equal(c.a.keyItem, 6692);
  assert.equal(c.b.keyItem, 6333);
  assert.ok(c.byGold.rows.length === 3);
  assert.ok(c.notes.some((n) => /associação, não causa/.test(n.text)));
  assert.ok(c.a.context.n > 0 && c.a.context.teamGold.mean != null);
  console.log(`       A=${c.a.games.length} (${E.pctTxt(c.a.summary.rate)}) B=${c.b.games.length} (${E.pctTxt(c.b.summary.rate)}) bruto=${(c.wrDiff.diff * 100).toFixed(1)}pp ajustado=${c.byGold.adjusted ? (c.byGold.adjusted.diff * 100).toFixed(1) + "pp" : "—"}`);
  console.log(`       ouro do time na compra: Eclipse ${Math.round(c.a.context.teamGold.mean)} · DdM ${Math.round(c.b.context.teamGold.mean)}`);
});

test("comparador com amostra pequena avisa e não conclui", () => {
  const all = E.applyFilters(D.games, { ...E.DEFAULT_FILTERS, period: "last10" }).current;
  const c = E.compareBuilds(all, { items: [6676, 6692], mode: "set" }, { items: [6676, 6333], mode: "set" }, D.meta);
  assert.ok(c.notes[0].tone === "warn");
  assert.ok(/Amostra pequena|não tem partidas/.test(c.notes[0].text));
});

test("todas as análises rodam sem erro", () => {
  const all = E.applyFilters(D.games, { ...E.DEFAULT_FILTERS, period: "all", champion: "ALL", queue: "all" }).current;
  E.itemStats(all, D.meta); E.comboStats(all, D.meta, { size: 3 }); E.comboStats(all, D.meta, { size: 2, mode: "set" });
  E.orderStats(all, D.meta); E.keystoneStats(all, D.meta); E.runePageStats(all, D.meta); E.minorRuneStats(all, D.meta);
  E.runeBuildMatrix(all, D.meta, [6692, 6333]); E.consistency(all); E.rollingSeries(all); E.byDay(all); E.championStats(all);
  const es = E.earlyStats(all); assert.ok(es.nTL > 0 && es.rows[1].dGold != null);
  const fs_ = E.farmStats(all); assert.ok(fs_.cs[0].mean > 0); assert.ok(fs_.cei.value == null || (fs_.cei.value >= 0 && fs_.cei.value <= 100));
  const os = E.objectiveStats(all); assert.ok(os.perType.length >= 3);
  const ds = E.deathStats(all); assert.ok(ds.total >= 0);
  const mu = E.matchupStats(all); assert.ok(mu.length > 5);
  E.matchupDetail(all, mu[0].champ, D.meta); E.classStats(all, D.meta, {});
  const ev = E.evolution(all, 20); assert.ok(ev.rows.length === E.EVOLUTION_METRICS.length);
  const co = E.coachDiagnostics(all, all, D.meta); assert.ok(Array.isArray(co));
  const pk = E.analyticsPacket(all, all, D.meta, "teste"); assert.ok(JSON.stringify(pk).length < 60000);
  E.gameEvents(all.find((g) => g.hasTL), D.meta);
});

test("mapa: eventos têm posição (abate pela Riot, torre/objetivo pela tabela ou pelo coletor 1.7)", () => {
  const D = JSON.parse(fs.readFileSync(new URL("./fixture_export.json", import.meta.url)));
  const all = E.prepare(D).games;
  const g = all.find((x) => x.hasTL);
  const me = g.raw.me.pid;
  g.raw.timeline.kills = [[100, 99, me, [], 5000, 10400]];
  g.buildings = [
    { t: 200, type: "TOWER_BUILDING", lane: "BOT_LANE", towerType: "OUTER_TURRET", ownerTeam: 200, byMyTeam: true, x: 13866, y: 4505 },
  ];
  g.elite = [{ t: 300, type: "DRAGON", mine: true, me: false, x: 9866, y: 4414 }];
  const ev = E.gameEvents(g, D.meta);
  const death = ev.find((e) => e.kind === "death");
  assert.equal(death.x, 5000); assert.equal(death.y, 10400);
  assert.ok(ev.find((e) => e.kind === "bld-ally").text.startsWith("Torre externa do bot"));
  assert.equal(ev.find((e) => e.kind === "obj-ally").x, 9866);
  // normalização: sem x/y gravado, a torre cai na posição fixa; com x/y (coletor 1.7), usa o gravado
  const raw = JSON.parse(JSON.stringify(D));
  const m = raw.matches.find((x) => x.timeline);
  const team = m.me.teamId === 100 ? 200 : 100;
  m.timeline.buildings = [[600, "TOWER_BUILDING", "MID_LANE", "OUTER_TURRET", team, m.me.pid], [700, "INHIBITOR_BUILDING", "TOP_LANE", null, team, m.me.pid, 111, 222]];
  m.timeline.elite = [[650, "BARON_NASHOR", null, m.me.teamId, m.me.pid, []]];
  const g2 = E.prepare(raw).games.find((x) => x.id === m.matchId);
  assert.deepEqual([g2.buildings[0].x, g2.buildings[0].y], E.BUILDING_SPOTS[team].MID_LANE.OUTER_TURRET);
  assert.deepEqual([g2.buildings[1].x, g2.buildings[1].y], [111, 222]);
  assert.deepEqual([g2.elite[0].x, g2.elite[0].y], E.OBJECTIVE_PITS.BARON_NASHOR);
});

test("runas: valores de fim de partida viram texto e % do total", () => {
  assert.equal(E.fillRuneText("Tempo concluído: @eogvar1@:@eogvar2@", [10, 5, 0]).text, "Tempo concluído: 10:05");
  assert.equal(E.runeStatKind("Total de acúmulos: @eogvar1@"), null);
  assert.equal(E.runeStatKind("Ouro coletado: @eogvar2@"), "gold");
  assert.equal(E.runeStatKind("Total de Vida restaurada: @eogvar1@"), "heal");
  assert.equal(E.runeStatKind("Dano total bloqueado: @eogvar1@"), "mitig");
  assert.equal(E.runeStatKind("Dano causado a torres: @eogvar1@"), null);
  const g = { runes: { primary: [8005, 9104], secondary: [8143], vars: { 8005: [2346, 2346, 0], 9104: [10, 10, 0], 8143: [1102, 0, 0] } }, raw: { me: { dmg: 24629, gold: 15561 } } };
  const meta = { runeStats: { 8005: ["Total de dano: @eogvar1@", "Dano adicional: @eogvar2@"], 9104: ["Tempo concluído: @eogvar1@:@eogvar2@"], 8143: ["Dano adicional: @eogvar1@"] } };
  const rc = E.runeContributions(g, meta);
  assert.ok(rc.hasValues);
  const pta = rc.runes.find((r) => r.id === 8005);
  assert.equal(pta.contrib.length, 1);
  assert.ok(Math.abs(pta.contrib[0].pct - 2346 / 24629) < 1e-9);
  assert.equal(rc.runes.find((r) => r.id === 9104).contrib.length, 0);
  assert.equal(rc.totals.find((t) => t.kind === "damage").value, 2346 + 1102);
  assert.equal(E.runeContributions({ runes: { primary: [8005], secondary: [] }, raw: { me: {} } }, meta).hasValues, false);
});

test("hábitos: perfil de partida e resumo rodam e as faixas do mapa fazem sentido", async () => {
  const H = await import("../src/habits.js");
  const MR = await import("../src/match_report.js");
  assert.equal(MR.mapRegion(2100, 8450).zone, "jungle"); // sapo do lado azul não é lane
  assert.equal(MR.mapRegion(12857, 2139).zone, "bot");   // curva da rota de baixo
  assert.equal(MR.mapRegion(9866, 4414).zone, "river");  // dragão
  const { games, meta } = E.prepare(fixture);
  const ps = games.filter((g) => g.hasTL).map((g) => H.habitProfile(g, meta)).filter(Boolean);
  const s = H.habitSummary(ps);
  assert.equal(s.n, ps.length);
  assert.equal(s.phases.length, 5);
  assert.ok(Array.isArray(H.sidePriority(ps)));
});

test("partidas para estudar e rota: rodam e respeitam a regra do lado do mapa", async () => {
  const ST = await import("../src/study.js");
  const H = await import("../src/habits.js");
  assert.equal(H.halfOf(11220, 7148), "bot");   // azul do lado vermelho fica do lado do bot
  assert.equal(H.halfOf(3861, 8020), "top");    // azul do lado azul fica do lado do topo
  const { games, meta } = E.prepare(fixture);
  const g = games.find((x) => x.hasTL);
  const paths = ST.junglerPaths(g);
  assert.ok(paths && Array.isArray(paths.me));
  assert.ok(Array.isArray(ST.routeReading(g, meta)));
  assert.ok(Array.isArray(ST.decisiveMoments(g, meta)));
  const prep = { players: [{ id: "x", riotId: "Teste#BR1", games }], meta };
  assert.ok(Array.isArray(ST.studyGames(prep, meta)));
  const V = E.voiceOf({ ...g, subject: "Teste" });
  assert.equal(V.S, "Teste");
  assert.ok(E.gameEvents({ ...g, subject: "Teste" }, meta).every((e) => !/^Você/.test(e.text)));
});

test("evolução: sequência de derrotas não vira 'piorando' sem evidência", () => {
  const mk = (win, d) => ({ win, d, k: 5, a: 5, csMin: 7, goldMin: 420, dmgMin: 700, early: null, elite: null, myEvents: null, order: null });
  const recent = [mk(false, 4), mk(false, 4), mk(false, 5), mk(true, 4), mk(false, 4)];
  const previous = [mk(true, 4), mk(true, 5), mk(false, 4), mk(true, 4), mk(true, 4)];
  const rows = E.compareWindows(recent, previous);
  const wr = rows.find((r) => r.key === "wr");
  assert.notEqual(wr.status, "piorando");
});

test("revisão de derrotas: tipos, sinais e conversão coerentes", () => {
  const all = E.applyFilters(D.games, { ...E.DEFAULT_FILTERS, period: "all", champion: "ALL", queue: "all" }).current;
  const lr = E.lossReview(all, all);
  assert.ok(lr.nLosses > 0);
  assert.equal(lr.rows.length, lr.nLosses);
  assert.equal(lr.byType.reduce((s, t) => s + t.n, 0), lr.rows.filter((r) => r.type).length);
  for (const r of lr.rows) { assert.ok(!r.g.win); for (const k of r.signals.on) assert.ok(E.LOSS_SIGNALS[k]); }
  for (const s of lr.signalRates) { assert.ok(s.losses == null || (s.losses >= 0 && s.losses <= 1)); }
  assert.ok(lr.normal > 0);
  const c = lr.conversion; assert.ok(c.ahead.n + c.even.n + c.behind.n <= lr.nLosses + lr.nWins);
});

console.log("Rumo ao Challenger");
const mkRefs = (games, n = 3, per = 12) => ({
  schema: CH.REF_SCHEMA, schemaVersion: 1, generatedAt: "2026-11-02T00:00:00Z", queue: 420, notFound: [], meta: D.meta,
  players: Array.from({ length: n }, (_, i) => ({
    riotId: `Ref${i}#BR1`, listedAs: `Ref${i}#BR1`, puuid: "R" + i,
    matches: games.filter((g, j) => j % n === i).slice(0, per).map((g) => {
      const m = g.raw;
      return { ...m, matchId: m.matchId + "-r" + i, me: { ...m.opp, puuid: "R" + i, position: "JUNGLE" }, opp: m.me,
        timeline: m.timeline ? { ...m.timeline, me: m.timeline.opp, opp: m.timeline.me, items: [] } : null };
    }),
  })),
});
const demoAll = () => E.applyFilters(D.games, { ...E.DEFAULT_FILTERS, period: "all" }).current.filter((g) => g.raw.opp && g.queueId === 420);

test("referências: arquivo próprio, não mistura com as suas partidas", () => {
  const raw = mkRefs(demoAll());
  assert.ok(CH.isRefsFile(raw));
  assert.throws(() => E.validateDataset(raw));
  assert.throws(() => CH.validateRefs({ schema: E.SCHEMA, matches: [] }));
  const { refs, report } = CH.mergeRefs(null, raw);
  assert.equal(report.players, 3);
  const again = CH.mergeRefs(refs, raw);
  assert.equal(again.report.added, 0, "reimportar não duplica");
  const fewer = CH.mergeRefs(refs, { ...raw, players: raw.players.slice(0, 2) });
  assert.equal(fewer.report.removed, 1, "quem saiu da lista sai das referências");
});

test("referências: linha de base do elo espelha as suas partidas", () => {
  const mine = demoAll().filter((g) => g.hasTL);
  const opp = CH.opponentGames(mine, D.meta);
  assert.ok(opp.length > 10);
  const g = mine.find((x) => x.early?.diff10);
  const o = opp.find((x) => x.id === g.id + ":adv");
  assert.equal(o.early.diff10.gold, -g.early.diff10.gold);
  assert.equal(o.win, !g.win);
  assert.equal(CH.firstRecallMin(o), null, "sem compras do inimigo, recall fica vazio");
});

test("referências: comparação, faixa e posição coerentes", () => {
  const all = demoAll();
  const prep = CH.prepareRefs(CH.mergeRefs(null, mkRefs(all, 3, 20)).refs);
  assert.equal(prep.players.length, 3);
  const mine = all.slice(0, 40);
  const cmp = CH.compare(mine, prep.players, CH.opponentGames(mine, D.meta));
  assert.equal(cmp.rows.length, CH.METRICS.length);
  for (const r of cmp.rows) if (r.pos && r.pos.beats != null) assert.ok(r.pos.beats >= 0 && r.pos.beats <= r.pos.of);
  assert.ok(cmp.gaps.every((r) => !r.partial && r.better !== "neutral"));
  assert.equal(cmp.style.filter((e) => e.isMe).length, 1);
  const b = { n: 3, center: 5, median: 5, min: 4, max: 6, p25: 4.5, p75: 5.5, values: [{ id: "a", v: 4 }, { id: "b", v: 5 }, { id: "c", v: 6 }] };
  assert.equal(CH.positionOf(3, b, "higher").status, "abaixo");
  assert.equal(CH.positionOf(3, b, "lower").status, "nivel");
  assert.equal(CH.positionOf(4.5, b, "higher").status, "faixa");
  assert.equal(CH.positionOf(4.5, b, "higher").beats, 1);
  assert.equal(CH.opggUrl("guga fighter#001"), "https://www.op.gg/summoners/br/guga%20fighter-001");
});

test("referências: sem jogadores, a comparação com o elo ainda funciona", () => {
  const mine = demoAll().slice(0, 30);
  const cmp = CH.compare(mine, [], CH.opponentGames(mine, D.meta));
  assert.equal(cmp.players.length, 0);
  assert.ok(cmp.rows.some((r) => r.elo != null && r.me != null));
  assert.equal(cmp.gaps.length, 0);
});

test("coach: diferença pareada e pontos fortes contra o jungler inimigo", () => {
  const pd = E.pairedDiff([[3, 1], [2, 1], [4, 2], [3, 2]]);
  assert.equal(pd.n, 4); assert.equal(pd.diff, 1.5); assert.ok(pd.ci[0] > 0);
  assert.equal(E.pairedDiff([[1, null]]), null);
  const all = E.applyFilters(D.games, { ...E.DEFAULT_FILTERS, period: "all", champion: "ALL" });
  const d = E.coachDiagnostics(all.pool, all.current, D.meta);
  for (const x of d.filter((x) => x.kind === "ponto-forte" && x.id.startsWith("str-"))) assert.ok(x.evidence.ci[0] > 0, x.id);
});

test("referências: visão depende do campeão e não entra no Coach; Lee Sin pode sair", () => {
  const all = demoAll();
  const prep = CH.prepareRefs(CH.mergeRefs(null, mkRefs(all, 3, 20)).refs);
  const mine = all.slice(0, 40);
  const cmp = CH.compare(mine, prep.players, CH.opponentGames(mine, D.meta));
  assert.ok(!cmp.gaps.some((r) => r.champDep || r.key === "controlWards"));
  assert.ok(cmp.focus.every((f) => f.lead && Array.isArray(f.related)));
  assert.ok(cmp.focus.every((f, i) => i === 0 || cmp.focus[i - 1].lead.pos.z <= f.lead.pos.z));
  const noLee = CH.filterRefGames(prep, "noLee", D.meta);
  assert.ok(noLee.every((p) => p.games.every((g) => g.champ !== "LeeSin")));
});


console.log("Early game (estratégias e cronograma)");
{
  const EG = await import("../src/early.js");
  // quadros: [t, ouro, ouro atual, xp, nível, farm, farm de selva, x, y]
  const fr = (t, jcs, x, y, lvl = 3) => [t, 500 + t * 4, 100, t * 5, lvl, 0, jcs, x, y];
  const base = (over = {}) => ({
    id: "T1", win: true, duration: 1500, champ: "Briar",
    elite: [{ t: 400, type: "DRAGON", mine: true, me: true, x: 9800, y: 4400 }],
    raw: {
      me: { pid: 1, teamId: 100, challenges: { initialCrabCount: 1 } },
      timeline: {
        me: [fr(0, 0, 400, 400, 1), fr(60, 0, 7800, 4100, 1), fr(120, 12, 6900, 5400), fr(180, 24, 3800, 7900, 4), fr(240, 28, 12200, 2400, 4), fr(300, 32, 600, 600, 5), fr(360, 40, 7000, 5300, 6), fr(420, 44, 7000, 5300, 6), fr(480, 48, 7000, 5300, 7), fr(540, 52, 7000, 5300, 7), fr(600, 56, 7000, 5300, 8)],
        opp: [], kills: [[205, 1, 9, [4], 12500, 2300]], items: [[10, "P", 1102], [280, "P", 1036], [281, "P", 2055]], wards: [[30, 0, "YELLOW_TRINKET"]],
        ...over,
      },
    },
  });
  test("placeOf: selva do topo, do bot, rio, lane e base", () => {
    assert.equal(EG.placeOf(3800, 7900, 100), "selvaTop");
    assert.equal(EG.placeOf(7800, 4100, 100), "selvaBot");
    assert.equal(EG.placeOf(7400, 7450, 100), "mid");
    assert.equal(EG.placeOf(500, 500, 100), "base");
    assert.equal(EG.placeOf(7800, 4100, 200), "inimiga");
  });
  test("full clear e gank no bot logo depois = Full clear focado em gank com prio bot", () => {
    const p = EG.earlyProfile(base());
    assert.equal(p.strat, "fullGank");
    assert.equal(p.prio, "bot");
    assert.equal(p.firstResult, "abate");
    assert.equal(p.recall1, 280);
    assert.equal(p.next, "base");
  });
  test("3 campos e recall antes dos 3:20 = 3 campos e recall", () => {
    const g = base({ items: [[10, "P", 1102], [125, "P", 1036]], kills: [[300, 1, 9, [], 12500, 2300]] });
    g.raw.timeline.me[2] = fr(120, 12, 500, 500);
    assert.equal(EG.earlyProfile(g).strat, "reset");
  });
  test("abate no bot com dragão vivo que vira dragão conta como conversão", () => {
    const g = base({ kills: [[205, 1, 9, [4], 12500, 2300], [350, 1, 8, [], 11000, 3000]] });
    const p = EG.earlyProfile(g);
    assert.deepEqual(p.conv.map((c) => [c.obj, c.got]), [["DRAGON", true]]);
  });
  test("ritmo do início: campos, 1º gank e 1º recall em ordem, com o horário", () => {
    const ev = EG.routeEvents(base());
    assert.deepEqual(ev.me.map((e) => e.k), ["start", "clear", "first", "recall"]);
    assert.equal(ev.me.find((e) => e.k === "first").t, 205);
    assert.equal(ev.me.find((e) => e.k === "recall").t, 280);
    assert.match(ev.me.find((e) => e.k === "first").label, /gank bot com abate/);
  });
}
{
  const MI = await import("../src/matchup_insights.js");
  test("ciclo de classes: cada classe ganha das duas seguintes e sofre contra as duas anteriores", () => {
    assert.deepEqual(MI.strongAgainst("tank"), ["slayer", "mage"]);
    assert.deepEqual(MI.weakAgainst("tank"), ["fighter", "marksman"]);
    assert.deepEqual(MI.strongAgainst("fighter"), ["tank", "slayer"]);
    assert.deepEqual(MI.weakAgainst("fighter"), ["marksman", "mage"]);
    assert.deepEqual(MI.attributesOf("tank"), ["resistência", "aproximação"]);
    assert.deepEqual(MI.strongAgainst("specialist"), []);
  });
  test("melhor e pior matchup: win rate puxado para a média com poucas partidas", () => {
    const row = (key, w, n) => ({ key, wins: w, n, rate: w / n });
    const bw = MI.bestWorst([row("a", 2, 2), row("b", 7, 9), row("c", 1, 6), row("d", 3, 5)], 0.55);
    assert.equal(bw.best.key, "b");
    assert.equal(bw.worst.key, "c");
  });
}
{
  const TU = await import("../src/turns.js");
  const fr = (t, jcs, x, y, lvl = 1, gold = 500 + t * 3) => [t, gold, 0, 0, lvl, 0, jcs, x, y];
  const g = {
    id: "T1", duration: 900, win: true, teamId: 100, participants: [{ pid: 1, teamId: 100 }, { pid: 9, teamId: 200, championName: "Zed", championId: 238 }],
    elite: [], buildings: [],
    raw: {
      me: { pid: 1, teamId: 100 }, opp: { pid: 6, teamId: 200 },
      timeline: {
        me: [fr(0, 0, 500, 500), fr(60, 0, 7800, 4100), fr(120, 12, 6900, 5400, 2), fr(180, 24, 3800, 7900, 3), fr(240, 28, 7800, 4100, 4), fr(300, 32, 500, 500, 4), fr(360, 40, 7000, 5300, 5), fr(420, 48, 7000, 5300, 6), fr(480, 52, 600, 600, 6), fr(540, 56, 7000, 5300, 7), fr(600, 60, 7000, 5300, 7), fr(660, 64, 7000, 5300, 8), fr(720, 68, 7000, 5300, 8), fr(780, 72, 7000, 5300, 9), fr(840, 76, 7000, 5300, 9), fr(900, 80, 7000, 5300, 9)],
        opp: [], kills: [[205, 1, 9, [], 12500, 2300], [470, 9, 1, [], 9000, 6000]], items: [[10, "P", 1102], [280, "P", 1036], [282, "P", 2055]], wards: [],
      },
    },
  };
  test("turnos: cada turno termina num recall ou numa morte", () => {
    const ts = TU.gameTurns(g, { items: { 1036: { gold: 350 }, 2055: { gold: 75 } } });
    assert.deepEqual(ts.map((t) => t.kind), ["recall", "morte", "fim"]);
    assert.equal(ts[0].end, 280);
    assert.equal(ts[0].kills, 1);
    assert.equal(ts[0].recall.spent, 425);
    assert.equal(ts[1].end, 470);
    assert.equal(ts[1].death.killer.champ, "Zed");
    assert.ok(ts[2].start > 470 + 10, "o turno seguinte começa depois do tempo de renascer");
  });
}
console.log(`\n${passed} testes passaram${process.exitCode ? ", COM FALHAS" : ""}.`);
