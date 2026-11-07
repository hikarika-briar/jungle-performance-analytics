// Visão Geral (v2): banner com ícone, elo e blocos visuais com o que mais importa no período.
import * as E from "./engine.js";
import { STATIC } from "./static_store.js";
import * as CH from "./challenger.js";
import * as RK from "./rank.js";
import * as G from "./goals.js";
import { fmt, C, Tip, Ring, CountUp, Versus, ItemIcon, RuneIcon, ChampIcon, NavIcon, ChartTip, axisProps, gridProps } from "./ui.jsx";
import { SummonerCrest, RankEmblem, HeroBackdrop, JungleGlyph } from "./visual.jsx";
import { prepareBannerImage } from "./icons.js";
import { EarlyTile } from "./views_early.jsx";

const React = window.React;
const { useMemo, useState } = React;
const R = window.Recharts;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

const PERIODS = [["last20", "Últimas 20"], ["last50", "Últimas 50"], ["last100", "Últimas 100"], ["d30", "30 dias"], ["all", "Tudo"]];

export function timeAgo(ts) {
  const m = Math.max(0, (Date.now() - ts) / 60000);
  if (m < 60) return `há ${Math.round(m)} min`;
  if (m < 48 * 60) return `há ${Math.round(m / 60)} h`;
  return `há ${Math.round(m / 1440)} dias`;
}

export function useHomeData(ctx) {
  const { games, pool, meta, dataset, prefs, refs } = ctx;
  const history = useMemo(() => RK.rankHistory(dataset, prefs?.rankManual), [dataset, prefs?.rankManual]);
  const cur = useMemo(() => RK.currentRank(dataset, history), [dataset, history]);
  const prep = useMemo(() => CH.prepareRefs(refs), [refs]);
  const opp = useMemo(() => CH.opponentGames(games, meta), [games, meta]);
  const cmp = useMemo(() => CH.compare(games, prep ? prep.players : [], opp), [games, prep, opp]);
  return { history, cur, prep, cmp };
}

