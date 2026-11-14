import * as E from "./engine.js";
import * as CH from "./challenger.js";
import { makeDemoDataset } from "./demo.js";
import { initStore, hintHasData } from "./storage.js";
import { STATIC, initStaticStore } from "./static_store.js";
import { shrinkIcons, shrinkVisual } from "./icons.js";
import { fmt, NavIcon, BrandMark, Tip, ChampIcon } from "./ui.jsx";
import { Overview } from "./views_overview.jsx";
import { Builds, Runes } from "./views_builds.jsx";
import { Farm, Objectives, Deaths, Matchups, Coach } from "./views_jungle.jsx";
import { Early } from "./views_early.jsx";
import { Evolution } from "./views_evolution.jsx";
import { History, MatchDrawer, DataSettings } from "./views_data.jsx";
import { Challenger } from "./views_challenger.jsx";
import { Home } from "./views_home.jsx";
import { Habits } from "./views_habits.jsx";

const React = window.React;
const { useState, useEffect, useMemo, useCallback, useRef } = React;

const SECTIONS = [
  ["visao-geral", "Visão Geral", "home", "Principal"],
  ["habitos", "Hábitos", "habits", "Principal"],
  ["coach", "Coach Analítico", "coach", "Principal"],
  ["rumo-challenger", "Rumo ao Challenger", "challenger", "Principal"],
  ["mono-briar", "Mono Briar", "briar", "Principal"],
  ["builds", "Builds e Itens", "builds", "Builds"],
  ["runas", "Runas", "runes", "Builds"],
  ["early-game", "Early Game", "early", "Seu jogo"],
  ["mortes", "Análise de Mortes", "deaths", "Seu jogo"],
  ["objetivos", "Objetivos", "objectives", "Seu jogo"],
  ["farm", "Farm e Economia", "farm", "Seu jogo"],
  ["matchups", "Matchups", "matchups", "Seu jogo"],
  ["estatisticas", "Análise e Estatísticas", "stats", "Dados"],
  ["evolucao", "Evolução", "evolution", "Dados"],
  ["historico", "Histórico de Partidas", "history", "Dados"],
  ["importacao", "Configurações e Importação", "settings", "Dados"],
].filter((s) => !(STATIC && s[0] === "importacao"));
const SECTION_IDS = SECTIONS.map((s) => s[0]);

