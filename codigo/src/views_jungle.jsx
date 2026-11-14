import * as E from "./engine.js";
import { STATIC } from "./static_store.js";
import { fmt, C, Card, Tip, Sample, WRBar, Empty, Table, SubTabs, StatusChip, ChampName, ChampIcon, ItemIcon, ItemRow, RuneIcon, statColumns, ChartTip, axisProps, gridProps, Versus } from "./ui.jsx";
import { NoGames } from "./views_overview.jsx";
import { EventMap } from "./views_map.jsx";
import * as TU from "./turns.js";
import { matchupDiagnostics, pickTable, TIER_LABEL, briarTier } from "./coach_matchups.js";
import { classOf, champStats, SUBCLASSES, CLASSES, subclassesOf } from "./classes.js";
import { MatchupHero, MatchupGames, ClassCycle, ClassMenu, JunglerSpotlight, ClassGlyph } from "./views_matchups_top.jsx";
const React = window.React;
const { useState, useMemo, useRef } = React;
const R = window.Recharts;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

function NeedsTimeline({ n, what }) {
  return <Empty title="Sem partidas com timeline neste filtro">{what} depende dos eventos minuto a minuto da timeline. {n} partida(s) do filtro não têm timeline. Rode o coletor com timelines ativadas ou mude o filtro.</Empty>;
}

function WRBuckets({ rows, title, tip }) {
  const data = rows.map((r) => ({ ...r, lo: r.ci ? r.ci[0] : null, hi: r.ci ? r.ci[1] : null, err: r.ci ? [r.rate - r.ci[0], r.ci[1] - r.rate] : [0, 0] }));
  return (
    <Card span={6} title={title} tip={tip || "Barras: win rate. Linhas finas: IC 95% (Wilson). Número acima: partidas na faixa."}>
      <div className="chart">
        <R.ResponsiveContainer>
          <R.BarChart data={data} margin={{ top: 18, right: 8, bottom: 0, left: -12 }}>
            <R.CartesianGrid {...gridProps} />
            <R.XAxis dataKey="label" {...axisProps} interval={0} tick={{ fill: C.fg2, fontSize: 10.5 }} />
            <R.YAxis {...axisProps} domain={[0, 1]} tickFormatter={(v) => fmt.pct(v)} />
            <R.ReferenceLine y={0.5} stroke={C.line2} />
            <R.Tooltip cursor={{ fill: "#ffffff08" }} content={<ChartTip render={(pl) => { const x = pl[0].payload; return <><div>{x.label}</div><div>Win rate <strong>{fmt.pct(x.rate, 1)}</strong> · {x.n} partidas</div>{x.ci && <div className="muted">IC 95%: {fmt.pct(x.lo)} a {fmt.pct(x.hi)}</div>}</>; }} />} />
            <R.Bar dataKey="rate" isAnimationActive={false} radius={[3, 3, 0, 0]}>
              {data.map((d, i) => <R.Cell key={i} fill={d.rate == null ? C.line : d.rate >= 0.5 ? C.green : C.red} fillOpacity={d.n < 10 ? 0.45 : 0.9} />)}
              <R.ErrorBar dataKey="err" width={5} stroke={C.fg2} />
              <R.LabelList dataKey="n" position="top" fill={C.fg3} fontSize={10.5} formatter={(v) => `${v}`} />
            </R.Bar>
          </R.BarChart>
        </R.ResponsiveContainer>
      </div>
      <p className="note" style={{ marginTop: 4 }}>Barras mais claras: menos de 10 partidas na faixa.</p>
    </Card>
  );
}

