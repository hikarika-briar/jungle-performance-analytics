// Evolução (v2): gráficos ao longo do tempo, aproximação dos Challengers e frente a frente entre períodos.
import * as E from "./engine.js";
import * as CH from "./challenger.js";
import * as EV from "./evolution.js";
import * as RK from "./rank.js";
import { fmt, C, Card, Tip, Empty, Versus, ChartTip, axisProps, gridProps, CountUp } from "./ui.jsx";
import { fmtV } from "./views_challenger.jsx";
import { NoGames } from "./views_overview.jsx";

const React = window.React;
const { useMemo, useState } = React;
const R = window.Recharts;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

export function Evolution({ ctx }) {
  const { pool, refs } = ctx;
  const [mode, setMode] = useState("g20");
  const opts = mode === "month" ? { mode: "month" } : { mode: "games", size: mode === "g10" ? 10 : 20 };
  const prep = useMemo(() => CH.prepareRefs(refs), [refs]);
  const ref = useMemo(() => EV.refMedians(prep), [prep]);
  const series = useMemo(() => EV.evolutionSeries(pool, ref, opts), [pool, ref, mode]);
  const window = mode === "g10" ? 20 : 40;
  const trends = useMemo(() => Object.fromEntries(EV.TRACK_KEYS.map((k) => [k, EV.trendOf(k, pool, window, ref?.medians[k])])), [pool, window, ref]);
  const label = (p) => (p.month ? RK.monthLabel(Date.parse(p.month + "-15")) : fmt.dateShort(p.to));
  const data = useMemo(() => series.map((p) => ({ ...p, label: label(p) })), [series]);
  if (!pool.length) return <NoGames ctx={ctx} />;
  const first = data[0], last = data[data.length - 1];

  return (
    <div className="row-gap">
      <div className="inline-form">
        <span className="eyebrow">Agrupar por</span>
        <div className="chips">
          {[["g10", "Blocos de 10 partidas"], ["g20", "Blocos de 20 partidas"], ["month", "Mês a mês"]].map(([k, l]) => <button key={k} className="chip" aria-pressed={mode === k} onClick={() => setMode(k)}>{l}</button>)}
        </div>
        <span className="note" style={{ margin: 0 }}>Usa todas as suas partidas com os filtros de campeão e fila (o período fica de fora).</span>
      </div>

      {ref ? (
        <Card title="Rumo ao Challenger ao longo do tempo" eyebrow={`em quantas métricas você está no nível da média dos ${ref.nPlayers} Challengers`}
          tip="Barras: quantas das métricas que dependem de você estavam iguais ou melhores que a média dos Challengers naquele bloco. Linha: win rate do bloco. As referências são as partidas recentes deles, então a régua é a mesma para todos os blocos.">
          {data.length >= 2 ? <>
            <div className="kpis" style={{ marginBottom: 12 }}>
              <div className="kpi"><div className="label">Agora</div><div className="value"><CountUp value={last.level} /><small>de {last.total}</small></div><div className="cmp">{label(last)} · {last.n} partidas</div></div>
              <div className="kpi"><div className="label">No começo</div><div className="value">{first.level}<small>de {first.total}</small></div><div className="cmp">{label(first)}</div></div>
              <div className="kpi"><div className="label">Melhor bloco</div><div className="value">{Math.max(...data.map((d) => d.level))}<small>de {last.total}</small></div><div className="cmp">{label(data.reduce((a, b) => (b.level > a.level ? b : a)))}</div></div>
              <div className="kpi"><div className="label">Tendência</div><div className="value" style={{ color: last.level > first.level ? C.green : last.level < first.level ? C.red : C.fg }}>{last.level > first.level ? "▲" : last.level < first.level ? "▼" : "■"} {fmt.signed(last.level - first.level)}</div><div className="cmp">métricas no nível, do primeiro ao último bloco</div></div>
            </div>
            <div className="chart tall">
              <R.ResponsiveContainer>
                <R.ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                  <defs><linearGradient id="ev-bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.blue} stopOpacity=".95" /><stop offset="1" stopColor={C.blue} stopOpacity=".25" /></linearGradient></defs>
                  <R.CartesianGrid {...gridProps} />
                  <R.XAxis dataKey="label" {...axisProps} />
                  <R.YAxis yAxisId="l" {...axisProps} domain={[0, last.total || 20]} allowDecimals={false} />
                  <R.YAxis yAxisId="w" orientation="right" {...axisProps} domain={[0, 1]} tickFormatter={(v) => fmt.pct(v)} />
                  <R.ReferenceLine yAxisId="w" y={0.5} stroke={C.line2} strokeDasharray="3 4" />
                  <R.Tooltip content={<ChartTip render={(pl) => { const p = pl[0].payload; return <><div>{fmt.date(p.from)} a {fmt.date(p.to)} · {p.n} partidas</div><div style={{ color: C.blue }}>{p.level} de {p.total} métricas no nível Challenger</div><div style={{ color: C.gold }}>Win rate {fmt.pct(p.wr)}</div></>; }} />} />
                  <R.Bar yAxisId="l" dataKey="level" fill="url(#ev-bar)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                  <R.Line yAxisId="w" dataKey="wr" stroke={C.gold} strokeWidth={2.5} dot={{ r: 3, fill: C.gold }} isAnimationActive={false} />
                </R.ComposedChart>
              </R.ResponsiveContainer>
            </div>
            <div className="legend"><span><i style={{ background: C.blue }} />Métricas no nível Challenger</span><span><i style={{ background: C.gold }} />Win rate do bloco</span></div>
          </> : <p className="muted">São precisos pelo menos 2 blocos de partidas.</p>}
        </Card>
      ) : (
        <Card title="Rumo ao Challenger ao longo do tempo"><Empty title="Importe as referências">Com o arquivo referencias_challenger.json importado, este gráfico mostra se você está chegando mais perto dos Challengers.</Empty></Card>
      )}

      {ref && <GapCard trends={trends} window={window} />}

      <Card title="Métrica por métrica" eyebrow={`você bloco a bloco · faixa verde-água = nível Challenger · status: últimas ${window} × ${window} anteriores`}
        tip="Linha dourada: você, bloco a bloco. Linha tracejada e faixa verde-água: a média dos Challengers e o lado em que você estaria no nível deles. 'Aproximando' e 'Afastando' só aparecem quando a diferença entre as duas janelas não parece acaso (intervalo de 95%); senão, aparece 'sem confirmação'.">
        <div className="evo-grid">
          {EV.TRACK_KEYS.map((k, i) => <MetricTrend key={k} k={k} i={i} data={data} t={trends[k]} median={ref?.medians[k]} />)}
        </div>
      </Card>

      <WindowVersus pool={pool} />
      <MonthlyCard pool={pool} />
      <CustomPeriods pool={pool} />
    </div>
  );
}

