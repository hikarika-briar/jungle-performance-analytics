// Aba "Hábitos": rota inicial, ritmo por fase, prioridade de objetivos e de lado — você × Challengers.
import * as E from "./engine.js";
import * as CH from "./challenger.js";
import * as H from "./habits.js";
import { fmt, C, Card, Tip, Empty, ChampIcon } from "./ui.jsx";
import { NoGames } from "./views_overview.jsx";
import * as ST from "./study.js";
import { PathsMap } from "./views_map.jsx";
import { MatchDrawer } from "./views_data.jsx";
import * as RK from "./rank.js";
import * as EG from "./early.js";
import * as SI from "./situations.js";
import { SidesHeader, SidePanels, campLabels, ObjectiveAnswer, StrategyDistTile, StrategyBestTile, SituationBoard, situationVerdictFor, SideBar, verdict } from "./views_habits_sides.jsx";
import { subLabel, laneClasses } from "./classes.js";
const React = window.React;
const { useMemo, useState } = React;

const EMERALD = "#2FCF7E";
const pct = (v) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const dec = (v, d = 1) => (v == null ? "—" : fmt.dec(v, d));
const clock = (s) => (s == null ? "—" : fmt.clock(s));
const ZONE = { top: "topo", mid: "meio", bot: "bot" };
const CAMP = { blue: "Blue", red: "Red", sapo: "Sapo", lobos: "Lobos", galinhas: "Galinhas", pedras: "Pedras", rio: "Rio (ward ou leash)", invade: "Invasão nível 1" };
const CLEAR = { ate3: "Até 3 campos", "4a5": "4 a 5 campos", full: "Full clear (6+)" };
const OBJ = { DRAGON: "Dragão", HORDE: "Vastilarvas", RIFTHERALD: "Arauto", nenhum: "Nenhum até os 15" };

export function useHabits(ctx) {
  const prep = useMemo(() => CH.prepareRefs(ctx.refs), [ctx.refs]);
  const mine = useMemo(() => ctx.games.filter((g) => g.hasTL && g.position === "JUNGLE").map((g) => H.habitProfile(g, ctx.meta)).filter(Boolean), [ctx.games, ctx.meta]);
  const chal = useMemo(() => (prep ? prep.players.flatMap((p) => p.games).filter((g) => g.hasTL).map((g) => H.habitProfile(g, prep.meta)).filter(Boolean) : []), [prep]);
  const sm = useMemo(() => H.habitSummary(mine), [mine]);
  const sc = useMemo(() => H.habitSummary(chal), [chal]);
  // Estratégias (as mesmas do Early Game) e situações de lane por classe
  const eMine = useMemo(() => ctx.games.filter((g) => g.hasTL && g.position === "JUNGLE").map(EG.earlyProfile).filter(Boolean), [ctx.games]);
  const eChal = useMemo(() => (prep ? prep.players.flatMap((p) => p.games).filter((g) => g.hasTL).map(EG.earlyProfile).filter(Boolean) : []), [prep]);
  const rMine = useMemo(() => ctx.games.filter((g) => g.hasTL && g.position === "JUNGLE").map((g) => SI.situationRow(g, ctx.meta)).filter(Boolean), [ctx.games, ctx.meta]);
  const rChal = useMemo(() => (prep ? prep.players.flatMap((p) => p.games).filter((g) => g.hasTL).map((g) => SI.situationRow(g, prep.meta)).filter(Boolean) : []), [prep]);
  return { prep, mine, chal, sm, sc, eMine, eChal, rMine, rChal };
}

// Barra empilhada de uma distribuição (você ou Challengers)
function Stack({ dist, labels, colors, who }) {
  const total = dist.reduce((s, d) => s + d.n, 0) || 1;
  return (
    <div className="hb-stack" aria-label={who}>
      <span className="who">{who}</span>
      <span className="bar">{dist.map((d, i) => d.n ? <i key={d.key} style={{ width: `${(d.n / total) * 100}%`, background: colors[i] }} title={`${labels[d.key]}: ${pct(d.n / total)} · win rate ${pct(d.wr)} (${d.n})`}>{d.n / total >= 0.12 ? pct(d.n / total) : ""}</i> : null)}</span>
    </div>
  );
}

function VsTile({ title, tip, rows }) {
  return (
    <div className="hb-tile">
      <div className="hb-tile-head"><span>{title}</span>{tip && <Tip text={tip} />}</div>
      <div className="hb-vs">
        {rows.map((r) => (
          <div key={r.label} className="hb-vs-row">
            <span className="l">{r.label}</span>
            <b className="me">{r.me}</b>
            <span className="x">×</span>
            <b className="ch">{r.ch}</b>
          </div>
        ))}
      </div>
      <div className="hb-legend"><span><i style={{ background: EMERALD }} />você</span><span><i style={{ background: C.gold }} />Challengers</span></div>
    </div>
  );
}

