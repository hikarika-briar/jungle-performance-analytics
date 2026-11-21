// Aba "Rumo ao Challenger": o seu jogo comparado com jogadores de referência.
import * as E from "./engine.js";
import { STATIC } from "./static_store.js";
import * as CH from "./challenger.js";
import { fmt, C, Card, Tip, Empty, Table, ChampIcon, ChartTip, axisProps, gridProps, Versus } from "./ui.jsx";

import { ChallengerHero } from "./views_challenger_hero.jsx";
import { ChallengerPanels } from "./views_challenger_panels.jsx";
import { HighlightGames } from "./views_highlights.jsx";
import { L, setVariant } from "./chal_variant.js";
const React = window.React;
const { useState, useMemo, useRef } = React;
const R = window.Recharts;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

const SIGNED = new Set(["gold10", "xp10", "gold15", "team15"]);
export function fmtV(v, m) {
  if (!isNum(v)) return "—";
  if (m.fmt === "pct") return fmt.pct(v);
  if (m.fmt === "int") return SIGNED.has(m.key) ? fmt.signed(v) : fmt.int(v);
  const s = fmt.dec(v, m.fmt === "dec2" ? 2 : 1);
  return m.unit ? `${s} ${m.unit}` : s;
}
const STATUS = {
  nivel: ["No nível", "good"], faixa: ["Dentro da faixa", "mid"], abaixo: ["Abaixo de todos", "bad"], estilo: ["Estilo", "neutral"],
};
function PosChip({ pos }) {
  if (!pos) return <span className="dim">—</span>;
  const [label, tone] = STATUS[pos.status] || ["—", "neutral"];
  const title = pos.beats != null ? `Melhor que ${pos.beats} de ${pos.of} jogadores de referência` : "Métrica de estilo: não existe melhor ou pior";
  return <span className={`pos ${tone}`} title={title}>{label}{pos.beats != null && <small> · {pos.beats}/{pos.of}</small>}</span>;
}

async function readJsonFile(f) {
  let text;
  if (/\.gz$/i.test(f.name) && typeof DecompressionStream !== "undefined") {
    text = await new Response(f.stream().pipeThrough(new DecompressionStream("gzip"))).text();
  } else text = await f.text();
  try { return JSON.parse(text); } catch { throw new Error("O arquivo não é um JSON válido. Use o referencias_challenger.json da pasta saida do coletor."); }
}