const fmtGap = (g, m) => (!isNum(g) ? "—" : m.fmt === "pct" ? `${fmt.dec(g * 100, 1)} p.p.` : m.fmt === "int" ? fmt.int(g) : fmt.dec(g, m.fmt === "dec2" ? 2 : 1));
const TONE_COLOR = { good: C.green, bad: C.red, mid: C.blue, warn: "#F0B232", neutral: C.gold };

function MetricTrend({ k, i, data, t, median }) {
  const m = EV.metricDef(k);
  if (!m) return null;
  const [lab, tone] = EV.STATUS_LABEL[t?.status] || ["Sem dados", "neutral"];
  const pts = data.map((d) => ({ label: d.label, v: d.vals[k], n: d.n }));
  const color = TONE_COLOR[tone] || C.gold;
  const vs = pts.map((p) => p.v).filter(isNum).concat(isNum(median) ? [median] : []);
  const lo = vs.length ? Math.min(...vs) : 0, hi = vs.length ? Math.max(...vs) : 1;
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.14;
  const dom = [lo - pad, hi + pad];
  const zone = isNum(median) ? (m.better === "lower" ? [dom[0], median] : [median, dom[1]]) : null;
  const c = t?.closeness;
  return (
    <article className="evo-card" style={{ "--i": i }}>
      <div className="evo-head"><span className="nm">{m.label}</span>{m.tip && <Tip text={m.tip} />}</div>
      <div><span className={`pos ${tone}`}>{lab}</span></div>
      <div className="evo-vals">
        <div><span>Agora</span><b style={{ color }}>{fmtV(t?.a, m)}</b></div>
        <div><span>Antes</span><b>{fmtV(t?.b, m)}</b></div>
        <div><span>Challenger</span><b className="bluec">{fmtV(median, m)}</b></div>
      </div>
      <div className="chart" style={{ height: 92 }}>
        <R.ResponsiveContainer>
          <R.LineChart data={pts} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
            <R.XAxis dataKey="label" hide />
            <R.YAxis hide domain={dom} />
            {zone && <R.ReferenceArea y1={zone[0]} y2={zone[1]} fill={C.blue} fillOpacity={0.09} stroke="none" ifOverflow="hidden" />}
            {isNum(median) && <R.ReferenceLine y={median} stroke={C.blue} strokeDasharray="4 4" strokeOpacity={0.8} />}
            <R.Tooltip content={<ChartTip render={(pl) => <><div>{pl[0].payload.label} · {pl[0].payload.n} partidas</div><div style={{ color: C.gold }}>{fmtV(pl[0].payload.v, m)}</div></>} />} />
            <R.Line dataKey="v" stroke={C.gold} strokeWidth={2} connectNulls isAnimationActive={false}
              dot={(pr) => (pr.index === pts.length - 1 && isNum(pr.payload.v) ? <circle key={pr.index} cx={pr.cx} cy={pr.cy} r={3.5} fill={color} stroke="#010A13" strokeWidth={1.5} /> : <g key={pr.index} />)} />
          </R.LineChart>
        </R.ResponsiveContainer>
      </div>
      {c && <div className="evo-gap">{c.gN === 0 ? (c.gB === 0 ? "No nível Challenger nas duas janelas." : "Chegou ao nível Challenger.") : <>Distância: <b>{fmtGap(c.gB, m)}</b> → <b style={{ color: c.gN < c.gB ? C.green : c.gN > c.gB ? C.red : C.fg }}>{fmtGap(c.gN, m)}</b></>}</div>}
    </article>
  );
}

