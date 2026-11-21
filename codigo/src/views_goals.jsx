// Metas: escolha até 4 métricas, defina o alvo e acompanhe a cada 10 partidas.
import * as E from "./engine.js";
import { STATIC } from "./static_store.js";
import * as CH from "./challenger.js";
import * as G from "./goals.js";
import { fmt, C, Card, Tip, Ring, ChartTip, axisProps, gridProps } from "./ui.jsx";
import { useHomeData } from "./views_home.jsx";

const React = window.React;
const { useMemo, useState } = React;
const R = window.Recharts;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const f = (v, m) => (!isNum(v) ? "—" : m.fmt === "pct" ? fmt.pct(v) : m.fmt === "int" ? fmt.signed(v) : fmt.dec(v, m.fmt === "dec2" ? 2 : 1));

export function Goals({ ctx }) {
  const { prefs, savePrefs, toast } = ctx;
  const { cmp, prep } = useHomeData(ctx);
  const ref = prep ? cmp : null;
  const saved = prefs?.goals && prefs.goals.length ? prefs.goals : G.DEFAULT_GOALS;
  const [draft, setDraft] = useState(null);
  const src = ctx.games; // partidas do período escolhido no filtro (da mais recente para a mais antiga)
  const rows = useMemo(() => saved.map((g) => {
    const sug = G.suggestTarget(g.key, ref);
    const target = isNum(g.target) ? g.target : sug.value;
    return { ...g, m: G.GOAL_METRICS[g.key], target, sug, auto: !isNum(g.target), st: G.goalStatus(g.key, src, target), trend: G.goalTrend(g.key, src) };
  }).filter((g) => g.m), [saved, src, ref]);

  const editing = draft || saved.map((g) => ({ key: g.key, target: isNum(g.target) ? String(g.target) : "" }));
  const save = async () => {
    const goals = editing.filter((g) => G.GOAL_METRICS[g.key]).slice(0, 4).map((g) => ({ key: g.key, target: g.target === "" || g.target == null ? null : Number(String(g.target).replace(",", ".")) }));
    await savePrefs({ ...prefs, goals });
    setDraft(null);
    toast("Metas salvas.");
  };
  return (
    <div className="row-gap">
      <div className="callout">O anel compara as <b>últimas 10 partidas do período</b> com o alvo (100% = na meta). "Antes" e o gráfico usam o resto do período escolhido no filtro, então dá para ver a meta numa janela curta (Últimas 20) ou longa (Tudo). {ref ? "O alvo sugerido é a média dos Challengers de referência." : "Sem as referências importadas, o alvo sugerido vem do jungler inimigo nas suas partidas."}</div>
      {src.length ? <div className="goals">
        {rows.map((g, i) => <GoalCard key={g.key} g={g} i={i} />)}
      </div> : <div className="callout">Nenhuma partida neste período. Escolha um período maior no filtro.</div>}
      {!STATIC && <Card title="Editar metas" eyebrow="até 4 metas" tip="Deixe o alvo em branco para usar o valor sugerido.">
        <div className="row-gap" style={{ gap: 8 }}>
          {editing.map((g, k) => {
            const sug = G.suggestTarget(g.key, ref);
            return (
              <div key={k} className="inline-form">
                <label className="field"><span>Métrica</span>
                  <select id={`goal-key-${k}`} value={g.key} onChange={(e) => setDraft(editing.map((x, j) => (j === k ? { key: e.target.value, target: "" } : x)))}>
                    {Object.entries(G.GOAL_METRICS).map(([key, m]) => <option key={key} value={key}>{m.label}</option>)}
                  </select></label>
                <label className="field"><span>Alvo</span>
                  <input id={`goal-target-${k}`} type="text" inputMode="decimal" style={{ width: 120 }} placeholder={isNum(sug.value) ? String(Math.round(sug.value * 100) / 100) : ""} value={g.target ?? ""} onChange={(e) => setDraft(editing.map((x, j) => (j === k ? { ...x, target: e.target.value } : x)))} /></label>
                <span className="note" style={{ margin: 0 }}>sugerido: {f(sug.value, G.GOAL_METRICS[g.key])} ({sug.source}){G.GOAL_METRICS[g.key]?.fmt === "pct" ? " · escreva 0,25 para 25%" : ""}</span>
                <button className="btn sm ghost" onClick={() => setDraft(editing.filter((_, j) => j !== k))} disabled={editing.length <= 1}>Remover</button>
              </div>
            );
          })}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn sm" disabled={editing.length >= 4} onClick={() => setDraft([...editing, { key: Object.keys(G.GOAL_METRICS).find((k) => !editing.some((g) => g.key === k)) || "csMin", target: "" }])}>Adicionar meta</button>
            <button className="btn primary sm" onClick={save}>Salvar metas</button>
            {draft && <button className="btn sm ghost" onClick={() => setDraft(null)}>Desfazer</button>}
          </div>
        </div>
      </Card>}
    </div>
  );
}

