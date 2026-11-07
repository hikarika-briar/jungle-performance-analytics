import * as E from "./engine.js";
import { fmt, C, Card, Tip, Sample, WRBar, Delta, Empty, Table, ChampName, ChartTip, axisProps, gridProps } from "./ui.jsx";
const React = window.React;
const { useMemo } = React;
const R = window.Recharts;

export function NoGames({ ctx }) {
  return (
    <Empty title="Nenhuma partida com esses filtros"
      action={<button className="btn" onClick={() => ctx.setFilters(E.DEFAULT_FILTERS)}>Restaurar filtros padrão</button>}>
      Ajuste o período, o campeão ou a fila. O padrão é todos os campeões nas últimas 50 partidas da Ranqueada Solo/Duo.
    </Empty>
  );
}

function Kpi({ label, value, unit, prev, delta, kind, better = "higher", tip, hero, children }) {
  return (
    <div className={`kpi ${hero ? "hero" : ""}`}>
      <div className="label">{label}{tip && <Tip text={tip} />}</div>
      <div className="value num">{value}{unit && <small>{unit}</small>}</div>
      {children}
      {prev !== undefined && (
        <div className="cmp">
          {prev == null ? <span>sem período anterior</span> : <><span>anterior {prev}</span><Delta value={delta} kind={kind} better={better} /></>}
        </div>
      )}
    </div>
  );
}

