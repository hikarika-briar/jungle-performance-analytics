import * as E from "./engine.js";
import { STATIC } from "./static_store.js";
import { fmt, C, Card, Tip, Sample, Empty, Table, ItemIcon, ItemRow, ChampIcon, ChampName, RuneIcon, ChartTip, axisProps, gridProps } from "./ui.jsx";
import { NoGames } from "./views_overview.jsx";
import { EventTimeline } from "./views_jungle.jsx";
import { RuneBreakdown } from "./views_builds.jsx";
import * as CH from "./challenger.js";
import { MatchHero, Scoreboard, DuelReport, PlaysReport, useMatchReport } from "./views_match.jsx";
import { MatchPlan } from "./views_habits.jsx";
const React = window.React;
const { useState, useMemo, useEffect, useRef } = React;
const R = window.Recharts;

export const TAGS = [
  ["revisar", "Revisar"], ["boa-execucao", "Boa execução"], ["erro-macro", "Erro de macro"], ["erro-farm", "Erro de farm"],
  ["erro-objetivo", "Erro em objetivo"], ["boa-recuperacao", "Boa recuperação"], ["exemplo", "Exemplo de gameplay eficiente"],
];
const tagLabel = (t) => (TAGS.find((x) => x[0] === t) || [t, t])[1];

// ---------------------------------------------------------------------------
// HISTÓRICO
// ---------------------------------------------------------------------------
export function History({ ctx }) {
  const { games, meta, notes } = ctx;
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return games.filter((g) => {
      if (tag && !(notes[g.id]?.tags || []).includes(tag)) return false;
      if (!s) return true;
      return g.id.toLowerCase().includes(s) || E.champDisplay(meta, g.oppChamp, g.oppChampId).toLowerCase().includes(s) ||
        (g.oppChamp || "").toLowerCase().includes(s) || (notes[g.id]?.text || "").toLowerCase().includes(s);
    });
  }, [games, q, tag, notes, meta]);
  if (!games.length) return <NoGames ctx={ctx} />;
  return (
    <Card title="Partidas" eyebrow="Clique numa partida para ver o detalhe, marcar e anotar"
      right={<div className="inline-form">
        <label className="field"><span>Buscar</span><input id="h-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ID, jungler ou anotação" /></label>
        <label className="field"><span>Marcação</span>
          <select id="h-tag" value={tag} onChange={(e) => setTag(e.target.value)}><option value="">Todas</option>{TAGS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <ExportCsv ctx={ctx} rows={rows} />
      </div>}>
      <Table rowKey={(r) => r.id} rows={rows} onRowClick={(r) => ctx.openMatch(r.id)} rowClass={(r) => (r.win ? "win" : "loss")} pageSize={25}
        initialSort={{ key: "start", dir: "desc" }} columns={[
          { key: "start", label: "Data", render: (r) => <>{fmt.date(r.start)} <span className="dim">{fmt.time(r.start)}</span></> },
          { key: "champ", label: "Campeão", render: (r) => <ChampName meta={meta} keyName={r.champ} id={r.champId} size={22} /> },
          { key: "oppChamp", label: "Jungler adv.", render: (r) => (r.oppChamp ? <ChampName meta={meta} keyName={r.oppChamp} id={r.oppChampId} size={22} /> : <span className="dim">não identificado</span>) },
          { key: "win", label: "Resultado", sortValue: (r) => (r.win ? 1 : 0), render: (r) => <span className={`res ${r.win ? "w" : "l"}`}>{r.win ? "VITÓRIA" : "DERROTA"}</span> },
          { key: "duration", label: "Duração", num: true, render: (r) => fmt.dur(r.duration) },
          { key: "kda", label: "K/D/A", num: true, render: (r) => <span title={`KDA ${r.perfect ? "perfeito" : fmt.dec(r.kda, 2)}`}>{r.k}/{r.d}/{r.a}</span> },
          { key: "cs", label: "Farm", num: true },
          { key: "csMin", label: "Farm/min", num: true, render: (r) => fmt.dec(r.csMin, 1) },
          { key: "gold", label: "Ouro", num: true, render: (r) => fmt.int(r.gold) },
          { key: "dmg", label: "Dano", num: true, render: (r) => fmt.int(r.dmg) },
          { key: "build", label: "Build final", sortable: false, render: (r) => <ItemRow meta={meta} ids={r.finalItems} size={22} /> },
          { key: "keystone", label: "Runa", sortValue: (r) => E.runeName(meta, r.keystone), render: (r) => <RuneIcon meta={meta} id={r.keystone} size={22} /> },
          { key: "patch", label: "Patch", sortValue: (r) => r.patch.split(".").map((x) => x.padStart(3, "0")).join(".") },
          { key: "hasTL", label: "TL", sortValue: (r) => (r.hasTL ? 1 : 0), render: (r) => (r.hasTL ? "✓" : <span className="dim">—</span>), tip: "Partida com timeline (ordem de compra, eventos, curvas)." },
          { key: "tags", label: "Marcações", sortable: false, render: (r) => <span className="iconrow">{(notes[r.id]?.tags || []).map((t) => <span key={t} className="chip static" style={{ fontSize: "0.72rem", padding: "1px 7px" }}>{tagLabel(t)}</span>)}{notes[r.id]?.text ? <span title={notes[r.id].text}>📝</span> : null}</span> },
          { key: "id", label: "ID da partida", render: (r) => <span className="mono dim">{r.id}</span> },
        ]} />
    </Card>
  );
}