// ---------------------------------------------------------------------------
export function Challenger({ ctx, variant = "challenger" }) {
  const V = setVariant(variant);
  const briar = variant === "briar";
  const { meta } = ctx;
  const refs = briar ? ctx.briarRefs : ctx.refs;
  // Mono Briar: compara só as suas partidas de Briar
  const games = useMemo(() => (briar ? ctx.games.filter((g) => g.champ === "Briar") : ctx.games), [briar, ctx.games]);
  const prep = useMemo(() => CH.prepareRefs(refs), [refs]);
  const vmeta = useMemo(() => (prep ? E.mergeMeta(prep.meta, meta) : meta), [prep, meta]);
  const [champF, setChampF] = useState("all");
  const [who, setWho] = useState("all");
  const opp = useMemo(() => CH.opponentGames(games, meta), [games, meta]);
  const refPlayers = useMemo(() => CH.filterRefGames(prep, champF, vmeta), [prep, champF, vmeta]);
  const cmpAll = useMemo(() => CH.compare(games, refPlayers, opp), [games, refPlayers, opp]);
  const cmp = useMemo(() => {
    if (who === "all" || !cmpAll.players.some((p) => p.id === who)) return cmpAll;
    return CH.compare(games, refPlayers.filter((p) => p.id === who), opp);
  }, [who, cmpAll, games, refPlayers, opp]);
  const champOpts = useMemo(() => CH.refChampionOptions(prep), [prep]);

  if (!games.length) return <Empty title={briar ? "Nenhuma partida sua de Briar no filtro atual" : "Nenhuma partida sua no filtro atual"}>Ajuste os filtros no topo para comparar o seu jogo com o das referências.</Empty>;
  if (!prep || !prep.players.length) {
    return (
      <div className="row-gap">
        {STATIC || briar ? <Empty title="Referências ainda não publicadas">As partidas dos {L().refsWord} ainda não foram enviadas para este site.{L().key === "briar" ? " Rode o coletor 2.3 (atualizar_tudo.bat ou atualizar_briar.bat) para trazer os mono Briar." : ""}</Empty> : <RefsSetup ctx={ctx} />}
        <EloPreview cmp={cmpAll} n={games.length} />
      </div>
    );
  }
  const selName = who === "all" ? null : cmpAll.players.find((p) => p.id === who)?.riotId;
  const dropped = refPlayers.filter((p) => p.games.length < CH.MIN_GAMES_PER_PLAYER).length;
  const controls = (
    <div className="chal-controls">
      {!briar && <label className="field"><span>Campeões das referências</span>
        <select id="ch-champ" value={champF} onChange={(e) => setChampF(e.target.value)}>
          <option value="all">Todos</option>
          <option value="noLee">Todos, menos Lee Sin</option>
          <option value="fighter">Lutadores e assassinos (perfil da Briar)</option>
          {champOpts.map(([c, n]) => <option key={c} value={c}>{E.champDisplay(vmeta, c)} ({n})</option>)}
        </select>
      </label>}
      <label className="field"><span>Comparar com</span>
        <select id="ch-who" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="all">Todos os jogadores de referência</option>
          {cmpAll.players.map((p) => <option key={p.id} value={p.id}>{p.riotId} ({p.games.length})</option>)}
        </select>
      </label>
    </div>
  );
  const info = <>Você: {games.length} partidas · {selName || `${cmp.players.length} ${L().many}`}: {cmp.nRefGames} partidas{prep.generatedAt ? ` (coletadas em ${fmt.date(prep.generatedAt)})` : ""}{dropped > 0 ? ` · ${dropped} com menos de ${CH.MIN_GAMES_PER_PLAYER} partidas ficaram de fora` : ""} <Tip text="A linha de base do seu elo são os junglers que você enfrentou nessas mesmas partidas. As referências jogam em outro elo e com outros campeões: use como direção, não como meta exata." /></>;
  return (
    <div className={`row-gap ${V.theme}`}>
      {cmp.players.length === 0 ? <>
        <ChallengerHero ctx={ctx} cmp={cmpAll} cmpAll={cmpAll} controls={controls} info={info} refs={refs} />
        <Empty title="Nenhum jogador de referência com partidas suficientes nesse filtro">Escolha "Todos" em campeões das referências.</Empty>
      </> : <>
        <ChallengerHero ctx={ctx} cmp={cmp} cmpAll={cmpAll} controls={controls} info={info} refs={refs} />
        <ChallengerPanels ctx={briar ? { ...ctx, games, pool: ctx.pool.filter((g) => g.champ === "Briar") } : ctx} cmp={cmp} cmpAll={cmpAll} meta={vmeta}
          highlights={<HighlightGames ctx={ctx} players={cmp.players} refs={refs} meta={vmeta} single={who !== "all" && cmp.players.length === 1} i={2} />} />
        <VersusCard cmp={cmp} selName={selName} />
        <GapCoach cmp={cmp} meta={vmeta} />
        <StripCard cmp={cmp} meta={vmeta} />
        <div className="grid">
          <CurveCard span={6} cmp={cmp} field="gold" title="Ouro contra o jungler inimigo, minuto a minuto" tip="Média do seu ouro menos o do jungler inimigo. Para as referências, o inimigo é o jungler do elo delas." signed />
          <CurveCard span={6} cmp={cmp} field="cs" title="Farm acumulado, minuto a minuto" tip="Média de tropas + monstros até cada minuto, nas partidas que ainda estavam em andamento." />
        </div>
        <div className="grid">
          <TimingCard span={6} cmp={cmp} field="takedowns" title="Quando você participa dos abates" tip="Abates + assistências por partida em cada faixa de 2 minutos (só conta partidas que ainda estavam em andamento)." />
          <TimingCard span={6} cmp={cmp} field="deaths" title="Quando você morre" tip="Mortes por partida em cada faixa de 2 minutos (só conta partidas que ainda estavam em andamento)." />
        </div>
        <BehaviorCard cmp={cmp} meta={vmeta} />
        <StyleCard cmp={cmpAll} meta={vmeta} />
      </>}
      {!STATIC && <RefsSetup ctx={ctx} prep={prep} compact />}
    </div>
  );
}