function GoalCard({ g, i }) {
  const { m, st, target } = g;
  const color = st.done ? C.green : st.progress >= 0.75 ? C.blue : C.gold;
  const data = g.trend.points;
  return (
    <article className={`goal ${st.done ? "done" : ""}`} style={{ "--i": i }}>
      <h3>{m.label}{m.tip && <> <Tip text={m.tip} /></>}</h3>
      <div className="goal-top">
        <Ring className="goal-ring" value={st.progress} size={96} stroke={8} color={color}><span>{isNum(st.progress) ? fmt.pct(st.progress) : "—"}<small>DA META</small></span></Ring>
        <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <div className="stat-sub">{st.done ? <b style={{ color: C.green }}>Na meta nas últimas {st.nNow}</b> : st.trend === 1 ? <>Melhorando em relação às {st.nBefore} anteriores do período</> : st.trend === -1 ? <>Pior que nas {st.nBefore} anteriores do período</> : st.trend === 0 ? "Estável no período" : "Período curto para comparar"}</div>
          <div className="dim" style={{ fontSize: "0.74rem" }}>alvo: {g.auto ? g.sug.source : "definido por você"}</div>
        </div>
      </div>
      <dl className="row3">
        <div><dt>Últimas {st.nNow}</dt><dd style={{ color }}>{f(st.now, m)}</dd></div>
        <div><dt title={st.nBefore ? `partidas 11 a ${st.nBefore + 10} do período` : ""}>Antes ({st.nBefore})</dt><dd>{f(st.start, m)}</dd></div>
        <div><dt>Meta</dt><dd>{f(target, m)}</dd></div>
      </dl>
      {data.length >= 2 && (
        <div className="chart" style={{ height: 90 }}>
          <R.ResponsiveContainer>
            <R.LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <R.CartesianGrid {...gridProps} />
              <R.XAxis dataKey="idx" type="number" domain={[data[0].idx, data[data.length - 1].idx]} ticks={data.map((d) => d.idx)} {...axisProps} tickFormatter={(v) => `${v}º`} />
              <R.YAxis {...axisProps} width={46} tickCount={3} domain={["auto", "auto"]} tickFormatter={(v) => f(v, m)} />
              {isNum(target) && <R.ReferenceLine y={target} stroke={C.green} strokeDasharray="4 4" />}
              <R.Tooltip content={<ChartTip render={(pl) => { const p = pl[0].payload; return <><div>{new Date(p.from).toLocaleDateString("pt-BR")} a {new Date(p.to).toLocaleDateString("pt-BR")}</div><div style={{ color: C.gold }}>{f(p.value, m)}</div></>; }} />} />
              <R.Line dataKey="value" stroke={C.gold} strokeWidth={2} dot={{ r: 3, fill: C.gold }} isAnimationActive animationDuration={800} />
            </R.LineChart>
          </R.ResponsiveContainer>
        </div>
      )}
      <div className="dim" style={{ fontSize: "0.72rem" }}>{data.length >= 2 ? <>Cada ponto é um bloco de {g.trend.block} partidas do período, do mais antigo ao mais recente. Linha verde: a meta.</> : <>Com um período maior aparece o gráfico em blocos de {g.trend.block} partidas.</>}</div>
    </article>
  );
}