function gapText(c) {
  if (c.kind === "nivel") return "segue no nível";
  if (c.kind === "chegou") return "chegou ao nível";
  if (c.kind === "saiu") return "saiu do nível";
  if (c.kind === "igual") return "sem mudança";
  return c.kind === "perto" ? "mais perto" : "mais longe";
}

function GapCard({ trends, window }) {
  const rows = EV.TRACK_KEYS.map((k) => ({ k, m: EV.metricDef(k), t: trends[k] })).filter((r) => r.m && r.t?.closeness)
    .sort((a, b) => b.t.closeness.rel - a.t.closeness.rel || (a.t.closeness.gN === 0 ? -1 : 1));
  if (!rows.length) return null;
  const closer = rows.filter((r) => r.t.closeness.v > 0), further = rows.filter((r) => r.t.closeness.v < 0);
  const atLvl = rows.filter((r) => r.t.closeness.gN === 0);
  const confirmed = rows.filter((r) => r.t.sig && r.t.closeness.v !== 0).length;
  const best = closer[0], worst = further[further.length - 1];
  return (
    <Card title="Mais perto ou mais longe dos Challengers?" eyebrow={`últimas ${window} partidas × ${window} anteriores · distância até a média Challenger em cada métrica`}
      tip="Para cada métrica, a distância entre você e a média dos Challengers nas duas janelas (zero quando você já está no nível). O tamanho da barra é a mudança dessa distância em proporção à média deles, para dar para comparar métricas de unidades diferentes.">
      <div className="gap-sum">
        <div className="gs good"><b><CountUp value={closer.length} /></b><span>mais perto</span></div>
        <div className="gs bad"><b><CountUp value={further.length} /></b><span>mais longe</span></div>
        <div className="gs lvl"><b><CountUp value={atLvl.length} /></b><span>no nível agora</span></div>
      </div>
      <p className="gap-verdict">
        Nas últimas {window} partidas você ficou <b className="good">mais perto</b> dos Challengers em {closer.length} de {rows.length} métricas e <b className="bad">mais longe</b> em {further.length}.
        {best && <> Maior avanço: <b>{best.m.label}</b> (distância {fmtGap(best.t.closeness.gB, best.m)} → {fmtGap(best.t.closeness.gN, best.m)}).</>}
        {worst && <> Onde mais se afastou: <b>{worst.m.label}</b> (distância {fmtGap(worst.t.closeness.gB, worst.m)} → {fmtGap(worst.t.closeness.gN, worst.m)}).</>}
        {" "}{confirmed === 0 ? "Nenhuma dessas mudanças é grande o bastante para descartar o acaso; vale olhar a tendência dos próximos blocos." : `${confirmed} ${confirmed === 1 ? "dessas mudanças é grande" : "dessas mudanças são grandes"} o bastante para não parecer acaso.`}
      </p>
      <div className="gapbars">
        {rows.map((r, i) => {
          const c = r.t.closeness, w = c.v === 0 ? 0 : Math.max(3, Math.min(1, Math.abs(c.rel) / 0.5) * 50);
          return (
            <div key={r.k} className={`gb-row ${r.t.sig ? "" : "unsure"}`} style={{ "--i": i }}>
              <span className="gb-name">{r.m.label}</span>
              <span className="gb-track"><i className="gb-mid" />{c.v !== 0 && <i className={`gb-bar ${c.v > 0 ? "pos" : "neg"}`} style={{ width: `${w}%`, [c.v > 0 ? "left" : "right"]: "50%" }} />}{c.v === 0 && c.gN === 0 && <i className="gb-dot" />}</span>
              <span className={`gb-txt ${c.v > 0 ? "good" : c.v < 0 ? "bad" : ""}`}><span>{gapText(c)}</span><small>distância {fmtGap(c.gB, r.m)} → {fmtGap(c.gN, r.m)}{r.t.sig ? "" : " · pode ser acaso"}</small></span>
            </div>
          );
        })}
      </div>
      <div className="legend"><span><i style={{ background: C.red }} />◀ mais longe</span><span><i style={{ background: C.green }} />mais perto ▶</span><span className="dim">barras mais claras: pode ser acaso</span></div>
    </Card>
  );
}