// ---------------------------------------------------------------------------
function Kpis({ cmp, cmpAll }) {
  const nearest = cmpAll.similar[0];
  const scored = [...cmp.gaps, ...cmp.strengths];
  const atLevel = scored.filter((r) => r.pos.status === "nivel").length;
  const below = scored.filter((r) => r.pos.status === "abaixo").length;
  return (
    <div className="kpis">
      <div className="kpi"><div className="label">{L().level} <Tip text="Métricas em que você está igual ou melhor que a média dos jogadores de referência." /></div><div className="value">{atLevel}<small>de {scored.length}</small></div><div className="cmp">pontos que dependem de você</div></div>
      <div className="kpi"><div className="label">Abaixo de todos <Tip text="Métricas em que você fica atrás de todos os jogadores de referência." /></div><div className="value">{below}</div><div className="cmp">onde está a maior distância</div></div>
      <div className="kpi"><div className="label">Estilo mais parecido <Tip text="Jogador de referência cujo perfil (agressividade no início, ganks, invasão, farm, objetivos, visão, mortes, participação e dano) mais se parece com o seu." /></div><div className="value" style={{ fontSize: "1.15rem", overflowWrap: "anywhere" }}>{nearest ? nearest.label : "—"}</div><div className="cmp">{cmpAll.similar[1] ? `depois: ${cmpAll.similar[1].label}` : ""}</div></div>
      <div className="kpi"><div className="label">Amostra</div><div className="value">{cmp.nRefGames}<small>partidas</small></div><div className="cmp">{cmp.players.length} jogador(es) · você: {cmp.me.n}</div></div>
    </div>
  );
}

const VS_KEYS = ["gold10", "gold15", "earlyGanks", "td10", "jcs10", "csMin", "farm1525", "goldMin", "kp", "objPart", "scuttle", "deaths15", "deaths", "picks", "redeaths", "afterBehind", "lossSignals"];
function VersusCard({ cmp, selName }) {
  const all = [...cmp.rows, ...cmp.behavior];
  const rows = VS_KEYS.map((k) => all.find((r) => r.key === k)).filter((r) => r && isNum(r.me) && isNum(r.band.center)).map((r) => ({
    key: r.key, label: r.label, tip: r.tip, a: r.me, b: r.band.center, fmt: r.fmt, better: r.better,
    mode: SIGNED.has(r.key) ? "abs" : undefined, scale: 600, render: (v) => fmtV(v, r),
  }));
  return (
    <Card title="Frente a frente" eyebrow={selName ? `você × ${selName}` : `você × média dos ${L().refsWord}`}
      tip="A barra cresce para o lado que vai melhor e o tamanho mostra o quanto. Aqui não há teste de acaso: o outro lado é a média dos jogadores, então use como direção.">
      <Versus a={{ name: "Você", short: "Você", tone: "emerald", sub: `${cmp.me.n} partidas` }}
        b={{ name: selName || L().Many, short: selName ? selName.split("#")[0] : L().Many, tone: "teal", sub: selName ? `${cmp.nRefGames} partidas` : `média de ${cmp.players.length} jogadores` }} rows={rows} />
    </Card>
  );
}

function posText(r) {
  const p = r.pos;
  if (!p) return "";
  if (p.of === 1) return p.status === "nivel" ? "Você está no nível desse jogador." : "Você fica atrás desse jogador.";
  if (p.status === "abaixo") return `Você fica atrás dos ${p.of} jogadores de referência.`;
  if (p.status === "faixa") return `Você fica abaixo da média, à frente de ${p.beats} de ${p.of}.`;
  return `Você está à frente de ${p.beats} de ${p.of} jogadores de referência.`;
}
function eloText(r) {
  if (!isNum(r.elo) || !r.band.n || !isNum(r.me)) return null;
  const ep = CH.positionOf(r.elo, r.band, r.better);
  if (!ep) return null;
  const eloBetter = r.better === "lower" ? r.elo < r.me : r.elo > r.me;
  if (ep.status === "abaixo" && !eloBetter) return `Os junglers que você enfrenta também ficam longe aqui, então é algo que costuma separar o seu elo ${L().gapTo}.`;
  if (eloBetter) return `Os junglers que você enfrenta já fazem isso melhor (${fmtV(r.elo, r)}), então é um ponto mais seu do que do seu elo.`;
  return null;
}

function mainText(r, champName) {
  if (!isNum(r.main) || r.mainN < 5 || !isNum(r.me)) return null;
  const mainNoBetter = r.better === "lower" ? r.main >= r.me : r.main <= r.me;
  if (!mainNoBetter) return null;
  return `Nas partidas de ${champName} das referências o número fica em ${fmtV(r.main, r)}, igual ou pior que o seu: pode ter mais a ver com o campeão do que com você (amostra pequena).`;
}