export function Overview({ ctx }) {
  const { games, previous, prevLabel, meta } = ctx;
  const s = useMemo(() => E.summarize(games), [games]);
  const p = useMemo(() => (previous ? E.summarize(previous) : null), [previous]);
  const series = useMemo(() => E.rollingSeries(games, 10), [games]);
  const days = useMemo(() => E.byDay(games), [games]);
  const champs = useMemo(() => E.championStats(games), [games]);
  const cons = useMemo(() => E.consistency(games), [games]);
  if (!games.length) return <NoGames ctx={ctx} />;
  const d = (a, b) => (a == null || b == null ? null : a - b);
  const pv = (v, f) => (p ? f(v) : null);
  const prevNote = p ? `Comparado com: ${prevLabel} (${p.n} partidas, mesmos filtros).` : "Não há um período anterior equivalente para comparar com este filtro.";

  return (
    <>
      <div className="kpis">
        <Kpi hero label="Win rate" value={fmt.pct(s.rate, 1)} prev={pv(p?.rate, (v) => fmt.pct(v, 1))} delta={d(s.rate, p?.rate)} kind="pct"
          tip="Proporção de vitórias. A barra mostra o intervalo de confiança de 95% (Wilson).">
          <WRBar rate={s.rate} ci={s.ci} n={s.n} compact />
          <div className="cmp"><span className="num">IC 95%: {fmt.pct(s.ci?.[0], 0)} a {fmt.pct(s.ci?.[1], 0)}</span><Sample n={s.n} /></div>
        </Kpi>
        <Kpi label="Partidas" value={fmt.int(s.n)} prev={pv(p?.n, fmt.int)} delta={d(s.n, p?.n)} kind="int" better={null} />
        <Kpi label="Vitórias" value={fmt.int(s.wins)} prev={pv(p?.wins, fmt.int)} delta={d(s.wins, p?.wins)} kind="int" better={null} />
        <Kpi label="Derrotas" value={fmt.int(s.losses)} prev={pv(p?.losses, fmt.int)} delta={d(s.losses, p?.losses)} kind="int" better={null} />
        <Kpi label="KDA" value={s.kda?.perfect ? "Perfeito" : fmt.dec(s.kda?.value, 2)} prev={pv(p?.kda?.value, (v) => fmt.dec(v, 2))} delta={d(s.kda?.value, p?.kda?.value)} kind="dec2"
          tip="(abates + assistências) ÷ mortes, somando todas as partidas. Partidas sem morte não distorcem a média." />
        <Kpi label="Abates" value={fmt.dec(s.kills, 1)} prev={pv(p?.kills, (v) => fmt.dec(v, 1))} delta={d(s.kills, p?.kills)} />
        <Kpi label="Mortes" value={fmt.dec(s.deaths, 1)} prev={pv(p?.deaths, (v) => fmt.dec(v, 1))} delta={d(s.deaths, p?.deaths)} better="lower" />
        <Kpi label="Assistências" value={fmt.dec(s.assists, 1)} prev={pv(p?.assists, (v) => fmt.dec(v, 1))} delta={d(s.assists, p?.assists)} />
        <Kpi label="Farm/min" value={fmt.dec(s.csMin, 2)} prev={pv(p?.csMin, (v) => fmt.dec(v, 2))} delta={d(s.csMin, p?.csMin)} kind="dec2" tip="Tropas + monstros por minuto (média por partida)." />
        <Kpi label="Ouro/min" value={fmt.int(s.goldMin)} prev={pv(p?.goldMin, fmt.int)} delta={d(s.goldMin, p?.goldMin)} kind="int" tip="Ouro obtido ÷ duração (não é ouro disponível)." />
        <Kpi label="Dano/min" value={fmt.int(s.dmgMin)} prev={pv(p?.dmgMin, fmt.int)} delta={d(s.dmgMin, p?.dmgMin)} kind="int" tip="Dano total a campeões ÷ duração." />
        <Kpi label="Part. em abates" value={fmt.pct(s.kp, 0)} prev={pv(p?.kp, (v) => fmt.pct(v, 0))} delta={d(s.kp, p?.kp)} kind="pct" tip="(abates + assistências) ÷ abates do seu time." />
        <Kpi label="Duração média" value={fmt.dur(s.durMin * 60)} prev={pv(p?.durMin, (v) => fmt.dur(v * 60))} delta={d(s.durMin, p?.durMin)} better={null} />
      </div>
      <p className="note">{prevNote} Deltas em verde indicam melhora, mas não dizem se a mudança vai além do acaso; para isso use a aba <b>Evolução</b>.</p>

      <div className="grid">
        <Card span={6} title="Win rate ao longo do tempo" tip="Linha: win rate das últimas 10 partidas em cada ponto (aparece a partir da 5ª). Pontos no rodapé: vitória (verde) ou derrota (vermelho).">
          <div className="chart">
            <R.ResponsiveContainer>
              <R.ComposedChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <R.CartesianGrid {...gridProps} />
                <R.XAxis dataKey="idx" {...axisProps} />
                <R.YAxis {...axisProps} domain={[0, 1]} tickFormatter={(v) => fmt.pct(v)} />
                <R.ReferenceLine y={0.5} stroke={C.line2} />
                <R.Tooltip content={<ChartTip render={(pl) => { const x = pl[0].payload; return <><div className="muted">Partida {x.idx} · {fmt.date(x.start)}</div><div>{x.win ? "Vitória" : "Derrota"}</div><div>Win rate (últimas {x.rollN}): <strong>{fmt.pct(x.wrRoll, 0)}</strong></div></>; }} />} />
                <R.Scatter dataKey={(x) => (x.win ? 0.03 : 0.0)} shape={(pp) => <circle cx={pp.cx} cy={pp.cy} r={2.6} fill={pp.payload.win ? C.green : C.red} />} isAnimationActive={false} />
                <R.Line type="monotone" dataKey="wrRoll" stroke={C.blue} strokeWidth={2.2} dot={false} connectNulls isAnimationActive={false} name="Win rate (10)" />
              </R.ComposedChart>
            </R.ResponsiveContainer>
          </div>
        </Card>
        <Card span={6} title="KDA por partida" tip="Pontos: KDA de cada partida (limitado a 15 no gráfico). Linha: KDA agregado das últimas 10.">
          <div className="chart">
            <R.ResponsiveContainer>
              <R.ComposedChart data={series.map((x) => ({ ...x, kdaC: Math.min(15, x.kda) }))} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <R.CartesianGrid {...gridProps} />
                <R.XAxis dataKey="idx" {...axisProps} />
                <R.YAxis {...axisProps} domain={[0, 15]} />
                <R.Tooltip content={<ChartTip render={(pl) => { const x = pl[0].payload; return <><div className="muted">Partida {x.idx} · {fmt.date(x.start)}</div><div>KDA: <strong>{fmt.dec(x.kda, 2)}</strong></div><div>Últimas 10: {fmt.dec(x.kdaRoll, 2)}</div></>; }} />} />
                <R.Scatter dataKey="kdaC" fill={C.fg3} isAnimationActive={false} shape={(pp) => <circle cx={pp.cx} cy={pp.cy} r={2.4} fill={pp.payload.win ? "#86efac" : "#fca5a5"} opacity={0.75} />} />
                <R.Line type="monotone" dataKey="kdaRoll" stroke={C.gold} strokeWidth={2.2} dot={false} isAnimationActive={false} />
              </R.ComposedChart>
            </R.ResponsiveContainer>
          </div>
        </Card>
        <Card span={6} title="Farm por minuto">
          <TrendChart data={series} raw="csMin" roll="rollCs" rollKey="csRoll" color={C.blue} fmtV={(v) => fmt.dec(v, 2)} />
        </Card>
        <Card span={6} title="Ouro por minuto">
          <TrendChart data={series} raw="goldMin" rollKey="goldRoll" color={C.gold} fmtV={fmt.int} />
        </Card>
        <Card span={7} title="Vitórias e derrotas por dia">
          <div className="chart">
            <R.ResponsiveContainer>
              <R.BarChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <R.CartesianGrid {...gridProps} />
                <R.XAxis dataKey="day" {...axisProps} tickFormatter={(v) => v.slice(8, 10) + "/" + v.slice(5, 7)} minTickGap={14} />
                <R.YAxis {...axisProps} allowDecimals={false} />
                <R.Tooltip cursor={{ fill: "#ffffff08" }} content={<ChartTip render={(pl) => { const x = pl[0].payload; return <><div className="muted">{x.day.split("-").reverse().join("/")}</div><div className="good">{x.wins} vitória(s)</div><div className="bad">{x.losses} derrota(s)</div></>; }} />} />
                <R.Bar dataKey="wins" stackId="a" fill={C.green} isAnimationActive={false} />
                <R.Bar dataKey="losses" stackId="a" fill={C.red} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </R.BarChart>
            </R.ResponsiveContainer>
          </div>
        </Card>
        <Card span={5} title="Desempenho por campeão" tip="Respeita todos os filtros, exceto se o filtro de campeão estiver restrito: escolha 'Todos' para comparar campeões.">
          <Table rowKey={(r) => r.champ} rows={champs} initialSort={{ key: "n", dir: "desc" }} columns={[
            { key: "champ", label: "Campeão", render: (r) => <ChampName meta={meta} keyName={r.champ} id={r.champId} />, sortValue: (r) => r.champ },
            { key: "n", label: "Partidas", num: true, render: (r) => <Sample n={r.n} /> },
            { key: "rate", label: "Win rate", render: (r) => <WRBar rate={r.rate} ci={r.ci} n={r.n} /> },
            { key: "kda", label: "KDA", num: true, render: (r) => fmt.dec(r.kda, 2) },
          ]} />
        </Card>
        <Card span={12} title="Consistência" tip="Média sozinha esconde oscilação. Mediana, desvio-padrão e percentis mostram se você é regular ou alterna partidas muito boas e muito ruins. CV = desvio ÷ média (menor = mais regular).">
          <div className="split">
            <Table rowKey={(r) => r.key} rows={[
              ["Farm/min", cons.metrics.csMin, 2], ["Ouro/min", cons.metrics.goldMin, 0], ["Dano/min", cons.metrics.dmgMin, 0],
              ["Mortes", cons.metrics.deaths, 1], ["KDA", cons.metrics.kda, 2], ["Part. em abates", cons.metrics.kp, "pct"],
            ].map(([label, m, dg]) => ({ key: label, label, m, dg }))} columns={[
              { key: "label", label: "Métrica", sortable: false },
              ...["mean", "median", "sd", "p25", "p75", "p90"].map((k) => ({ key: k, sortable: false, num: true,
                label: { mean: "Média", median: "Mediana", sd: "Desvio", p25: "P25", p75: "P75", p90: "P90" }[k],
                render: (r) => (r.dg === "pct" ? fmt.pct(r.m[k], 0) : fmt.dec(r.m[k], r.dg)) })),
              { key: "cv", label: "CV", num: true, sortable: false, render: (r) => fmt.pct(r.m.cv, 0) },
            ]} />
            <div className="row-gap" style={{ gap: 10, alignContent: "start" }}>
              <div className="eyebrow">Frequência de partidas acima de referências</div>
              {cons.thresholds.map((t) => (
                <div key={t.label} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 200px", gap: 12, alignItems: "center" }}>
                  <span>{t.label} <span className="dim num">({t.x ?? 0} de {t.n ?? 0})</span></span>
                  <WRBar rate={t.rate} ci={t.ci} n={t.n} />
                </div>
              ))}
              <p className="note" style={{ marginTop: 0 }}>As referências são pontos de corte práticos para jungle, não metas oficiais.</p>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

function TrendChart({ data, raw, rollKey, color, fmtV }) {
  return (
    <div className="chart">
      <R.ResponsiveContainer>
        <R.ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
          <R.CartesianGrid {...gridProps} />
          <R.XAxis dataKey="idx" {...axisProps} />
          <R.YAxis {...axisProps} domain={["auto", "auto"]} tickFormatter={fmtV} />
          <R.Tooltip content={<ChartTip render={(pl) => { const x = pl[0].payload; return <><div className="muted">Partida {x.idx} · {fmt.date(x.start)}</div><div>Partida: <strong>{fmtV(x[raw])}</strong></div><div>Média das últimas {x.rollN}: {fmtV(x[rollKey])}</div></>; }} />} />
          <R.Scatter dataKey={raw} isAnimationActive={false} shape={(pp) => <circle cx={pp.cx} cy={pp.cy} r={2.3} fill={C.fg3} opacity={0.7} />} />
          <R.Line type="monotone" dataKey={rollKey} stroke={color} strokeWidth={2.2} dot={false} isAnimationActive={false} />
        </R.ComposedChart>
      </R.ResponsiveContainer>
    </div>
  );
}