export function Home({ ctx }) {
  const { games, pool, meta, dataset, filters, setFilters, go, isDemo } = ctx;
  const { history, cur, prep, cmp } = useHomeData(ctx);
  const visual = meta.visual || {};
  const main = useMemo(() => CH.topChamps(pool.length ? pool : games, 1)[0] || null, [pool, games]);
  const champSplash = (main && visual.splash?.[main.champ]) || Object.values(visual.splash || {})[0] || null;
  const [draft, setDraft] = useState(null); // enquadramento em edição (prévia ao vivo)
  const custom = draft || ctx.prefs?.banner || null;
  const customSrc = custom ? (custom.assetId ? "/_blob/" + custom.assetId : custom.src || null) : null;
  const splash = customSrc || champSplash;
  const frame = customSrc ? custom : null;
  const [name, tag] = String(dataset?.player?.riotId || (isDemo ? "Invocador#DEMO" : "Invocador")).split("#");
  const me = cmp.style.find((s) => s.isMe);
  const season = cur && isNum(cur.wins) ? { w: cur.wins, l: cur.losses, rate: cur.wins / Math.max(1, cur.wins + cur.losses) } : null;
  const step = RK.nextStep(cur);
  const periodLabel = { last10: "últimas 10", last20: "últimas 20", last50: "últimas 50", last100: "últimas 100", d7: "7 dias", d30: "30 dias", d90: "90 dias", all: "todo o histórico", custom: "período" }[filters.period] || "";

  return (
    <div className="home">
      <section className="banner">
        <HeroBackdrop splash={splash} frame={frame} />
        {!isDemo && !STATIC && <BannerEditor ctx={ctx} draft={draft} setDraft={setDraft} hasChamp={!!champSplash} />}
        <div className="hero-inner">
          <SummonerCrest icon={visual.profileIcon} level={dataset?.profile?.summonerLevel} initials={(name || "?").slice(0, 1).toUpperCase()} />
          <div className="hero-id">
            <div className="eyebrow">{isDemo ? "Modo demonstração" : "Perfil de invocador · BR"}</div>
            <h1 className="hero-name">{name}{tag && <span>#{tag}</span>}</h1>
            <div className="hero-tags">
              <span className="htag"><JungleGlyph /> Caçador</span>
              {main && <span className="htag"><ChampIcon meta={meta} id={main.champId} keyName={main.champ} size={16} /> Main {E.champDisplay(meta, main.champ, main.champId)} · {main.n} partidas</span>}
              {season && <span className="htag">Temporada: {season.w}V {season.l}D · {fmt.pct(season.rate)}</span>}
              {me && me.tags.slice(0, 2).map((t) => <span key={t} className="htag teal">{t}</span>)}
            </div>
          </div>
          <div className="hero-rank">
            <RankEmblem tier={cur?.tier} rank={cur?.rank} size={136} images={visual.emblems} />
            <div>
              <div className="eyebrow">Ranqueada Solo/Duo</div>
              <div className="rank-name">{cur ? RK.rankLabel(cur, { lp: false }) : "Elo não coletado"}</div>
              {cur && !RK.isApex(cur.tier) && <div className="lp-bar"><i style={{ width: `${Math.max(2, Math.min(100, cur.lp || 0))}%` }} /></div>}
              <div className="stat-sub">{cur ? <><b>{cur.lp ?? 0} PDL</b>{step ? ` · faltam ${step.missing} para ${step.label}` : ""}</> : "Rode o atualizar_tudo.bat para trazer o elo."}</div>
              {cur?.source === "manual" && <div className="dim" style={{ fontSize: "0.74rem" }}>informado por você em {RK.monthLabel(cur.t)}</div>}
            </div>
          </div>
        </div>
        <div className="hero-bar">
          <span className="lbl">Período</span>
          <div className="chips">{PERIODS.map(([k, l]) => <button key={k} className="chip" aria-pressed={filters.period === k} onClick={() => setFilters({ period: k })}>{l}</button>)}</div>
          <div className="right">
            <span className="dim" style={{ fontSize: "0.8rem" }}>{games.length} partidas · {filters.champion === "ALL" ? "todos os campeões" : E.champDisplay(meta, filters.champion)} · {filters.queue === "420" ? "Solo/Duo" : "fila: " + filters.queue}</span>
            <button className="btn sm ghost" onClick={() => go("estatisticas")}>Ver estatísticas</button>
          </div>
        </div>
      </section>

      {!games.length ? <div className="empty">Nenhuma partida nesse período. Escolha outro período acima.</div> : <>
        <div className="grid">
          <BuildTile ctx={ctx} periodLabel={periodLabel} i={0} />
          <EloTile ctx={ctx} history={history} cur={cur} i={1} />
          <RecentTile ctx={ctx} i={2} />
        </div>
        <div className="grid">
          <EloChartTile ctx={ctx} history={history} i={3} />
          <EarlyTile ctx={ctx} i={4} TileHead={TileHead} />
        </div>
        <div className="grid">
          <VsEnemyTile ctx={ctx} main={main} i={5} />
          <FocusTile ctx={ctx} cmp={cmp} prep={prep} i={6} />
        </div>
        <RecentGames ctx={ctx} i={7} />
      </>}
    </div>
  );
}

export function TileHead({ icon, title, sub, tip }) {
  return <header className="tile-head"><span className="tile-ico"><NavIcon name={icon} /></span><h2>{title}</h2>{tip && <Tip text={tip} />}{sub && <span className="tile-sub">{sub}</span>}</header>;
}

// ---------------------------------------------------------------------------
function BuildTile({ ctx, periodLabel, i }) {
  const { games, meta, filters } = ctx;
  // Com "Todos os campeões", a build é a do campeão mais jogado no período (builds não se misturam entre campeões).
  const champ = useMemo(() => (filters.champion === "ALL" ? CH.topChamps(games, 1)[0] || null : null), [games, filters.champion]);
  const src = useMemo(() => (champ ? games.filter((g) => g.champ === champ.champ) : games), [games, champ]);
  const bb = useMemo(() => E.bestBuild(src, meta), [src, meta]);
  return (
    <article className="tile link span-4" style={{ "--i": i }} onClick={() => ctx.go("builds")} title="Abrir Builds e Itens">
      <TileHead icon="builds" title="Build que mais vence" sub={champ ? E.champDisplay(meta, champ.champ, champ.champId) : periodLabel} tip={bb ? `Primeiros 3 itens completos, na ordem de compra${champ ? `, com o seu campeão mais jogado (${periodLabel})` : ""}. Entram só builds com pelo menos ${bb.minN} partidas nesse período (das ${bb.evaluable} com timeline).` : undefined} />
      {bb ? <>
        <div className="bw">
          <div className="bw-rune">{bb.keystone ? <RuneIcon meta={meta} id={bb.keystone} size={52} /> : null}</div>
          <div className="bw-items">{bb.items.map((id, k) => <React.Fragment key={k}>{k > 0 && <span className="arrow">›</span>}<ItemIcon meta={meta} id={id} size={46} /></React.Fragment>)}</div>
        </div>
        <div className="bw-foot">
          <div className="big-stat teal"><CountUp value={(bb.rate || 0) * 100} format={(x) => fmt.dec(x, 0)} /><small>%</small></div>
          <div className="stat-sub"><b>{bb.n}</b> partidas · {bb.wins}V {bb.losses}D<br />{bb.keystone ? E.runeName(meta, bb.keystone) : ""}</div>
        </div>
        <div className="minibar teal"><i style={{ width: `${(bb.rate || 0) * 100}%` }} /></div>
        {bb.alternatives.length > 0 && <div className="bw-alt">
          {bb.alternatives.map((r) => <div key={r.key} className="bw-alt-row"><span className="iconrow">{r.items.map((id) => <ItemIcon key={id} meta={meta} id={id} size={22} />)}</span><span>{r.n} partidas</span><b>{fmt.pct(r.rate)}</b></div>)}
        </div>}
      </> : <p className="muted">Sem partidas com timeline suficientes nesse período para montar a build.</p>}
    </article>
  );
}

function EloTile({ ctx, history, cur, i }) {
  const { games, meta } = ctx;
  const visual = meta.visual || {};
  const s = useMemo(() => E.winRate(games), [games]);
  const fromT = games.length ? Math.min(...games.map((g) => g.start)) : Date.now();
  const ld = RK.lpDelta(history, fromT);
  const saldo = s.wins - s.losses;
  const big = ld ? ld.delta : saldo;
  return (
    <article className="tile span-4" style={{ "--i": i }}>
      <TileHead icon="crown" title="Elo no período" sub={`${games.length} partidas`}
        tip={ld ? "Diferença de PDL entre o registro de elo mais próximo do começo do período e o mais recente." : "A Riot não informa o PDL de partidas antigas. Enquanto o coletor não tiver registrado o seu elo no começo do período, aparece o saldo de vitórias."} />
      <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: 16, alignItems: "center" }}>
        <RankEmblem tier={cur?.tier} rank={cur?.rank} size={108} images={visual.emblems} />
        <div>
          <div className={`big-stat ${big >= 0 ? "teal" : "red"}`}>{big > 0 ? "+" : big < 0 ? "−" : ""}<CountUp value={Math.abs(big)} /><small>{ld ? "PDL" : "saldo"}</small></div>
          <div className="stat-sub">{ld ? <>de {RK.rankLabel(ld.from)} para <b>{RK.rankLabel(ld.to)}</b></> : <>{s.wins} vitórias e {s.losses} derrotas. O PDL passa a ser contado a cada atualização do coletor.</>}</div>
        </div>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><span className="eyebrow">Win rate no período</span><b className="num" style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", color: s.rate >= 0.5 ? "#8ff0e6" : "#ff8b9b" }}>{fmt.pct(s.rate, 1)}</b></div>
        <div className={`minibar ${s.rate >= 0.5 ? "teal" : ""}`}><i style={{ width: `${(s.rate || 0) * 100}%` }} /></div>
        <div className="dim" style={{ fontSize: "0.76rem" }}>IC 95%: {fmt.pct(s.ci?.[0])} a {fmt.pct(s.ci?.[1])}</div>
      </div>
    </article>
  );
}