function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function ExportCsv({ ctx, rows }) {
  const { meta, store, notes } = ctx;
  const go = async () => {
    const header = ["matchId", "data", "hora", "campeao", "jungler_adversario", "resultado", "duracao_min", "abates", "mortes", "assistencias", "kda", "farm", "farm_min", "ouro", "ouro_min", "dano", "dano_min", "part_abates", "patch", "fila", "lado", "runa_chave", "build_final", "ordem_compra", "timeline", "marcacoes", "anotacao"];
    const lines = [header.join(";")];
    for (const g of rows) {
      lines.push([g.id, fmt.date(g.start), fmt.time(g.start), g.champ, g.oppChamp || "", g.win ? "Vitória" : "Derrota", (g.durMin || 0).toFixed(2).replace(".", ","),
        g.k, g.d, g.a, g.kda.toFixed(2).replace(".", ","), g.cs, (g.csMin ?? 0).toFixed(2).replace(".", ","), g.gold, Math.round(g.goldMin ?? 0), g.dmg, Math.round(g.dmgMin ?? 0),
        g.kp == null ? "" : (g.kp * 100).toFixed(0) + "%", g.patch, E.QUEUE_NAMES[g.queueId] || g.queueId, g.side === "blue" ? "Azul" : "Vermelho", E.runeName(meta, g.keystone),
        g.finalItems.map((id) => E.itemName(meta, id)).join(" + "), g.order ? g.order.map((o) => `${E.itemName(meta, o.id)} (${fmt.clock(o.t)})`).join(" > ") : "",
        g.hasTL ? "sim" : "não", (notes[g.id]?.tags || []).map(tagLabel).join(", "), notes[g.id]?.text || ""].map(csvCell).join(";"));
    }
    const res = await store.download(`jungle-partidas-${new Date().toISOString().slice(0, 10)}.csv`, "﻿" + lines.join("\n"));
    if (res.ok) ctx.toast("CSV exportado.");
    else if (res.reason !== "declined") ctx.toast("A exportação não está disponível nesta visualização.");
  };
  return <button className="btn" onClick={go} disabled={!store?.canDownload} title={store?.canDownload ? "" : "Exportação indisponível nesta visualização"}>Exportar CSV ({rows.length})</button>;
}