function WindowVersus({ pool }) {
  const [size, setSize] = useState(50);
  const ev = useMemo(() => E.evolution(pool, size), [pool, size]);
  const rows = (ev.rows || []).filter((r) => r.key !== "item3").map((r) => ({ key: r.key, label: r.label, a: r.a, b: r.b, fmt: r.fmt === "dec2" ? "dec2" : r.fmt, better: r.better, sig: r.ci ? E.excludesZero(r.ci) : false, mode: ["gold10", "xp10"].includes(r.key) ? "abs" : undefined, scale: 500, render: ["gold10", "xp10"].includes(r.key) ? (v) => fmt.signed(v) : undefined }));
  return (
    <Card title="Frente a frente com você mesmo" eyebrow={`últimas ${size} × ${size} anteriores, sem sobreposição`}
      right={<div className="chips">{[20, 50, 100].map((n) => <button key={n} className="chip" aria-pressed={size === n} onClick={() => setSize(n)}>{n} × {n}</button>)}</div>}
      tip="A barra cresce para o lado que vai melhor. Quando o intervalo de 95% da diferença inclui zero, aparece 'pode ser acaso' e não conta no placar.">
      {ev.rows ? <Versus a={{ name: `Últimas ${size}`, short: "Agora", tone: "gold" }} b={{ name: `${size} anteriores`, short: "Antes", tone: "teal" }} rows={rows}
        foot="O placar conta só as diferenças que não parecem acaso." />
        : <Empty title={`Menos de ${size * 2} partidas`}>Escolha uma janela menor.</Empty>}
    </Card>
  );
}

function MonthlyCard({ pool }) {
  const rows = useMemo(() => EV.monthlyWinRate(pool), [pool]);
  const data = useMemo(() => {
    if (!rows.length) return [];
    const by = new Map(rows.map((r) => [r.key, r]));
    const [y0, m0] = rows[0].key.split("-").map(Number), [y1, m1] = rows[rows.length - 1].key.split("-").map(Number);
    const out = [];
    for (let y = y0, mo = m0; y < y1 || (y === y1 && mo <= m1); mo === 12 ? (y++, mo = 1) : mo++) {
      const key = `${y}-${String(mo).padStart(2, "0")}`;
      out.push({ ...(by.get(key) || { key, n: 0, rate: null }), label: RK.monthLabel(new Date(y, mo - 1, 15).getTime()) });
    }
    return out;
  }, [rows]);
  return (
    <Card title="Mês a mês" eyebrow="win rate e partidas de cada mês" tip="Barra: win rate do mês (verde-água a partir de 50%, vermelho abaixo). O número em cima é a quantidade de partidas; barras apagadas têm menos de 10 partidas.">
      <div className="chart">
        <R.ResponsiveContainer>
          <R.BarChart data={data} margin={{ top: 18, right: 8, bottom: 0, left: -12 }}>
            <R.CartesianGrid {...gridProps} />
            <R.XAxis dataKey="label" {...axisProps} />
            <R.YAxis {...axisProps} domain={[0, 1]} tickFormatter={(v) => fmt.pct(v)} />
            <R.ReferenceLine y={0.5} stroke={C.gold} strokeDasharray="3 4" />
            <R.Tooltip cursor={{ fill: "#ffffff08" }} content={<ChartTip render={(pl) => { const p = pl[0].payload; return <><div>{p.label} · {p.n} partidas</div>{p.n ? <><div>{p.wins}V {p.losses}D · <b>{fmt.pct(p.rate, 1)}</b></div>{p.n < 10 && <div style={{ color: "#F0B232" }}>Poucas partidas: o win rate deste mês varia muito.</div>}</> : <div className="muted">Sem partidas neste mês.</div>}<div className="muted">IC 95%: {fmt.pct(p.ci?.[0])} a {fmt.pct(p.ci?.[1])}</div><div className="muted">{fmt.dec(p.deaths, 1)} mortes por partida</div></>; }} />} />
            <R.Bar dataKey="rate" radius={[2, 2, 0, 0]} isAnimationActive={false}>
              {data.map((d) => <R.Cell key={d.key} fill={d.rate >= 0.5 ? C.blue : C.red} fillOpacity={d.n >= 10 ? 0.85 : 0.3} />)}
              <R.LabelList dataKey="n" position="top" fill={C.fg3} fontSize={11} formatter={(v) => (v ? v : "")} />
            </R.Bar>
          </R.BarChart>
        </R.ResponsiveContainer>
      </div>
    </Card>
  );
}