function RecentTile({ ctx, i }) {
  const src = ctx.pool.length ? ctx.pool : ctx.games;
  const r = useMemo(() => E.recentSummary(src, 20), [src]);
  return (
    <article className="tile span-4" style={{ "--i": i }}>
      <TileHead icon="history" title="Últimas 20 partidas" sub={`${r.wins}V ${r.losses}D`} />
      <div className="donut-wrap">
        <Ring value={r.rate} size={112} color={r.rate >= 0.5 ? C.blue : C.red}><span><CountUp value={(r.rate || 0) * 100} format={(x) => `${fmt.dec(x, 0)}%`} /><small>WIN RATE</small></span></Ring>
        <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
          <div className="kda-line">{fmt.dec(r.k, 1)} / <span className="d">{fmt.dec(r.d, 1)}</span> / {fmt.dec(r.a, 1)}</div>
          <div className="stat-sub"><b>{fmt.dec(r.kda?.value, 2)}:1</b> KDA · <b>{fmt.pct(r.kp)}</b> participação · <b>{fmt.dec(r.csMin, 1)}</b> farm/min</div>
          <div className="wlrow" title="Da mais antiga (esquerda) para a mais recente (direita)">{[...r.seq].reverse().map((w, k) => <i key={k} className={w ? "w" : ""} style={{ "--k": k }} />)}</div>
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
function EloChartTile({ ctx, history, i }) {
  const { prefs, savePrefs } = ctx;
  const manual = prefs?.rankManual || [];
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ month: "", tier: "DIAMOND", rank: "IV", lp: "" });
  // Um ponto por mês (o registro mais recente do mês), meses em sequência e espaçados por igual.
  const data = useMemo(() => {
    const mon = RK.monthly(history);
    if (!mon.length) return [];
    const byKey = new Map(mon.map((p) => [p.month, p]));
    const first = new Date(mon[0].t), last = new Date(mon[mon.length - 1].t);
    const out = [];
    const now = new Date();
    for (let d = new Date(first.getFullYear(), first.getMonth(), 1); d <= last; d.setMonth(d.getMonth() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const p = byKey.get(key);
      const current = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      out.push({ key, label: RK.monthLabel(d.getTime()), v: p ? p.v : null, text: p ? RK.rankLabel(p) : null, source: p?.source, current, tier: p?.tier });
    }
    return out;
  }, [history]);
  const vs = data.map((d) => d.v).filter((v) => v != null);
  const lo = vs.length ? Math.max(0, Math.floor((Math.min(...vs) - 40) / 400) * 400) : 1600;
  const hi = vs.length ? Math.min(4000, Math.ceil((Math.max(...vs) + 40) / 400) * 400) : 2800;
  const ticks = []; for (let v = lo; v <= hi; v += 400) ticks.push(v);
  const bands = ticks.slice(0, -1).map((v) => ({ y1: v, y2: v + 400, tier: RK.TIERS[Math.min(9, v / 400)] }));
  const add = () => {
    if (!form.month) return;
    const [y, m] = form.month.split("-").map(Number);
    const t = new Date(y, m - 1, 28, 12).getTime();
    const next = [...manual.filter((x) => RK.monthLabel(x.t) !== RK.monthLabel(t)), { t, tier: form.tier, rank: RK.isApex(form.tier) ? "I" : form.rank, lp: Number(form.lp) || 0 }].sort((a, b) => a.t - b.t);
    savePrefs({ ...prefs, rankManual: next });
    setForm({ ...form, month: "", lp: "" });
  };
  const remove = (t) => savePrefs({ ...prefs, rankManual: manual.filter((x) => x.t !== t) });
  const months = data.filter((d) => d.v != null).length;
  return (
    <article className="tile span-8" style={{ "--i": i }}>
      <TileHead icon="evolution" title="Elo mês a mês" sub={`${months} ${months === 1 ? "mês" : "meses"}`}
        tip="Um ponto por mês: o elo mais recente registrado no mês (o mês atual mostra o elo de agora). Pontos cheios vêm do coletor; pontos vazados são meses que você marcou." />
      {data.length ? (
        <div className="chart" style={{ height: 240 }}>
          <R.ResponsiveContainer>
            <R.LineChart data={data} margin={{ top: 18, right: 26, bottom: 0, left: 4 }}>
              {bands.map((b) => <R.ReferenceArea key={b.y1} y1={b.y1} y2={b.y2} fill={RK.TIER_COLOR[b.tier]} fillOpacity={0.07} stroke="none" ifOverflow="hidden" />)}
              <R.CartesianGrid {...gridProps} />
              <R.XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={6} />
              <R.YAxis domain={[lo, hi]} ticks={ticks} {...axisProps} width={78} tickFormatter={(v) => (v >= 2800 ? "Mestre+" : RK.TIER_PT[RK.TIERS[v / 400]] || "")} />
              <R.Tooltip content={<ChartTip render={(pl) => { const p = pl[0].payload; return p.v == null ? <div>{p.label}: sem registro</div> : <><div>{p.label}{p.current ? " · até agora" : ""}</div><div style={{ color: C.gold }}>{p.text}</div><div className="muted">{p.source === "manual" ? "marcado por você" : "registrado pelo coletor"}</div></>; }} />} />
              <R.Line type="monotone" dataKey="v" stroke={C.gold} strokeWidth={2.5} connectNulls isAnimationActive={false}
                dot={(pr) => (pr.payload.v == null ? <g key={pr.index} /> : <circle key={pr.index} cx={pr.cx} cy={pr.cy} r={pr.payload.current ? 6 : 5} fill={pr.payload.source === "manual" ? "#010A13" : C.gold} stroke={pr.payload.current ? C.blue : C.gold} strokeWidth={2} />)}
                label={(pr) => { const p = data[pr.index]; const last = pr.index === data.length - 1; return p && p.v != null && (last || pr.index === 0) && data.length > 1 ? <text key={pr.index} x={last ? pr.x + 4 : pr.x - 4} y={pr.y - 12} textAnchor={last ? "end" : "start"} fill={C.fg} fontSize={11}>{p.text}{last && p.current ? " (agora)" : ""}</text> : <g key={pr.index} />; }} />
            </R.LineChart>
          </R.ResponsiveContainer>
        </div>
      ) : <p className="muted">Ainda não há registros de elo. O coletor registra o seu elo a cada atualização, e você pode marcar os meses que lembra.</p>}
      {!STATIC && <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn sm" onClick={() => setOpen(!open)}>{open ? "Fechar" : "Marcar um mês"}</button>
      </div>}
      {open && (
        <div className="elo-form">
          <label className="field"><span>Mês</span><input id="elo-month" type="month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} /></label>
          <label className="field"><span>Elo</span><select id="elo-tier" value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })}>{RK.TIERS.map((t) => <option key={t} value={t}>{RK.TIER_PT[t]}</option>)}</select></label>
          {!RK.isApex(form.tier) && <label className="field"><span>Divisão</span><select id="elo-div" value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })}>{["I", "II", "III", "IV"].map((d) => <option key={d}>{d}</option>)}</select></label>}
          <label className="field"><span>PDL</span><input id="elo-lp" type="number" min="0" max="2000" style={{ width: 90 }} value={form.lp} onChange={(e) => setForm({ ...form, lp: e.target.value })} /></label>
          <button className="btn primary sm" onClick={add} disabled={!form.month}>Adicionar</button>
          <span className="note" style={{ margin: 0, flexBasis: "100%" }}>Vale o elo com que você terminou o mês. Se o coletor também tiver registro no mesmo mês, vale o mais recente.</span>
          {manual.length > 0 && <div className="elo-list" style={{ flexBasis: "100%" }}><span className="eyebrow" style={{ alignSelf: "center" }}>Marcados por você</span>{manual.map((m) => <span key={m.t} className="elo-chip">{RK.monthLabel(m.t)}: {RK.rankLabel(m)}<button aria-label={`Remover ${RK.monthLabel(m.t)}`} onClick={() => remove(m.t)}>✕</button></span>)}</div>}
        </div>
      )}
    </article>
  );
}