// ---------------------------------------------------------------------------
// DETALHE DA PARTIDA
// ---------------------------------------------------------------------------
export function MatchDrawer({ ctx, id, game, pool, meta: metaOverride, onClose, focusT }) {
  const { setNote } = ctx;
  const notes = ctx.notes || {};
  const meta = metaOverride || ctx.meta;
  const g = game || ctx.all.find((x) => x.id === id);
  const isRef = !!game?.subject;
  const V = E.voiceOf(g);
  id = id || g?.id;
  const ref = useRef(null);
  const [draft, setDraft] = useState(() => ({ tags: [...(notes[id]?.tags || [])], text: notes[id]?.text || "" }));
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, []);
  const [tlFocus, setTlFocus] = useState(null);
  const report = useMatchReport(g, meta, ctx, pool);
  const pickTime = (t) => {
    setTlFocus(Math.max(0, Math.round(t) - 3));
    setTimeout(() => document.getElementById("tl-card")?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  };
  if (!g) return null;
  const opp = g.opp;
  const curves = g.hasTL ? buildCurves(g) : [];
  const dirty = JSON.stringify(draft) !== JSON.stringify({ tags: notes[id]?.tags || [], text: notes[id]?.text || "" });
  const myTeam = g.participants.filter((p) => p.teamId === g.teamId), enTeam = g.participants.filter((p) => p.teamId !== g.teamId);
  const toggle = (t) => setDraft((d) => ({ ...d, tags: d.tags.includes(t) ? d.tags.filter((x) => x !== t) : [...d.tags, t] }));
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="drawer" role="dialog" aria-modal="true" aria-label="Detalhe da partida" tabIndex={-1} ref={ref}>
        <div className="drawer-head">
          <span className={`res ${g.win ? "w" : "l"}`} style={{ fontSize: "1rem" }}>{g.win ? "VITÓRIA" : "DERROTA"}</span>
          <span className="namecell"><ChampIcon meta={meta} id={g.champId} keyName={g.champ} size={36} /><strong style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem" }}>{E.champDisplay(meta, g.champ, g.champId)}</strong></span>
          {g.oppChamp && <span className="namecell"><span className="dim">vs</span><ChampIcon meta={meta} id={g.oppChampId} keyName={g.oppChamp} size={30} /><span>{E.champDisplay(meta, g.oppChamp, g.oppChampId)}</span></span>}
          <span className="muted num">{fmt.date(g.start)} {fmt.time(g.start)} · {fmt.dur(g.duration)} · {E.QUEUE_NAMES[g.queueId] || `Fila ${g.queueId}`} · patch {g.patch} · lado {g.side === "blue" ? "azul" : "vermelho"}</span>
          <span className="mono dim">{g.id}</span>
          <button className="btn close" onClick={onClose}>Fechar</button>
        </div>
        {isRef ? <div className="ref-banner"><span className="ref-tag">{g.subjectTag || "Partida para estudar"}</span><span>Jogada por <b>{g.riotIdAtGame || g.subject}</b>{g.subjectRank ? ` · ${g.subjectRankLabel || ""}` : ""}. Tudo nesta tela é do ponto de vista dele.</span></div>
          : g.riotIdAtGame && <div className="dim" style={{ fontSize: "0.82rem" }}>Jogada como <span className="mono">{g.riotIdAtGame}</span> · identificada pelo PUUID</div>}

        <MatchHero g={g} meta={meta} ctx={ctx} ratings={report.ratings} />

        <Card title="Placar" tip="Os 10 jogadores da partida. Nota de 1 a 10 comparando os 10 entre si; 5,5 é a média desta partida.">
          <Scoreboard g={g} meta={meta} ratings={report.ratings} ctx={ctx} />
        </Card>

        {report.duel && (
          <Card title={isRef && g.win ? `Por que o ${g.subject} venceu · ${V.S} vs. ${report.duel.oppName}` : `${V.S} vs. ${report.duel.oppName}`} tip={g.oppHow === "smite" ? "Jungler inimigo identificado pelo feitiço Golpear (a posição não veio na partida)." : "Comparação direta com o jungler inimigo. Empate: diferença menor que 8%."}>
            <DuelReport duel={report.duel} moments={report.moments} />
          </Card>
        )}
        {g.hasTL && g.position === "JUNGLE" && (
          <Card title={V.plan} tip="Como a partida começou e para onde o jungler foi primeiro, com a rota dos dois junglers minuto a minuto e o que os Challengers de referência fazem no mesmo contexto de lanes. Campos pelo farm de selva de minuto em minuto (cada campo vale 4).">
            <MatchPlan g={g} meta={meta} ctx={ctx} />
          </Card>
        )}
        {report.duel?.plays && (
          <Card title="Jogadas e respostas" tip="Cada jogada de um jungler e o que o outro fez em seguida. Clique numa linha para ver o momento na linha do tempo e no mapa.">
            <PlaysReport duel={report.duel} onPick={pickTime} />
          </Card>
        )}
        {!report.duel && opp == null && <p className="muted">Jungler inimigo não identificado nesta partida.</p>}

        <div className="grid">
          <Card span={6} title="Itens">
            <div className="eyebrow" style={{ marginBottom: 6 }}>Build final</div>
            <ItemRow meta={meta} ids={[...g.raw.me.items]} size={34} />
            <div className="eyebrow" style={{ margin: "14px 0 6px" }}>Itens completos em ordem</div>
            {g.order ? (g.order.length ? (
              <div className="iconrow" style={{ gap: 14 }}>{g.order.map((o, i) => (
                <span key={i} className="namecell" style={{ gap: 6 }}><span className="dim">{i + 1}º</span><ItemIcon meta={meta} id={o.id} size={30} /><span><span style={{ display: "block" }}>{E.itemName(meta, o.id)}</span><span className="mono dim">{fmt.clock(o.t)}</span></span></span>))}</div>
            ) : <p className="muted">Nenhum item completo nesta partida.</p>) : <p className="muted">Sem timeline: a ordem de compra não está disponível e não é deduzida dos slots finais.</p>}
            {g.hasTL && <PurchaseLog g={g} meta={meta} />}
            {g.order && g.order.length > 0 && <ItemPacing g={g} ctx={ctx} pool={pool} meta={meta} />}
          </Card>
          <Card span={6} title="Runas">
            <RuneBreakdown meta={meta} g={g} showHint={!STATIC && !isRef} />
          </Card>
        </div>

        {g.hasTL && (
          <Card title="Ouro e experiência vs. jungler inimigo" tip="Snapshots por minuto da timeline. Δ = você menos o jungler inimigo; Δ time = ouro do seu time menos o do inimigo.">
            <div className="chart">
              <R.ResponsiveContainer>
                <R.ComposedChart data={curves} margin={{ top: 8, right: 8, bottom: 0, left: -2 }}>
                  <R.CartesianGrid {...gridProps} />
                  <R.XAxis dataKey="m" {...axisProps} tickFormatter={(v) => `${v}′`} />
                  <R.YAxis yAxisId="p" {...axisProps} tickFormatter={fmt.int} />
                  <R.YAxis yAxisId="t" orientation="right" {...axisProps} tickFormatter={fmt.int} />
                  <R.ReferenceLine yAxisId="p" y={0} stroke={C.line2} />
                  <R.Tooltip content={<ChartTip render={(pl) => { const x = pl[0].payload; return <><div>Minuto {x.m}</div><div>Δ ouro (jungler): <strong>{fmt.signed(x.dGold)}</strong></div><div>Δ XP (jungler): {fmt.signed(x.dXp)}</div><div>Δ ouro do time: {fmt.signed(x.team)}</div></>; }} />} />
                  <R.Area yAxisId="t" dataKey="team" fill={C.blue} fillOpacity={0.08} stroke={C.blue} strokeOpacity={0.35} isAnimationActive={false} />
                  <R.Line yAxisId="p" dataKey="dGold" stroke={C.gold} strokeWidth={2} dot={false} isAnimationActive={false} />
                  <R.Line yAxisId="p" dataKey="dXp" stroke={C.fg2} strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                </R.ComposedChart>
              </R.ResponsiveContainer>
            </div>
            <div className="legend"><span><i style={{ background: C.gold }} />Δ ouro vs. jungler</span><span><i style={{ background: C.fg2 }} />Δ experiência vs. jungler</span><span><i style={{ background: C.blue, opacity: 0.5 }} />Δ ouro do time (eixo direito)</span></div>
          </Card>
        )}

        {g.hasTL && <div id="tl-card"><Card title="Linha do tempo de eventos" tip="Abates, mortes, objetivos, torres, itens e a rota do jungler, separados em turnos: cada turno vai da saída da base (ou do renascimento) até o recall ou a morte. Escolha um turno para ver o que ele rendeu e a rota no mapa."><EventTimeline key={tlFocus ?? "f"} g={g} meta={meta} focusT={tlFocus ?? focusT} startFirst={isRef} /></Card></div>}

        {!STATIC && !isRef && <Card title="Marcações e anotações">
          <div className="tagbtns">{TAGS.map(([k, v]) => <button key={k} className="chip" aria-pressed={draft.tags.includes(k)} onClick={() => toggle(k)}>{v}</button>)}</div>
          <label className="field" style={{ marginTop: 10 }}><span>Anotação pessoal</span>
            <textarea id="note-text" value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} placeholder="O que aconteceu, o que faria diferente, minuto para rever no replay…" /></label>
          <div className="inline-form" style={{ marginTop: 8 }}>
            <button className="btn primary" disabled={!dirty} onClick={() => setNote(id, draft)}>Salvar marcações</button>
            {dirty && <span className="dim">Alterações não salvas</span>}
          </div>
        </Card>}
      </div>
    </div>
  );
}


