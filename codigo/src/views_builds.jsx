import * as E from "./engine.js";
import { fmt, C, Card, Tip, Sample, WRBar, Empty, Table, SubTabs, ItemIcon, ItemRow, RuneIcon, statColumns, ChartTip, axisProps, gridProps, Versus } from "./ui.jsx";
import { NoGames } from "./views_overview.jsx";
const React = window.React;
const { useState, useMemo } = React;
const R = window.Recharts;

const ID = { COL: 6676, HYD: 3748, ISB: 6673, ECL: 6692, DDA: 6333, LDR: 3036, BC: 3071 };
const REFERENCE_SETS = [
  [ID.COL, ID.HYD], [ID.COL, ID.HYD, ID.ISB], [ID.COL, ID.HYD, ID.ECL], [ID.COL, ID.HYD, ID.DDA],
  [ID.COL, ID.HYD, ID.ISB, ID.ECL], [ID.COL, ID.HYD, ID.ISB, ID.DDA],
];
const isReference = (items) => REFERENCE_SETS.some((s) => s.length === items.length && s.every((x) => items.includes(x)));

export function Builds({ ctx }) {
  const [tab, setTab] = useState("comparador");
  if (!ctx.games.length) return <NoGames ctx={ctx} />;
  return (
    <>
      <SubTabs value={tab} onChange={setTab} tabs={[["comparador", "Build Comparator"], ["itens", "Win rate por item"], ["combos", "Combinações"], ["ordem", "Ordem de compra"], ["patch", "Por patch"]]} />
      {tab === "comparador" && <Comparator ctx={ctx} />}
      {tab === "itens" && <ItemTable ctx={ctx} />}
      {tab === "combos" && <Combos ctx={ctx} />}
      {tab === "ordem" && <PurchaseOrder ctx={ctx} />}
      {tab === "patch" && <PatchTable ctx={ctx} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// BUILD COMPARATOR
// ---------------------------------------------------------------------------
const PRESETS = [
  { label: "Eclipse × Dança da Morte no 4º item", mode: "seq", a: [ID.COL, ID.HYD, ID.LDR, ID.ECL], b: [ID.COL, ID.HYD, ID.LDR, ID.DDA] },
  { label: "Build do Eclipse × Hidra › Cutelo › Dança", mode: "seq", a: [ID.COL, ID.HYD, ID.LDR, ID.ECL], b: [ID.HYD, ID.BC, ID.DDA] },
  { label: "Mesma profundidade: Coletora › Hidra › Lembranças × Hidra › Cutelo › Dança", mode: "seq", a: [ID.COL, ID.HYD, ID.LDR], b: [ID.HYD, ID.BC, ID.DDA] },
  { label: "Eclipse × Dança (qualquer ordem, base Coletora + Hidra)", mode: "set", a: [ID.COL, ID.HYD, ID.ECL], b: [ID.COL, ID.HYD, ID.DDA] },
  { label: "Só Eclipse × só Dança da Morte", mode: "set", a: [ID.ECL], b: [ID.DDA] },
];
const DEFAULT_SAVED_BUILDS = [
  { id: "eclipse", items: [ID.COL, ID.HYD, ID.LDR, ID.ECL], mode: "seq" },
  { id: "danca", items: [ID.COL, ID.HYD, ID.LDR, ID.DDA], mode: "seq" },
  { id: "cutelo", items: [ID.HYD, ID.BC, ID.DDA], mode: "seq" },
  { id: "base3", items: [ID.COL, ID.HYD, ID.LDR], mode: "seq", note: "referência: mesma profundidade da build do Cutelo" },
];

function BuildCell({ meta, def }) {
  return (
    <span style={{ display: "grid", gap: 3, whiteSpace: "normal", minWidth: 220 }}>
      <ItemRow meta={meta} ids={def.items} size={24} arrows={def.mode === "seq"} />
      <span className="dim" style={{ fontSize: "0.78rem" }}>{def.items.map((id) => E.itemName(meta, id)).join(def.mode === "seq" ? " › " : " + ")}{def.note ? ` · ${def.note}` : ""}</span>
    </span>
  );
}

function BuildRanking({ ctx, itemOptions, onUse }) {
  const { games, meta, prefs, savePrefs } = ctx;
  const builds = prefs && Array.isArray(prefs.savedBuilds) && prefs.savedBuilds.length ? prefs.savedBuilds : DEFAULT_SAVED_BUILDS;
  const [editing, setEditing] = useState(false);
  const rows = useMemo(() => E.buildTable(games, builds, meta), [games, JSON.stringify(builds), meta]);
  const save = (next) => savePrefs({ ...prefs, savedBuilds: next });
  return (
    <Card title="Suas builds lado a lado" eyebrow="Na ordem de compra · cada build comparada com as outras partidas que chegaram ao mesmo número de itens"
      tip="Partidas que chegam ao 4º item já vencem mais do que as que param no 3º, porque são mais longas. Por isso cada build é comparada com as outras partidas da mesma profundidade, não com a média geral."
      right={<button className="btn sm" onClick={() => setEditing(!editing)}>{editing ? "Concluir edição" : "Editar builds"}</button>}>
      <Table rowKey={(r) => r.key} rows={rows} columns={[
        { key: "build", label: "Build", sortable: false, render: (r) => <BuildCell meta={meta} def={r.def} /> },
        { key: "n", label: "Partidas", num: true, sortValue: (r) => r.summary.n, render: (r) => <Sample n={r.summary.n} /> },
        { key: "rate", label: "Win rate", sortValue: (r) => r.summary.rate, render: (r) => <WRBar rate={r.summary.rate} ci={r.summary.ci} n={r.summary.n} /> },
        { key: "vsRest", label: "vs. mesma profundidade", sortValue: (r) => r.vsRest?.diff,
          tip: "Diferença de win rate para as outras partidas que chegaram ao mesmo número de itens. 'Distinguível' só quando o intervalo de 95% não inclui zero.",
          render: (r) => (r.vsRest ? <span style={{ display: "grid", gap: 2 }}><span className="num">{fmt.pp(r.vsRest.diff)} {E.excludesZero(r.vsRest.ci) ? <span className="status melhorando">Distinguível</span> : <span className="dim">· inconclusivo</span>}</span><span className="dim" style={{ fontSize: "0.78rem" }}>outras: {fmt.pct(r.rest.rate)} em {r.rest.n}</span></span> : "—") },
        { key: "kda", label: "KDA", num: true, sortValue: (r) => r.summary.kda?.value, render: (r) => fmt.dec(r.summary.kda?.value, 2) },
        { key: "deaths", label: "Mortes", num: true, sortValue: (r) => r.summary.deaths, render: (r) => fmt.dec(r.summary.deaths, 1) },
        { key: "dmg", label: "Dano/min", num: true, sortValue: (r) => r.summary.dmgMin, render: (r) => fmt.int(r.summary.dmgMin) },
        { key: "lastDone", label: "Último item", num: true, tip: "Minuto mediano em que o último item da build foi fechado.", render: (r) => fmt.clock(r.lastDone) },
        { key: "teamGold", label: "Ouro do time ao fechar", num: true, tip: "Diferença média de ouro do seu time para o inimigo quando o último item foi fechado. Valores altos indicam que a build costuma ser fechada em jogos que já estavam ganhos.", render: (r) => <span className={r.teamGold >= 0 ? "good" : "bad"}>{fmt.signed(r.teamGold)}</span> },
        { key: "deathsAfter", label: "Mortes /10 min depois", num: true, tip: "Suas mortes a cada 10 minutos depois de fechar o último item da build.", render: (r) => fmt.dec(r.deathsAfter, 2) },
        { key: "patches", label: "Patches", sortable: false, render: (r) => <span className="dim">{r.patches.join(", ") || "—"}</span> },
        { key: "use", label: "Comparar", sortable: false, render: (r) => <span className="iconrow"><button className="btn sm" title="Levar para a Build A" onClick={() => onUse("a", r.def)}>A</button><button className="btn sm" title="Levar para a Build B" onClick={() => onUse("b", r.def)}>B</button></span> },
      ]} />
      {editing && (
        <div className="row-gap" style={{ marginTop: 12, gap: 10 }}>
          {builds.map((b, i) => (
            <div key={b.id || i} className="bc-side" style={{ padding: 10 }}>
              <div className="inline-form" style={{ alignItems: "center" }}>
                <span className="eyebrow">Build {i + 1}</span>
                <button className="btn sm danger" onClick={() => save(builds.filter((_, j) => j !== i))} disabled={builds.length <= 1}>Remover</button>
              </div>
              <BuildEditor side={`r${i}`} def={{ ...b, mode: "seq" }} setDef={(d) => save(builds.map((x, j) => (j === i ? { ...x, items: d.items, note: undefined } : x)))} itemOptions={itemOptions} meta={meta} />
            </div>
          ))}
          <div className="inline-form">
            {builds.length < 6 && <button className="btn sm" onClick={() => save([...builds, { id: "b" + Date.now(), items: [ID.COL, ID.HYD], mode: "seq" }])}>+ Adicionar build</button>}
            <button className="btn sm ghost" onClick={() => save(DEFAULT_SAVED_BUILDS)}>Restaurar as builds padrão</button>
          </div>
        </div>
      )}
      <p className="note">Todas as builds aqui consideram a ordem de compra (1º, 2º, 3º item…), então só entram partidas com timeline. As builds ficam salvas no dashboard.</p>
    </Card>
  );
}

function BuildEditor({ side, def, setDef, itemOptions, meta }) {
  const items = [...def.items];
  const setSlot = (i, v) => {
    const next = [...items];
    if (v) next[i] = Number(v); else next.splice(i, 1);
    setDef({ ...def, items: next.filter(Boolean) });
  };
  return (
    <div className="slots">
      {items.map((id, i) => (
        <div className="slot" key={i}>
          <span className="ord">{def.mode === "seq" ? i + 1 : ""}</span>
          <ItemIcon meta={meta} id={id} size={28} />
          <select id={`bc-${side}-${i}`} aria-label={`Build ${side.toUpperCase()}, item ${i + 1}`} value={id} onChange={(e) => setSlot(i, e.target.value)}>
            {itemOptions.map((o) => <option key={o} value={o}>{E.itemName(meta, o)}</option>)}
            <option value="">Remover</option>
          </select>
        </div>
      ))}
      {items.length < 5 && (
        <div className="slot">
          <span className="ord">+</span>
          <select id={`bc-${side}-add`} aria-label={`Adicionar item à build ${side.toUpperCase()}`} value="" onChange={(e) => e.target.value && setDef({ ...def, items: [...items, Number(e.target.value)] })}>
            <option value="">Adicionar item</option>
            {itemOptions.filter((o) => !items.includes(o)).map((o) => <option key={o} value={o}>{E.itemName(meta, o)}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

function Comparator({ ctx }) {
  const { games, meta } = ctx;
  const [mode, setMode] = useState(PRESETS[0].mode);
  const [defA, setDefA] = useState({ items: PRESETS[0].a });
  const [defB, setDefB] = useState({ items: PRESETS[0].b });
  const [excludeOverlap, setExcludeOverlap] = useState(true);
  const itemOptions = useMemo(() => {
    const ids = new Set();
    for (const g of ctx.all) for (const id of g.finalItems) if (E.isCompletedItem(meta, id)) ids.add(id);
    for (const p of PRESETS) [...p.a, ...p.b].forEach((x) => ids.add(x));
    for (const b of (ctx.prefs?.savedBuilds || [])) (b.items || []).forEach((x) => ids.add(x));
    return [...ids].sort((a, b) => E.itemName(meta, a).localeCompare(E.itemName(meta, b), "pt-BR"));
  }, [ctx.all, meta]);
  const A = { ...defA, mode }, B = { ...defB, mode };
  const res = useMemo(() => E.compareBuilds(games, A, B, meta, { excludeOverlap }), [games, JSON.stringify(A), JSON.stringify(B), meta, excludeOverlap]);
  const { a, b } = res;
  return (
    <div className="row-gap">
      {ctx.filters.period !== "all" && (
        <div className="callout warn" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <span>Você está vendo: <b>{E.PERIOD_LABELS[ctx.filters.period]}</b>. Para comparar builds, o histórico completo dá muito mais partidas para cada lado.</span>
          <button className="btn sm" onClick={() => ctx.setFilters({ period: "all" })}>Usar todo o histórico</button>
        </div>
      )}
      <BuildRanking ctx={ctx} itemOptions={itemOptions} onUse={(side, def) => { setMode("seq"); (side === "a" ? setDefA : setDefB)({ items: def.items }); }} />
      <Card title="BUILD COMPARATOR" eyebrow="Compare duas configurações nas mesmas condições de filtro"
        right={<div className="chips">{PRESETS.map((p) => <button key={p.label} className="chip" aria-pressed={mode === p.mode && JSON.stringify(defA.items) === JSON.stringify(p.a) && JSON.stringify(defB.items) === JSON.stringify(p.b)} onClick={() => { setMode(p.mode); setDefA({ items: p.a }); setDefB({ items: p.b }); }}>{p.label}</button>)}</div>}>
        <div className="inline-form" style={{ marginBottom: 12 }}>
          <label className="field"><span>Como comparar</span>
            <select id="bc-mode" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="set">Itens na build final (qualquer ordem)</option>
              <option value="seq">Primeiros itens nesta ordem (exige timeline)</option>
            </select>
          </label>
          <label className="field"><span>Partidas nas duas builds</span>
            <select id="bc-overlap" value={excludeOverlap ? "1" : "0"} onChange={(e) => setExcludeOverlap(e.target.value === "1")}>
              <option value="1">Retirar dos dois lados</option><option value="0">Manter nos dois lados</option>
            </select>
          </label>
          <span className="note" style={{ margin: 0 }}>Os filtros globais (campeão, fila, período, patch…) valem aqui também.</span>
        </div>
        <div className="bc-grid">
          {[["a", "BUILD A", defA, setDefA, a], ["b", "BUILD B", defB, setDefB, b]].map(([k, label, def, setDef, side]) => (
            <div key={k} className={`bc-side ${k}`}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span className="bc-tag">{label}</span>
                <Sample n={side.games.length} />
              </div>
              <BuildEditor side={k} def={def} setDef={setDef} itemOptions={itemOptions} meta={meta} />
              {side.games.length > 0 ? (
                <>
                  <div style={{ display: "flex", gap: 18, alignItems: "flex-end", flexWrap: "wrap" }}>
                    <div><div className="eyebrow">Win rate</div><div className="bignum">{fmt.pct(side.summary.rate, 1)}</div></div>
                    <div style={{ flex: 1, minWidth: 160 }}><WRBar rate={side.summary.rate} ci={side.summary.ci} n={side.summary.n} /></div>
                  </div>
                  <dl className="statline">
                    <div><dt>Partidas</dt><dd>{side.summary.n} ({side.summary.wins}V {side.summary.losses}D)</dd></div>
                    <div><dt>KDA</dt><dd>{fmt.dec(side.summary.kda?.value, 2)}</dd></div>
                    <div><dt>Mortes</dt><dd>{fmt.dec(side.summary.deaths, 1)}</dd></div>
                    <div><dt>Farm/min</dt><dd>{fmt.dec(side.summary.csMin, 2)}</dd></div>
                    <div><dt>Ouro/min</dt><dd>{fmt.int(side.summary.goldMin)}</dd></div>
                    <div><dt>Dano/min</dt><dd>{fmt.int(side.summary.dmgMin)}</dd></div>
                    <div><dt>Duração</dt><dd>{fmt.dur((side.summary.durMin || 0) * 60)}</dd></div>
                    <div><dt>Com timeline</dt><dd>{side.summary.withTL}</dd></div>
                  </dl>
                </>
              ) : <Empty title="Nenhuma partida com esta build">Ajuste os itens, o modo de comparação ou os filtros.</Empty>}
            </div>
          ))}
        </div>
      </Card>

      {a.games.length > 0 && b.games.length > 0 && (
        <>
          <div className="grid">
            <Card span={7} title="O que dá e o que não dá para concluir">
              <ul className="notes">{res.notes.map((n, i) => <li key={i} className={n.tone}>{n.text}</li>)}</ul>
            </Card>
            <Card span={5} title="Win rate com intervalo de 95%" tip="Cada faixa é o intervalo de confiança de Wilson. Faixas muito sobrepostas significam que a diferença pode ser acaso.">
              <CIAxis rows={[["A", a.summary, C.blue], ["B", b.summary, C.gold]]} />
              <dl className="kv" style={{ marginTop: 28 }}>
                <dt>Diferença bruta (A − B)</dt><dd className="num">{fmt.pp(res.wrDiff?.diff)} <span className="dim">IC {fmt.pp(res.wrDiff?.ci[0])} a {fmt.pp(res.wrDiff?.ci[1])}</span></dd>
                <dt>Ajustada pelo ouro na compra <Tip text="Diferença de Mantel-Haenszel: compara A e B dentro de cada faixa de ouro do time no momento em que o item-chave foi fechado (atrás, equilibrado, à frente) e faz a média ponderada." /></dt>
                <dd className="num">{res.byGold.adjusted ? <>{fmt.pp(res.byGold.adjusted.diff)} <span className="dim">IC {fmt.pp(res.byGold.adjusted.ci[0])} a {fmt.pp(res.byGold.adjusted.ci[1])}</span></> : "não calculável"}</dd>
              </dl>
            </Card>
          </div>

          <Card title="Frente a frente" eyebrow="Build A × Build B nas mesmas condições de filtro"
            tip="A barra cresce para o lado que vai melhor; o tamanho mostra o quanto. 'Pode ser acaso' = o intervalo de 95% da diferença inclui zero, então a vantagem ainda não é confiável.">
            <Versus a={{ name: "Build A", short: "Build A", tone: "teal", sub: `${a.summary.n} partidas`, icon: <ItemRow meta={meta} ids={defA.items} size={26} /> }}
              b={{ name: "Build B", short: "Build B", tone: "gold", sub: `${b.summary.n} partidas`, icon: <ItemRow meta={meta} ids={defB.items} size={26} /> }}
              rows={[
                { key: "wr", label: "Win rate", a: a.summary.rate, b: b.summary.rate, fmt: "pct", better: "higher", sig: res.wrDiff ? E.excludesZero(res.wrDiff.ci) : undefined, na: `${a.summary.wins}V ${a.summary.losses}D`, nb: `${b.summary.wins}V ${b.summary.losses}D` },
                { key: "kda", label: "KDA (agregado)", a: a.summary.kda?.value, b: b.summary.kda?.value, fmt: "dec2", better: "higher" },
                ...res.metrics.map((m) => ({ key: m.key, label: m.label, a: m.a, b: m.b, fmt: m.fmt, better: m.better || "neutral", sig: m.ci ? m.reliable : undefined })),
              ]}
              foot="O placar conta só as diferenças que não parecem acaso." />
          </Card>

          <details className="card" style={{ padding: "12px 18px" }}>
            <summary className="eyebrow" style={{ cursor: "pointer" }}>Ver os números com intervalo de confiança</summary>
            <div style={{ marginTop: 12 }}>
            <Table rowKey={(r) => r.key} rows={[{ key: "wr", label: "Win rate", a: a.summary.rate, b: b.summary.rate, diff: res.wrDiff?.diff, ci: res.wrDiff?.ci, fmt: "pct", reliable: res.wrDiff && E.excludesZero(res.wrDiff.ci), better: "higher" },
              { key: "kda", label: "KDA (agregado)", a: a.summary.kda?.value, b: b.summary.kda?.value, diff: (a.summary.kda?.value ?? 0) - (b.summary.kda?.value ?? 0), ci: null, fmt: "dec2", better: "higher" },
              ...res.metrics]}
              columns={[
                { key: "label", label: "Métrica", sortable: false },
                { key: "a", label: "Build A", num: true, sortable: false, render: (r) => <span className="bluec">{fmt.byKind(r.a, r.fmt)}</span> },
                { key: "b", label: "Build B", num: true, sortable: false, render: (r) => <span className="goldc">{fmt.byKind(r.b, r.fmt)}</span> },
                { key: "diff", label: "A − B", num: true, sortable: false, render: (r) => fmt.diffByKind(r.diff, r.fmt) },
                { key: "ci", label: "IC 95%", num: true, sortable: false, render: (r) => (r.ci ? `${fmt.diffByKind(r.ci[0], r.fmt)} a ${fmt.diffByKind(r.ci[1], r.fmt)}` : "—") },
                { key: "reliable", label: "Diferença", sortable: false, render: (r) => (r.ci ? (r.reliable ? <span className="status melhorando">Distinguível</span> : <span className="status estavel">Pode ser acaso</span>) : <span className="dim">sem IC</span>) },
              ]} />
            </div>
          </details>

          <div className="grid">
            <Card span={6} title="Quando cada item foi fechado" tip="Minuto médio de conclusão, pela timeline. Partidas sem timeline não entram aqui.">
              <Table rowKey={(r) => r.id} rows={[...new Set([...defA.items, ...defB.items])].map((id) => ({
                id, a: a.timing.find((t) => t.id === id)?.time, b: b.timing.find((t) => t.id === id)?.time,
              }))} columns={[
                { key: "id", label: "Item", sortable: false, render: (r) => <span className="namecell"><ItemIcon meta={meta} id={r.id} /><span>{E.itemName(meta, r.id)}</span></span> },
                { key: "a", label: "Build A", num: true, sortable: false, render: (r) => (r.a && r.a.n ? <span className="bluec">{fmt.clock(r.a.mean)} <span className="dim">({r.a.n})</span></span> : "—") },
                { key: "b", label: "Build B", num: true, sortable: false, render: (r) => (r.b && r.b.n ? <span className="goldc">{fmt.clock(r.b.mean)} <span className="dim">({r.b.n})</span></span> : "—") },
              ]} />
            </Card>
            <Card span={6} title="Em que circunstâncias o item-chave apareceu" tip="Contexto no instante em que o item que diferencia as builds foi completado (snapshot do minuto anterior à compra).">
              <Table rowKey={(r) => r.k} rows={[
                { k: "Item-chave", a: <span className="namecell"><ItemIcon meta={meta} id={a.keyItem} size={22} /><span>{a.keyItemName}</span></span>, b: <span className="namecell"><ItemIcon meta={meta} id={b.keyItem} size={22} /><span>{b.keyItemName}</span></span> },
                { k: "Partidas com timeline", a: a.context.n, b: b.context.n },
                { k: "Minuto de conclusão (média)", a: fmt.clock(a.context.completion.mean), b: fmt.clock(b.context.completion.mean) },
                { k: "Ouro do time vs. inimigo (média)", a: fmt.signed(a.context.teamGold.mean), b: fmt.signed(b.context.teamGold.mean) },
                { k: "Ouro vs. jungler inimigo (média)", a: fmt.signed(a.context.oppGold.mean), b: fmt.signed(b.context.oppGold.mean) },
                { k: "Nível vs. jungler inimigo (média)", a: fmt.signed(a.context.oppLevel.mean, 1), b: fmt.signed(b.context.oppLevel.mean, 1) },
                { k: "Time 1.500+ de ouro à frente", a: fmt.pct(a.context.aheadShare), b: fmt.pct(b.context.aheadShare) },
                { k: "Abates /10 min antes → depois", a: `${fmt.dec(a.context.before.k, 1)} → ${fmt.dec(a.context.after.k, 1)}`, b: `${fmt.dec(b.context.before.k, 1)} → ${fmt.dec(b.context.after.k, 1)}` },
                { k: "Mortes /10 min antes → depois", a: `${fmt.dec(a.context.before.d, 1)} → ${fmt.dec(a.context.after.d, 1)}`, b: `${fmt.dec(b.context.before.d, 1)} → ${fmt.dec(b.context.after.d, 1)}` },
              ]} columns={[
                { key: "k", label: "", sortable: false },
                { key: "a", label: "Build A", num: true, sortable: false, render: (r) => <span className="bluec">{r.a}</span> },
                { key: "b", label: "Build B", num: true, sortable: false, render: (r) => <span className="goldc">{r.b}</span> },
              ]} />
              <p className="note">"Depois" só conta quando restam 3+ minutos de partida após a compra. Antes e depois mudam também porque o jogo avança; compare A com B, não o antes com o depois.</p>
            </Card>
          </div>

          <div className="grid">
            <StrataCard span={4} title="Por ouro do time na compra" data={res.byGold} note={res.byGold.unknownA + res.byGold.unknownB ? `${res.byGold.unknownA + res.byGold.unknownB} partida(s) sem timeline ficaram fora deste corte.` : null} />
            <StrataCard span={4} title="Por duração da partida" data={res.byDuration} />
            <StrataCard span={4} title="Por patch" data={res.byPatch} />
          </div>
        </>
      )}
    </div>
  );
}

function StrataCard({ title, data, note, span }) {
  return (
    <Card span={span} title={title} tip="Win rate de cada build dentro do mesmo contexto. Comparações dentro da mesma linha são mais justas do que o número geral.">
      <Table rowKey={(r) => r.key} rows={data.rows} columns={[
        { key: "key", label: "Faixa", sortable: false },
        { key: "a", label: "A", num: true, sortable: false, render: (r) => (r.a.n ? <span className="bluec">{fmt.pct(r.a.rate)} <span className="dim">({r.a.n})</span></span> : <span className="dim">—</span>) },
        { key: "b", label: "B", num: true, sortable: false, render: (r) => (r.b.n ? <span className="goldc">{fmt.pct(r.b.rate)} <span className="dim">({r.b.n})</span></span> : <span className="dim">—</span>) },
      ]} />
      {data.adjusted && <p className="note">Diferença ponderada: <b>{fmt.pp(data.adjusted.diff)}</b> (IC {fmt.pp(data.adjusted.ci[0])} a {fmt.pp(data.adjusted.ci[1])})</p>}
      {note && <p className="note">{note}</p>}
    </Card>
  );
}

function CIAxis({ rows }) {
  return (
    <div className="ci-axis">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => <React.Fragment key={t}><span className="gridl" style={{ left: `${t * 100}%` }} /><span className="tick" style={{ left: `${t * 100}%` }}>{fmt.pct(t)}</span></React.Fragment>)}
      {rows.map(([label, s, color], i) => (
        <div key={label} className="row" style={{ top: 4 + i * 16 }}>
          {s.ci && <span className="rng" style={{ left: `${s.ci[0] * 100}%`, width: `${(s.ci[1] - s.ci[0]) * 100}%`, background: color }} />}
          {s.rate != null && <span className="pt" style={{ left: `${s.rate * 100}%`, background: color }} title={`${label}: ${fmt.pct(s.rate, 1)}`} />}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
function ItemTable({ ctx }) {
  const { games, meta } = ctx;
  const [boots, setBoots] = useState(false);
  const rows = useMemo(() => E.itemStats(games, meta).filter((r) => boots || !r.boots), [games, meta, boots]);
  return (
    <Card title="Win rate por item" tip="Itens presentes no inventário final. Itens fechados tarde só aparecem em partidas longas: veja a duração média e o minuto médio de conclusão antes de comparar."
      right={<label className="field" style={{ gridAutoFlow: "column", alignItems: "center", gap: 8 }}><span>Botas</span>
        <select id="it-boots" value={boots ? "1" : "0"} onChange={(e) => setBoots(e.target.value === "1")}><option value="0">Ocultar</option><option value="1">Mostrar</option></select></label>}>
      <Table rowKey={(r) => r.id} rows={rows} initialSort={{ key: "n", dir: "desc" }} columns={[
        { key: "name", label: "Item", render: (r) => <span className="namecell"><ItemIcon meta={meta} id={r.id} /><span>{r.name}</span></span>, sortValue: (r) => r.name },
        ...statColumns(),
        { key: "medianDone", label: "Concluído (média)", num: true, render: (r) => fmt.clock(r.medianDone), tip: "Minuto médio em que o item foi completado (só partidas com timeline)." },
      ]} />
      <p className="note">Viés de sobrevivência: partidas que terminam cedo nunca chegam ao 4º ou 5º item, então itens tardios carregam o resultado de jogos longos. Use o Build Comparator para comparar itens no mesmo contexto.</p>
    </Card>
  );
}

function Combos({ ctx }) {
  const { games, meta } = ctx;
  const [mode, setMode] = useState("seq");
  const [size, setSize] = useState(3);
  const [minN, setMinN] = useState(2);
  const res = useMemo(() => E.comboStats(games, meta, { size, mode, minN }), [games, meta, size, mode, minN]);
  return (
    <Card title="Win rate por combinação de itens" tip="Combinações detectadas automaticamente nos seus dados. As combinações de referência que você usa aparecem marcadas."
      right={<div className="inline-form">
        <label className="field"><span>Tipo</span><select id="cb-mode" value={mode} onChange={(e) => setMode(e.target.value)}><option value="seq">Ordem de compra (timeline)</option><option value="set">Build final (qualquer ordem)</option></select></label>
        <label className="field"><span>Itens</span><select id="cb-size" value={size} onChange={(e) => setSize(Number(e.target.value))}><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option></select></label>
        <label className="field"><span>Mín. partidas</span><select id="cb-min" value={minN} onChange={(e) => setMinN(Number(e.target.value))}><option value={1}>1</option><option value={2}>2</option><option value={5}>5</option><option value={10}>10</option></select></label>
      </div>}>
      <Table rowKey={(r) => r.key} rows={res.rows} initialSort={{ key: "n", dir: "desc" }} pageSize={20} columns={[
        { key: "key", label: "Combinação", sortValue: (r) => r.key, render: (r) => (
          <span className="namecell"><ItemRow meta={meta} ids={r.items} arrows={mode === "seq"} />
            {isReference(r.items) && <span className="chip static" style={{ borderColor: "var(--gold)", color: "var(--gold)" }}>referência</span>}</span>) },
        ...statColumns({ withDmg: false }),
      ]} />
      <p className="note">{mode === "seq" ? `${res.evaluable} partidas com timeline chegaram a ${size} itens completos. Partidas sem timeline não têm ordem confiável e ficam fora (a ordem não é deduzida dos slots finais).` : `${res.evaluable} partidas com ${size}+ itens completos no inventário final. Uma partida pode contar em várias combinações.`}</p>
    </Card>
  );
}

function PurchaseOrder({ ctx }) {
  const { games, meta } = ctx;
  const os = useMemo(() => E.orderStats(games, meta, 5), [games, meta]);
  if (!os.tlGames) return <Card title="Ordem de compra"><Empty title="Sem partidas com timeline">A ordem de compra vem dos eventos da timeline. {os.noTL} partida(s) deste filtro não têm timeline; para elas só existem os itens finais.</Empty></Card>;
  const chart = os.bySlot.filter((s) => s.time.n).map((s) => ({ slot: `${s.slot}º`, median: s.time.mean / 60, p25: s.time.p25 / 60, p75: s.time.p75 / 60, n: s.reached,
    err: [Math.max(0, s.time.mean / 60 - s.time.p25 / 60), Math.max(0, s.time.p75 / 60 - s.time.mean / 60)] }));
  return (
    <div className="row-gap">
      <div className="grid">
        <Card span={8} title="Itens completos por posição" tip="Para cada posição (1º, 2º...), quais itens você fechou, com que frequência, em que minuto (em média) e o win rate.">
          <div className="tablewrap">
            <table>
              <thead><tr>{os.bySlot.map((s) => <th key={s.slot}>{s.slot}º item <span className="dim">· {s.reached}/{s.ofTL}</span></th>)}</tr></thead>
              <tbody>
                {Array.from({ length: Math.min(5, Math.max(...os.bySlot.map((s) => s.items.length))) }).map((_, row) => (
                  <tr key={row}>
                    {os.bySlot.map((s) => {
                      const it = s.items[row];
                      return <td key={s.slot}>{it ? (
                        <span className="namecell" title={`${it.name} · ${it.n} partidas · win rate ${fmt.pct(it.rate)} · em média ${fmt.clock(it.medianT)}`}>
                          <ItemIcon meta={meta} id={it.id} size={24} />
                          <span className="num">{fmt.pct(it.share)} <span className="dim">· {fmt.clock(it.medianT)} · {fmt.pct(it.rate)} WR</span></span>
                        </span>) : ""}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">{os.tlGames} partidas com timeline · {os.noTL} sem timeline (fora desta análise). Passe o mouse sobre um item para ver o nome. Compras desfeitas não contam.</p>
        </Card>
        <Card span={4} title="Minuto de conclusão por posição" tip="Barra: minuto médio. Linha fina: do 25º ao 75º percentil.">
          <div className="chart">
            <R.ResponsiveContainer>
              <R.ComposedChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <R.CartesianGrid {...gridProps} />
                <R.XAxis dataKey="slot" {...axisProps} />
                <R.YAxis {...axisProps} tickFormatter={(v) => `${Math.round(v)}′`} />
                <R.Tooltip cursor={{ fill: "#ffffff08" }} content={<ChartTip render={(pl) => { const x = pl[0].payload; return <><div>{x.slot} item · {x.n} partidas</div><div>Média <strong>{fmt.clock(x.median * 60)}</strong></div><div className="muted">P25–P75: {fmt.clock(x.p25 * 60)} a {fmt.clock(x.p75 * 60)}</div></>; }} />} />
                <R.Bar dataKey="median" fill={C.gold} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                  <R.ErrorBar dataKey="err" width={6} stroke={C.fg2} />
                </R.Bar>
              </R.ComposedChart>
            </R.ResponsiveContainer>
          </div>
          <dl className="kv">
            {os.bySlot.map((s) => <React.Fragment key={s.slot}><dt>Chegou ao {s.slot}º item</dt><dd className="num">{fmt.pct(s.reached / (s.ofTL || 1))} das partidas · WR {fmt.pct(s.winRateReached.rate)}</dd></React.Fragment>)}
          </dl>
        </Card>
      </div>
      <OrderList ctx={ctx} />
    </div>
  );
}

function OrderList({ ctx }) {
  const { games, meta } = ctx;
  const rows = games.filter((g) => g.order).slice(0, 60);
  return (
    <Card title="Ordem de compra por partida" tip="As 60 partidas mais recentes do filtro com timeline. Clique para abrir a partida.">
      <Table rowKey={(r) => r.id} rows={rows} onRowClick={(r) => ctx.openMatch(r.id)} rowClass={(r) => (r.win ? "win" : "loss")} pageSize={15} columns={[
        { key: "start", label: "Data", render: (r) => fmt.date(r.start), sortValue: (r) => r.start },
        { key: "win", label: "Resultado", render: (r) => <span className={`res ${r.win ? "w" : "l"}`}>{r.win ? "VITÓRIA" : "DERROTA"}</span>, sortValue: (r) => (r.win ? 1 : 0) },
        { key: "order", label: "Itens completos e minuto", sortable: false, render: (r) => (
          <span className="iconrow" style={{ gap: 10 }}>{r.order.map((o, i) => <span key={i} className="namecell" style={{ gap: 4 }}><ItemIcon meta={meta} id={o.id} size={22} /><span className="mono dim">{fmt.clock(o.t)}</span></span>)}</span>) },
        { key: "durMin", label: "Duração", num: true, render: (r) => fmt.dur(r.duration) },
      ]} />
    </Card>
  );
}

function PatchTable({ ctx }) {
  const { games, meta } = ctx;
  const rows = useMemo(() => E.patchStats(games, meta), [games, meta]);
  return (
    <Card title="Desempenho por patch" tip="Mudanças de patch alteram itens e campeões. Evite comparar builds misturando patches muito diferentes; use o filtro de patch ou a tabela 'Por patch' no comparador.">
      <Table rowKey={(r) => r.patch} rows={rows} initialSort={{ key: "patch", dir: "desc" }} columns={[
        { key: "patch", label: "Patch", sortValue: (r) => r.patch.split(".").map((x) => x.padStart(3, "0")).join("."), render: (r) => <button className="chip" onClick={() => ctx.setFilters({ patches: [r.patch] })} title="Filtrar por este patch">{r.patch}</button> },
        ...statColumns({ withDmg: false }),
        { key: "topFirst", label: "1º item mais comum", sortable: false, render: (r) => (r.topFirst ? <span className="namecell"><ItemIcon meta={meta} id={r.topFirst.id} size={22} /><span>{r.topFirst.name} <span className="dim">({r.topFirst.n})</span></span></span> : <span className="dim">sem timeline</span>) },
      ]} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// RUNAS
// ---------------------------------------------------------------------------
export function Runes({ ctx }) {
  const { games, meta } = ctx;
  const ks = useMemo(() => E.keystoneStats(games, meta), [games, meta]);
  const pages = useMemo(() => E.runePageStats(games, meta), [games, meta]);
  const minors = useMemo(() => E.minorRuneStats(games, meta), [games, meta]);
  const [matrixItems, setMatrixItems] = useState([ID.ECL, ID.DDA]);
  const matrix = useMemo(() => E.runeBuildMatrix(games, meta, matrixItems), [games, meta, matrixItems]);
  const itemOptions = useMemo(() => [...new Set(games.flatMap((g) => g.finalCompleted))].sort((a, b) => E.itemName(meta, a).localeCompare(E.itemName(meta, b), "pt-BR")), [games, meta]);
  if (!games.length) return <NoGames ctx={ctx} />;
  const top = pages[0];
  return (
    <div className="row-gap">
      <div className="grid">
        <Card span={5} title="Página mais usada" eyebrow={top ? `${top.n} partidas · win rate ${fmt.pct(top.rate)}` : ""}>
          {top && <RunePage meta={meta} runes={top.runes} />}
          <p className="note">Runas mostram o que você escolheu, não quanto cada runa contribuiu. Quando a API não traz o valor de uma runa, o dashboard não estima.</p>
        </Card>
        <Card span={7} title="Win rate por runa-chave">
          <Table rowKey={(r) => r.id} rows={ks} initialSort={{ key: "n", dir: "desc" }} columns={[
            { key: "name", label: "Runa-chave", sortValue: (r) => r.name, render: (r) => <span className="namecell"><RuneIcon meta={meta} id={r.id} size={26} /><span>{r.name} <span className="dim">· {r.styleName}</span></span></span> },
            ...statColumns({ withDur: false }),
          ]} />
          <p className="note">Para ver runas por matchup, use o filtro <b>Jungler adversário</b> no topo.</p>
        </Card>
      </div>
      <Card title="Runas × itens" tip="Win rate de cada runa-chave nas partidas em que o item estava na build final. Responde perguntas como: Eclipse com Conquistador rende diferente de Dança da Morte com Conquistador?"
        right={<div className="inline-form">{matrixItems.map((id, i) => (
          <label key={i} className="field"><span>Item {i + 1}</span>
            <select id={`rm-${i}`} value={id} onChange={(e) => setMatrixItems(matrixItems.map((x, j) => (j === i ? Number(e.target.value) : x)))}>
              {[...new Set([id, ...itemOptions])].map((o) => <option key={o} value={o}>{E.itemName(meta, o)}</option>)}
            </select></label>))}
          {matrixItems.length < 4 && itemOptions.length > matrixItems.length && <button className="btn sm" onClick={() => setMatrixItems([...matrixItems, itemOptions.find((o) => !matrixItems.includes(o))])}>+ item</button>}
          {matrixItems.length > 1 && <button className="btn sm ghost" onClick={() => setMatrixItems(matrixItems.slice(0, -1))}>− item</button>}
        </div>}>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Runa-chave</th>{matrixItems.map((id) => <th key={id}><span className="namecell"><ItemIcon meta={meta} id={id} size={20} /><span>{E.itemName(meta, id)}</span></span></th>)}</tr></thead>
            <tbody>{matrix.map((row) => (
              <tr key={row.keystone}>
                <td><span className="namecell"><RuneIcon meta={meta} id={row.keystone} /><span>{row.name}</span></span></td>
                {row.cells.map((c) => <td key={c.item}>{c.n ? <div style={{ display: "grid", gap: 4 }}><WRBar rate={c.rate} ci={c.ci} n={c.n} /><Sample n={c.n} /></div> : <span className="dim">sem partidas</span>}</td>)}
              </tr>))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="grid">
        <Card span={7} title="Páginas completas" tip="Runa-chave + menores + árvore secundária, exatamente como registradas nas partidas.">
          <Table rowKey={(r) => r.key} rows={pages} initialSort={{ key: "n", dir: "desc" }} pageSize={10} columns={[
            { key: "key", label: "Página", sortable: false, render: (r) => (
              <span className="iconrow">{(r.runes.primary || []).map((id, i) => <RuneIcon key={i} meta={meta} id={id} size={i ? 20 : 26} />)}<span className="arrow">|</span>{(r.runes.secondary || []).map((id, i) => <RuneIcon key={"s" + i} meta={meta} id={id} size={20} />)}</span>) },
            ...statColumns({ withDur: false, withDmg: false }),
          ]} />
        </Card>
        <Card span={5} title="Runas menores">
          <Table rowKey={(r) => r.id} rows={minors} initialSort={{ key: "n", dir: "desc" }} maxHeight={420} columns={[
            { key: "name", label: "Runa", sortValue: (r) => r.name, render: (r) => <span className="namecell"><RuneIcon meta={meta} id={r.id} size={20} /><span>{r.name}</span></span> },
            { key: "n", label: "Partidas", num: true },
            { key: "rate", label: "Win rate", render: (r) => <WRBar rate={r.rate} ci={r.ci} n={r.n} /> },
          ]} />
        </Card>
      </div>
    </div>
  );
}

// Página de runas da partida com o que cada runa rendeu (dano, ouro, cura...) e quanto isso
// representa do total da partida. Sem os valores (coletor antigo), mostra a página simples.
export function RuneBreakdown({ meta, g, showHint }) {
  const rc = useMemo(() => E.runeContributions(g, meta), [g, meta]);
  const runes = g.runes;
  if (!runes) return null;
  if (!rc.hasValues) return (
    <>
      <RunePage meta={meta} runes={runes} />
      {showHint && <p className="note" style={{ marginTop: 10 }}>Atualize o coletor para a versão 1.8 para ver aqui quanto cada runa rendeu de dano, ouro e cura nesta partida.</p>}
    </>
  );
  const shards = (runes.shards || []).filter(Boolean);
  const group = (key, styleId) => (
    <div className="rb-group">
      <div className="eyebrow">{E.runeName(meta, styleId)}</div>
      {rc.runes.filter((r) => r.group === key).map((r) => (
        <div key={r.id} className={`rb-row ${key === "primary" && r.slot === 0 ? "key" : ""}`}>
          <RuneIcon meta={meta} id={r.id} size={key === "primary" && r.slot === 0 ? 38 : 28} />
          <div className="rb-body">
            <div className="rb-name">{E.runeName(meta, r.id)}</div>
            {r.lines.length > 0 && <div className="rb-lines">{r.lines.map((l, i) => <span key={i}>{l.text}</span>)}</div>}
            {r.contrib.filter((c) => c.pct != null).map((c) => (
              <div key={c.kind} className={`rb-share ${c.kind}`}>
                <span className="rb-bar"><i style={{ width: `${Math.min(100, Math.max(2, c.pct * 100))}%` }} /></span>
                <span><b>{fmt.pct(c.pct, c.pct < 0.1 ? 1 : 0)}</b> {E.RUNE_KIND[c.kind].label}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
  const totals = rc.totals.filter((t) => t.pct != null);
  return (
    <div className="rb">
      {group("primary", runes.primaryStyle)}
      {group("secondary", runes.subStyle)}
      {shards.length > 0 && <div className="rb-group"><div className="eyebrow">Fragmentos</div>
        <div className="chips">{shards.map((s, i) => <span key={i} className="chip static">{(meta.shards || {})[String(s)] || `Fragmento ${s}`}</span>)}</div></div>}
      {totals.length > 0 && (
        <div className="rb-total">
          <div className="eyebrow">Somando as runas</div>
          {totals.map((t) => (
            <div key={t.kind} className={`rb-share ${t.kind}`}>
              <span className="rb-bar"><i style={{ width: `${Math.min(100, Math.max(2, t.pct * 100))}%` }} /></span>
              <span><b>{fmt.int(t.value)}</b> {t.kind === "damage" ? "de dano" : t.kind === "gold" ? "de ouro" : t.kind === "heal" ? "de cura" : "de dano evitado"} · <b>{fmt.pct(t.pct, t.pct < 0.1 ? 1 : 0)}</b> {E.RUNE_KIND[t.kind].label} ({fmt.int(t.total)})</span>
            </div>
          ))}
        </div>
      )}
      <p className="note">Valores que a Riot registra no fim da partida, os mesmos da aba Runas do cliente. A porcentagem compara com o seu total na partida.</p>
    </div>
  );
}

export function RunePage({ meta, runes }) {
  if (!runes) return null;
  const shards = (runes.shards || []).filter(Boolean);
  return (
    <div className="split" style={{ gap: 10 }}>
      <div className="row-gap" style={{ gap: 8 }}>
        <div className="eyebrow">{E.runeName(meta, runes.primaryStyle)}</div>
        {(runes.primary || []).map((id, i) => <span key={i} className="namecell"><RuneIcon meta={meta} id={id} size={i ? 26 : 36} /><span style={i ? null : { fontWeight: 600 }}>{E.runeName(meta, id)}</span></span>)}
      </div>
      <div className="row-gap" style={{ gap: 8, alignContent: "start" }}>
        <div className="eyebrow">{E.runeName(meta, runes.subStyle)}</div>
        {(runes.secondary || []).map((id, i) => <span key={i} className="namecell"><RuneIcon meta={meta} id={id} size={26} /><span>{E.runeName(meta, id)}</span></span>)}
        {shards.length > 0 && <><div className="eyebrow" style={{ marginTop: 6 }}>Fragmentos</div>
          <div className="chips">{shards.map((s, i) => <span key={i} className="chip static">{(meta.shards || {})[String(s)] || `Fragmento ${s}`}</span>)}</div></>}
      </div>
    </div>
  );
}