function BannerEditor({ ctx, draft, setDraft, hasChamp }) {
  const { prefs, savePrefs, store, toast } = ctx;
  const saved = prefs?.banner || null;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const cur = draft || saved;
  const close = () => { setDraft(null); setOpen(false); };
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const img = await prepareBannerImage(file);
      const up = store?.uploadImage ? await store.uploadImage(img.blob) : null;
      // Sem o armazenamento do artefato, a imagem fica guardada nas preferências deste navegador.
      setDraft({ ...(up ? { assetId: up.id } : { src: img.dataUrl }), x: 50, y: 30, zoom: 100, isNew: true });
    } catch (err) { console.warn(err); toast("Não consegui abrir essa imagem. Tente um PNG, JPG ou WebP."); }
    setBusy(false);
  };
  const save = async () => {
    if (!draft) { setOpen(false); return; }
    const { isNew, ...banner } = draft;
    const old = saved?.assetId;
    await savePrefs({ ...prefs, banner });
    if (old && old !== banner.assetId && store?.deleteAsset) store.deleteAsset(old);
    setDraft(null); setOpen(false);
    toast("Fundo do banner salvo.");
  };
  const reset = async () => {
    const old = saved?.assetId;
    const { banner, ...rest } = prefs || {};
    await savePrefs(rest);
    if (draft?.assetId && draft.assetId !== old && store?.deleteAsset) store.deleteAsset(draft.assetId);
    if (old && store?.deleteAsset) store.deleteAsset(old);
    setDraft(null); setOpen(false);
    toast(hasChamp ? "Voltou para a arte do campeão mais jogado." : "Fundo removido.");
  };
  const set = (k, v) => setDraft({ ...(cur || {}), [k]: Number(v) });
  return (
    <div className="banner-edit">
      <button className="btn sm ghost" aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}>{open ? "Fechar" : "Trocar fundo"}</button>
      {open && (
        <div className="banner-panel">
          <h4>Fundo do banner</h4>
          <div className="row">
            <label className="btn sm primary file-btn">{busy ? "Enviando…" : "Escolher imagem"}<input id="banner-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={pick} disabled={busy} /></label>
            {(saved || draft) && <button className="btn sm ghost" onClick={reset}>{hasChamp ? "Usar arte do campeão" : "Remover"}</button>}
          </div>
          {cur && (cur.assetId || cur.src) ? <>
            <label className="rng"><span>Zoom</span><input id="banner-zoom" type="range" min="100" max="180" value={cur.zoom ?? 100} onChange={(e) => set("zoom", e.target.value)} /><output>{cur.zoom ?? 100}%</output></label>
            <label className="rng"><span>Horizontal</span><input id="banner-x" type="range" min="0" max="100" value={cur.x ?? 50} onChange={(e) => set("x", e.target.value)} /><output>{cur.x ?? 50}%</output></label>
            <label className="rng"><span>Vertical</span><input id="banner-y" type="range" min="0" max="100" value={cur.y ?? 30} onChange={(e) => set("y", e.target.value)} /><output>{cur.y ?? 30}%</output></label>
            <div className="row"><button className="btn sm primary" onClick={save} disabled={!draft}>Salvar</button>{draft && <button className="btn sm ghost" onClick={() => setDraft(null)}>Desfazer</button>}</div>
          </> : <p className="note" style={{ margin: 0 }}>Escolha uma imagem do seu computador (uma splash art, por exemplo). Depois dá para ajustar o enquadramento.</p>}
        </div>
      )}
    </div>
  );
}