// Quando cada item fechou nesta partida, comparado com a sua média e a dos Challengers,
// e o que você fez até o próximo item (o pico de poder foi aproveitado?).
function ItemPacing({ g, ctx, pool, meta: metaOverride }) {
  const meta = metaOverride || ctx.meta;
  const V = E.voiceOf(g);
  const prep = useMemo(() => CH.prepareRefs(ctx.refs), [ctx.refs]);
  const refGames = useMemo(() => (prep ? prep.players.flatMap((p) => p.games.slice(0, 20)).filter((x) => x.id !== g.id) : []), [prep, g.id]);
  const ip = useMemo(() => E.itemPacing(g, pool || ctx.all, refGames), [g, pool, ctx.all, refGames]);
  if (!ip || !ip.rows.length) return null;
  const champ = E.champDisplay(meta, g.champ, g.champId);
  const all = ip.rows.flatMap((r) => [r.t, r.mine?.mean, r.chal?.mean]).filter((v) => v != null);
  const maxT = Math.max(15 * 60, Math.ceil((Math.max(...all) * 1.08) / 300) * 300);
  const pos = (t) => `${Math.max(0, Math.min(100, (t / maxT) * 100))}%`;
  const ticks = []; for (let t = 0; t <= maxT; t += 300) ticks.push(t);
  const gap = (t, ref) => {
    const d = t - ref;
    if (Math.abs(d) < 15) return { txt: "no mesmo tempo", cls: "dim" };
    const v = Math.abs(d) >= 60 ? fmt.clock(Math.abs(d)) : `${Math.round(Math.abs(d))} s`;
    return d < 0 ? { txt: `${v} antes`, cls: "good" } : { txt: `${v} depois`, cls: "bad" };
  };
  const basis = (a, who) => a ? `${who}: ${fmt.clock(a.mean)} em ${a.n} partida${a.n > 1 ? "s" : ""}${a.sameItem ? " com este item nesta posição" : " (qualquer item nesta posição)"}` : "";
  return (
    <div className="ip">
      <div className="ip-title">
        <span className="eyebrow">Ritmo dos itens</span>
        <Tip text={`Minuto em que cada item completo fechou. ${V.avgCap}: as últimas partidas de ${champ}${V.ref ? " dele" : ""}. Challengers: as últimas 20 partidas de cada jogador de referência. Quando há partidas suficientes, a média usa o mesmo item na mesma posição; senão, qualquer item na mesma posição (1º, 2º, 3º).`} />
      </div>
      {ip.rows.map((r) => {
        const gm = r.mine ? gap(r.t, r.mine.mean) : null, gc = r.chal ? gap(r.t, r.chal.mean) : null;
        return (
          <div key={r.slot} className="ip-row">
            <div className="ip-head">
              <span className="dim">{r.slot + 1}º</span>
              <ItemIcon meta={meta} id={r.id} size={26} />
              <span className="ip-name">{E.itemName(meta, r.id)}</span>
              <span className="ip-time">{fmt.clock(r.t)}</span>
            </div>
            <div className="ip-track" aria-hidden="true">
              {ticks.map((t) => <span key={t} className="ip-tick" style={{ left: pos(t) }}><em>{Math.round(t / 60)}′</em></span>)}
              {r.chal && <span className="ip-mark chal" style={{ left: pos(r.chal.mean) }} title={basis(r.chal, "Challengers")} />}
              {r.mine && <span className="ip-mark avg" style={{ left: pos(r.mine.mean) }} title={basis(r.mine, V.avgCap)} />}
              <span className="ip-mark me" style={{ left: pos(r.t) }} title={`Esta partida: ${fmt.clock(r.t)}`} />
            </div>
            <div className="ip-cmp">
              {gm && <span title={basis(r.mine, V.avgCap)}><b className={gm.cls}>{gm.txt}</b> da {V.avg} ({fmt.clock(r.mine.mean)})</span>}
              {gc && <span title={basis(r.chal, "Challengers")}><b className={gc.cls}>{gc.txt}</b> dos Challengers ({fmt.clock(r.chal.mean)})</span>}
            </div>
            <div className="ip-after">
              <span className="dim">{r.nextId ? `Até o ${r.slot + 2}º item (${fmt.clock(r.until)})` : `Até o fim (${fmt.clock(r.until)})`}:</span>
              <span><b className={r.after.k ? "good" : ""}>{r.after.k}</b> abate{r.after.k === 1 ? "" : "s"}</span>
              <span><b className={r.after.d ? "bad" : ""}>{r.after.d}</b> morte{r.after.d === 1 ? "" : "s"}</span>
              <span><b>{r.after.a}</b> assist.</span>
              {r.goldVsJg != null && <span>ouro vs. jungler ao fechar <b className={r.goldVsJg >= 0 ? "good" : "bad"}>{fmt.signed(r.goldVsJg)}</b></span>}
            </div>
          </div>
        );
      })}
      <div className="ip-legend">
        <span><i className="ip-mark me" />Esta partida</span>
        {ip.rows.some((r) => r.mine) && <span><i className="ip-mark avg" />{V.avgCap} com {champ}</span>}
        {ip.rows.some((r) => r.chal) && <span><i className="ip-mark chal" />Média dos Challengers</span>}
      </div>
    </div>
  );
}