function GapCoach({ cmp, meta }) {
  const focus = cmp.focus.slice(0, 3);
  return (
    <Card title={`${L().coach}: onde focar`} eyebrow={`${focus.length} focos · ${cmp.gaps.length} lacunas · ${cmp.strengths.length} pontos no nível`}
      tip="Entram só métricas que dependem principalmente de você e com pelo menos 10 partidas suas. Ficam de fora as que dependem do time (ouro do time, dragões) e as que dependem muito do campeão (visão). Lacunas do mesmo tema viram um foco só; a ordem vem da distância para a média das referências.">
      {focus.length ? <div className="row-gap" style={{ gap: 10 }}>{focus.map((f, i) => <GapItem key={f.theme} f={f} i={i} cmp={cmp} meta={meta} />)}</div>
        : <p className="muted">Nenhuma lacuna clara: nas métricas que dependem de você, está no nível das referências.</p>}
      {cmp.strengths.length > 0 && <>
        <div className="eyebrow good" style={{ margin: "16px 0 8px" }}>Onde você já está {L().levelOf}</div>
        <div className="chips">{cmp.strengths.map((r) => <span key={r.key} className="chip static" title={`${posText(r)} Você: ${fmtV(r.me, r)} · média ${L().one}: ${fmtV(r.band.center, r)}`}>{r.label} <span className="dim">· {fmtV(r.me, r)}</span></span>)}</div>
      </>}
    </Card>
  );
}

function GapItem({ f, i, cmp, meta }) {
  const r = f.lead;
  const ex = useMemo(() => CH.exampleGames(cmp.players, r.key, 3), [cmp, r.key]);
  const elo = eloText(r);
  const main = cmp.main;
  return (
    <article className="diag">
      <div className="diag-head"><span className={`prio ${i === 0 ? "alta" : "media"}`}>FOCO {i + 1}</span><h3>{f.label}: {r.label.charAt(0).toLowerCase() + r.label.slice(1)}</h3></div>
      <dl>
        <dt>Você</dt><dd><b>{fmtV(r.me, r)}</b> <span className="dim">({r.meX != null ? `${r.meX} de ${r.meN}` : `${r.meN} partidas`})</span></dd>
        <dt>{L().Many}</dt><dd>média <b>{fmtV(r.band.center, r)}</b>{r.band.n > 1 && <span className="dim"> · do pior ao melhor: {fmtV(r.better === "lower" ? r.band.max : r.band.min, r)} a {fmtV(r.better === "lower" ? r.band.min : r.band.max, r)}</span>}</dd>
        {main && isNum(r.main) && <><dt>{L().Many} de {E.champDisplay(meta, main.champ, main.champId)}</dt><dd>{fmtV(r.main, r)} <span className="dim">({r.mainN} partidas de {main.players.join(", ")})</span></dd></>}
        {isNum(r.elo) && <><dt>Seu elo</dt><dd>{fmtV(r.elo, r)} <span className="dim">(junglers que você enfrentou)</span></dd></>}
        <dt>Leitura</dt><dd>{posText(r)}{elo && <> {elo}</>}{main && mainText(r, E.champDisplay(meta, main.champ, main.champId)) && <> {mainText(r, E.champDisplay(meta, main.champ, main.champId))}</>}</dd>
        {f.related.length > 0 && <><dt>No mesmo tema</dt><dd><div className="ch-rel">{f.related.map((x) => <span key={x.key}>{x.label}: <b>{fmtV(x.me, x)}</b> <span className="dim">· média {fmtV(x.band.center, x)}</span></span>)}</div></dd></>}
        {r.look && <><dt>O que observar</dt><dd>Nos replays deles, vale observar {r.look}.</dd></>}
        {ex.length > 0 && <><dt>Para assistir</dt><dd><ExampleList ex={ex} r={r} meta={meta} /></dd></>}
      </dl>
    </article>
  );
}