function CustomPeriods({ pool }) {
  const [ra, setRa] = useState({ from: "", to: "" });
  const [rb, setRb] = useState({ from: "", to: "" });
  const inRange = (g, r) => {
    const a = r.from ? new Date(r.from + "T00:00:00").getTime() : -Infinity, b = r.to ? new Date(r.to + "T23:59:59").getTime() : Infinity;
    return g.start >= a && g.start <= b;
  };
  const custom = useMemo(() => {
    if ((!ra.from && !ra.to) || (!rb.from && !rb.to)) return null;
    const A = pool.filter((g) => inRange(g, ra)), B = pool.filter((g) => inRange(g, rb));
    return { nA: A.length, nB: B.length, rows: A.length && B.length ? E.compareWindows(A, B) : null };
  }, [pool, ra, rb]);
  const rows = (custom?.rows || []).filter((r) => r.key !== "item3").map((r) => ({ key: r.key, label: r.label, a: r.a, b: r.b, fmt: r.fmt, better: r.better, sig: r.ci ? E.excludesZero(r.ci) : false, mode: ["gold10", "xp10"].includes(r.key) ? "abs" : undefined, scale: 500, render: ["gold10", "xp10"].includes(r.key) ? (v) => fmt.signed(v) : undefined }));
  return (
    <Card title="Comparar dois períodos" eyebrow="antes e depois de uma mudança" tip="Útil para antes/depois de uma mudança (ex.: começou a usar Eclipse). As datas podem se sobrepor; se isso acontecer, as amostras compartilham partidas.">
      <div className="inline-form" style={{ marginBottom: 12 }}>
        <span className="eyebrow">Período A</span>
        <label className="field"><span>De</span><input id="ev-a-from" type="date" value={ra.from} onChange={(e) => setRa({ ...ra, from: e.target.value })} /></label>
        <label className="field"><span>Até</span><input id="ev-a-to" type="date" value={ra.to} onChange={(e) => setRa({ ...ra, to: e.target.value })} /></label>
        <span className="eyebrow" style={{ marginLeft: 12 }}>Período B</span>
        <label className="field"><span>De</span><input id="ev-b-from" type="date" value={rb.from} onChange={(e) => setRb({ ...rb, from: e.target.value })} /></label>
        <label className="field"><span>Até</span><input id="ev-b-to" type="date" value={rb.to} onChange={(e) => setRb({ ...rb, to: e.target.value })} /></label>
      </div>
      {custom?.rows ? <Versus a={{ name: "Período A", short: "A", tone: "gold", sub: `${custom.nA} partidas` }} b={{ name: "Período B", short: "B", tone: "teal", sub: `${custom.nB} partidas` }} rows={rows} foot="O placar conta só as diferenças que não parecem acaso." />
        : <p className="muted">{custom ? `Um dos períodos não tem partidas (A: ${custom.nA}, B: ${custom.nB}).` : "Escolha as datas dos dois períodos."}</p>}
    </Card>
  );
}