function PurchaseLog({ g, meta }) {
  const [open, setOpen] = useState(false);
  const ev = (g.raw.timeline.items || []).filter((e) => e[1] === "P" || e[1] === "U" || e[1] === "S");
  return (
    <div style={{ marginTop: 12 }}>
      <button className="btn sm ghost" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "Ocultar" : "Ver"} todas as compras ({ev.length})</button>
      {open && <div className="evlist" style={{ marginTop: 8 }}>{ev.map((e, i) => (
        <div key={i}><span className="t">{fmt.clock(e[0])}</span><span className="namecell" style={{ gap: 6 }}><ItemIcon meta={meta} id={e[2]} size={18} />{e[1] === "P" ? "Comprou" : e[1] === "S" ? "Vendeu" : "Desfez compra de"} {E.itemName(meta, e[2])}</span></div>))}</div>}
    </div>
  );
}

function buildCurves(g) {
  const tl = g.raw.timeline;
  const out = [];
  for (let i = 0; i < tl.me.length; i++) {
    const r = tl.me[i];
    const m = Math.round(r[0] / 60);
    const o = tl.opp.find((x) => Math.round(x[0] / 60) === m);
    const t = E.teamDiffAt(g, r[0]);
    out.push({ m, dGold: o ? r[1] - o[1] : null, dXp: o ? r[3] - o[3] : null, team: t ? t.goldDiff : null });
  }
  return out;
}