// ---------------------------------------------------------------------------
export function EarlyNumbers({ ctx }) {
  const { games } = ctx;
  const es = useMemo(() => E.earlyStats(games), [games]);
  if (!games.length) return <NoGames ctx={ctx} />;
  if (!es.nTL) return <NeedsTimeline n={es.nNoTL} what="O early game" />;
  return (
    <div className="row-gap">
      <Card title="Primeiros 15 minutos" tip="Valores por snapshot de minuto da timeline (não são eventos exatos). Diferenças = você menos o jungler inimigo."
        eyebrow={`${es.nTL} partidas com timeline · ${es.nNoTL} sem (fora)`}>
        <Table rowKey={(r) => r.minute} rows={es.rows} columns={[
          { key: "minute", label: "Minuto", sortable: false, render: (r) => `${r.minute}:00` },
          { key: "gold", label: "Ouro", num: true, sortable: false, render: (r) => fmt.int(r.gold) },
          { key: "level", label: "Nível", num: true, sortable: false, render: (r) => fmt.dec(r.level, 1) },
          { key: "xp", label: "Experiência", num: true, sortable: false, render: (r) => fmt.int(r.xp) },
          { key: "cs", label: "Farm", num: true, sortable: false, render: (r) => fmt.dec(r.cs, 1) },
          { key: "dGold", label: "Δ ouro", num: true, sortable: false, render: (r) => <span className={r.dGold >= 0 ? "good" : "bad"}>{fmt.signed(r.dGold)}</span> },
          { key: "dXp", label: "Δ experiência", num: true, sortable: false, render: (r) => <span className={r.dXp >= 0 ? "good" : "bad"}>{fmt.signed(r.dXp)}</span> },
          { key: "dLevel", label: "Δ nível", num: true, sortable: false, render: (r) => fmt.signed(r.dLevel, 2) },
          { key: "dCs", label: "Δ farm", num: true, sortable: false, render: (r) => fmt.signed(r.dCs, 1) },
          { key: "nDiff", label: "Partidas", num: true, sortable: false },
        ]} />
        <div className="kpis" style={{ marginTop: 12 }}>
          <div className="kpi"><div className="label">Abates antes dos 10</div><div className="value">{fmt.dec(es.early10.k, 2)}</div></div>
          <div className="kpi"><div className="label">Mortes antes dos 10</div><div className="value">{fmt.dec(es.early10.d, 2)}</div></div>
          <div className="kpi"><div className="label">Assistências antes dos 10</div><div className="value">{fmt.dec(es.early10.a, 2)}</div></div>
          <div className="kpi"><div className="label">1º dragão do seu time <Tip text="Proporção das partidas em que o primeiro dragão foi do seu time." /></div><div className="value">{fmt.pct(es.firstDragonTeam)}</div></div>
          <div className="kpi"><div className="label">Você no 1º dragão do time</div><div className="value">{fmt.pct(es.firstDragonMe)}</div></div>
          <div className="kpi"><div className="label">1ª vastilarva do time</div><div className="value">{fmt.pct(es.firstGrubsTeam)}</div></div>
        </div>
      </Card>
      <div className="grid">
        <WRBuckets title="Win rate por diferença de nível aos 10" rows={es.level} />
        <WRBuckets title="Win rate por diferença de ouro aos 10" rows={es.gold} />
        <WRBuckets title="Win rate por experiência aos 10" rows={es.xp} />
        <WRBuckets title="Win rate por farm aos 10" rows={es.cs} />
      </div>
      <div className="grid">
        <Card span={7} title="Ouro × experiência aos 10 (vs. jungler inimigo)" tip="Cada ponto é uma partida. Verde = vitória, vermelho = derrota. Quadrante superior direito = à frente nas duas coisas.">
          <div className="chart tall">
            <R.ResponsiveContainer>
              <R.ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: -6 }}>
                <R.CartesianGrid stroke={C.line} strokeDasharray="3 4" />
                <R.XAxis type="number" dataKey="x" name="Ouro" {...axisProps} tickFormatter={fmt.int} />
                <R.YAxis type="number" dataKey="y" name="Experiência" {...axisProps} tickFormatter={fmt.int} />
                <R.ReferenceLine x={0} stroke={C.line2} />
                <R.ReferenceLine y={0} stroke={C.line2} />
                <R.Tooltip content={<ChartTip render={(pl) => { const x = pl[0].payload; return <><div>{x.win ? "Vitória" : "Derrota"} vs {E.champDisplay(ctx.meta, x.opp)}</div><div>Ouro {fmt.signed(x.x)} · XP {fmt.signed(x.y)}</div></>; }} />} />
                <R.Scatter data={es.scatter} isAnimationActive={false} onClick={(p) => p && p.payload && ctx.openMatch(p.payload.id)}
                  shape={(p) => <circle cx={p.cx} cy={p.cy} r={4} fill={p.payload.win ? C.green : C.red} fillOpacity={0.75} style={{ cursor: "pointer" }} />} />
              </R.ScatterChart>
            </R.ResponsiveContainer>
          </div>
        </Card>
        <Card span={5} title="Eficiência do primeiro clear (estimativa)">
          <dl className="kv">
            <dt>Monstros aos 10 (média)</dt><dd className="num">{fmt.dec(es.jungleCs10, 1)}</dd>
            <dt>Farm total aos 5</dt><dd className="num">{fmt.dec(es.rows[0].cs, 1)} <span className="dim">({fmt.signed(es.rows[0].dCs, 1)} vs. inimigo)</span></dd>
            <dt>Nível aos 5</dt><dd className="num">{fmt.dec(es.rows[0].level, 2)} <span className="dim">({fmt.signed(es.rows[0].dLevel, 2)})</span></dd>
          </dl>
          <p className="note">A API não informa a rota do clear nem a ordem dos campos. Estes números são <b>estimativas</b> a partir dos snapshots por minuto (farm e nível aos 5 e aos 10). Nenhuma rota é inventada.</p>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function Farm({ ctx }) {
  const { games } = ctx;
  const fs = useMemo(() => E.farmStats(games), [games]);
  if (!games.length) return <NoGames ctx={ctx} />;
  const ivData = fs.cs.map((c, i) => ({ label: c.label, cs: c.mean, n: c.n, gold: fs.gold[i].mean }));
  const cei = fs.cei;
  return (
    <div className="row-gap">
      <div className="kpis">
        <div className="kpi"><div className="label">Farm total (média)</div><div className="value">{fmt.int(fs.totals.cs.mean)}</div><div className="cmp">desvio {fmt.int(fs.totals.cs.sd)}</div></div>
        <div className="kpi"><div className="label">Farm/min</div><div className="value">{fmt.dec(fs.totals.csMin.mean, 2)}</div><div className="cmp">desvio {fmt.dec(fs.totals.csMin.sd, 2)}</div></div>
        <div className="kpi"><div className="label">Monstros (média)</div><div className="value">{fmt.int(fs.totals.jungleCs.mean)}</div></div>
        <div className="kpi"><div className="label">Tropas (média)</div><div className="value">{fmt.int(fs.totals.laneCs.mean)}</div></div>
        <div className="kpi"><div className="label">Ouro total (média)</div><div className="value">{fmt.int(fs.totals.gold.mean)}</div></div>
        <div className="kpi"><div className="label">Ouro/min</div><div className="value">{fmt.int(fs.totals.goldMin.mean)}</div><div className="cmp">desvio {fmt.int(fs.totals.goldMin.sd)}</div></div>
        <div className="kpi hero">
          <div className="label">Consistência econômica <Tip text="Índice próprio deste dashboard (não é métrica da Riot). Fórmula abaixo." /></div>
          <div className="value">{cei.value == null ? "—" : fmt.int(cei.value)}<small>/100</small></div>
          <div className="cmp">{cei.value == null ? "Precisa de 5+ partidas em cada componente (inclusive à frente e atrás aos 10)." : "Quanto maior, mais estável seu farm entre partidas, ao longo da partida e quando o jogo começa mal."}</div>
        </div>
      </div>
      <div className="grid">
        <Card span={7} title="Farm por minuto em cada fase da partida" tip="Ritmo de farm (tropas + monstros) dentro de cada intervalo, pela timeline. Só entram partidas que chegaram ao fim do intervalo.">
          {fs.nTL ? <div className="chart">
            <R.ResponsiveContainer>
              <R.ComposedChart data={ivData} margin={{ top: 18, right: 8, bottom: 0, left: -14 }}>
                <R.CartesianGrid {...gridProps} />
                <R.XAxis dataKey="label" {...axisProps} interval={0} />
                <R.YAxis yAxisId="cs" {...axisProps} domain={[0, "auto"]} tickFormatter={(v) => fmt.dec(v, 1)} />
                <R.YAxis yAxisId="g" orientation="right" {...axisProps} tickFormatter={fmt.int} />
                <R.Tooltip cursor={{ fill: "#ffffff08" }} content={<ChartTip render={(pl) => { const x = pl[0].payload; return <><div>{x.label} · {x.n} partidas</div><div>Farm/min <strong>{fmt.dec(x.cs, 2)}</strong></div><div>Ouro/min {fmt.int(x.gold)}</div></>; }} />} />
                <R.Bar yAxisId="cs" dataKey="cs" fill={C.blue} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                  <R.LabelList dataKey="n" position="top" fill={C.fg3} fontSize={10.5} />
                </R.Bar>
                <R.Line yAxisId="g" dataKey="gold" stroke={C.gold} strokeWidth={2} dot={{ r: 3, fill: C.gold }} isAnimationActive={false} />
              </R.ComposedChart>
            </R.ResponsiveContainer>
          </div> : <NeedsTimeline n={games.length} what="O ritmo por fase" />}
          <p className="note">Barras azuis: farm/min. Linha dourada: ouro/min no mesmo intervalo. O número acima da barra é a quantidade de partidas.</p>
        </Card>
        <Card span={5} title="Seu farm quando o jogo vai bem e quando vai mal">
          <Table rowKey={(r) => r.label} rows={fs.groups} columns={[
            { key: "label", label: "Grupo", sortable: false },
            { key: "n", label: "Partidas", num: true, sortable: false },
            { key: "csMin", label: "Farm/min", num: true, sortable: false, render: (r) => fmt.dec(r.csMin, 2) },
            { key: "goldMin", label: "Ouro/min", num: true, sortable: false, render: (r) => fmt.int(r.goldMin) },
            { key: "jungleShare", label: "% monstros", num: true, sortable: false, render: (r) => fmt.pct(r.jungleShare) },
          ]} />
        </Card>
      </div>
      <div className="grid">
        <Card span={7} title="Curvas médias de ouro e farm" tip="Média por minuto entre as partidas com timeline que ainda estavam em andamento naquele minuto.">
          <div className="chart">
            <R.ResponsiveContainer>
              <R.LineChart data={fs.curve} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
                <R.CartesianGrid {...gridProps} />
                <R.XAxis dataKey="minute" {...axisProps} tickFormatter={(v) => `${v}′`} />
                <R.YAxis yAxisId="g" {...axisProps} tickFormatter={fmt.int} />
                <R.YAxis yAxisId="c" orientation="right" {...axisProps} />
                <R.Tooltip content={<ChartTip render={(pl) => { const x = pl[0].payload; return <><div>Minuto {x.minute} · {x.n} partidas</div><div>Ouro {fmt.int(x.gold)}</div><div>Farm {fmt.int(x.cs)}</div><div>XP {fmt.int(x.xp)}</div></>; }} />} />
                <R.Line yAxisId="g" dataKey="gold" stroke={C.gold} dot={false} strokeWidth={2} isAnimationActive={false} />
                <R.Line yAxisId="c" dataKey="cs" stroke={C.blue} dot={false} strokeWidth={2} isAnimationActive={false} />
              </R.LineChart>
            </R.ResponsiveContainer>
          </div>
        </Card>
        <Card span={5} title="Como o índice é calculado">
          <div className="formula">{`R  = 1 − CV(farm/min entre partidas)        ${cei.R == null ? "—" : fmt.dec(cei.R, 2)}  (${cei.nR} partidas)
S  = média de farm/min 15–25 ÷ 0–15        ${cei.S == null ? "—" : fmt.dec(cei.S, 2)}  (${cei.nS} partidas)
Rz = farm/min atrás aos 10 ÷ à frente      ${cei.Rz == null ? "—" : fmt.dec(cei.Rz, 2)}  (${cei.nBehind} × ${cei.nAhead})

ICE = 100 × (0,4·R + 0,3·S + 0,3·Rz)       ${cei.value == null ? "—" : fmt.dec(cei.value, 1)}`}</div>
          <p className="note">Cada componente vai de 0 a 1 (valores acima de 1 contam como 1). R mede regularidade entre partidas, S mede se o ritmo se mantém depois dos 15 minutos e Rz mede se o farm se sustenta quando você começa atrás.</p>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function Objectives({ ctx }) {
  const { games } = ctx;
  const os = useMemo(() => E.objectiveStats(games), [games]);
  if (!games.length) return <NoGames ctx={ctx} />;
  return (
    <div className="row-gap">
      {!os.nTL ? <NeedsTimeline n={games.length} what="A análise de objetivos" /> : (
        <>
          <Card title="Objetivos épicos por partida" eyebrow={`${os.nTL} partidas com timeline`} tip="Médias por partida. Participação = objetivos do seu time em que você deu o último golpe ou recebeu assistência.">
            <Table rowKey={(r) => r.type} rows={os.perType} columns={[
              { key: "label", label: "Objetivo", sortable: false },
              { key: "team", label: "Seu time / partida", num: true, render: (r) => fmt.dec(r.team, 2) },
              { key: "enemy", label: "Inimigo / partida", num: true, render: (r) => fmt.dec(r.enemy, 2) },
              { key: "participation", label: "Sua participação", num: true, render: (r) => <>{fmt.pct(r.participation)} <span className="dim">({r.nMine})</span></> },
              { key: "medianT", label: "Minuto típico", num: true, render: (r) => fmt.clock(r.medianT) },
            ]} />
            <p className="note">Atakhan e outros objetivos só aparecem nos patches em que existem.</p>
          </Card>
          <div className="grid">
            <Card span={6} title="Mortes antes de objetivos" tip="Conta suas mortes seguidas, dentro da janela, por um objetivo épico conquistado. É sequência no tempo, não prova de causa.">
              <Table rowKey={(r) => r.window} rows={os.windows} columns={[
                { key: "window", label: "Janela", sortable: false, render: (r) => `${r.window} s antes` },
                { key: "beforeEnemy", label: "Antes de objetivo do inimigo", num: true, sortable: false },
                { key: "beforeAny", label: "Antes de qualquer objetivo", num: true, sortable: false },
                { key: "perGame", label: "Por partida (inimigo)", num: true, sortable: false, render: (r) => fmt.dec(r.perGame, 2) },
              ]} />
              <dl className="kv" style={{ marginTop: 12 }}>
                <dt>Mortes durante disputa</dt><dd>{os.contested} <span className="dim">· até 30 s antes do objetivo e a menos de 2.500 unidades do covil</span></dd>
                <dt>Antes de o objetivo surgir</dt><dd className="dim">Não calculado: a API não registra o momento em que cada objetivo nasce, e os tempos mudam entre patches.</dd>
              </dl>
            </Card>
            <Card span={6} title="Associações com o resultado" tip="Win rate quando a condição acontece e quando não acontece. Associação estatística, não causalidade.">
              <Table rowKey={(r) => r.label} rows={os.assoc} columns={[
                { key: "label", label: "Condição", sortable: false, render: (r) => <span style={{ whiteSpace: "normal" }}>{r.label}</span> },
                { key: "yes", label: "Sim", sortable: false, render: (r) => <span className="num">{fmt.pct(r.yes.rate)} <span className="dim">({r.yes.n})</span></span> },
                { key: "no", label: "Não", sortable: false, render: (r) => <span className="num">{fmt.pct(r.no.rate)} <span className="dim">({r.no.n})</span></span> },
                { key: "diff", label: "Diferença", sortable: false, render: (r) => (r.diff ? <span title={`IC 95%: ${fmt.pp(r.diff.ci[0])} a ${fmt.pp(r.diff.ci[1])}`}>{fmt.pp(r.diff.diff)} {E.excludesZero(r.diff.ci) ? "" : <span className="dim">(inconclusiva)</span>}</span> : "—") },
              ]} />
              <p className="note">"Vantagem numérica antes do objetivo" exigiria a posição de todos os jogadores em cada segundo, que a API não fornece (só um snapshot por minuto). Por isso não aparece aqui.</p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
export function Deaths({ ctx }) {
  const { games, meta } = ctx;
  const ds = useMemo(() => E.deathStats(games), [games]);
  const tlGames = games.filter((g) => g.hasTL);
  const [sel, setSel] = useState(tlGames[0]?.id || "");
  const g = tlGames.find((x) => x.id === sel) || tlGames[0];
  if (!games.length) return <NoGames ctx={ctx} />;
  return (
    <div className="row-gap">
      <div className="kpis">
        <div className="kpi"><div className="label">Mortes totais</div><div className="value">{fmt.int(ds.total)}</div><div className="cmp">{ds.nAll} partidas</div></div>
        <div className="kpi"><div className="label">Mortes por partida</div><div className="value">{fmt.dec(ds.avg, 2)}</div></div>
        <div className="kpi"><div className="label">Partidas sem morrer</div><div className="value">{ds.noDeathGames}</div><div className="cmp">de {ds.nTL} com timeline</div></div>
        <div className="kpi"><div className="label">1ª morte (média)</div><div className="value">{fmt.clock(ds.firstDeath.mean)}</div></div>
        <div className="kpi"><div className="label">Morreu à frente <Tip text="Seu ouro maior que o do jungler inimigo no minuto da morte." /></div><div className="value">{ds.aheadDeaths}</div><div className="cmp">atrás: {ds.behindDeaths}</div></div>
        <div className="kpi hero">
          <div className="label">Pick-offs antes de objetivos <Tip text={E.DEATH_CATEGORIES.pick.rule} /></div>
          <div className="value">{fmt.dec(ds.critical.perGame, 2)}<small>por partida</small></div>
          <div className="cmp">{ds.critical.total} no total · {ds.critical.critTrend ? (E.excludesZero(ds.critical.critTrend.ci)
            ? (ds.critical.critTrend.diff < 0 ? <span className="good">diminuindo (metade recente vs. antiga)</span> : <span className="bad">aumentando (metade recente vs. antiga)</span>)
            : "sem mudança clara entre a metade antiga e a recente") : "precisa de 20+ partidas para tendência"}</div>
        </div>
      </div>
      {!ds.nTL ? <NeedsTimeline n={games.length} what="A análise temporal das mortes" /> : (
        <>
          <div className="grid">
            <Card span={5} title="Mortes por fase">
              <Table rowKey={(r) => r.label} rows={ds.phases} columns={[
                { key: "label", label: "Fase", sortable: false },
                { key: "total", label: "Total", num: true, sortable: false },
                { key: "perGame", label: "Por partida", num: true, sortable: false, render: (r) => fmt.dec(r.perGame, 2) },
              ]} />
            </Card>
            <Card span={7} title="Quando você morre (a cada 5 minutos)">
              <div className="chart short">
                <R.ResponsiveContainer>
                  <R.BarChart data={ds.histogram} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                    <R.CartesianGrid {...gridProps} />
                    <R.XAxis dataKey="label" {...axisProps} />
                    <R.YAxis {...axisProps} allowDecimals={false} />
                    <R.Tooltip cursor={{ fill: "#ffffff08" }} content={<ChartTip render={(pl) => <div>{pl[0].payload.label} min: <strong>{pl[0].value}</strong> mortes</div>} />} />
                    <R.Bar dataKey="deaths" fill={C.red} fillOpacity={0.85} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  </R.BarChart>
                </R.ResponsiveContainer>
              </div>
            </Card>
          </div>
          <ObjectiveDeaths ctx={ctx} />
          <Card title="Pick-offs antes de objetivos ao longo do tempo" tip="Pontos: pick-offs antes de objetivos em cada partida. Linha: média móvel de 10 partidas.">
            <div className="chart short">
              <R.ResponsiveContainer>
                <R.ComposedChart data={ds.critical.trend} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <R.CartesianGrid {...gridProps} />
                  <R.XAxis dataKey="idx" {...axisProps} />
                  <R.YAxis {...axisProps} allowDecimals={false} />
                  <R.Tooltip content={<ChartTip render={(pl) => { const x = pl[0].payload; return <><div className="muted">{fmt.date(x.start)}</div><div>{x.value} pick-off(s) antes de objetivo</div><div>Média móvel {fmt.dec(x.roll, 2)}</div></>; }} />} />
                  <R.Scatter dataKey="value" isAnimationActive={false} shape={(p) => <circle cx={p.cx} cy={p.cy} r={2.5} fill={C.fg3} />} />
                  <R.Line dataKey="roll" stroke={C.red} dot={false} strokeWidth={2} isAnimationActive={false} />
                </R.ComposedChart>
              </R.ResponsiveContainer>
            </div>
          </Card>
          {g && <Card title="Linha do tempo de uma partida" right={
            <label className="field"><span>Partida</span>
              <select id="dt-match" value={g.id} onChange={(e) => setSel(e.target.value)}>
                {tlGames.slice(0, 80).map((x) => <option key={x.id} value={x.id}>{fmt.date(x.start)} · {x.win ? "V" : "D"} · vs {E.champDisplay(meta, x.oppChamp, x.oppChampId)} · {x.k}/{x.d}/{x.a}</option>)}
              </select></label>}>
            <EventTimeline key={g.id} g={g} meta={meta} />
          </Card>}
        </>
      )}
    </div>
  );
}

function ObjectiveDeaths({ ctx }) {
  const { games, meta } = ctx;
  const od = useMemo(() => E.objectiveDeathStats(games), [games]);
  const [cat, setCat] = useState("pick");
  const row = od.rows.find((r) => r.key === cat);
  const list = row ? [...row.list].sort((a, b) => b.g.start - a.g.start) : [];
  if (!od.nGames) return null;
  return (
    <Card title="Mortes antes de objetivos, por tipo" eyebrow={`${od.beforeObjective} das suas ${od.totalDeaths} mortes vieram antes de um objetivo épico (até 90 s) · ${od.nGames} partidas`}
      tip="Cada morte seguida de um objetivo épico é classificada pelos eventos da partida: quem morreu na mesma luta (até 3.000 unidades e 20 s), se você caiu primeiro, a distância até o fosso, quanto tempo antes do objetivo e quem o pegou. Passe o mouse no nome de cada tipo para ver a regra.">
      <Table rowKey={(r) => r.key} rows={od.rows} selectedKey={cat} onRowClick={(r) => setCat(r.key)} columns={[
        { key: "label", label: "Tipo", sortable: false, render: (r) => <span title={r.rule} style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><span className={`dot ${r.tone === "bad" ? "" : r.tone === "good" ? "ok" : "warn"}`} style={r.tone === "bad" ? { background: "var(--red)" } : undefined} />{r.label}{r.actionable ? <span className="chip static" style={{ fontSize: "0.7rem", padding: "0 7px" }}>mais controlável</span> : null}</span> },
        { key: "n", label: "Mortes", num: true, sortable: false },
        { key: "perGame", label: "Por partida", num: true, sortable: false, render: (r) => fmt.dec(r.perGame, 2) },
        { key: "share", label: "% das mortes antes de objetivo", num: true, sortable: false, render: (r) => fmt.pct(r.share) },
        { key: "state", label: "À frente / equil. / atrás", num: true, sortable: false, tip: "Ouro do seu time no momento da morte: à frente (+1.500), equilibrado ou atrás (−1.500).", render: (r) => r.byState.join(" / ") },
        { key: "wr", label: "Win rate com × sem", sortable: false, tip: "Win rate das partidas com pelo menos uma morte desse tipo contra as partidas sem. Associação: partidas ruins também geram mais mortes.", render: (r) => <span className="num">{fmt.pct(r.wrWith.rate)} <span className="dim">({r.wrWith.n})</span> × {fmt.pct(r.wrWithout.rate)} <span className="dim">({r.wrWithout.n})</span></span> },
      ]} />
      <p className="note"><b>{row?.label}:</b> {row?.rule} Clique em outro tipo para trocar a lista. Os tipos marcados como mais controláveis são os que dependem mais da sua decisão; lutas, trocas e tentativas com o jogo perdido dependem muito do time e da composição.</p>
      <div className="eyebrow" style={{ margin: "14px 0 6px" }}>Para validar: {list.length} morte(s) do tipo {row?.short?.toLowerCase()}, mais recentes primeiro</div>
      <Table rowKey={(r) => r.g.id + r.t} rows={list} pageSize={10} onRowClick={(r) => ctx.openMatch(r.g.id, r.t)} rowClass={(r) => (r.g.win ? "win" : "loss")} columns={[
        { key: "date", label: "Partida", sortValue: (r) => r.g.start, render: (r) => <span className="namecell"><ChampIcon meta={meta} id={r.g.oppChampId} keyName={r.g.oppChamp} size={20} /><span>{fmt.date(r.g.start)} · vs {E.champDisplay(meta, r.g.oppChamp, r.g.oppChampId)} · <span className={r.g.win ? "good" : "bad"}>{r.g.win ? "V" : "D"}</span></span></span> },
        { key: "t", label: "Morte", num: true, render: (r) => fmt.clock(r.t) },
        { key: "obj", label: "Objetivo", sortable: false, render: (r) => `${r.objectiveLabel} (${r.objective.mine ? "seu time" : "inimigo"})` },
        { key: "gap", label: "Antes do objetivo", num: true, render: (r) => `${Math.round(r.gap)} s` },
        { key: "fight", label: "Luta (seu time × inimigo)", num: true, sortable: false, render: (r) => `${r.allyDeaths} × ${r.enemyDeaths}${r.firstDeath ? " · caiu 1º" : ""}` },
        { key: "enemiesOnMe", label: "Inimigos na morte", num: true },
        { key: "dist", label: "Distância do fosso", num: true, render: (r) => (r.dist == null ? "—" : fmt.int(r.dist)) },
        { key: "gold", label: "Ouro do time", num: true, render: (r) => <span className={r.gold >= 0 ? "good" : "bad"}>{fmt.signed(r.gold)}</span> },
      ]} />
      <p className="note">Clique numa linha para abrir a partida já com essa morte selecionada. Se uma morte estiver classificada errado, marque a partida em Histórico (ex.: "Revisar") e anote o motivo.</p>
    </Card>
  );
}

const DETAIL_KINDS = new Set(["start", "ward", "clear", "recall", "trinket"]);
const TURN_END = { recall: "recall", morte: "morte", fim: "fim" };
const FOUNTAIN_XY = { 100: { x: 560, y: 560 }, 200: { x: 14250, y: 14300 } };

// Linha do tempo da partida, analisada por turnos: cada turno vai da saída da base (ou do
// renascimento) até o recall ou a morte.
export function EventTimeline({ g, meta, focusT, startFirst = false }) {
  const V = E.voiceOf(g);
  const events = useMemo(() => E.gameEvents(g, meta).map((e, i) => ({ ...e, key: i })), [g, meta]);
  const turns = useMemo(() => TU.gameTurns(g, meta), [g, meta]);
  const deathType = useMemo(() => new Map(E.classifyObjectiveDeaths(g).map((x) => [x.t, x])), [g]);
  // turno de um instante: o último que começou antes dele (o tempo morto depois de uma morte fica com o turno da morte)
  const turnOf = (t) => { let idx = 0; for (let i = 0; i < turns.length; i++) if (turns[i].start - 0.5 <= t) idx = i; return idx; };
  const first = useMemo(() => {
    if (focusT != null) { const i = turns.findIndex((u) => u.kind === "morte" && Math.abs(u.end - focusT) <= 5); if (i >= 0) return i; return turnOf(focusT); }
    if (startFirst) return 0;
    const d = turns.findIndex((u) => u.kind === "morte");
    return d >= 0 ? d : 0;
  }, [turns]); // eslint-disable-line
  const [sel, setSel] = useState(first);
  const [active, setActive] = useState(null);
  const dur = g.duration || 1;
  const T = turns[Math.min(sel, turns.length - 1)] || null;
  const lanes = { kill: 18, assist: 18, "jg-enemy": 26, death: 34, start: 44, ward: 44, clear: 44, recall: 44, trinket: 44, "obj-ally": 52, "obj-enemy": 52, item: 8, "bld-ally": 62, "bld-enemy": 62 };
  const inTurn = (e) => T && e.t >= T.start - 0.5 && e.t <= T.end + 0.5;
  // o "Primeiro recall" já aparece como o fim do turno
  const after = T ? events.filter((e) => inTurn(e) && !(e.kind === "recall" && T.kind === "recall" && Math.abs(e.t - T.end) < 3)) : [];
  const soon = T && T.kind === "morte" ? events.filter((e) => e.t > T.end + 0.5 && e.t <= T.end + 45 && (e.kind === "obj-enemy" || e.kind === "obj-ally" || e.kind === "bld-enemy")) : [];
  let n = 0;
  const mapItems = after.map((e) => ({ ...e, n: e.x != null && e.y != null && e.kind !== "item" ? ++n : null }));
  if (T && T.kind === "recall") { const b = FOUNTAIN_XY[g.raw.me.teamId]; mapItems.push({ key: "recall-end", kind: "recall-end", t: T.end, x: b.x, y: b.y, n: ++n, text: `Recall: chegou na base${T.recall?.spent != null ? ` e gastou ${fmt.int(T.recall.spent)} de ouro` : ""}` }); }
  const numOf = new Map(mapItems.map((e) => [e.key, e.n]));
  const inWindow = new Set(after.map((e) => e.key));
  const pick = (i) => { setSel(i); setActive(null); };
  const pickT = (t) => pick(turnOf(t));
  const info = T && T.kind === "morte" ? deathType.get(T.end) || [...deathType.values()].find((x) => Math.abs(x.t - T.end) < 2) : null;
  const tone = T?.reading.tone || "neutral";
  return (
    <div className="row-gap" style={{ gap: 10 }}>
      <div className="strip" role="group" aria-label="Linha do tempo de eventos">
        {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45].filter((m) => m * 60 <= dur).map((m) => <span key={m} className="tk" style={{ left: `${(m * 60 / dur) * 100}%` }}>{m}′</span>)}
        <div className="turn-bands" aria-hidden="true">{turns.map((u, i) => (
          <i key={i} className={`${u.reading.tone} ${i === sel ? "on" : ""}`} style={{ left: `${(u.start / dur) * 100}%`, width: `${Math.max(0.4, ((u.end - u.start) / dur) * 100)}%` }} onClick={() => pick(i)} title={`Turno ${u.i} · ${TU.turnLabel(u)}`} />
        ))}</div>
        {events.map((e, i) => (
          <button key={i} className={`ev ${e.kind} ${inTurn(e) ? "inturn" : ""}`} title={`${fmt.clock(e.t)} · ${e.text}`} aria-label={`${fmt.clock(e.t)} ${e.text}`}
            style={{ left: `${(e.t / dur) * 100}%`, top: lanes[e.kind] }} onClick={() => pickT(e.t)} />
        ))}
      </div>
      <div className="legend">
        <span><i style={{ background: C.green }} />{V.myKill}</span><span><i style={{ background: "#86efac" }} />Assistência</span><span><i style={{ background: C.red }} />{V.myDeath}</span>{g.raw.opp && <span><i style={{ background: C.violet }} />Abate do jungler inimigo</span>}
        <span><i style={{ background: C.blue, borderRadius: 2 }} />Objetivo do {V.team}</span><span><i style={{ background: C.amber, borderRadius: 2 }} />Objetivo inimigo</span><span><i style={{ background: C.gold, borderRadius: 1 }} />Item completo</span><span><i style={{ background: C.fg3 }} />Torre/inibidor</span>
        <span><i className="lg-turn" />Turnos (verde: produtivo · vermelho: caro)</span>
      </div>
      {T ? <>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Escolha o turno <Tip text="Um turno vai do início da partida, da saída da base ou do renascimento até o recall ou a morte. A Riot registra a posição uma vez por minuto e as compras na hora exata: o recall é a primeira compra na base, e a saída é a última compra daquela ida." /></div>
          <div className="turn-chips">{turns.map((u, i) => (
            <button key={i} type="button" className={`turn-chip ${u.reading.tone} ${u.kind}`} aria-pressed={i === sel} onClick={() => pick(i)}>
              <b>Turno {u.i}</b><span>{TU.turnLabel(u)}</span><em>{u.kind === "morte" ? "✕ morte" : u.kind === "recall" ? "↩ recall" : "fim"}</em>
            </button>
          ))}</div>
        </div>
        <div className="split ev-split">
          <div>
            <div className={`turn-card ${tone}`}>
              <div className="turn-card-h">
                <div><span className="eyebrow">Turno {T.i} · {TU.turnLabel(T)} · {fmt.clock(T.dur)} de duração</span><b className="turn-lead">{T.reading.lead}</b></div>
                <span className={`turn-pill ${T.kind}`}>{T.kind === "morte" ? `${V.myDeath}` : T.kind === "recall" ? "Recall" : "Fim da partida"}</span>
              </div>
              <div className="turn-stats">
                <div><span className="k">Campos</span><b>{T.camps != null ? fmt.dec(T.camps, 1) : "—"}</b><small>{T.cs ? `+ ${Math.round(T.cs)} de farm em lane` : "da selva"}</small></div>
                <div><span className="k">Ouro no turno</span><b>{T.gold != null ? `+${fmt.int(T.gold)}` : "—"}</b><small>{T.dur > 30 && T.gold != null ? `${fmt.int(T.gold / (T.dur / 60))} por minuto` : ""}</small></div>
                <div><span className="k">Sobre o jungler inimigo</span><b className={T.gvj == null ? "" : T.gvj >= 0 ? "good" : "bad"}>{T.gvj != null ? fmt.signed(T.gvj) : "—"}</b><small>diferença de ouro no turno</small></div>
                <div><span className="k">Abates / assist.</span><b>{T.kills} / {T.assists}</b><small>nível {T.level[0] ?? "?"} → {T.level[1] ?? "?"}</small></div>
              </div>
              {(T.objMine.length > 0 || T.objEnemy.length > 0 || T.towers > 0) && <div className="turn-objs">
                {T.objMine.map((o, i) => <span key={"m" + i} className="good">{E.OBJECTIVE_LABELS[E.objectiveType(o)] || o.type}{o.me ? ` (com ${V.s})` : ""}</span>)}
                {T.towers > 0 && <span className="good">{T.towers} torre{T.towers > 1 ? "s" : ""}</span>}
                {T.objEnemy.map((o, i) => <span key={"e" + i} className="bad">{E.OBJECTIVE_LABELS[E.objectiveType(o)] || o.type} do inimigo</span>)}
              </div>}
              <p className="turn-where">Passou por: <b>{T.zones.length ? T.zones.join(", ") : "—"}</b>{T.lanes.length ? <> · jogou nas lanes: <b>{T.lanes.join(", ")}</b></> : null}</p>
              <div className={`turn-end ${T.kind}`}>
                {T.kind === "morte" && T.death && <>
                  {T.death.killer && <ChampIcon meta={meta} id={T.death.killer.champId} keyName={T.death.killer.champ} size={30} />}
                  <span>{T.reading.endTxt}{info ? <span className="dim"> Classificação: {E.DEATH_CATEGORIES[info.cat].label.toLowerCase()}.</span> : null}</span>
                </>}
                {T.kind === "recall" && T.recall && <>
                  <span>{T.reading.endTxt}</span>
                  {T.recall.bought.length > 0 && <span className="iconrow">{T.recall.bought.slice(0, 6).map((id) => <ItemIcon key={id} meta={meta} id={id} size={24} />)}</span>}
                </>}
                {T.kind === "fim" && <span>{T.reading.endTxt}</span>}
              </div>
            </div>
            <div className="eyebrow" style={{ margin: "12px 0 6px" }}>O que aconteceu no turno</div>
            <div className="evlist numbered">{after.map((e) => (
              <div key={e.key} className={`${e.kind === "death" ? "hl" : ""} ${DETAIL_KINDS.has(e.kind) ? "detail" : ""} ${e.key === active ? "on" : ""}`}
                onMouseEnter={() => setActive(e.key)} onMouseLeave={() => setActive(null)}>
                <span className="t">{fmt.clock(e.t)}</span>
                <span className={`evn ${e.kind}`}>{numOf.get(e.key) ?? ""}</span>
                <span>{e.text}{e.approx && numOf.get(e.key) ? <span className="dim"> · local aproximado</span> : null}</span>
              </div>
            ))}
            {T.kind === "recall" && <div className="detail"><span className="t">{fmt.clock(T.end)}</span><span className="evn recall-end">{numOf.get("recall-end")}</span><span>{T.recall?.seen ? "Voltou à base" : `Recall${T.recall?.spent != null ? `: gastou ${fmt.int(T.recall.spent)} de ouro` : ""}`}</span></div>}
            {!after.length && T.kind !== "recall" && <p className="muted">Nenhum evento registrado neste turno.</p>}
            </div>
            {soon.length > 0 && <>
              <div className="eyebrow" style={{ margin: "10px 0 4px" }}>Logo depois da morte</div>
              <div className="evlist">{soon.map((e) => <div key={e.key}><span className="t">{fmt.clock(e.t)}</span><span>{e.text}</span></div>)}</div>
            </>}
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>No mapa · turno {T.i} · {TU.turnLabel(T)}</div>
            <EventMap items={mapItems} meta={meta} active={active} onActive={setActive} focusT={T.kind === "morte" ? T.end : null} path={T.path}
              labels={{ death: V.myDeath, kill: V.myKill, "obj-ally": `Objetivo do ${V.team}`, "bld-ally": `Estrutura destruída pelo ${V.team}`, "recall-end": "Recall (base)" }} />
            <p className="note" style={{ margin: "6px 0 0" }}>Linha tracejada: a rota do turno pelos registros de minuto (número = minuto). Entre dois registros o caminho é uma linha reta, não o trajeto real.</p>
          </div>
        </div>
      </> : <p className="muted">Sem timeline suficiente para separar os turnos desta partida.</p>}
      <div className="ev-all">
        <div className="eyebrow" style={{ marginBottom: 6 }}>Todos os eventos <span className="dim" style={{ textTransform: "none", letterSpacing: 0 }}>· clique num evento para abrir o turno dele</span></div>
        <div className="evlist cols">{events.map((e) => (
          <div key={e.key} className={`${e.kind === "death" ? "hl" : ""} ${DETAIL_KINDS.has(e.kind) ? "detail" : ""} ${inWindow.has(e.key) ? "inwin" : ""} click`}
            role="button" tabIndex={0} onClick={() => pickT(e.t)} onKeyDown={(k) => { if (k.key === "Enter" || k.key === " ") { k.preventDefault(); pickT(e.t); } }}>
            <span className="t">{fmt.clock(e.t)}</span><span>{e.text}</span>
          </div>
        ))}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
const ORDERS = {
  n: { label: "Mais partidas", sort: { key: "n", dir: "desc" } },
  losses: { label: "Mais derrotas", sort: { key: "losses", dir: "desc" } },
  wins: { label: "Mais vitórias", sort: { key: "wins", dir: "desc" } },
  worst: { label: "Pior win rate", sort: { key: "rate", dir: "asc" } },
  best: { label: "Melhor win rate", sort: { key: "rate", dir: "desc" } },
};
const CLS_KEYS = ["fighter", "slayer", "tank", "mage", "marksman", "controller", "specialist"];

// Filtro por classe e subclasse (chips de classe + seletor de subclasse)
function ClassFilter({ rows, getCls, fCls, setFCls, fSub, setFSub, extra }) {
  const present = CLS_KEYS.map((c) => [c, rows.filter((r) => getCls(r)?.cls === c).length]).filter(([, n]) => n);
  const subs = Object.entries(SUBCLASSES).filter(([k, sc]) => (fCls === "all" || sc.cls === fCls) && rows.some((r) => getCls(r)?.sub === k || (getCls(r)?.all || []).includes(k)));
  return (
    <div className="mu-filters">
      <div className="chips">
        <button className="chip" aria-pressed={fCls === "all"} onClick={() => { setFCls("all"); setFSub("all"); }}>Todas as classes</button>
        {present.map(([c, n]) => (
          <button key={c} className="chip" aria-pressed={fCls === c} onClick={() => { setFCls(fCls === c ? "all" : c); setFSub("all"); }}>
            <ClassGlyph cls={c} size={14} />{CLASSES[c].label}<small>{n}</small>
          </button>
        ))}
      </div>
      <div className="inline-form">
        <label className="field"><span>Subclasse</span>
          <select value={fSub} onChange={(e) => setFSub(e.target.value)}>
            <option value="all">Todas</option>
            {subs.map(([k, sc]) => <option key={k} value={k}>{sc.label} ({CLASSES[sc.cls].label})</option>)}
          </select>
        </label>
        {extra}
      </div>
    </div>
  );
}

export function Matchups({ ctx }) {
  const { games, meta } = ctx;
  const rows = useMemo(() => E.matchupStats(games), [games]);
  const [sel, setSel] = useState(null);
  const [fCls, setFCls] = useState("all");
  const [fSub, setFSub] = useState("all");
  const [order, setOrder] = useState("n");
  const [guideCls, setGuideCls] = useState("fighter");
  const tableRef = useRef(null), guideRef = useRef(null);
  const rowsC = useMemo(() => rows.map((r) => ({ ...r, c: classOf(meta, r.champ, r.champId, "JUNGLE") })), [rows, meta]);
  const shown = rowsC.filter((r) => (fCls === "all" || r.c?.cls === fCls) && (fSub === "all" || r.c?.sub === fSub));
  const sumShown = shown.reduce((a, r) => ({ n: a.n + r.n, w: a.w + r.wins }), { n: 0, w: 0 });
  const scrollTo = (ref) => setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  const showInTable = (sub, cls) => { setFCls(cls || "all"); setFSub(sub || "all"); setOrder("losses"); setSel(null); scrollTo(tableRef); };
  const showChamp = (champ) => { setFCls("all"); setFSub("all"); setSel(champ); scrollTo(tableRef); };
  const classes = useMemo(() => {
    // Classes da wiki oficial (subclasse do jungler inimigo)
    const m = new Map();
    for (const g of games) { const c = g.oppChamp ? classOf(meta, g.oppChamp, g.oppChampId, "JUNGLE") : null; if (!c) continue; if (!m.has(c.sub)) m.set(c.sub, []); m.get(c.sub).push(g); }
    return [...m].map(([sub, gs]) => ({ cls: sub, label: SUBCLASSES[sub].label, group: CLASSES[SUBCLASSES[sub].cls].label, ...E.rowStats(gs) })).sort((a, b) => b.n - a.n);
  }, [games, meta]);
  const selected = sel && rows.find((r) => r.champ === sel) ? sel : null;
  const detail = useMemo(() => (selected ? E.matchupDetail(games, selected, meta) : null), [games, selected, meta]);
  if (!games.length) return <NoGames ctx={ctx} />;
  const filtLabel = fSub !== "all" ? SUBCLASSES[fSub].label : fCls !== "all" ? CLASSES[fCls].label : null;
  return (
    <div className="row-gap">
      <MatchupHero ctx={ctx} onShow={showInTable} />
      <MatchupGames ctx={ctx} />
      <ClassCycle ctx={ctx} sel={guideCls} onPick={setGuideCls} />
      <ClassMenu ctx={ctx} sel={guideCls} setSel={setGuideCls} onShow={showInTable} anchorRef={guideRef} />
      <div ref={tableRef} className="scroll-anchor" />
      <Card title="Contra cada jungler" tip="Clique numa linha para ver o detalhe do confronto. Diferenças aos 10 vêm da timeline (n10 = partidas com timeline). Use os filtros para ver só uma classe ou subclasse e ordenar por derrotas.">
        <ClassFilter rows={rowsC} getCls={(r) => r.c} fCls={fCls} setFCls={setFCls} fSub={fSub} setFSub={setFSub}
          extra={<label className="field"><span>Ordenar por</span>
            <select value={order} onChange={(e) => setOrder(e.target.value)}>{Object.entries(ORDERS).map(([k, o]) => <option key={k} value={k}>{o.label}</option>)}</select>
          </label>} />
        {filtLabel && <p className="mu-sum"><span>Contra <b>{filtLabel}</b>: {shown.length} campeões · {sumShown.n} partidas ·</span> <b className={sumShown.w / Math.max(1, sumShown.n) >= 0.5 ? "good" : "bad"}>{sumShown.w}V {sumShown.n - sumShown.w}D ({fmt.pct(sumShown.w / Math.max(1, sumShown.n))})</b>
          <button type="button" className="btn sm ghost" onClick={() => { setFCls("all"); setFSub("all"); }}>Limpar filtro</button></p>}
        <Table key={order + fCls + fSub} rowKey={(r) => r.champ} rows={shown} initialSort={ORDERS[order].sort} onRowClick={(r) => setSel(r.champ === selected ? null : r.champ)} selectedKey={selected} pageSize={15} columns={[
          { key: "champ", label: "Jungler inimigo", sortValue: (r) => E.champDisplay(meta, r.champ, r.champId), render: (r) => <ChampName meta={meta} keyName={r.champ} id={r.champId} /> },
          { key: "cls", label: "Classe", sortValue: (r) => r.c?.label || "", render: (r) => (r.c ? <span className="mu-clscell" title={r.c.clsLabel}><ClassGlyph cls={r.c.cls} size={13} />{r.c.label}</span> : "—") },
          { key: "tier", label: "Guia Briar", sortValue: (r) => "S+SABCDF".indexOf(briarTier(r.champ, E.champDisplay(meta, r.champ, r.champId)) || "Z"), render: (r) => { const t = briarTier(r.champ, E.champDisplay(meta, r.champ, r.champId)); return t ? <span className={`tier-chip t${t.replace("+", "p")}`} title={`Guia de matchups de Briar do L0ganJG: ${TIER_LABEL[t]}`}>{t}</span> : <span className="dim">—</span>; } },
          { key: "n", label: "Partidas", num: true, render: (r) => <Sample n={r.n} /> },
          { key: "wins", label: "V", num: true }, { key: "losses", label: "D", num: true },
          { key: "rate", label: "Win rate", render: (r) => <WRBar rate={r.rate} ci={r.ci} n={r.n} /> },
          { key: "kda", label: "KDA", num: true, render: (r) => fmt.dec(r.kda, 2) },
          { key: "csMin", label: "Farm/min", num: true, render: (r) => fmt.dec(r.csMin, 2) },
          { key: "gold10", label: "Δ ouro 10", num: true, render: (r) => <span className={r.gold10 >= 0 ? "good" : "bad"}>{fmt.signed(r.gold10)}</span> },
          { key: "xp10", label: "Δ XP 10", num: true, render: (r) => fmt.signed(r.xp10) },
          { key: "level10", label: "Δ nível 10", num: true, render: (r) => fmt.signed(r.level10, 2) },
          { key: "n10", label: "n10", num: true },
        ]} />
      </Card>
      {detail && (
        <Card title={<span className="namecell"><ChampIcon meta={meta} id={detail.games[0]?.champId} keyName={detail.games[0]?.champ} size={28} /> vs <ChampIcon meta={meta} id={detail.games[0]?.oppChampId} keyName={selected} size={28} /><span>{E.champDisplay(meta, detail.games[0]?.champ)} vs {E.champDisplay(meta, selected, detail.games[0]?.oppChampId)}</span></span>}
          right={<><Sample n={detail.summary.n} /><button className="btn sm" onClick={() => ctx.setFilters({ oppJungler: selected })}>Aplicar como filtro global</button></>}>
          <div className="grid">
            <div className="span-7">
              <div className="eyebrow">Diferença média para o jungler inimigo, minuto a minuto</div>
              {detail.curve.length ? <div className="chart">
                <R.ResponsiveContainer>
                  <R.LineChart data={detail.curve} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
                    <R.CartesianGrid {...gridProps} />
                    <R.XAxis dataKey="minute" {...axisProps} tickFormatter={(v) => `${v}′`} />
                    <R.YAxis {...axisProps} tickFormatter={fmt.int} />
                    <R.ReferenceLine y={0} stroke={C.line2} />
                    <R.Tooltip content={<ChartTip render={(pl) => { const x = pl[0].payload; return <><div>Minuto {x.minute} · {x.n} partidas</div><div>Ouro {fmt.signed(x.gold)}</div><div>XP {fmt.signed(x.xp)}</div></>; }} />} />
                    <R.Line dataKey="gold" name="Ouro" stroke={C.gold} strokeWidth={2} dot={false} isAnimationActive={false} />
                    <R.Line dataKey="xp" name="XP" stroke={C.blue} strokeWidth={2} dot={false} isAnimationActive={false} />
                  </R.LineChart>
                </R.ResponsiveContainer>
              </div> : <p className="muted">Sem timeline suficiente (precisa de 2+ partidas com timeline).</p>}
              <p className="note">{detail.losingFrom ? <>Em média, a partir do minuto <b>{detail.losingFrom}</b> você fica atrás em ouro e não recupera até o minuto 25.</> : "Não há um ponto em que você fique atrás em ouro de forma contínua até os 25 minutos."} Linha dourada: ouro. Linha azul: experiência.</p>
            </div>
            <div className="span-5 row-gap" style={{ alignContent: "start" }}>
              <dl className="kv">
                <dt>Win rate</dt><dd>{fmt.pct(detail.summary.rate, 1)} <span className="dim">({detail.summary.wins}V {detail.summary.losses}D)</span></dd>
                <dt>KDA</dt><dd>{fmt.dec(detail.summary.kda?.value, 2)}</dd>
                <dt>Farm/min</dt><dd>{fmt.dec(detail.summary.csMin, 2)}</dd>
              </dl>
              <div className="eyebrow">Builds usadas (itens completos finais)</div>
              <Table rowKey={(r) => r.key} rows={detail.builds.slice(0, 6)} columns={[
                { key: "items", label: "Build", sortable: false, render: (r) => (r.items.length ? <ItemRow meta={meta} ids={r.items} size={22} /> : <span className="dim">sem itens completos</span>) },
                { key: "n", label: "n", num: true, sortable: false },
                { key: "rate", label: "WR", num: true, sortable: false, render: (r) => fmt.pct(r.rate) },
              ]} />
              <div className="eyebrow">Runas-chave</div>
              <Table rowKey={(r) => r.id} rows={detail.runes} columns={[
                { key: "name", label: "Runa", sortable: false, render: (r) => <span className="namecell"><RuneIcon meta={meta} id={r.id} size={20} /><span>{r.name}</span></span> },
                { key: "n", label: "n", num: true, sortable: false },
                { key: "rate", label: "WR", num: true, sortable: false, render: (r) => fmt.pct(r.rate) },
              ]} />
            </div>
          </div>
        </Card>
      )}
      <div className="grid">
        <Card span={7} title="Por classe do jungler inimigo" tip="Classe e subclasse da wiki oficial do League of Legends (Champion classes), traduzidas. Quando o campeão tem duas subclasses, vale a mais natural para a selva. Clique numa linha para ver as partidas dessa subclasse na tabela de cima.">
          <Table rowKey={(r) => r.cls} rows={classes} initialSort={{ key: "n", dir: "desc" }} onRowClick={(r) => showInTable(r.cls, SUBCLASSES[r.cls].cls)} columns={[
            { key: "label", label: "Subclasse", sortValue: (r) => r.label, render: (r) => <span>{r.label} <span className="dim">· {r.group}</span></span> },
            ...statColumns({ withDur: false, withDmg: false }),
          ]} />
        </Card>
        <JunglerSpotlight ctx={ctx} rows={rows} onShowChamp={showChamp} />
      </div>
      <ChampClassTable ctx={ctx} />
    </div>
  );
}

// Tabela de referência: classe, subclasse e atributos de cada campeão, e a sua win rate contra ele.
function ChampClassTable({ ctx }) {
  const { meta, games } = ctx;
  const [q, setQ] = useState("");
  const [fCls, setFCls] = useState("all");
  const [fSub, setFSub] = useState("all");
  const [faced, setFaced] = useState(false);
  const vs = useMemo(() => { const m = {}; for (const g of games) if (g.oppChamp) { (m[g.oppChamp] ||= { n: 0, w: 0 }); m[g.oppChamp].n++; if (g.win) m[g.oppChamp].w++; } return m; }, [games]);
  // Só os campeões de verdade (o Data Dragon também traz variantes de outros modos, como "Jade_Ahri")
  const rows = useMemo(() => Object.entries(meta.champions || {}).filter(([id, c]) => Number(id) < 10000 && !String(c.key || "").includes("_")).map(([id, c]) => {
    const subs = subclassesOf(c.key, c.name) || [];
    const cl = classOf(meta, c.key, id, null);
    const st = champStats(meta, id);
    const v = vs[c.key];
    return { id, key: c.key, name: c.name, c: cl ? { ...cl, all: subs.length ? subs : [cl.sub] } : null, cls: cl ? cl.clsLabel : "—", subs: subs.map((x) => SUBCLASSES[x].label).join(" / ") || (cl ? `${cl.label} (aprox.)` : "—"), ...st, n: v?.n || 0, rate: v ? v.w / v.n : null };
  }).filter((r, i, a) => a.findIndex((x) => x.key === r.key) === i), [meta, vs]);
  const qq = q.trim().toLowerCase();
  // Campeões com duas subclasses aparecem nas duas (ex.: Diana é Mergulhadora e Assassina)
  const inCls = (r) => fCls === "all" || (r.c?.all || []).some((x) => SUBCLASSES[x]?.cls === fCls);
  const inSub = (r) => fSub === "all" || (r.c?.all || []).includes(fSub);
  const list = rows.filter((r) => (!qq || r.name.toLowerCase().includes(qq) || r.subs.toLowerCase().includes(qq) || r.cls.toLowerCase().includes(qq)) && inCls(r) && inSub(r) && (!faced || r.n > 0));
  const hasStats = rows.some((r) => r.hp1 != null);
  // No Data Dragon atual o dano de ataque não cresce por nível (o crescimento veio zerado para todos)
  const adGrows = rows.some((r) => r.ad18 != null && r.ad1 != null && r.ad18 - r.ad1 > 0.5);
  const n0 = (v) => (v == null ? "—" : fmt.int(v));
  return (
    <Card title="Classes dos campeões" eyebrow={`${rows.length} campeões · classe, subclasse e atributos`} tip="Classes e subclasses da wiki oficial do League of Legends (Champion classes), traduzidas: Controlador (Encantador, Agarrador), Lutador (Colosso, Mergulhador), Mago (Explosivo, Mago de batalha, Artilharia), Atirador, Matador (Assassino, Duelista), Tanque (Vanguarda, Guardião) e Especialista. Atributos do Data Dragon da Riot, no nível 1 e no 18. Na versão atual do Data Dragon, o dano de ataque vem sem crescimento por nível, então a tabela mostra só o valor base.">
      <ClassFilter rows={rows} getCls={(r) => r.c} fCls={fCls} setFCls={setFCls} fSub={fSub} setFSub={setFSub}
        extra={<>
          <label className="field"><span>Buscar</span><input type="search" placeholder="Campeão ou classe" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar campeão ou classe" style={{ minWidth: 200 }} /></label>
          <label className="check"><input type="checkbox" checked={faced} onChange={(e) => setFaced(e.target.checked)} /> Só os que já enfrentei na selva</label>
        </>} />
      <p className="mu-sum">{list.length} de {rows.length} campeões{faced ? " · só os que já enfrentei" : ""}{!hasStats ? " · os atributos por nível chegam com o coletor 2.3" : ""}</p>
      <Table key={fCls + fSub + (faced ? 1 : 0)} rowKey={(r) => r.key} rows={list} initialSort={faced ? { key: "n", dir: "desc" } : { key: "name", dir: "asc" }} pageSize={20} columns={[
        { key: "name", label: "Campeão", sortValue: (r) => r.name, render: (r) => <ChampName meta={meta} keyName={r.key} id={r.id} /> },
        { key: "cls", label: "Classe", render: (r) => (r.c ? <span className="mu-clscell"><ClassGlyph cls={r.c.cls} size={13} />{r.cls}</span> : r.cls) }, { key: "subs", label: "Subclasse" },
        ...(hasStats ? [
          { key: "hp1", label: "Vida 1 → 18", num: true, render: (r) => `${n0(r.hp1)} → ${n0(r.hp18)}` },
          adGrows ? { key: "ad1", label: "Dano de ataque 1 → 18", num: true, render: (r) => `${n0(r.ad1)} → ${n0(r.ad18)}` } : { key: "ad1", label: "Dano de ataque", num: true, render: (r) => n0(r.ad1) },
          { key: "ar1", label: "Armadura 1 → 18", num: true, render: (r) => `${n0(r.ar1)} → ${n0(r.ar18)}` },
          { key: "mr1", label: "Resist. mágica 1 → 18", num: true, render: (r) => `${n0(r.mr1)} → ${n0(r.mr18)}` },
          { key: "range", label: "Alcance", num: true, render: (r) => n0(r.range) },
          { key: "ms", label: "Velocidade", num: true, render: (r) => n0(r.ms) },
        ] : []),
        { key: "n", label: "Contra você", num: true, render: (r) => (r.n ? <span>{r.n} · <span className={r.rate >= 0.5 ? "good" : "bad"}>{fmt.pct(r.rate)}</span></span> : <span className="dim">—</span>) },
      ]} />
    </Card>
  );
}

// Antes da próxima partida: banimento recomendado e as matchups que pedem cuidado.
function DraftCard({ ctx, diags }) {
  const ban = diags.find((d) => d.group === "draft");
  const hard = diags.filter((d) => d.group === "matchup").slice(0, 3);
  if (!ban && !hard.length) return null;
  const go = (id) => document.getElementById(`diag-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const picks = pickTable(ctx.games, ctx.pool, ctx.meta);
  return (
    <section className="card span-12 draft">
      <div className="card-head"><div><div className="eyebrow">Antes da próxima partida</div><h2>Banimento e matchups</h2></div></div>
      <div className="draft-grid">
        {ban && (
          <button type="button" className="draft-ban" onClick={() => go(ban.id)}>
            <ChampIcon meta={ctx.meta} id={ban.champId} keyName={ban.champ} size={56} />
            <span><span className="k">Banimento recomendado</span><b>{ban.title.replace("Banimento recomendado: ", "")}</b><span className="s">{ban.headline.value} {ban.headline.label}</span></span>
          </button>
        )}
        {hard.map((d) => (
          <button key={d.id} type="button" className="draft-mu" onClick={() => go(d.id)}>
            <ChampIcon meta={ctx.meta} id={d.champId} keyName={d.champ} size={40} />
            <span><span className="k">Matchup difícil</span><b>{d.title.replace("Matchup difícil: ", "")}</b><span className="s">{d.headline.value} {d.headline.label}</span><span className="tip1">{d.steps?.[0]}</span></span>
          </button>
        ))}
      </div>
      {picks.rows.length > 0 && <div className="draft-picks">
        <span className="k">Mais escolhidos contra você · {picks.n} partidas · sua média {fmt.pct(picks.overall)}</span>
        <div className="draft-pick-row">{picks.rows.map((r) => (
          <span key={r.champ} className={`draft-pick ${r.n >= 4 && r.wr <= picks.overall - 0.08 ? "bad" : r.n >= 4 && r.wr >= picks.overall + 0.08 ? "good" : ""}`} title={r.tier ? `Guia do L0ganJG: ${r.tier} · ${TIER_LABEL[r.tier]}` : undefined}>
            <ChampIcon meta={ctx.meta} id={r.champId} keyName={r.champ} size={26} /><b>{r.name}</b><span>{fmt.pct(r.share)} · {fmt.pct(r.wr)} WR ({r.n})</span>{r.tier && <i className="tier">{r.tier}</i>}
          </span>
        ))}</div>
      </div>}
    </section>
  );
}

// ---------------------------------------------------------------------------
export function Coach({ ctx }) {
  const { games, pool, meta, isDemo } = ctx;
  const diags = useMemo(() => E.scoreDiagnostics([...E.coachDiagnostics(pool, games, meta), ...matchupDiagnostics(games, pool, meta)]), [pool, games, meta]);
  const problems = diags.filter((d) => d.kind === "problema");
  const strengths = diags.filter((d) => d.kind !== "problema");
  const best = useMemo(() => bestGames(games), [games]);
  if (!games.length) return <NoGames ctx={ctx} />;
  return (
    <div className="row-gap">
      {isDemo && <div className="callout"><b>Modo demonstração:</b> todos os diagnósticos são sobre partidas fictícias.</div>}
      <DraftCard ctx={ctx} diags={diags} />
      <CoachSummary problems={problems} strengths={strengths} />
      <EnemyVersus ctx={ctx} />
      <Card title="Diagnósticos" eyebrow={`${problems.length} pontos de atenção · ${strengths.length} pontos fortes`}>
        {diags.length ? <div className="row-gap" style={{ gap: 10 }}>{diags.map((d) => <Diagnostic key={d.id} d={d} />)}</div>
          : <Empty title="Nenhum padrão forte o suficiente">Com os filtros atuais nenhuma regra encontrou evidência suficiente. Isso é comum com poucas partidas: troque o Período para "Todo o histórico".</Empty>}
      </Card>
      <LossReview ctx={ctx} />
      <div className="grid">
        <Card span={12} title="Melhores exemplos de execução" tip="Regras: vitória com poucas mortes e farm acima da sua média, ou recuperação depois de começar atrás aos 10.">
          <GameList ctx={ctx} items={best} />
        </Card>
      </div>
      {!STATIC && <AiAssistant ctx={ctx} />}
      <div className="grid">
        <Card span={7} title="Plano de treino" eyebrow="o que fazer em cada ponto a melhorar">
          {problems.length ? <ol className="steps">{problems.slice(0, 3).map((s) => <li key={s.id}><b>{s.title}.</b> {s.action} <span className="dim">· acompanhar: {s.track}</span></li>)}</ol>
            : <p className="muted">Nenhum problema com evidência suficiente neste filtro.</p>}
        </Card>
        <Card span={5} title="Como o Coach funciona">
          <p className="note" style={{ marginTop: 0 }}>Os diagnósticos saem só das métricas calculadas no painel, com regras explícitas e o tamanho da amostra declarado em cada um. A prioridade de cada ponto a melhorar é calculada assim:</p>
          <div className="formula">{`pontuação = 0,35·impacto + 0,25·frequência
          + 0,25·confiança + 0,15·facilidade
(cada critério de 1 a 3)

ALTA ≥ 2,55 · MÉDIA ≥ 2,10 · BAIXA abaixo`}</div>
          <p className="note">Confiança sobe com o tamanho da amostra. Impacto e facilidade vêm de uma tabela fixa por tipo de problema (por exemplo, mortes antes de objetivos têm impacto alto).</p>
        </Card>
      </div>
    </div>
  );
}

function diagHeadline(d) {
  if (d.headline?.value) return d.headline;
  const ev = d.evidence || {};
  if (isNum(ev.a) && isNum(ev.b)) {
    const evo = d.id.startsWith("evo-");
    return { value: `${fmt.byKind(ev.a, ev.fmt)} × ${fmt.byKind(ev.b, ev.fmt)}`, label: d.headline?.label || (evo ? `${ev.labelA.toLowerCase()} × ${ev.labelB.toLowerCase()}` : "você × jungler inimigo") };
  }
  return d.headline || null;
}

function CsumItem({ d, k, good, go }) {
  const h = diagHeadline(d);
  return (
    <button className={`csum-item ${good ? "good" : ""}`} style={{ "--k": k }} onClick={() => go(d.id)} title="Ver o diagnóstico completo">
      <span className="rk">{good ? "✓" : k + 1}</span>
      <span style={{ minWidth: 0 }}>
        <span className="tt">{d.title}</span>
        {!good && <span className={`prio ${d.priority}`} style={{ marginLeft: 8, verticalAlign: "middle" }}>{d.priority === "media" ? "MÉDIA" : d.priority.toUpperCase()}</span>}
        {h?.label && <span className="hl" style={{ display: "block" }}>{h.label}</span>}
      </span>
      {h?.value && <span className="big">{h.value}</span>}
    </button>
  );
}

function CoachSummary({ problems, strengths }) {
  if (!problems.length && !strengths.length) return <div className="callout">Ainda não há evidência suficiente para um resumo. Importe mais partidas ou amplie o período.</div>;
  const go = (id) => { const el = document.getElementById(`diag-${id}`); if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); } };
  const counts = { alta: 0, media: 0, baixa: 0 };
  for (const p of problems) counts[p.priority] = (counts[p.priority] || 0) + 1;
  return (
    <Card title="Resumo do Coach" eyebrow="toque em um item para ver o diagnóstico completo"
      right={problems.length ? <div className="chips">{counts.alta > 0 && <span className="prio alta">{counts.alta} ALTA</span>}{counts.media > 0 && <span className="prio media">{counts.media} MÉDIA</span>}{counts.baixa > 0 && <span className="prio baixa">{counts.baixa} BAIXA</span>}</div> : null}>
      <div className="csum">
        <div className="csum-col">
          <div className="eyebrow bad">Pontos a melhorar</div>
          {problems.length ? problems.slice(0, 3).map((d, k) => <CsumItem key={d.id} d={d} k={k} go={go} />) : <p className="muted">Nenhum problema com evidência suficiente.</p>}
        </div>
        <div className="csum-col">
          <div className="eyebrow good">Pontos fortes</div>
          {strengths.length ? strengths.slice(0, 3).map((d, k) => <CsumItem key={d.id} d={d} k={k} good go={go} />) : <p className="muted">Nenhum ponto forte com evidência clara neste filtro.</p>}
        </div>
      </div>
    </Card>
  );
}

function EnemyVersus({ ctx }) {
  const rows = useMemo(() => E.vsEnemyRows(ctx.games), [ctx.games]);
  const n = rows.find((r) => r.key === "deaths")?.n || 0;
  if (n < 10) return null;
  return (
    <Card title="Frente a frente com o jungler inimigo" eyebrow={`as mesmas ${n} partidas, vistas dos dois lados`}
      tip="Média de cada lado nas mesmas partidas. 'Pode ser acaso' = o intervalo de 95% da diferença pareada inclui zero.">
      <Versus a={{ name: "Você", short: "Você", tone: "gold" }} b={{ name: "Jungler inimigo", short: "Inimigo", tone: "teal" }}
        rows={rows.map((r) => ({ key: r.key, label: r.label, tip: r.tip, a: r.a, b: r.b, fmt: r.fmt, better: r.better, mode: r.mode, scale: r.scale, sig: r.n >= 10 ? r.sig : false }))}
        foot="O placar conta só as diferenças que não parecem acaso." />
    </Card>
  );
}

function Diagnostic({ d }) {
  const ev = d.evidence || {};
  return (
    <article className="diag" id={`diag-${d.id}`}>
      <div className="diag-head"><span className={`prio ${d.priority}`}>{d.priority === "positivo" ? "PONTO FORTE" : `PRIORIDADE ${d.priority.toUpperCase().replace("MEDIA", "MÉDIA")}`}</span><h3>{d.title}</h3></div>
      <dl>
        <dt>Evidência</dt><dd>{ev.text || <>{ev.labelA}: <b>{fmt.byKind(ev.a, ev.fmt)}</b> · {ev.labelB}: {fmt.byKind(ev.b, ev.fmt)} · diferença {fmt.diffByKind(ev.diff, ev.fmt)} (IC {fmt.diffByKind(ev.ci?.[0], ev.fmt)} a {fmt.diffByKind(ev.ci?.[1], ev.fmt)})</>}</dd>
        <dt>Amostra</dt><dd>{d.n}</dd>
        <dt>Interpretação</dt><dd>{d.interpretation}</dd>
        {d.causes && <><dt>Possíveis causas</dt><dd>{d.causes}</dd></>}
        <dt>{d.kind === "problema" ? "Recomendação" : "O que fazer"}</dt><dd>{d.steps ? <ol className="diag-steps">{d.steps.map((x, i) => <li key={i}>{x}</li>)}</ol> : d.action}{d.guide && <div style={{ marginTop: 6 }}><a href={d.guide} target="_blank" rel="noopener noreferrer">Ver a matchup no guia de Briar do L0ganJG (onetricks.gg)</a></div>}</dd>
        <dt>Acompanhar</dt><dd>{d.track}</dd>
      </dl>
    </article>
  );
}

function reviewQueue(games) {
  const out = [];
  for (const g of games) {
    const reasons = [];
    if (!g.win && g.early?.diff10 && g.early.diff10.gold > 500) reasons.push(`Derrota com ${fmt.signed(g.early.diff10.gold)} de ouro aos 10`);
    const crit = E.pickoffsBeforeObjectives(g) || 0;
    if (crit >= 2) reasons.push(`${crit} pick-offs antes de objetivos`);
    const early = g.myEvents ? g.myEvents.deaths.filter((d) => d.t < 1200).length : 0;
    if (early >= 4) reasons.push(`${early} mortes antes dos 20 min`);
    if (reasons.length) out.push({ g, reasons, score: reasons.length * 2 + crit });
  }
  return out.sort((a, b) => b.score - a.score || b.g.start - a.g.start).slice(0, 8);
}
function bestGames(games) {
  const med = E.describe(games.map((g) => g.csMin)).mean;
  const out = [];
  for (const g of games) {
    const reasons = [];
    if (g.win && g.d <= 2 && g.csMin != null && med != null && g.csMin >= med) reasons.push(`Vitória com ${g.d} morte(s) e farm/min ${fmt.dec(g.csMin, 1)} (acima da sua média)`);
    if (g.win && g.early?.diff10 && g.early.diff10.gold < -500) reasons.push(`Recuperou de ${fmt.signed(g.early.diff10.gold)} de ouro aos 10`);
    if (reasons.length) out.push({ g, reasons, score: reasons.length * 2 + (g.kda || 0) / 5 });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 8);
}
function GameList({ ctx, items }) {
  if (!items.length) return <p className="muted">Nenhuma partida se encaixa nas regras com os filtros atuais.</p>;
  return (
    <div className="row-gap" style={{ gap: 6 }}>
      {items.map(({ g, reasons }) => (
        <button key={g.id} className="gl-item" onClick={() => ctx.openMatch(g.id)}>
          <span className={`res ${g.win ? "w" : "l"}`} style={{ width: 22 }}>{g.win ? "V" : "D"}</span>
          <ChampIcon meta={ctx.meta} id={g.oppChampId} keyName={g.oppChamp} size={26} />
          <span style={{ minWidth: 0 }}><span className="gl-t">{fmt.date(g.start)} · vs {E.champDisplay(ctx.meta, g.oppChamp, g.oppChampId)} · {g.k}/{g.d}/{g.a}</span><span className="gl-r">{reasons.join(" · ")}</span></span>
        </button>
      ))}
    </div>
  );
}


function LossReview({ ctx }) {
  const { games, pool, meta } = ctx;
  const lr = useMemo(() => E.lossReview(games, pool), [games, pool]);
  const [type, setType] = useState("all");
  const [onlySignals, setOnlySignals] = useState(false);
  const rows = lr.rows.filter((r) => (type === "all" || r.type === type) && (!onlySignals || r.signals.on.length >= 2));
  if (!lr.nLosses) return null;
  const c = lr.conversion;
  return (
    <Card title="Revisão de derrotas" eyebrow={`${lr.nLosses} derrotas com timeline neste filtro · como cada uma foi perdida e o que você fez nela`}
      tip="Os sinais medem comportamento, não emoção. São o que costuma aparecer quando se força jogada com o jogo ruim, e foram calibrados nas suas próprias partidas: aparecem muito mais nas derrotas do que nas vitórias.">
      <div className="kpis" style={{ marginBottom: 12 }}>
        <div className="kpi"><div className="label">Time +2.000 aos 15 min</div><div className="value">{fmt.pct(c.ahead.rate)}</div><div className="cmp">venceu {c.ahead.wins} de {c.ahead.n}</div></div>
        <div className="kpi"><div className="label">Equilibrado aos 15 min</div><div className="value">{fmt.pct(c.even.rate)}</div><div className="cmp">venceu {c.even.wins} de {c.even.n}</div></div>
        <div className="kpi"><div className="label">Time −2.000 aos 15 min</div><div className="value">{fmt.pct(c.behind.rate)}</div><div className="cmp">venceu {c.behind.wins} de {c.behind.n}</div></div>
        <div className="kpi"><div className="label">2+ sinais de jogo forçado <Tip text="Quantas partidas tiveram pelo menos 2 dos 4 sinais abaixo." /></div><div className="value">{fmt.pct(lr.twoPlus.losses)}</div><div className="cmp">das derrotas · {fmt.pct(lr.twoPlus.wins)} das vitórias</div></div>
      </div>
      <div className="split">
        <Table rowKey={(r) => r.key} rows={lr.signalRates} columns={[
          { key: "label", label: "Sinal", sortable: false, render: (r) => <span title={r.rule}>{r.label} <Tip text={r.rule} /></span> },
          { key: "losses", label: "Nas derrotas", num: true, sortable: false, render: (r) => fmt.pct(r.losses) },
          { key: "wins", label: "Nas vitórias", num: true, sortable: false, render: (r) => fmt.pct(r.wins) },
        ]} />
        <Table rowKey={(r) => r.key} rows={lr.byType} columns={[
          { key: "label", label: "Como a derrota aconteceu", sortable: false, render: (r) => <span title={r.rule}>{r.label} <Tip text={r.rule + " " + r.review} /></span> },
          { key: "n", label: "Derrotas", num: true, sortable: false },
          { key: "withSignals", label: "Com 2+ sinais", num: true, sortable: false },
        ]} />
      </div>
      <div className="inline-form" style={{ margin: "14px 0 8px" }}>
        <label className="field"><span>Tipo de derrota</span>
          <select id="lr-type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">Todas</option>{Object.entries(E.LOSS_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select></label>
        <label className="field"><span>Sinais</span>
          <select id="lr-sig" value={onlySignals ? "1" : "0"} onChange={(e) => setOnlySignals(e.target.value === "1")}>
            <option value="0">Todas as derrotas</option><option value="1">Só com 2+ sinais</option>
          </select></label>
        <span className="note" style={{ margin: 0 }}>{type !== "all" ? E.LOSS_TYPES[type].review : "Clique numa derrota para abrir a partida."}</span>
      </div>
      <Table rowKey={(r) => r.id} rows={rows} pageSize={12} onRowClick={(r) => ctx.openMatch(r.id)} rowClass={() => "loss"} initialSort={{ key: "date", dir: "desc" }} columns={[
        { key: "date", label: "Partida", sortValue: (r) => r.g.start, render: (r) => <span className="namecell"><ChampIcon meta={meta} id={r.g.oppChampId} keyName={r.g.oppChamp} size={20} /><span>{fmt.date(r.g.start)} · vs {E.champDisplay(meta, r.g.oppChamp, r.g.oppChampId)}</span></span> },
        { key: "kda", label: "K/D/A", num: true, sortValue: (r) => r.g.kda, render: (r) => `${r.g.k}/${r.g.d}/${r.g.a}` },
        { key: "type", label: "Como perdeu", sortValue: (r) => r.type, render: (r) => (r.type ? E.LOSS_TYPES[r.type].label : "—") },
        { key: "me10", label: "Você vs jungler 10'", num: true, render: (r) => <span className={r.me10 >= 0 ? "good" : "bad"}>{fmt.signed(r.me10)}</span> },
        { key: "t15", label: "Time 15'", num: true, render: (r) => <span className={r.t15 >= 0 ? "good" : "bad"}>{fmt.signed(r.t15)}</span> },
        { key: "t20", label: "Time 20'", num: true, render: (r) => <span className={r.t20 >= 0 ? "good" : "bad"}>{fmt.signed(r.t20)}</span> },
        { key: "signals", label: "Sinais", sortValue: (r) => r.signals.on.length, render: (r) => (r.signals.on.length ? <span className="iconrow" style={{ gap: 4, flexWrap: "wrap", whiteSpace: "normal", maxWidth: 340 }}>{r.signals.on.map((k) => <span key={k} className="chip static" style={{ fontSize: "0.72rem", padding: "1px 7px", borderColor: r.signals.on.length >= 2 ? "#ef444466" : undefined }} title={E.LOSS_SIGNALS[k].rule}>{E.LOSS_SIGNALS[k].short}</span>)}</span> : <span className="dim">nenhum</span>) },
      ]} />
      <p className="note">Uma derrota sem sinais costuma ser um jogo que fugiu do seu controle. Derrotas com 2 ou mais sinais são as melhores para revisar o lado mental: procure o momento em que o primeiro sinal aparece (normalmente logo depois de o time ficar para trás) e o que você decidiu ali.</p>
    </Card>
  );
}

const AI_EXAMPLES = ["Com qual build estou jogando melhor?", "Quais são meus três maiores problemas nessas partidas?", "Como está meu early game comparado ao jungler inimigo?", "Meu desempenho melhorou nas últimas 20 partidas?"];

function AiAssistant({ ctx }) {
  const { store, games, pool, meta, filters, isDemo } = ctx;
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ctl = useRef(null);
  const sample = store?.sample;
  const ask = async (question) => {
    const text = (question || q).trim();
    if (!text || !sample) return;
    setQ(text); setBusy(true); setErr(""); setAnswer("Pensando…");
    ctl.current = new AbortController();
    const packet = E.analyticsPacket(games, pool, meta, `${E.PERIOD_LABELS[filters.period]} · campeão ${filters.champion} · fila ${filters.queue}`);
    const prompt = `Você é o JUNGLE COACH, um analista de desempenho de League of Legends (jungle). Responda em português do Brasil, de forma direta e consultiva (recomendações com o raciocínio, sem ordens).
REGRAS OBRIGATÓRIAS:
- Use SOMENTE os números do JSON abaixo. Não invente estatísticas, partidas, patches ou valores.
- Sempre cite o tamanho da amostra (n) ao citar um número. Amostras com menos de 10 partidas são muito pequenas; diga isso.
- Não trate correlação como causa. Win rate de um item pode refletir o contexto da partida.
- Se os dados não respondem a pergunta, diga claramente o que falta.
${isDemo ? "- ATENÇÃO: estes dados são SIMULADOS (modo demonstração). Avise isso no início da resposta.\n" : ""}
DADOS CALCULADOS PELO DASHBOARD (JSON):
${JSON.stringify(packet)}

PERGUNTA: ${text}`;
    try {
      const { truncated } = await sample(prompt, { signal: ctl.current.signal, onText: ({ text: t }) => setAnswer(t) });
      if (truncated) setErr("A resposta foi cortada. Tente uma pergunta mais específica.");
    } catch (e) {
      setAnswer(e && e.text ? e.text : "");
      const code = e && e.code;
      if (code === "cancelled") return;
      setErr(code === "not_granted" ? "O uso do Claude por este dashboard não foi permitido nesta visualização." : code === "rate_limited" ? "Muitas perguntas seguidas. Tente de novo em alguns minutos." : code === "session_expired" ? "Sua sessão expirou. Entre de novo no Claude." : "Não foi possível obter resposta agora. Tente de novo.");
    } finally { setBusy(false); }
  };
  return (
    <Card title="Pergunte ao Jungle Coach" eyebrow="IA sobre os indicadores calculados" tip="A pergunta é enviada ao Claude junto com um resumo dos números desta tela (com os filtros atuais). A IA é instruída a usar só esses números. Usa a sua cota do Claude.">
      {!sample ? <p className="muted">O assistente de IA não está disponível nesta visualização do dashboard. Os diagnósticos acima funcionam sem ele.</p> : (
        <div className="ai-box">
          <div className="chips">{AI_EXAMPLES.map((x) => <button key={x} className="chip" onClick={() => ask(x)} disabled={busy}>{x}</button>)}</div>
          <form className="inline-form" onSubmit={(e) => { e.preventDefault(); ask(); }}>
            <input id="ai-q" type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex.: Por que meu win rate caiu nas últimas 20 partidas?" style={{ flex: 1, minWidth: 220 }} />
            {busy ? <button type="button" className="btn" onClick={() => ctl.current?.abort()}>Parar</button> : <button className="btn primary" type="submit" disabled={!q.trim()}>Perguntar</button>}
          </form>
          {(answer || err) && <div className="ai-answer" aria-live="polite">{answer}{err && <div className="bad" style={{ marginTop: 8 }}>{err}</div>}</div>}
          <p className="note" style={{ margin: 0 }}>A IA recebe apenas os números agregados ({games.length} partidas do filtro atual), não as partidas individuais. Confira os números citados nas abas correspondentes.</p>
        </div>
      )}
    </Card>
  );
}