function readHash() {
  const h = (location.hash || "").replace(/^#/, "");
  return SECTION_IDS.includes(h) ? h : "visao-geral";
}
// Versão do padrão de filtros: quando o padrão muda, os filtros salvos voltam uma vez para o novo padrão.
const FILTERS_VERSION = 2;
function loadFilters() {
  try {
    const f = JSON.parse(localStorage.getItem("jpa.filters") || "null");
    if (f && typeof f === "object" && f.fv === FILTERS_VERSION) return { ...E.DEFAULT_FILTERS, ...f };
  } catch { /* sem armazenamento */ }
  return E.DEFAULT_FILTERS;
}

function App() {
  const [section, setSection] = useState(readHash);
  const [filters, setFiltersRaw] = useState(loadFilters);
  const [dataset, setDataset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState(null);
  const [savedInfo, setSavedInfo] = useState(null);
  const [notes, setNotes] = useState({});
  const [prefs, setPrefs] = useState({});
  const [refs, setRefs] = useState(null);
  const [briarRefs, setBriarRefs] = useState(null);
  const [openMatch, setOpenMatch] = useState(null);
  const [toast, setToast] = useState(null);
  const [moreFilters, setMoreFilters] = useState(false);
  const toastTimer = useRef(null);

  const showToast = useCallback((text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5200);
  }, []);

  // Navegação pelo endereço (#secao)
  useEffect(() => {
    const on = () => setSection(readHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const go = (id) => {
    setSection(id);
    try { history.replaceState(null, "", "#" + id); } catch { location.hash = id; }
    window.scrollTo({ top: 0 });
  };

  const setFilters = useCallback((upd) => {
    setFiltersRaw((f) => {
      const next = typeof upd === "function" ? upd(f) : { ...f, ...upd };
      try { localStorage.setItem("jpa.filters", JSON.stringify({ ...next, fv: FILTERS_VERSION })); } catch { /* ok */ }
      return next;
    });
  }, []);

  // Carrega dados salvos (artefato -> navegador -> demonstração)
  useEffect(() => {
    let alive = true;
    (async () => {
      const st = STATIC ? await initStaticStore() : await initStore();
      if (!alive) return;
      setStore(st);
      const [saved, n, p, r] = await Promise.all([st.loadDataset().catch((e) => { console.warn(e); return null; }), st.loadNotes(), st.loadPrefs(), st.loadRefs().catch(() => null)]);
      if (!alive) return;
      if (saved && saved.dataset && saved.dataset.matches) {
        setDataset(saved.dataset);
        setSavedInfo({ where: saved.where, savedAt: saved.savedAt });
      } else {
        setDataset((d) => d || makeDemoDataset());
        if (STATIC) showToast("Não foi possível carregar os dados do site. Mostrando a demonstração.");
      }
      setNotes(n || {});
      setPrefs(p || {});
      if (r && r.refs && CH.isRefsFile(r.refs)) setRefs(r.refs);
      try { const b = st.loadBriarRefs ? await st.loadBriarRefs() : null; if (alive && b && b.refs && CH.isRefsFile(b.refs)) setBriarRefs(b.refs); } catch { /* sem mono Briar */ }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const isDemo = !dataset || dataset.source === "demo";
  const prepared = useMemo(() => E.prepare(dataset), [dataset]);
  const meta = prepared.meta || {};
  const filtered = useMemo(() => E.applyFilters(prepared.games, filters), [prepared, filters]);

  const options = useMemo(() => {
    const g = prepared.games;
    const champs = [...new Set(["Briar", "Viego", "LeeSin", ...g.map((x) => x.champ)])];
    const patches = [...new Set(g.map((x) => x.patch))].sort((a, b) => E.comparePatch(b, a));
    const opps = [...new Set(g.map((x) => x.oppChamp).filter(Boolean))].sort((a, b) => E.champDisplay(meta, a).localeCompare(E.champDisplay(meta, b), "pt-BR"));
    const items = [...new Set(g.flatMap((x) => x.finalItems))].filter((id) => E.isCompletedItem(meta, id))
      .sort((a, b) => E.itemName(meta, a).localeCompare(E.itemName(meta, b), "pt-BR"));
    const keystones = [...new Set(g.map((x) => x.keystone).filter(Boolean))];
    const champId = Object.fromEntries(g.map((x) => [x.champ, x.champId]));
    const oppId = Object.fromEntries(g.map((x) => [x.oppChamp, x.oppChampId]));
    return { champs, patches, opps, items, keystones, champId, oppId };
  }, [prepared, meta]);

  // Jogadores de referência (aba Rumo ao Challenger)
  const importRefs = useCallback(async (raw) => {
    const { refs: mergedRaw, report } = CH.mergeRefs(refs, raw);
    const merged = await shrinkIcons(mergedRaw);
    setRefs(merged);
    const res = store ? await store.saveRefs(merged) : { where: "memory" };
    return { report, saved: res };
  }, [refs, store]);
  const clearRefs = useCallback(async () => {
    if (store) await store.clearRefs();
    setRefs(null);
  }, [store]);

  // Mono Briar: o arquivo novo substitui o anterior
  const importBriarRefs = useCallback(async (raw) => {
    const next = await shrinkIcons(raw);
    setBriarRefs(next);
    const res = store?.saveBriarRefs ? await store.saveBriarRefs(next) : { where: "memory" };
    return { report: { players: next.players.length, added: next.players.reduce((n, p) => n + p.matches.length, 0), total: next.players.reduce((n, p) => n + p.matches.length, 0), removed: 0 }, saved: res };
  }, [store]);

  // Importação (mescla incremental)
  const importData = useCallback(async (raw) => {
    if (CH.isRefsFile(raw) && raw.kind === "briar") return { ...(await importBriarRefs(raw)), refs: true };
    if (CH.isRefsFile(raw)) return { ...(await importRefs(raw)), refs: true };
    const kind = E.validateDataset(raw);
    if (kind === "backup") {
      const ds = raw.dataset;
      E.validateDataset(ds);
      const base = isDemo ? null : dataset;
      const { dataset: mergedRaw, report } = E.mergeDatasets(base, ds);
      const merged = await shrinkIcons(mergedRaw);
      setDataset(merged);
      const mergedNotes = { ...notes, ...(raw.notes || {}) };
      setNotes(mergedNotes);
      if (raw.prefs) setPrefs(raw.prefs);
      const res = await store.saveDataset(merged);
      setSavedInfo({ where: res.where, savedAt: res.savedAt });
      for (const [id, n] of Object.entries(raw.notes || {})) await store.saveNote(id, n, mergedNotes);
      if (raw.prefs) await store.savePrefs(raw.prefs);
      return { report, saved: res };
    }
    const base = isDemo ? null : dataset;
    const { dataset: mergedRaw, report } = E.mergeDatasets(base, raw);
    const merged = await shrinkVisual(await shrinkIcons(E.riftOnly(mergedRaw)));
    report.removedOtherModes = mergedRaw.matches.length - merged.matches.length;
    setDataset(merged);
    const res = store ? await store.saveDataset(merged) : { where: "memory" };
    setSavedInfo({ where: res.where, savedAt: res.savedAt });
    return { report, saved: res };
  }, [dataset, isDemo, notes, store, importRefs, importBriarRefs]);

  const clearAll = useCallback(async () => {
    if (store) await store.clearDataset();
    setDataset(makeDemoDataset());
    setSavedInfo(null);
    showToast("Dados apagados. O dashboard voltou ao modo demonstração.");
  }, [store, showToast]);

  const setNote = useCallback(async (matchId, note) => {
    const next = { ...notes };
    if (!note || (!note.tags?.length && !note.text)) delete next[matchId]; else next[matchId] = note;
    setNotes(next);
    const where = store ? await store.saveNote(matchId, note, next) : "memory";
    showToast(where === "cloud" ? "Marcações salvas no dashboard." : where === "local" ? "Marcações salvas neste navegador." : "Marcações mantidas só nesta sessão. Exporte um backup para não perder.");
  }, [notes, store, showToast]);

  const savePrefs = useCallback(async (p) => {
    setPrefs(p);
    if (store) await store.savePrefs(p);
  }, [store]);

  const ctx = {
    games: filtered.current, previous: filtered.previous, prevLabel: filtered.prevLabel, pool: filtered.pool, all: prepared.games,
    remakesExcluded: filtered.remakesExcluded, meta, filters, setFilters, options, openMatch: (id, t) => setOpenMatch({ id, t: t ?? null }), notes, setNote,
    store, isDemo, dataset, importData, clearAll, savedInfo, prefs, savePrefs, toast: showToast, go,
    refs, importRefs, clearRefs, briarRefs,
  };

  const current = SECTIONS.find((s) => s[0] === section);
  const periodLabel = E.PERIOD_LABELS[filters.period];

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <BrandMark />
          <div className="brand-name">JUNGLE PERFORMANCE<small>ANALYTICS</small></div>
        </div>
        <nav className="nav" aria-label="Seções">
          {SECTIONS.map(([id, label, icon, group], k) => (
            <React.Fragment key={id}>
              {(k === 0 || SECTIONS[k - 1][3] !== group) && <div className="nav-group">{group}</div>}
              <button aria-current={section === id ? "page" : undefined} onClick={() => go(id)}>
                <NavIcon name={icon} /><span>{label}</span>
                {!STATIC && id === "visao-geral" && section !== id && <span className="new-badge">NOVO</span>}
              </button>
            </React.Fragment>
          ))}
        </nav>
        <div className="side-foot">
          <span><span className={`dot ${isDemo ? "demo" : "ok"}`} style={{ display: "inline-block", marginRight: 6 }} />{isDemo ? "Dados simulados" : `${prepared.games.length} partidas importadas`}</span>
          {!isDemo && dataset?.player?.riotId && <span className="mono">{dataset.player.riotId}</span>}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="titlebar">
            <h1>JUNGLE PERFORMANCE ANALYTICS</h1>
            <span className="sub">Análise de desempenho, builds e tomada de decisão — League of Legends</span>
            <div className="right">
              <DataPill isDemo={isDemo} loading={loading} store={store} savedInfo={savedInfo} n={prepared.games.length} />
            </div>
          </div>
          {section !== "visao-geral" && <FilterBar filters={filters} setFilters={setFilters} options={options} meta={meta} more={moreFilters} setMore={setMoreFilters} />}
        </header>

        <main className="content" id="conteudo">
          {isDemo && !loading && (
            <div className="demo-banner" role="status">
              <strong>MODO DEMONSTRAÇÃO — DADOS SIMULADOS</strong>
              <span>Nenhum número desta tela é seu. As partidas são fictícias e servem só para mostrar como o dashboard funciona.</span>
              {!STATIC && <button className="btn sm" onClick={() => go("importacao")}>Importar minhas partidas</button>}
            </div>
          )}
          {loading ? <LoadingState /> : (
            <>
              {section !== "visao-geral" && <SampleLine ctx={ctx} periodLabel={periodLabel} sectionLabel={current[1]} />}
              {section === "visao-geral" && <Home ctx={ctx} />}
              {section === "estatisticas" && <Overview ctx={ctx} />}
              {section === "habitos" && <Habits ctx={ctx} />}
              {section === "builds" && <Builds ctx={ctx} />}
              {section === "runas" && <Runes ctx={ctx} />}
              {section === "early-game" && <Early ctx={ctx} />}
              {section === "farm" && <Farm ctx={ctx} />}
              {section === "objetivos" && <Objectives ctx={ctx} />}
              {section === "mortes" && <Deaths ctx={ctx} />}
              {section === "matchups" && <Matchups ctx={ctx} />}
              {section === "evolucao" && <Evolution ctx={ctx} />}
              {section === "historico" && <History ctx={ctx} />}
              {section === "coach" && <Coach ctx={ctx} />}
              {section === "rumo-challenger" && <Challenger key="challenger" ctx={ctx} />}
              {section === "mono-briar" && <Challenger key="briar" ctx={ctx} variant="briar" />}
              {section === "importacao" && !STATIC && <DataSettings ctx={ctx} />}
            </>
          )}
          {STATIC && <SiteFooter dataset={dataset} savedInfo={savedInfo} />}
        </main>
      </div>
      {openMatch && <MatchDrawer key={openMatch.id + ":" + (openMatch.t ?? "")} ctx={ctx} id={openMatch.id} focusT={openMatch.t} onClose={() => setOpenMatch(null)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function DataPill({ isDemo, loading, store, savedInfo, n }) {
  if (loading) return <span className="data-pill"><span className="dot" />{STATIC ? "Carregando partidas…" : "Carregando dados salvos…"}</span>;
  if (isDemo) return <span className="data-pill"><span className="dot demo" />Demonstração</span>;
  if (STATIC) return <span className="data-pill"><span className="dot ok" />{n} partidas{savedInfo?.savedAt ? ` · atualizado em ${new Date(savedInfo.savedAt).toLocaleDateString("pt-BR")}` : ""}</span>;
  const where = savedInfo?.where;
  const txt = where === "cloud" ? "Salvo no dashboard" : where === "local" ? "Salvo só neste navegador" : "Não salvo — exporte um backup";
  return <span className="data-pill" title={savedInfo?.savedAt ? `Atualizado em ${new Date(savedInfo.savedAt).toLocaleString("pt-BR")}` : ""}><span className={`dot ${where === "cloud" ? "ok" : "warn"}`} />{n} partidas · {txt}</span>;
}

function SiteFooter({ dataset, savedInfo }) {
  const rid = dataset?.player?.riotId;
  return (
    <footer className="site-foot">
      <div>{rid ? <><b>{rid}</b> · </> : null}Jungle Performance Analytics{savedInfo?.savedAt ? ` · dados de ${new Date(savedInfo.savedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}` : ""}</div>
      <p>Jungle Performance Analytics não é endossado pela Riot Games e não reflete as opiniões da Riot Games nem de ninguém oficialmente envolvido na produção ou na gestão das propriedades da Riot Games. Riot Games e todas as propriedades associadas são marcas comerciais ou marcas registradas da Riot Games, Inc.</p>
    </footer>
  );
}

function LoadingState() {
  return (
    <div className="row-gap" aria-busy="true">
      <div className="kpis">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 92 }} />)}</div>
      <div className="skeleton" style={{ height: 280 }} />
      <p className="muted">Carregando suas partidas salvas…</p>
    </div>
  );
}

function SampleLine({ ctx, periodLabel, sectionLabel }) {
  const n = ctx.games.length;
  const wTL = ctx.games.filter((g) => g.hasTL).length;
  const first = ctx.games.at(-1), last = ctx.games[0];
  return (
    <div className="section-title">
      <h1>{sectionLabel}</h1>
      <p className="num">
        <strong style={{ color: "var(--fg)" }}>{n} partidas</strong> · {periodLabel}
        {n > 0 && <> · {fmt.date(first.start)} a {fmt.date(last.start)}</>}
        {" "}· {wTL} com timeline, {n - wTL} sem
        {ctx.remakesExcluded > 0 && !ctx.filters.includeRemakes && <> · {ctx.remakesExcluded} remake(s) fora</>}
      </p>
    </div>
  );
}

function FilterBar({ filters: f, setFilters, options, meta, more, setMore }) {
  const set = (k) => (e) => setFilters({ [k]: e.target.value });
  const active = [];
  if (f.patches.length) active.push(["Patch " + f.patches.join(", "), () => setFilters({ patches: [] })]);
  if (f.result !== "all") active.push([f.result === "win" ? "Só vitórias" : "Só derrotas", () => setFilters({ result: "all" })]);
  if (f.oppJungler) active.push(["vs " + E.champDisplay(meta, f.oppJungler, options.oppId[f.oppJungler]), () => setFilters({ oppJungler: "" })]);
  if (f.duration !== "all") active.push([{ lt25: "< 25 min", "25to32": "25–32 min", gt32: "> 32 min" }[f.duration], () => setFilters({ duration: "all" })]);
  if (f.slotItem.slot && f.slotItem.item) active.push([`${f.slotItem.slot}º item: ${E.itemName(meta, f.slotItem.item)}`, () => setFilters({ slotItem: { slot: 0, item: 0 } })]);
  if (f.anyItem) active.push(["Com " + E.itemName(meta, f.anyItem), () => setFilters({ anyItem: 0 })]);
  if (f.keystone) active.push([E.runeName(meta, f.keystone), () => setFilters({ keystone: 0 })]);
  if (f.side !== "all") active.push([f.side === "blue" ? "Lado azul" : "Lado vermelho", () => setFilters({ side: "all" })]);
  if (f.timeline !== "all") active.push([f.timeline === "with" ? "Com timeline" : "Sem timeline", () => setFilters({ timeline: "all" })]);
  if (f.position !== "JUNGLE") active.push(["Todas as posições", () => setFilters({ position: "JUNGLE" })]);
  if (f.includeRemakes) active.push(["Incluindo remakes", () => setFilters({ includeRemakes: false })]);
  return (
    <div className="row-gap" style={{ gap: 8 }}>
      <div className="filters">
        <label className="field"><span>Período</span>
          <select id="f-period" value={f.period} onChange={set("period")}>
            {Object.entries(E.PERIOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        {f.period === "custom" && <>
          <label className="field"><span>De</span><input id="f-from" type="date" value={f.from} onChange={set("from")} /></label>
          <label className="field"><span>Até</span><input id="f-to" type="date" value={f.to} onChange={set("to")} /></label>
        </>}
        <label className="field"><span>Campeão</span>
          <select id="f-champ" value={f.champion} onChange={set("champion")}>
            <option value="ALL">Todos</option>
            {options.champs.map((c) => <option key={c} value={c}>{E.champDisplay(meta, c, options.champId[c])}</option>)}
          </select>
        </label>
        <label className="field"><span>Fila</span>
          <select id="f-queue" value={f.queue} onChange={set("queue")}>
            <option value="420">Ranqueada Solo/Duo</option>
            <option value="440">Ranqueada Flex</option>
            <option value="normal">Normal</option>
            <option value="all">Todas</option>
          </select>
        </label>
        <label className="field"><span>Resultado</span>
          <select id="f-result" value={f.result} onChange={set("result")}>
            <option value="all">Vitórias e derrotas</option><option value="win">Só vitórias</option><option value="loss">Só derrotas</option>
          </select>
        </label>
        <label className="field"><span>Jungler adversário</span>
          <select id="f-opp" value={f.oppJungler} onChange={set("oppJungler")}>
            <option value="">Todos</option>
            {options.opps.map((c) => <option key={c} value={c}>{E.champDisplay(meta, c, options.oppId[c])}</option>)}
          </select>
        </label>
        <button className="btn ghost" aria-expanded={more} onClick={() => setMore(!more)}>{more ? "Menos filtros" : "Mais filtros"}{active.length ? ` (${active.length})` : ""}</button>
        {(active.length > 0 || f.champion !== E.DEFAULT_FILTERS.champion || f.queue !== "420" || f.period !== "last50") &&
          <button className="btn ghost" onClick={() => setFilters(E.DEFAULT_FILTERS)}>Restaurar padrão</button>}
      </div>
      {more && (
        <div className="filters">
          <label className="field"><span>Patch</span>
            <select id="f-patch" value={f.patches[0] || ""} onChange={(e) => setFilters({ patches: e.target.value ? [e.target.value] : [] })}>
              <option value="">Todos</option>
              {options.patches.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="field"><span>Duração</span>
            <select id="f-dur" value={f.duration} onChange={set("duration")}>
              <option value="all">Qualquer</option><option value="lt25">Menos de 25 min</option><option value="25to32">25 a 32 min</option><option value="gt32">Mais de 32 min</option>
            </select>
          </label>
          <label className="field"><span>Posição do item</span>
            <select id="f-slot" value={f.slotItem.slot} onChange={(e) => setFilters({ slotItem: { ...f.slotItem, slot: Number(e.target.value) } })}>
              <option value={0}>—</option><option value={1}>1º item</option><option value={2}>2º item</option><option value={3}>3º item</option><option value={4}>4º item</option>
            </select>
          </label>
          <label className="field"><span>Item nessa posição</span>
            <select id="f-slotitem" value={f.slotItem.item} onChange={(e) => setFilters({ slotItem: { slot: f.slotItem.slot || 1, item: Number(e.target.value) } })}>
              <option value={0}>—</option>
              {options.items.map((id) => <option key={id} value={id}>{E.itemName(meta, id)}</option>)}
            </select>
          </label>
          <label className="field"><span>Item na build final</span>
            <select id="f-any" value={f.anyItem} onChange={(e) => setFilters({ anyItem: Number(e.target.value) })}>
              <option value={0}>Qualquer</option>
              {options.items.map((id) => <option key={id} value={id}>{E.itemName(meta, id)}</option>)}
            </select>
          </label>
          <label className="field"><span>Runa principal</span>
            <select id="f-key" value={f.keystone} onChange={(e) => setFilters({ keystone: Number(e.target.value) })}>
              <option value={0}>Qualquer</option>
              {options.keystones.map((id) => <option key={id} value={id}>{E.runeName(meta, id)}</option>)}
            </select>
          </label>
          <label className="field"><span>Lado</span>
            <select id="f-side" value={f.side} onChange={set("side")}>
              <option value="all">Azul e vermelho</option><option value="blue">Azul</option><option value="red">Vermelho</option>
            </select>
          </label>
          <label className="field"><span>Timeline</span>
            <select id="f-tl" value={f.timeline} onChange={set("timeline")}>
              <option value="all">Com e sem</option><option value="with">Só com timeline</option><option value="without">Só sem timeline</option>
            </select>
          </label>
          <label className="field"><span>Posição</span>
            <select id="f-pos" value={f.position} onChange={set("position")}>
              <option value="JUNGLE">Jungle</option><option value="ALL">Todas</option>
            </select>
          </label>
          <label className="field"><span>Remakes</span>
            <select id="f-remake" value={f.includeRemakes ? "1" : "0"} onChange={(e) => setFilters({ includeRemakes: e.target.value === "1" })}>
              <option value="0">Excluir</option><option value="1">Incluir</option>
            </select>
          </label>
          <label className="field"><span>Faixa de elo <Tip text="A API de partidas não informa o elo de cada partida no histórico. O filtro fica desativado até existirem dados confiáveis." /></span>
            <select id="f-elo" disabled><option>Sem dados confiáveis</option></select>
          </label>
        </div>
      )}
      {active.length > 0 && (
        <div className="chips">
          {active.map(([label, clear]) => <button key={label} className="chip" aria-pressed="true" onClick={clear}>{label} <span className="x" aria-hidden="true">✕</span></button>)}
        </div>
      )}
    </div>
  );
}

window.ReactDOM.createRoot(document.getElementById("root")).render(<App />);