// ---------------------------------------------------------------------------
// CONFIGURAÇÕES E IMPORTAÇÃO
// ---------------------------------------------------------------------------
export function DataSettings({ ctx }) {
  const { dataset, isDemo, store, savedInfo, all, notes, prefs } = ctx;
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const fileRef = useRef(null);

  const handleFiles = async (files) => {
    const f = files && files[0];
    if (!f) return;
    setBusy(true); setError(""); setResult(null);
    try {
      let text;
      if (/\.gz$/i.test(f.name) && typeof DecompressionStream !== "undefined") {
        text = await new Response(f.stream().pipeThrough(new DecompressionStream("gzip"))).text();
      } else text = await f.text();
      let raw;
      try { raw = JSON.parse(text); } catch { throw new Error("O arquivo não é um JSON válido. Use o jungle_data.json gerado pelo coletor (pasta saida)."); }
      const res = await ctx.importData(raw);
      setResult({ ...res, file: f.name });
      ctx.toast(res.refs ? `Referências importadas: ${res.report.players} jogadores. Veja na aba Rumo ao Challenger.` : `Importação concluída: ${res.report.added} novas, ${res.report.updated} atualizadas.`);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const backup = async () => {
    const data = JSON.stringify({ kind: "jpa-backup", version: 1, exportedAt: new Date().toISOString(), dataset, notes, prefs });
    const res = await store.download(`jungle-backup-${new Date().toISOString().slice(0, 10)}.json`, data);
    if (res.ok) ctx.toast("Backup exportado. Guarde o arquivo: ele restaura partidas, marcações e anotações.");
    else if (res.reason !== "declined") ctx.toast("A exportação não está disponível nesta visualização.");
  };
  const exportAnalysis = async () => {
    const packet = E.analyticsPacket(ctx.games, ctx.pool, ctx.meta, `${E.PERIOD_LABELS[ctx.filters.period]} · ${ctx.filters.champion} · fila ${ctx.filters.queue}`);
    const res = await store.download(`jungle-analise-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(packet, null, 2));
    if (res.ok) ctx.toast("Resumo da análise exportado.");
  };

  const withTL = all.filter((g) => g.hasTL).length;
  const stats = dataset?.stats || {};
  const whereLabel = { cloud: "Salvo no próprio dashboard (abre em qualquer dispositivo onde você acessa este artefato)", local: "Salvo só neste navegador (pode ser apagado se você limpar os dados do navegador)", memory: "Não salvo — exporte um backup antes de fechar" };
  return (
    <div className="row-gap">
      <div className="grid">
        <Card span={7} title="Importar partidas reais">
          <div className={`drop ${over ? "over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); handleFiles(e.dataTransfer.files); }}>
            <strong>Arraste aqui os arquivos da pasta <span className="mono">saida</span></strong>
            <span className="muted"><span className="mono">jungle_data.json</span> (suas partidas) e <span className="mono">referencias_challenger.json</span> (referências), um de cada vez, ou um backup. O dashboard reconhece cada um e não duplica partidas.</span>
            <input ref={fileRef} id="imp-file" type="file" accept=".json,.gz,application/json" hidden onChange={(e) => handleFiles(e.target.files)} />
            <button className="btn primary" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? "Importando…" : "Escolher arquivo"}</button>
          </div>
          {error && <div className="callout warn" style={{ marginTop: 10 }}>{error}</div>}
          {result && result.refs && (
            <div className="callout good" style={{ marginTop: 10 }}>
              <strong>{result.file}</strong> é o arquivo de jogadores de referência: {result.report.players} jogadores, {result.report.added} partidas novas. Ele fica separado das suas partidas e aparece na aba <button className="btn sm" onClick={() => ctx.go("rumo-challenger")}>Rumo ao Challenger</button>
            </div>
          )}
          {result && !result.refs && (
            <div className="callout good" style={{ marginTop: 10 }}>
              <strong>{result.file}</strong>: {result.report.added} partidas novas, {result.report.updated} atualizadas com timeline, {result.report.unchanged} já existiam{result.report.rejected ? `, ${result.report.rejected} ignoradas` : ""}.{result.report.removedOtherModes ? ` ${result.report.removedOtherModes} partidas de ARAM/Arena ficaram de fora (não entram nas análises).` : ""}
              {" "}{whereLabel[result.saved.where]}.
            </div>
          )}
          {isDemo && <p className="note">Ao importar o primeiro arquivo, os dados simulados saem de cena e o banner de demonstração desaparece.</p>}
        </Card>
        <Card span={5} title="Seus dados">
          {isDemo ? <p className="muted">Nenhuma partida real importada ainda. O dashboard está mostrando <b>dados simulados</b>.</p> : (
            <dl className="kv">
              <dt>Conta</dt><dd className="mono">{dataset.player?.riotId}</dd>
              <dt>Nomes já usados</dt><dd>{(dataset.player?.namesSeen || []).join(" · ") || "—"}</dd>
              <dt>Identificação</dt><dd>PUUID <span className="mono dim">{String(dataset.player?.puuid || "").slice(0, 10)}…</span> (o nome pode mudar sem afetar o histórico)</dd>
              <dt>Partidas</dt><dd className="num">{all.length}</dd>
              <dt>Com timeline</dt><dd className="num">{withTL}</dd>
              <dt>Sem timeline</dt><dd className="num">{all.length - withTL}{(stats.timelineUnavailable || []).length ? ` (${stats.timelineUnavailable.length} indisponíveis na API)` : ""}</dd>
              <dt>Período</dt><dd>{all.length ? `${fmt.date(all.at(-1).start)} a ${fmt.date(all[0].start)}` : "—"}</dd>
              <dt>Gerado pelo coletor</dt><dd>{dataset.generatedAt ? new Date(dataset.generatedAt).toLocaleString("pt-BR") : "—"}</dd>
              <dt>Última atualização</dt><dd>{savedInfo?.savedAt ? new Date(savedInfo.savedAt).toLocaleString("pt-BR") : "—"}</dd>
              <dt>Armazenamento</dt><dd>{whereLabel[savedInfo?.where] || "—"}</dd>
              <dt>Anotações</dt><dd className="num">{Object.keys(notes).length} partidas marcadas</dd>
            </dl>
          )}
        </Card>
      </div>

      <div className="grid">
        <Card span={7} title="Como conectar seus dados da Riot" eyebrow="Coletor Python · roda no seu Windows">
          <ol className="steps">
            <li>Gere a chave de desenvolvimento em <a href="https://developer.riotgames.com" target="_blank" rel="noopener noreferrer">developer.riotgames.com</a> (entre com sua conta Riot, botão <b>Regenerate API Key</b>). Ela vale 24 horas.</li>
            <li>Extraia a pasta do coletor e dê dois cliques em <code>atualizar_dados.bat</code> (ou rode <code>python coletor_riot.py</code> no Prompt de Comando, dentro da pasta).</li>
            <li>Cole a chave quando o programa pedir. Ela fica só no seu computador, no arquivo <code>chave_api.txt</code>; nunca entra neste dashboard.</li>
            <li>Aguarde o download. Na primeira vez, cerca de 460 partidas com timeline levam por volta de 15 a 20 minutos, por causa do limite da chave de desenvolvimento (100 consultas a cada 2 minutos). Das próximas vezes ele só baixa o que for novo.</li>
            <li>Importe aqui o arquivo <code>saida\jungle_data.json</code>. Repita os passos 2 e 5 sempre que quiser atualizar.</li>
          </ol>
          <p className="note">Partidas antigas recuperadas pelo histórico de outros jogadores (ex.: fevereiro e março de 2026): coloque os IDs (BR1_…) num arquivo <code>extras.txt</code>, um por linha, e rode <code>python coletor_riot.py --ids extras.txt</code>. Se a Riot ainda tiver os dados dessas partidas, elas entram identificadas pelo seu PUUID, mesmo com o nome antigo.</p>
        </Card>
        <Card span={5} title="Backup e exportação">
          <div className="row-gap" style={{ gap: 10 }}>
            <button className="btn" onClick={backup} disabled={!store?.canDownload || isDemo}>Exportar backup completo (.json)</button>
            <button className="btn" onClick={exportAnalysis} disabled={!store?.canDownload}>Exportar resumo da análise atual (.json)</button>
            <p className="note" style={{ margin: 0 }}>Para restaurar, importe o arquivo de backup na área ao lado. O CSV das partidas está na aba <b>Histórico de Partidas</b>.</p>
            {!store?.canDownload && <p className="note" style={{ margin: 0 }}>Exportar arquivos não está disponível nesta visualização.</p>}
            <hr style={{ border: 0, borderTop: "1px solid var(--line)", width: "100%" }} />
            {!isDemo && (confirmClear ? (
              <div className="callout warn">
                Isto apaga as partidas importadas deste dashboard. As anotações ficam. Exporte um backup antes se quiser guardar.
                <div className="inline-form" style={{ marginTop: 8 }}>
                  <button className="btn danger" onClick={async () => { setConfirmClear(false); await ctx.clearAll(); }}>Apagar partidas</button>
                  <button className="btn ghost" onClick={() => setConfirmClear(false)}>Cancelar</button>
                </div>
              </div>
            ) : <button className="btn danger" onClick={() => setConfirmClear(true)}>Apagar partidas importadas…</button>)}
          </div>
        </Card>
      </div>

      <Card title="O que já funciona e o que depende de integração">
        <div className="split">
          <ul className="featlist">
            {["Importação incremental do arquivo do coletor, sem duplicar partidas", "Filtros globais aplicados em todas as abas", "Visão geral com comparação ao período anterior e consistência",
              "Builds: win rate por item, combinações, ordem de compra, Build Comparator com ajuste por contexto e por patch", "Runas: runa-chave, páginas, menores e cruzamento com itens",
              "Early game, farm e economia, objetivos, mortes, matchups e evolução", "Histórico com detalhe da partida, marcações e anotações", "Coach com regras explícitas, relatório de treino e partidas para revisar",
              "Exportação CSV, backup e restauração"].map((t) => <li key={t}><span className="good">✓</span><span>{t}</span></li>)}
          </ul>
          <ul className="featlist">
            {[["Dados reais", "dependem do coletor Python rodando no seu computador (o dashboard não acessa a Riot direto, por segurança da chave)"],
              ["Ícones", "vêm embutidos no arquivo do coletor; no modo demonstração aparecem iniciais"],
              ["Pergunte ao Jungle Coach", "usa o Claude dentro do dashboard e pede sua permissão na primeira pergunta"],
              ["Faixa de elo por partida", "não está disponível na API de partidas; o filtro fica desativado"],
              ["Rota do clear e vantagem numérica antes de objetivos", "a API só dá um snapshot de posição por minuto, então não são reconstruídas"]].map(([a, b]) => <li key={a}><span className="goldc">•</span><span><b>{a}</b>: {b}</span></li>)}
          </ul>
        </div>
      </Card>
    </div>
  );
}