function FocusTile({ ctx, cmp, prep, i }) {
  const { games, pool, meta, go } = ctx;
  const diags = useMemo(() => E.coachDiagnostics(pool, games, meta), [pool, games, meta]);
  const prob = diags.find((d) => d.kind === "problema");
  const strong = diags.find((d) => d.kind !== "problema");
  const f = prep && cmp.focus[0];
  return (
    <article className="tile span-5" style={{ "--i": i }}>
      <TileHead icon="coach" title="Seu foco agora" />
      {prob && <div className="focus-item"><span className="gem red" /><div><div className="k">Coach analítico</div><div className="t">{prob.title}</div><div className="s">{prob.action}</div></div></div>}
      {f && <div className="focus-item"><span className="gem" /><div><div className="k">Rumo ao Challenger</div><div className="t">{f.label}</div><div className="s">{f.lead.label}: você {CHfmt(f.lead.me, f.lead)} · Challengers {CHfmt(f.lead.band.center, f.lead)}</div></div></div>}
      {!f && <div className="focus-item"><span className="gem" /><div><div className="k">Rumo ao Challenger</div><div className="s">Importe as referências para comparar com os Challengers.</div></div></div>}
      {strong && <div className="focus-item"><span className="gem gold" /><div><div className="k">Ponto forte</div><div className="t">{strong.title}</div></div></div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
        <button className="btn sm" onClick={() => go("coach")}>Abrir Coach</button>
        <button className="btn sm ghost" onClick={() => go("rumo-challenger")}>Rumo ao Challenger</button>
      </div>
    </article>
  );
}
function CHfmt(v, m) {
  if (!isNum(v)) return "—";
  if (m.fmt === "pct") return fmt.pct(v);
  if (m.fmt === "int") return fmt.int(v);
  return fmt.dec(v, m.fmt === "dec2" ? 2 : 1);
}

export function GoalsTile({ ctx, cmp, i }) {
  const goals = (ctx.prefs?.goals && ctx.prefs.goals.length ? ctx.prefs.goals : G.DEFAULT_GOALS);
  const src = ctx.games;
  const rows = useMemo(() => goals.map((g) => {
    const target = isNum(g.target) ? g.target : G.suggestTarget(g.key, cmp).value;
    return { ...g, m: G.GOAL_METRICS[g.key], target, st: G.goalStatus(g.key, src, target) };
  }).filter((g) => g.m), [goals, src, cmp]);
  return (
    <article className="tile link span-4" style={{ "--i": i }} onClick={() => ctx.go("metas")} title="Abrir Metas">
      <TileHead icon="goals" title="Metas" sub="últimas 10" tip="Quão perto da meta você está nas últimas 10 partidas. 100% = na meta. A seta compara com o resto do período escolhido." />
      <div className="goal-list">
        {rows.map((g) => {
          const col = g.st.done ? C.green : g.st.progress >= 0.75 ? C.blue : C.gold;
          return (
            <div key={g.key} className="goal-line">
              <Ring className="goal-ring" value={g.st.progress} size={58} stroke={9} color={col}><span style={{ fontSize: "0.78rem" }}>{isNum(g.st.progress) ? fmt.pct(g.st.progress) : "—"}</span></Ring>
              <div style={{ minWidth: 0 }}><div className="nm">{g.m.short}</div><div className="sb">agora {CHfmt(g.st.now, g.m)} · meta {CHfmt(g.target, g.m)}</div></div>
              <span className="pc" style={{ color: g.st.trend === 1 ? C.green : g.st.trend === -1 ? C.red : C.fg3 }} title={g.st.trend === 1 ? `melhor que nas ${g.st.nBefore} anteriores do período` : g.st.trend === -1 ? `pior que nas ${g.st.nBefore} anteriores do período` : "estável"}>{g.st.trend === 1 ? "▲" : g.st.trend === -1 ? "▼" : "■"}</span>
            </div>
          );
        })}
      </div>
      <div className="dim" style={{ fontSize: "0.76rem" }}>{STATIC ? "Abra Metas para ver a evolução de cada uma." : "Abra Metas para trocar as métricas ou os alvos."}</div>
    </article>
  );
}

function VsEnemyTile({ ctx, main, i }) {
  const rows = useMemo(() => E.vsEnemyRows(ctx.games).filter((r) => ["gold10", "ganks", "goldMin", "kp", "deaths", "redeaths"].includes(r.key)), [ctx.games]);
  return (
    <article className="tile span-7" style={{ "--i": i }}>
      <TileHead icon="matchups" title="Você × jungler inimigo" sub="mesmas partidas" tip="Média nas mesmas partidas dos dois lados. 'Pode ser acaso' quando o intervalo de 95% da diferença inclui zero." />
      <Versus compact a={{ name: "Você", short: "Você", tone: "gold", icon: main ? <ChampIcon meta={ctx.meta} id={main.champId} keyName={main.champ} size={30} /> : null }}
        b={{ name: "Jungler inimigo", short: "Inimigo", tone: "teal", sub: `${ctx.games.length} partidas` }} rows={rows} />
    </article>
  );
}

function RecentGames({ ctx, i }) {
  const { meta } = ctx;
  const src = (ctx.pool.length ? ctx.pool : ctx.games).slice(0, 8);
  return (
    <article className="tile" style={{ "--i": i }}>
      <TileHead icon="history" title="Partidas recentes" sub="clique para abrir" />
      <div className="mlist">
        {src.map((g, k) => (
          <div key={g.id} className={`mrow ${g.win ? "win" : ""}`} style={{ "--k": k }} onClick={() => ctx.openMatch(g.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") ctx.openMatch(g.id); }}>
            <div className="mrow-res"><b>{g.win ? "Vitória" : "Derrota"}</b><span>{timeAgo(g.start)}</span><span>{fmt.dur(g.duration)}</span></div>
            <div className="mrow-ch"><ChampIcon meta={meta} id={g.champId} keyName={g.champ} size={40} /><span className="vs">VS</span><ChampIcon meta={meta} id={g.oppChampId} keyName={g.oppChamp} size={28} /></div>
            <div className="mrow-kda"><b>{g.k} / <span className="d">{g.d}</span> / {g.a}</b><span>{fmt.dec(g.kda, 2)} KDA · {fmt.pct(g.kp)} KP</span></div>
            <div className="mrow-cs">{g.cs} CS ({fmt.dec(g.csMin, 1)})<span>{g.early?.diff10 ? `aos 10: ${fmt.signed(g.early.diff10.gold)} de ouro` : ""}</span></div>
            <div className="mrow-items iconrow">{g.finalItems.slice(0, 6).map((id, j) => <ItemIcon key={j} meta={meta} id={id} size={24} />)}</div>
          </div>
        ))}
      </div>
    </article>
  );
}