function ExampleList({ ex, r, meta }) {
  return (
    <div className="ch-ex">
      {ex.map((x) => {
        const url = CH.opggUrl(x.player.riotId);
        return (
          <div key={x.g.id} className="ch-ex-row">
            <ChampIcon meta={meta} id={x.g.champId} keyName={x.g.champ} size={22} />
            <span className="namecell"><span>
              {url ? <a href={url} target="_blank" rel="noopener noreferrer">{x.player.riotId}</a> : x.player.riotId}
              {" · "}{E.champDisplay(meta, x.g.champ, x.g.champId)} vs {E.champDisplay(meta, x.g.oppChamp, x.g.oppChampId)}
            </span></span>
            <span className="dim num">{fmt.dateShort(x.g.start)} {fmt.time(x.g.start)} · {x.g.win ? "vitória" : "derrota"} · {r.short}: {fmtV(x.v, r)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
function StripCard({ cmp, meta }) {
  const [group, setGroup] = useState("all");
  const names = Object.fromEntries(cmp.players.map((p) => [p.id, p.riotId]));
  const rows = cmp.rows.filter((r) => (group === "all" || r.group === group) && (isNum(r.me) || r.band.n));
  return (
    <Card title={`Onde você está entre os ${L().many}`} eyebrow="cada ponto cinza é um jogador de referência · direita = melhor"
      tip="Faixa clara: metade do meio das referências (do 1º ao 3º quartil). Losango dourado: você. Traço azul: junglers que você enfrenta. Nas métricas de estilo o eixo não tem melhor ou pior.">
      <div className="subtabs" role="tablist" style={{ marginBottom: 10 }}>
        <button role="tab" aria-selected={group === "all"} onClick={() => setGroup("all")}>Tudo</button>
        {CH.GROUPS.map(([id, label]) => <button key={id} role="tab" aria-selected={group === id} onClick={() => setGroup(id)}>{label}</button>)}
      </div>
      <div className="legend" style={{ marginBottom: 8 }}>
        <span><i style={{ background: C.gold, borderRadius: 1, transform: "rotate(45deg)" }} />Você</span>
        <span><i style={{ background: C.fg3 }} />Jogador de referência</span>
        <span><i style={{ background: C.blue, borderRadius: 1, width: 3 }} />Junglers que você enfrenta</span>
        {cmp.main && <span><i style={{ background: "#c084fc" }} />{L().Many} de {E.champDisplay(meta, cmp.main.champ, cmp.main.champId)} ({cmp.main.n} partidas)</span>}
      </div>
      <div className="ch-rows">
        {rows.map((r) => <StripRow key={r.key} r={r} names={names} mainLabel={cmp.main ? `${L().Many} de ${E.champDisplay(meta, cmp.main.champ, cmp.main.champId)}` : ""} />)}
      </div>
    </Card>
  );
}

function StripRow({ r, names, mainLabel }) {
  const vals = r.band.values || [];
  const showMain = isNum(r.main) && r.mainN >= 5;
  const pts = [...vals.map((x) => x.v), r.me, r.elo, showMain ? r.main : null].filter(isNum);
  if (!pts.length) return null;
  let lo = Math.min(...pts), hi = Math.max(...pts);
  const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.1 || 1;
  lo -= pad; hi += pad;
  const flip = r.better === "lower";
  const x = (v) => { const p = ((v - lo) / (hi - lo)) * 100; return `${flip ? 100 - p : p}%`; };
  const q = isNum(r.band.p25) && isNum(r.band.p75) && r.band.n >= 4 ? [r.band.p25, r.band.p75].map((v) => parseFloat(x(v))).sort((a, b) => a - b) : null;
  return (
    <div className="ch-row">
      <div className="ch-label">{r.label}{r.partial && <span className="dim"> (depende do time)</span>}{r.champDep && <span className="dim"> (depende do campeão)</span>} <Tip text={r.tip} /></div>
      <div className="ch-track">
        {q && <span className="ch-iqr" style={{ left: `${q[0]}%`, width: `${Math.max(0.5, q[1] - q[0])}%` }} />}
        {vals.map((p) => <span key={p.id} className="ch-dot" style={{ left: x(p.v) }} title={`${names[p.id] || "Referência"}: ${fmtV(p.v, r)}`} />)}
        {isNum(r.elo) && <span className="ch-elo" style={{ left: x(r.elo) }} title={`Junglers que você enfrenta: ${fmtV(r.elo, r)}`} />}
        {showMain && <span className="ch-main" style={{ left: x(r.main) }} title={`${mainLabel}: ${fmtV(r.main, r)} (${r.mainN} partidas)`} />}
        {isNum(r.me) && <span className="ch-me" style={{ left: x(r.me) }} title={`Você: ${fmtV(r.me, r)}`} />}
      </div>
      <div className="ch-vals num"><b>{fmtV(r.me, r)}</b><span>média {fmtV(r.band.center, r)}</span></div>
      <div className="ch-status">{r.partial ? <span className="pos neutral" title="Depende do time inteiro, não só de você">Time</span>
        : r.champDep ? <span className="pos neutral" title={`Depende muito do campeão: não entra no ${L().coach}`}>Campeão</span>
        : <PosChip pos={r.meN >= 10 ? r.pos : null} />}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function CurveCard({ cmp, field, title, tip, span, signed }) {
  const data = cmp.curves.me.map((row, i) => ({
    m: row.m, me: row[field], refs: cmp.curves.refs[i]?.[field] ?? null, elo: cmp.curves.elo?.[i]?.[field] ?? null, n: row.n, nRef: cmp.curves.refs[i]?.n ?? 0,
  }));
  const f = signed ? fmt.signed : fmt.int;
  return (
    <Card span={span} title={title} tip={tip}>
      <div className="chart">
        <R.ResponsiveContainer>
          <R.LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
            <R.CartesianGrid {...gridProps} />
            <R.XAxis dataKey="m" {...axisProps} tickFormatter={(v) => `${v}′`} />
            <R.YAxis {...axisProps} tickFormatter={(v) => f(v)} />
            {signed && <R.ReferenceLine y={0} stroke={C.line2} />}
            <R.Tooltip content={<ChartTip render={(pl) => { const p = pl[0].payload; return <><div>Minuto {p.m}</div><div style={{ color: C.gold }}>Você: {f(p.me)}</div><div style={{ color: C.blue }}>{L().Many}: {f(p.refs)}</div>{isNum(p.elo) && <div className="muted">Seu elo: {f(p.elo)}</div>}</>; }} />} />
            <R.Line dataKey="elo" name="Seu elo" stroke={C.fg3} strokeDasharray="4 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <R.Line dataKey="refs" name={L().Many} stroke={C.blue} strokeWidth={2} dot={false} isAnimationActive={false} />
            <R.Line dataKey="me" name="Você" stroke={C.gold} strokeWidth={2.5} dot={false} isAnimationActive={false} />
          </R.LineChart>
        </R.ResponsiveContainer>
      </div>
      <div className="legend"><span><i style={{ background: C.gold }} />Você</span><span><i style={{ background: C.blue }} />{L().Many}</span>{data.some((d) => isNum(d.elo)) && <span><i style={{ background: C.fg3 }} />Junglers que você enfrenta (tracejado)</span>}</div>
    </Card>
  );
}

function TimingCard({ cmp, field, title, tip, span }) {
  const data = cmp.timing.me.map((row, i) => ({ label: row.label, me: row[field], refs: cmp.timing.refs[i]?.[field] ?? null, n: row.n, nRef: cmp.timing.refs[i]?.n ?? 0 }));
  return (
    <Card span={span} title={title} tip={tip}>
      <div className="chart">
        <R.ResponsiveContainer>
          <R.BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -14 }} barGap={1} barCategoryGap="22%">
            <R.CartesianGrid {...gridProps} />
            <R.XAxis dataKey="label" {...axisProps} interval={1} tickFormatter={(v) => `${v}′`} />
            <R.YAxis {...axisProps} tickFormatter={(v) => fmt.dec(v, 1)} />
            <R.Tooltip cursor={{ fill: "#ffffff08" }} content={<ChartTip render={(pl) => { const p = pl[0].payload; return <><div>Minutos {p.label}</div><div style={{ color: C.gold }}>Você: {fmt.dec(p.me, 2)} por partida ({p.n})</div><div style={{ color: C.blue }}>{L().Many}: {fmt.dec(p.refs, 2)} ({p.nRef})</div></>; }} />} />
            <R.Bar dataKey="me" name="Você" fill={C.gold} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <R.Bar dataKey="refs" name={L().Many} fill={C.blue} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </R.BarChart>
        </R.ResponsiveContainer>
      </div>
      <div className="legend"><span><i style={{ background: C.gold }} />Você</span><span><i style={{ background: C.blue }} />{L().Many}</span></div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
function BehaviorCard({ cmp, meta }) {
  const f = (v, m) => (m.fmt === "pct" ? fmt.pct(v) : fmt.dec(v, m.fmt === "dec2" ? 2 : 1));
  return (
    <Card title="Jogo à frente e jogo atrás" eyebrow="o lado mental, em comportamento"
      tip="Mesma régua da Revisão de derrotas, aplicada às referências e aos junglers que você enfrenta. Taxas de jogadores com menos de 5 partidas na situação ficam de fora da média. Viradas e vitórias à frente não têm coluna do elo porque seriam o espelho das suas.">
      <Table rowKey={(r) => r.key} rows={cmp.behavior} columns={[
        { key: "label", label: "Situação", sortable: false, render: (r) => <span>{r.label} <Tip text={r.tip} /></span> },
        { key: "me", label: "Você", num: true, sortable: false, render: (r) => <span><b>{f(r.me, r)}</b> <span className="dim">({r.meX != null ? `${r.meX} de ${r.meN}` : r.meN})</span></span> },
        { key: "ref", label: L().Many, num: true, sortable: false, render: (r) => <span>{f(r.band.center, r)}{r.band.n > 1 && <span className="dim"> ({f(r.better === "lower" ? r.band.max : r.band.min, r)} a {f(r.better === "lower" ? r.band.min : r.band.max, r)})</span>}</span> },
        ...(cmp.main ? [{ key: "main", label: `${L().Many} de ${E.champDisplay(meta, cmp.main.champ, cmp.main.champId)}`, num: true, sortable: false, render: (r) => (r.mainN >= 5 ? <span>{f(r.main, r)} <span className="dim">({r.mainN})</span></span> : <span className="dim" title="Menos de 5 partidas nessa situação">—</span>) }] : []),
        { key: "elo", label: "Seu elo", num: true, sortable: false, render: (r) => f(r.elo, r) },
        { key: "pos", label: "", sortable: false, render: (r) => <PosChip pos={r.pos} /> },
      ]} />
      <p className="note">"Do pior ao melhor" entre parênteses. Quando a sua amostra numa situação é pequena (menos de 5 partidas), a comparação não recebe selo.</p>
    </Card>
  );
}

function StyleCard({ cmp, meta }) {
  const byId = Object.fromEntries(cmp.players.map((p) => [p.id, p]));
  const rank = new Map(cmp.similar.map((e, i) => [e.id, i + 1]));
  const rows = cmp.style.map((e) => {
    const p = byId[e.id];
    const games = e.isMe ? null : p?.games || [];
    return { ...e, n: e.stats.n, wr: e.stats.wr.rate, kda: e.stats.kda?.value, champs: games ? CH.topChamps(games) : null, rank: rank.get(e.id) ?? null };
  });
  return (
    <Card title="Estilo de jogo" eyebrow="perfil de cada jogador comparado ao grupo"
      tip="As marcas aparecem quando o jogador está bem acima do grupo de referência naquele traço (agressividade até 10 min, ganks com abate, invasão, farm, objetivos, visão, poucas mortes, participação e dano). A semelhança compara o seu perfil com o de cada um.">
      <Table rowKey={(r) => r.id} rows={rows} rowClass={(r) => (r.isMe ? "ch-me-row" : "")} initialSort={{ key: "rank", dir: "asc" }} columns={[
        { key: "label", label: "Jogador", sortValue: (r) => (r.isMe ? "" : r.label.toLowerCase()), render: (r) => { const url = r.isMe ? null : CH.opggUrl(r.label); return r.isMe ? <b>Você</b> : url ? <a href={url} target="_blank" rel="noopener noreferrer">{r.label}</a> : r.label; } },
        { key: "rank", label: "Parecido com você", num: true, sortValue: (r) => (r.isMe ? -1 : r.rank ?? 99), render: (r) => (r.isMe ? "—" : r.rank ? `${r.rank}º` : "—") },
        { key: "n", label: "Partidas", num: true },
        { key: "champs", label: "Campeões", sortable: false, render: (r) => (r.champs ? <span className="iconrow">{r.champs.map((c) => <span key={c.champ} title={`${E.champDisplay(meta, c.champ, c.champId)}: ${c.n} partidas`}><ChampIcon meta={meta} id={c.champId} keyName={c.champ} size={22} /></span>)}</span> : <span className="dim">filtro atual</span>) },
        { key: "wr", label: "Win rate", num: true, render: (r) => fmt.pct(r.wr) },
        { key: "kda", label: "KDA", num: true, render: (r) => fmt.dec(r.kda, 2) },
        { key: "tags", label: "Estilo", sortable: false, render: (r) => (r.tags.length ? <span className="chips">{r.tags.map((t) => <span key={t} className="chip static ch-tag">{t}</span>)}</span> : <span className="dim">equilibrado</span>) },
      ]} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
function EloPreview({ cmp, n }) {
  const rows = cmp.rows.filter((r) => r.better !== "neutral" && isNum(r.me) && isNum(r.elo));
  const diff = (r) => r.me - r.elo;
  return (
    <Card title="Enquanto isso: você contra os junglers que você enfrenta" eyebrow={`as suas ${n} partidas do filtro atual, vistas dos dois lados`}
      tip={`Mesmas métricas da comparação com ${L().many}, calculadas para o jungler inimigo de cada partida sua. Ficam de fora as que seriam só o espelho do seu resultado (ouro contra o jungler, ouro do time e dragões).`}>
      <Table rowKey={(r) => r.key} rows={rows} initialSort={{ key: "group", dir: "asc" }} columns={[
        { key: "group", label: "Área", sortValue: (r) => CH.GROUPS.findIndex((g) => g[0] === r.group), render: (r) => <span className="dim">{CH.GROUPS.find((g) => g[0] === r.group)?.[1]}</span> },
        { key: "label", label: "Métrica", render: (r) => <span>{r.label} <Tip text={r.tip} /></span> },
        { key: "me", label: "Você", num: true, render: (r) => <b>{fmtV(r.me, r)}</b> },
        { key: "elo", label: "Junglers que você enfrenta", num: true, render: (r) => fmtV(r.elo, r) },
        { key: "diff", label: "Diferença", num: true, sortValue: (r) => (r.better === "lower" ? -diff(r) : diff(r)), render: (r) => {
          const d = diff(r); const good = r.better === "lower" ? d < 0 : d > 0;
          const txt = r.fmt === "pct" ? fmt.pp(d) : r.fmt === "int" ? fmt.signed(d) : fmt.signed(d, r.fmt === "dec2" ? 2 : 1);
          return <span className={/^[+−]?0(,0+)?( p\.p\.)?$/.test(txt) ? "dim" : good ? "good" : "bad"}>{txt}</span>; } },
      ]} />
    </Card>
  );
}

function RefsSetup({ ctx, prep, compact }) {
  const { importRefs, clearRefs, toast } = ctx;
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const fileRef = useRef(null);
  const handle = async (files) => {
    const f = files && files[0];
    if (!f) return;
    setBusy(true); setError("");
    try {
      const raw = await readJsonFile(f);
      if (!CH.isRefsFile(raw)) throw new Error(raw && raw.schema === E.SCHEMA ? "Esse é o arquivo das suas partidas (jungle_data.json). Importe ele em Configurações e Importação; aqui vai o referencias_challenger.json." : "Este não é o arquivo de referências. Use o saida\\referencias_challenger.json gerado pelo atualizar_referencias.bat.");
      const res = await importRefs(raw);
      toast(`Referências importadas: ${res.report.players} jogadores, ${res.report.added} partidas novas.`);
    } catch (e) { setError(e.message || String(e)); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };
  const players = prep?.players || [];
  const drop = (
    <div className={`drop ${over ? "over" : ""}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files); }}>
      <strong>Arraste aqui o <span className="mono">referencias_challenger.json</span></strong>
      <span className="muted">Fica separado das suas partidas. Importar de novo atualiza sem duplicar.</span>
      <input ref={fileRef} id="ch-file" type="file" accept=".json,.gz,application/json" hidden onChange={(e) => handle(e.target.files)} />
      <button className="btn primary" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? "Importando…" : "Escolher arquivo"}</button>
    </div>
  );
  const steps = (
    <ol className="steps">
      <li>Use o coletor <b>versão 1.2</b> ou mais nova: ela tem o <code>atualizar_referencias.bat</code> e o <code>referencias.txt</code>, já com os 10 junglers Challenger.</li>
      <li>Se quiser, edite o <code>referencias.txt</code> no Bloco de Notas (um Riot ID por linha, no formato Nome#TAG).</li>
      <li>Dê dois cliques em <code>atualizar_referencias.bat</code>. Na primeira vez leva uns 15 a 20 minutos; depois, só baixa o que for novo.</li>
      <li>Importe aqui o arquivo <code>saida\referencias_challenger.json</code>.</li>
    </ol>
  );
  if (!compact) {
    return (
      <div className="grid">
        <Card span={7} title="Comece pelos jogadores de referência" eyebrow="dados públicos da API da Riot">
          {steps}
          <p className="note">A sua chave continua só no seu computador, dentro do coletor. O arquivo gerado não contém a chave.</p>
        </Card>
        <Card span={5} title="Importar referências">
          {drop}
          {error && <div className="callout warn" style={{ marginTop: 10 }}>{error}</div>}
        </Card>
      </div>
    );
  }
  const total = players.reduce((s, p) => s + p.games.length, 0);
  return (
    <Card title="Dados das referências" eyebrow={`${players.length} jogadores · ${total} partidas de jungle em Solo/Duo`}>
      <div className="split">
        <div className="row-gap" style={{ gap: 10, alignContent: "start" }}>
          <dl className="kv">
            <dt>Coletado em</dt><dd>{prep.generatedAt ? new Date(prep.generatedAt).toLocaleString("pt-BR") : "—"}</dd>
            <dt>Jogadores</dt><dd>{players.map((p) => `${p.riotId} (${p.games.length})`).join(" · ")}</dd>
            {prep.notFound.length > 0 && <><dt>Não encontrados</dt><dd>{prep.notFound.join(" · ")} <span className="dim">(confira o Riot ID no referencias.txt)</span></dd></>}
          </dl>
          <div className="inline-form">
            {!confirm ? <button className="btn ghost" onClick={() => setConfirm(true)}>Remover referências</button> : <>
              <span className="note" style={{ margin: 0 }}>Remover os dados das referências deste dashboard?</span>
              <button className="btn" onClick={async () => { await clearRefs(); setConfirm(false); toast("Referências removidas."); }}>Remover</button>
              <button className="btn ghost" onClick={() => setConfirm(false)}>Cancelar</button>
            </>}
          </div>
        </div>
        <div>{drop}{error && <div className="callout warn" style={{ marginTop: 10 }}>{error}</div>}</div>
      </div>
    </Card>
  );
}