const PHASE_ROWS = [
  ["camps", "Campos da selva", (v) => dec(v, 1), "higher"],
  ["laneTd", "Abates nas rotas", (v) => dec(v, 2), "higher"],
  ["takedowns", "Abates + assistências", (v) => dec(v, 2), "higher"],
  ["deaths", "Mortes", (v) => dec(v, 2), "lower"],
  ["objectives", "Objetivos épicos (com você)", (v) => dec(v, 2), "higher"],
  ["towers", "Torres (com você)", (v) => dec(v, 2), "higher"],
  ["plates", "Placas de torre", (v) => dec(v, 2), "higher"],
  ["enemyJungle", "Tempo na selva inimiga", pct, "higher"],
];

// Três cartões, um por janela do jogo; em cada linha, você × Challengers com uma barra dupla.
function PhaseCards({ sm, sc }) {
  const rows = PHASE_ROWS.filter(([k]) => sm.phases.some((p) => p[k] != null) || sc.phases.some((p) => p[k] != null));
  return (
    <>
      <div className="hb-phases">
        {sm.phases.map((p, i) => {
          const q = sc.phases[i];
          return (
            <div key={p.label} className="hb-ph">
              <div className="hb-ph-head"><b>{p.label}</b><span>minutos</span></div>
              {rows.map(([k, label, f, better]) => {
                const a = p[k], b = q[k];
                const max = Math.max(a ?? 0, b ?? 0) || 1;
                const rel = a != null && b != null ? (a - b) / (Math.max(Math.abs(a), Math.abs(b)) || 1) : 0;
                const tone = Math.abs(rel) < 0.1 ? "even" : (better === "higher" ? rel > 0 : rel < 0) ? "good" : "bad";
                return (
                  <div key={k} className={`hb-ph-row ${tone}`}>
                    <span className="l">{label}</span>
                    <span className="v"><b>{a == null ? "—" : f(a)}</b><span className="x">×</span><span className="c">{b == null ? "—" : f(b)}</span></span>
                    <span className="bars"><i className="me" style={{ width: `${((a ?? 0) / max) * 100}%` }} /><i className="ch" style={{ width: `${((b ?? 0) / max) * 100}%` }} /></span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="hb-legend" style={{ marginTop: 10 }}><span><i style={{ background: EMERALD }} />você</span><span><i style={{ background: C.gold }} />Challengers</span><span className="dim">Número em verde ou vermelho quando a diferença passa de 10%.</span></div>
    </>
  );
}

// Linha do tempo do início: cada momento numa linha, com você e os Challengers no mesmo eixo de tempo.
function OpeningTimeline({ sm, sc }) {
  const recall = (x) => (x.recall == null ? null : x.recall * 60);
  const marks = [
    ["Ward nível 1", sm.ward1T, sc.ward1T], ["3 campos", sm.tCamps3, sc.tCamps3], ["Full clear", sm.tCamps6, sc.tCamps6],
    ["1ª lane", sm.firstActionT, sc.firstActionT], ["1º abate em lane", sm.firstGankT, sc.firstGankT], ["1º recall", recall(sm), recall(sc)],
  ].filter(([, a, b]) => a != null || b != null);
  const maxT = Math.max(300, Math.ceil(Math.max(...marks.flatMap(([, a, b]) => [a ?? 0, b ?? 0])) / 60) * 60);
  const pos = (t) => `${(t / maxT) * 100}%`;
  const ticks = []; for (let t = 0; t <= maxT; t += 60) ticks.push(t);
  return (
    <div className="hb-tile">
      <div className="hb-tile-head"><span>Linha do tempo do início</span><Tip text="Mediana de cada momento. Campos: quando o farm de selva passou de 12 (3 campos) e de 24 (6 campos), entre os quadros de minuto. 1ª lane: primeira jogada numa lane (abate, morte ou presença no minuto). Recall: primeira compra na base." /></div>
      <div className="hb-dots">
        {marks.map(([label, a, b]) => {
          const d = a != null && b != null ? a - b : null;
          return (
            <div key={label} className="hb-dot-row">
              <span className="l">{label}</span>
              <span className="track">
                {ticks.map((t) => <span key={t} className="tk" style={{ left: pos(t) }} />)}
                {a != null && b != null && <span className="gap" style={{ left: pos(Math.min(a, b)), width: `${(Math.abs(a - b) / maxT) * 100}%` }} />}
                {b != null && <i className="ch" style={{ left: pos(b) }} title={`Challengers: ${clock(b)}`} />}
                {a != null && <i className="me" style={{ left: pos(a) }} title={`Você: ${clock(a)}`} />}
              </span>
              <span className="t"><b>{clock(a)}</b><span className="c">{clock(b)}</span>{d != null && Math.abs(d) >= 5 && <span className={`d ${d > 0 ? "late" : "early"}`}>{d > 0 ? "+" : "−"}{Math.round(Math.abs(d))}s</span>}</span>
            </div>
          );
        })}
        <div className="hb-dot-axis"><span className="l" /><span className="track">{ticks.map((t) => <span key={t} style={{ left: pos(t) }}>{t / 60}′</span>)}</span><span className="t" /></div>
      </div>
      <div className="hb-legend"><span><i style={{ background: EMERALD, borderRadius: "50%" }} />você</span><span><i style={{ background: C.gold, transform: "rotate(45deg)" }} />Challengers</span><span className="dim">+ = depois deles</span></div>
    </div>
  );
}

function lobbyAvg(g, subjectRank) {
  const v = (g.participants || []).map((p) => (p.pid === g.raw.me.pid ? subjectRank : p.rank)).map((r) => RK.rankValue(r)).filter((x) => x != null);
  return v.length >= 3 ? RK.valueToRank(v.reduce((a, b) => a + b, 0) / v.length) : null;
}

// Partidas para estudar: vitórias disputadas dos Challengers em que o jungler fez a diferença.
function Spark({ g }) {
  const c = ST.teamCurve(g);
  if (c.length < 3) return null;
  const W = 220, Hh = 54, maxT = c[c.length - 1].t || 1;
  const m = Math.max(1000, ...c.map((p) => Math.abs(p.d)));
  const x = (t) => (t / maxT) * W, y = (d) => Hh / 2 - (d / m) * (Hh / 2 - 3);
  const pts = c.map((p) => `${x(p.t).toFixed(1)},${y(p.d).toFixed(1)}`).join(" ");
  const area = `0,${Hh / 2} ${pts} ${W},${Hh / 2}`;
  const worst = c.reduce((a, b) => (b.d < a.d ? b : a));
  return (
    <svg className="sg-spark" viewBox={`0 0 ${W} ${Hh}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <clipPath id={`up-${g.id}`}><rect x="0" y="0" width={W} height={Hh / 2} /></clipPath>
        <clipPath id={`dn-${g.id}`}><rect x="0" y={Hh / 2} width={W} height={Hh / 2} /></clipPath>
      </defs>
      <line x1="0" x2={W} y1={Hh / 2} y2={Hh / 2} className="zero" />
      <polygon points={area} className="up" clipPath={`url(#up-${g.id})`} />
      <polygon points={area} className="dn" clipPath={`url(#dn-${g.id})`} />
      <polyline points={pts} className="ln" />
      <circle cx={x(worst.t)} cy={y(worst.d)} r="2.6" className="worst" />
    </svg>
  );
}

function StudyGames({ ctx, prep, onOpen }) {
  const main = useMemo(() => { const c = {}; for (const g of ctx.all) if (g.position === "JUNGLE") c[g.champ] = (c[g.champ] || 0) + 1; return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] || null; }, [ctx.all]);
  const [champ, setChamp] = useState("ALL");
  const list = useMemo(() => ST.studyGames(prep, prep.meta, { champ: champ === "ALL" ? null : champ }), [prep, champ]);
  const meta = prep.meta;
  const rankOf = (pl) => (ctx.refs?.players || []).find((x) => x.puuid === pl.id)?.rank || null;
  const allGames = useMemo(() => prep.players.map((pl) => ({ pl, games: [...pl.games].sort((a, b) => b.start - a.start) })), [prep]);
  const [pick, setPick] = useState("");
  const openPick = (v) => {
    setPick(v);
    if (!v) return;
    const [pid, gid] = v.split("|");
    const pl = prep.players.find((x) => x.id === pid); const g = pl?.games.find((x) => x.id === gid);
    if (g) onOpen(g, pl, rankOf(pl));
  };
  return (
    <section className="card span-12 sg">
      <div className="card-head">
        <div>
          <div className="eyebrow">Vitórias disputadas em que o jungler fez a diferença · de {prep.players.reduce((n, p) => n + p.games.length, 0)} partidas dos Challengers</div>
          <h2>Partidas para estudar<Tip text="Vitórias em que o time ficou atrás em algum momento (virada) ou estava equilibrado aos 20 minutos, sem stomp. Entre elas, as de maior nota do jungler, mais objetivos e duelo vencido contra o jungler inimigo. No máximo 2 por jogador." /></h2>
        </div>
        <div className="right chips">
          <button className="chip" aria-pressed={champ === "ALL"} onClick={() => setChamp("ALL")}>Todos os campeões</button>
          {main && <button className="chip" aria-pressed={champ === main} onClick={() => setChamp(main)}>Só {E.champDisplay(meta, main)}</button>}
        </div>
      </div>
      {list.length ? (
        <div className="sg-grid">{list.map((c, i) => {
          const g = c.g;
          const rk = rankOf(c.player);
          return (
            <button key={g.id} type="button" className={`sg-card ${i === 0 ? "first" : ""}`} onClick={() => onOpen(g, c.player, rk)}>
              <div className="sg-top">
                <span className="sg-rank">{i + 1}</span>
                <span className="sg-ch"><ChampIcon meta={meta} id={g.champId} keyName={g.champ} size={44} /></span>
                <span className="sg-vs">vs</span>
                <span className="sg-ch opp"><ChampIcon meta={meta} id={g.oppChampId} keyName={g.oppChamp} size={32} /></span>
                <span className="sg-who"><b>{ST.shortName(c.player.riotId)}</b><span>{E.champDisplay(meta, g.champ, g.champId)} × {E.champDisplay(meta, g.oppChamp, g.oppChampId)}</span>{rk && <span className="sg-tier" style={{ color: RK.TIER_COLOR[RK.normTier(rk.tier)] }}>{RK.rankLabel(rk, { lp: false })}</span>}</span>
              </div>
              {(() => { const lb = lobbyAvg(g, rk); return lb ? <div className="sg-lobby">Elo médio da partida: <b style={{ color: RK.TIER_COLOR[RK.normTier(lb.tier)] }}>{RK.rankLabel(lb, { lp: false })}</b></div> : null; })()}
              <div className="sg-line"><span className="res-chip w">Vitória</span><span className="num">{fmt.dur(g.duration)}</span><b className="num">{g.k}/{g.d}/{g.a}</b><span className="dim">{fmt.date(g.start)}</span></div>
              <div className="sg-curve"><Spark g={g} /><span className="lbl">ouro do time</span></div>
              <div className="sg-reasons">{c.reasons.map((r, k) => <span key={k} className={`sg-r ${r.tone}`}>{r.text}</span>)}</div>
              <span className="sg-open">Abrir partida ›</span>
            </button>
          );
        })}</div>
      ) : <p className="muted">Nenhuma vitória disputada{champ !== "ALL" ? ` de ${E.champDisplay(meta, champ)}` : ""} nas partidas dos Challengers coletadas.</p>}
      <div className="sg-pick">
        <label className="field"><span>Ou abra qualquer partida dos Challengers</span>
          <select value={pick} onChange={(e) => openPick(e.target.value)}>
            <option value="">Escolha uma partida…</option>
            {allGames.map(({ pl, games }) => (
              <optgroup key={pl.id} label={pl.riotId}>
                {games.map((g) => <option key={g.id} value={`${pl.id}|${g.id}`}>{fmt.date(g.start)} · {E.champDisplay(meta, g.champ, g.champId)} vs {E.champDisplay(meta, g.oppChamp, g.oppChampId)} · {g.win ? "V" : "D"} · {g.k}/{g.d}/{g.a}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

// Topo da página: quantos hábitos estão no nível dos Challengers, pontos críticos e pontos fortes.
export function HabitsHero({ checks, nMine, nChal, nPlayers, title = "Hábitos para treinar", unit = "já no nível Challenger", note }) {
  const crit = checks.filter((c) => c.status !== "nivel").sort((a, b) => b.score - a.score).slice(0, 3);
  const strong = checks.filter((c) => c.status === "nivel").sort((a, b) => b.good - a.good).slice(0, 3);
  const at = checks.filter((c) => c.status === "nivel").length;
  const order = [...checks].sort((a, b) => ({ nivel: 0, perto: 1, longe: 2 })[a.status] - ({ nivel: 0, perto: 1, longe: 2 })[b.status]);
  return (
    <section className="card span-12 hb-hero">
      <div className="hb-hero-top">
        <div>
          <div className="eyebrow">Você: {nMine} partidas de jungle do filtro · Challengers: {nChal} partidas de {nPlayers} jogadores</div>
          <h2 className="hb-hero-title">{title} <span>· {at} de {checks.length} {unit}</span></h2>
        </div>
        <div className="hb-meter" aria-label={`${at} de ${checks.length} hábitos no nível`}>
          <div className="hb-meter-bars">{order.map((c) => <i key={c.key} className={c.status} title={`${c.title}: ${c.fmt(c.me)} × ${c.fmt(c.ch)}`} />)}</div>
          <div className="hb-meter-legend"><span><i className="nivel" />no nível</span><span><i className="perto" />perto</span><span><i className="longe" />longe</span></div>
        </div>
      </div>
      {(() => {
        // Duas colunas com as mesmas linhas: cada ponto crítico fica na altura do ponto forte ao lado.
        const rows = Math.max(1, crit.length, strong.length);
        const pad = (list) => [...list, ...Array(rows - list.length).fill(null)];
        return (
          <div className="hb-sum" style={{ "--rows": rows + 1 }}>
            <div className="eyebrow bad hb-sum-h">Pontos críticos para trabalhar</div>
            {crit.length ? pad(crit).map((c, k) => c ? (
              <div key={c.key} className="csum-item hb-crit" style={{ "--k": k }}>
                <span className="rk">{k + 1}</span>
                <div className="tx"><div className="tt">{c.title} {c.severity && <span className={`prio ${c.severity}`}>{c.severity === "alta" ? "ALTA" : "MÉDIA"}</span>}</div><div className="hl">{c.tip}</div></div>
                <span className="big">{c.fmt(c.me)} <span className="x">×</span> {c.fmt(c.ch)}</span>
              </div>
            ) : <div key={"e" + k} className="hb-sum-empty" aria-hidden="true" />) : <><p className="muted">Nenhum hábito longe dos Challengers neste filtro.</p>{pad([]).slice(1).map((_, k) => <div key={"e" + k} className="hb-sum-empty" aria-hidden="true" />)}</>}
            <div className="eyebrow good hb-sum-h">O que já está no nível</div>
            {strong.length ? pad(strong).map((c, k) => c ? (
              <div key={c.key} className="csum-item good" style={{ "--k": k }}>
                <span className="rk">✓</span>
                <div className="tx"><div className="tt">{c.title}</div><div className="hl">{c.unit} · você × Challengers</div></div>
                <span className="big">{c.fmt(c.me)} <span className="x">×</span> {c.fmt(c.ch)}</span>
              </div>
            ) : <div key={"e" + k} className="hb-sum-empty" aria-hidden="true" />) : <><p className="muted">Nenhum hábito no nível ainda.</p>{pad([]).slice(1).map((_, k) => <div key={"e" + k} className="hb-sum-empty" aria-hidden="true" />)}</>}
          </div>
        );
      })()}
      <p className="note" style={{ marginBottom: 0 }}>{note || "Para mais base das suas partidas, troque o Período no filtro (por exemplo, \"Todo o histórico\"). Os Challengers usam sempre as últimas partidas de cada jogador de referência."}</p>
    </section>
  );
}

export function Habits({ ctx }) {
  const { prep, mine, chal, sm, sc, eMine, eChal, rMine, rChal } = useHabits(ctx);
  const [open, setOpen] = useState(null);
  // Ícones: as referências só trazem os campeões dos junglers; os seus dados completam os demais.
  const refMeta = useMemo(() => {
    if (!prep) return null;
    const a = prep.meta || {}, b = ctx.meta || {};
    const icons = {};
    for (const k of ["champion", "item", "rune", "spell"]) icons[k] = { ...(b.icons?.[k] || {}), ...(a.icons?.[k] || {}) };
    const merge = (k) => ({ ...(b[k] || {}), ...(a[k] || {}) });
    return { ...a, icons, champions: merge("champions"), items: merge("items"), runes: merge("runes"), runeStyles: merge("runeStyles"), spells: merge("spells"), runeStats: merge("runeStats") };
  }, [prep, ctx.meta]);
  const onOpen = (g, pl, rank) => setOpen({ g: { ...g, subject: ST.shortName(pl.riotId), subjectRank: rank, subjectRankLabel: rank ? RK.rankLabel(rank, { lp: true }) : "" }, pool: pl.games });
  if (!ctx.games.length) return <NoGames ctx={ctx} />;
  if (!prep || !chal.length) return <Empty title="Sem jogadores de referência">Rode o coletor com as referências (atualizar_tudo.bat) para comparar os seus hábitos com os dos Challengers.</Empty>;
  if (!mine.length) return <Empty title="Sem partidas de jungle com timeline neste filtro">Os hábitos usam a timeline da partida. Ajuste o período ou a fila.</Empty>;
  const checks = H.habitChecks(sm, sc);
  const objColors = [C.amber, "#a78bfa", C.blue, "#3a4a5e"];
  const gankColors = [C.blue, "#B57BF2", "#f472b6"];
  const campColors = ["#0ac8b9", "#e84057", "#86efac", "#a78bfa", "#f5c97a", "#94a3b8", "#60a5fa", "#f472b6"];
  const prioBox = sm.prioAhead && sc.prioAhead ? (
    <div className="hb-prio">
      <b>A lane do seu 1º gank aos 10 minutos:</b> à frente em <b>{pct(sm.prioAhead.share)}</b> das partidas. Você ganha <b className="good">{pct(sm.prioAhead.wrAhead)}</b> quando ela está à frente e <b className="bad">{pct(sm.prioAhead.wrBehind)}</b> quando está atrás. Challengers: à frente em {pct(sc.prioAhead.share)}.
    </div>
  ) : null;
  return (
    <div className="row-gap">
      <StudyGames ctx={ctx} prep={prep} onOpen={onOpen} />
      {open && <MatchDrawer ctx={ctx} game={open.g} pool={open.pool} meta={refMeta} onClose={() => setOpen(null)} />}
      <HabitsHero checks={checks} nMine={mine.length} nChal={chal.length} nPlayers={prep.players.length} />

      <Card title="Rota inicial" eyebrow="do nível 1 ao primeiro gank" tip="Cada campo da selva vale 4 de farm. A Riot registra o farm e a posição de minuto em minuto, então a contagem de campos e o lado do mapa são exatos por minuto; a ordem exata dos campos não aparece nos dados.">
        <div className="hb-tile sd-tile">
          <div className="hb-tile-head"><span>Início por lado do mapa</span><Tip text="O lado muda tudo: no lado azul, o Red fica no lado do bot da sua selva; no lado vermelho, fica no lado do topo. Primeiro campo: o campo mais perto de onde o jungler estava a 1:00. 1º abate em lane: primeiro abate ou assistência numa lane até os 10 minutos." /></div>
          <SidesHeader mine={mine} chal={chal} />
          <SidePanels mine={mine} chal={chal} blocks={[
            { title: "Primeiro campo", f: (p) => p.pathing?.startCamp?.key || null, keys: H.START_CAMP_KEYS, labels: (team) => campLabels(team), colors: campColors },
            { title: "Lado do 1º abate em lane", f: (p) => p.firstTd?.zone || null, keys: ["top", "mid", "bot"], labels: ZONE, colors: gankColors },
          ]} />
        </div>
        <div className="hb-grid three" style={{ marginTop: 12 }}>
          <StrategyDistTile mine={eMine} chal={eChal} />
          <StrategyBestTile mine={eMine} chal={eChal} />
          <VsTile title="Ritmo do início" tip="Campos pelo farm de selva naquele minuto. 1º gank: primeiro abate ou assistência numa lane. Aronguejo: os que você pegou no início da partida." rows={[
            { label: "Campos aos 3:00", me: dec(sm.camps3), ch: dec(sc.camps3) },
            { label: "Full clear (6 campos)", me: clock(sm.tCamps6), ch: clock(sc.tCamps6) },
            { label: "1ª ida a uma lane", me: clock(sm.firstActionT), ch: clock(sc.firstActionT) },
            { label: "1º abate em lane", me: clock(sm.firstGankT), ch: clock(sc.firstGankT) },
            { label: "Aronguejos no início", me: dec(sm.crab, 2), ch: dec(sc.crab, 2) },
            { label: "1º recall (min)", me: dec(sm.recall), ch: dec(sc.recall) },
            { label: "Ward no nível 1", me: sm.ward1 ? pct(sm.ward1.share) : "coletor 2.0", ch: sc.ward1 ? pct(sc.ward1.share) : "coletor 2.0" },
          ]} />
        </div>
        <div style={{ marginTop: 12 }}><OpeningTimeline sm={sm} sc={sc} /></div>
      </Card>

      <Card title="Ritmo por fase" eyebrow="o que acontece em cada janela do jogo, até os 30 minutos" tip="Média por partida em cada janela, só com as partidas que chegaram ao fim dela. Campos: farm de selva da janela dividido por 4 (inclui aronguejo). Tempo na selva inimiga: parte dos minutos em que você estava na selva do outro time.">
        <PhaseCards sm={sm} sc={sc} />
      </Card>

      <Card title="Prioridade de objetivos" tip="Primeiro objetivo épico do seu time até os 15 minutos, por lado do mapa, e a win rate de cada foco.">
        <div className="hb-tile sd-tile">
          <div className="hb-tile-head"><span>Primeiro objetivo do time, por lado</span></div>
          <ObjectiveAnswer chal={chal} />
          <SidePanels mine={mine} chal={chal} blocks={[
            { title: "Primeiro objetivo do time", f: (p) => p.firstObjective, keys: ["DRAGON", "HORDE", "RIFTHERALD", "nenhum"], labels: OBJ, colors: objColors },
          ]} />
        </div>
        <div className="hb-grid two" style={{ marginTop: 12 }}>
          {[100, 200].map((team) => {
            const m = H.habitSummary(mine.filter((p) => p.team === team)), c = H.habitSummary(chal.filter((p) => p.team === team));
            return <VsTile key={team} title={`Controle de objetivos · ${team === 100 ? "lado azul" : "lado vermelho"}`} rows={[
              { label: "Vastilarvas do seu time", me: pct(m.grubsShare), ch: pct(c.grubsShare) },
              { label: "Vastilarvas por partida", me: dec(m.grubsTeam, 2), ch: dec(c.grubsTeam, 2) },
              { label: "Dragões até os 20", me: pct(m.dragonsShare), ch: pct(c.dragonsShare) },
              { label: "Dragões por partida (até 20)", me: dec(m.dragons20, 2), ch: dec(c.dragons20, 2) },
            ]} />;
          })}
        </div>
      </Card>

      <Card title="Para onde ir primeiro, conforme as lanes" eyebrow="situações por classe dos campeões" tip="Cada campeão entra na classe e subclasse da wiki oficial do League of Legends. Para cada situação de topo e de suporte, para onde os Challengers e você deram o 1º gank e a win rate de cada escolha.">
        <SituationBoard mineRows={rMine} chalRows={rChal} prioBox={prioBox} />
      </Card>
    </div>
  );
}

// Card "Plano de jogo" (detalhe da partida): passos do início, rota dos dois junglers e a leitura da rota.
export function MatchPlan({ g, meta, ctx }) {
  const p = useMemo(() => H.habitProfile(g, meta), [g, meta]);
  const prep = useMemo(() => CH.prepareRefs(ctx.refs), [ctx.refs]);
  const chal = useMemo(() => (prep ? prep.players.flatMap((x) => x.games).filter((x) => x.hasTL && x.id !== g.id).map((x) => H.habitProfile(x, prep.meta)).filter(Boolean) : []), [prep, g.id]);
  const sc = useMemo(() => (chal.length ? H.habitSummary(chal) : null), [chal]);
  const rChal = useMemo(() => (prep ? prep.players.flatMap((x) => x.games).filter((x) => x.hasTL && x.id !== g.id).map((x) => SI.situationRow(x, prep.meta)).filter(Boolean) : []), [prep, g.id]);
  const ep = useMemo(() => EG.earlyProfile(g), [g]);
  const op = useMemo(() => EG.oppStrategy(g), [g]);
  const sit = useMemo(() => situationVerdictFor(SI.situationRow(g, meta), rChal), [g, meta, rChal]);
  const paths = useMemo(() => ST.junglerPaths(g), [g]);
  const reading = useMemo(() => ST.routeReading(g, meta), [g, meta]);
  const [focus, setFocus] = useState(null);
  if (!p) return null;
  const V = E.voiceOf(g);
  const oName = g.raw.opp ? E.champDisplay(meta, g.raw.opp.championName, g.raw.opp.championId) : "Jungler inimigo";

  const zone = { top: "topo", mid: "meio", bot: "bot" };
  const cmp = (a, b, lowerBetter) => (a == null || b == null || Math.abs(a - b) < 8 ? "even" : (lowerBetter ? a < b : a > b) ? "good" : "bad");
  const steps = [
    { k: V.ref ? `Estratégia do ${V.S}` : "Sua estratégia", v: ep ? EG.strategyLabel(EG.strategyKey(ep)) : "—", sub: p.pathing?.startCamp ? `começou no ${p.pathing.startCamp.name}` : null, wide: true, who: "me" },
    { k: `Estratégia do ${oName}`, v: op ? op.label : "—", sub: op?.startCamp ? `começou no ${op.startCamp.name}` : null, wide: true, opp: true, who: "opp" },
    { k: "Ward nível 1", v: p.ward1T != null ? clock(p.ward1T) : p.ward1 === false ? "nenhuma" : "—", sub: sc?.ward1T != null ? `Challengers ${clock(sc.ward1T)}` : null },
    { k: "Full clear", v: p.tCamps6 != null ? clock(p.tCamps6) : p.campsBefore != null ? `${Math.round(p.campsBefore)} campos` : "—", sub: sc?.tCamps6 != null ? `Challengers ${clock(sc.tCamps6)}` : null, tone: cmp(p.tCamps6, sc?.tCamps6, true) },
    { k: "1ª lane", v: p.firstAction ? `${clock(p.firstAction.t)} · ${zone[p.firstAction.zone]}` : "—", sub: p.firstAction ? { abate: "com abate", morte: "com morte", visita: "sem abate" }[p.firstAction.kind] : null },
    { k: "1º abate em lane", v: p.firstTd ? `${clock(p.firstTd.t)} · ${zone[p.firstTd.zone]}` : "até 10′: —", sub: p.gankFar != null ? (p.gankFar ? `longe do ${oName}` : `perto do ${oName}`) : null, tone: p.gankFar == null ? "" : p.gankFar ? "good" : "warn" },
    { k: "1º recall", v: p.recall != null ? clock(p.recall * 60) : "—", sub: sc?.recall != null ? `Challengers ${clock(sc.recall * 60)}` : null },
  ];
  const champs = p.lanes.champs;
  const lc = laneClasses(g, meta);
  const prio = p.prio;
  return (
    <div className="plan2">
      <div className="plan-steps">{steps.map((st, i) => (
        <React.Fragment key={st.k}>
          {i > 0 && <span className="arrow" aria-hidden="true">›</span>}
          {st.who ? (
            <button type="button" className={`plan-step pick ${st.opp ? "opp" : "me"} wide ${focus === st.who ? "on" : ""} ${focus && focus !== st.who ? "off" : ""}`} aria-pressed={focus === st.who}
              onClick={() => setFocus(focus === st.who ? null : st.who)} title="Clique para ver só a rota dele no mapa">
              <span className="k">{st.k}</span><b>{st.v}</b>{st.sub && <span className="s">{st.sub}</span>}<span className="pick-hint">{focus === st.who ? "mostrando só ele · clique para ver os dois" : "ver só a rota dele no mapa"}</span>
            </button>
          ) : <div className={`plan-step ${st.tone || ""} ${st.opp ? "opp" : ""} ${st.wide ? "wide" : ""}`}><span className="k">{st.k}</span><b>{st.v}</b>{st.sub && <span className="s">{st.sub}</span>}</div>}
        </React.Fragment>
      ))}</div>
      <div className="plan2-grid">
        <div className="plan2-map">
          <div className="eyebrow" style={{ marginBottom: 6 }}>{focus ? `Rota do ${focus === "me" ? (V.ref ? V.S : "seu jungler") : oName}` : "Rota dos dois junglers"} · 0 a 6 min</div>
          <ST_Paths g={g} meta={meta} paths={paths} V={V} oName={oName} focus={focus} onFocus={setFocus} />
        </div>
        <div className="plan2-side">
          <div className="eyebrow" style={{ marginBottom: 6 }}>Leitura da rota</div>
          <ul className="plan-read">{reading.map((r, i) => <li key={i} className={r.kind}><span className="tag">{r.kind === "dado" ? "dado" : "leitura"}</span><span>{r.text}</span></li>)}</ul>
          <div className="eyebrow" style={{ margin: "12px 0 6px" }}>Lanes da partida</div>
          <div className="plan-mus">{["TOP", "MIDDLE", "BOTTOM", "UTILITY"].map((pos) => (
            <div key={pos} className={`plan-mu ${prio && { top: "TOP", mid: "MIDDLE", bot: "BOTTOM" }[prio.zone] === pos ? "prio" : ""}`}>
              <span className="pos">{{ TOP: "Topo", MIDDLE: "Meio", BOTTOM: "Atirador", UTILITY: "Suporte" }[pos]}</span><span className="a">{champs[pos][0]}{lc[pos][0] && <small>{lc[pos][0].label}</small>}</span><span className="x">×</span><span className="b">{champs[pos][1]}{lc[pos][1] && <small>{lc[pos][1].label}</small>}</span>
            </div>
          ))}</div>
          {prio && <div className="plan-prio2"><span className="k">Lane do 1º gank aos 10 min</span><b>{zone[prio.zone]}</b>{prio.goldDiff != null && <span>ouro <b className={prio.goldDiff >= 0 ? "good" : "bad"}>{fmt.signed(prio.goldDiff)}</b></span>}<span>mortes <b>{prio.allyDeaths} × {prio.foeDeaths}</b></span></div>}
          {sit && sit.row && (sit.row.top[0] || sit.row.sup[0]) && <>
            <div className="eyebrow" style={{ margin: "12px 0 6px" }}>Nessa situação, os Challengers vão primeiro para</div>
            <div className="plan-sit">
              <span className="k">Topo {sit.row.top[0] ? subLabel(sit.row.top[0]) : "?"} × {sit.row.top[1] ? subLabel(sit.row.top[1]) : "?"} · suporte {sit.row.sup[0] ? subLabel(sit.row.sup[0]) : "?"} × {sit.row.sup[1] ? subLabel(sit.row.sup[1]) : "?"}</span>
              {sit.exact.n >= 20 ? <><SideBar sp={sit.exact} who="Challengers" tone="ch" /><p className="sit-verdict">{verdict(sit.exact)}</p></> : <>
                <span className="k2">Só o topo</span><SideBar sp={sit.top} who="Challengers" tone="ch" />
                <span className="k2">Só o bot</span><SideBar sp={sit.sup} who="Challengers" tone="ch" />
                <p className="sit-verdict">{verdict(sit.top) || verdict(sit.sup) || <span className="dim">Pouca amostra dos Challengers nessa situação.</span>}</p>
              </>}
            </div>
          </>}
        </div>
      </div>
    </div>
  );
}

function ST_Paths({ g, meta, paths, V, oName, focus, onFocus }) {
  if (!paths || !paths.me.length) return <p className="muted">Sem posições na timeline desta partida.</p>;
  return <PathsMap paths={paths} meta={meta} meName={V.ref ? V.S : "Você"} oppName={oName} focus={focus} onFocus={onFocus}
    meChamp={{ id: g.champId, key: g.champ }} oppChamp={g.raw.opp ? { id: g.raw.opp.championId, key: g.raw.opp.championName } : null} />;
}
