// Aba Matchups, parte de cima: melhor e pior matchup (por classe do jungler inimigo), partidas em destaque,
// como as classes se enfrentam (ciclo da wiki) e o guia de cada classe com os seus números.
import * as E from "./engine.js";
import * as MI from "./matchup_insights.js";
import { CLASSES, SUBCLASSES } from "./classes.js";
import { CLASS_TIP, briarTier, TIER_LABEL, BRIAR_GUIDE_URL } from "./coach_matchups.js";
import { fmt, C, Card, Ring, CountUp, ChampIcon, ItemIcon } from "./ui.jsx";
import { TileHead, timeAgo } from "./views_home.jsx";

const React = window.React;
const { useMemo, useState } = React;
const pct = (v) => fmt.pct(v);

// Ícones das classes (desenho próprio, em traço)
const GLYPH = {
  fighter: ["M5 4l11 11", "M19 4L8 15", "M13.5 17.5l4-4", "M10.5 17.5l-4-4", "M16.5 16.5L19.5 19.5", "M7.5 16.5L4.5 19.5"],
  slayer: ["M12 2.5l2.6 4.2V14H9.4V6.7z", "M7 14h10", "M12 14v5", "M12 19.2v1.6"],
  mage: ["M12 3c3 4 6.5 6.3 6.5 10.3a6.5 6.5 0 01-13 0c0-2.6 1.4-4.3 3.1-5.4 0 2 1 3.3 2.2 3.4-1-3 .1-6 1.2-8.3z"],
  marksman: ["M12 5a7 7 0 110 14 7 7 0 010-14z", "M12 2v5", "M12 17v5", "M2 12h5", "M17 12h5", "M12 11.2v1.6"],
  tank: ["M12 3l7 2.6V11c0 4.6-3 8.1-7 10-4-1.9-7-5.4-7-10V5.6z", "M12 7v10", "M8.5 11h7"],
  controller: ["M12 8.5a3.5 3.5 0 110 7 3.5 3.5 0 010-7z", "M12 2v3", "M12 19v3", "M2 12h3", "M19 12h3", "M5 5l2.1 2.1", "M16.9 16.9L19 19", "M5 19l2.1-2.1", "M16.9 7.1L19 5"],
  specialist: ["M12 2.5l2 7.5 7.5 2-7.5 2-2 7.5-2-7.5-7.5-2 7.5-2z"],
};
export function ClassGlyph({ cls, size = 22, className = "" }) {
  const d = GLYPH[cls] || GLYPH.specialist;
  return (
    <svg className={`cls-glyph ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

const overallOf = (games) => (games.length ? games.filter((g) => g.win).length / games.length : null);
const diffTxt = (v, base, unit = "", lowerBetter = false) => {
  if (v == null) return null;
  const better = base == null ? null : lowerBetter ? v < base : v > base;
  return { better, text: unit === "ouro" ? fmt.signed(v) : fmt.dec(v, 1), base: base == null ? null : unit === "ouro" ? fmt.signed(base) : fmt.dec(base, 1) };
};

// ---------------------------------------------------------------------------
// Melhor matchup ao lado de pior matchup
export function MatchupHero({ ctx, onShow }) {
  const { games, meta } = ctx;
  const rows = useMemo(() => MI.groupByClass(games, meta, "sub"), [games, meta]);
  const ov = overallOf(games);
  const bw = useMemo(() => MI.bestWorst(rows, ov), [rows, ov]);
  const base = useMemo(() => ({
    gd10: E.mean(games.map((g) => g.early?.diff10?.gold).filter((x) => x != null)),
    deaths: games.length ? games.reduce((s, g) => s + (g.d || 0), 0) / games.length : null,
  }), [games]);
  if (!bw.best && !bw.worst) return null;
  const board = rows.filter((r) => r.n >= 2).sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0) || b.n - a.n);
  return (
    <div className="grid">
      {bw.best ? <BestTile r={bw.best} board={board} ov={ov} base={base} meta={meta} onShow={onShow} /> : <EmptyTile title="Melhor matchup" />}
      {bw.worst ? <WorstTile r={bw.worst} ov={ov} base={base} meta={meta} onShow={onShow} /> : <EmptyTile title="Pior matchup" />}
    </div>
  );
}

function EmptyTile({ title }) {
  return <article className="tile span-6"><TileHead icon="matchups" title={title} /><p className="muted">Ainda não há partidas suficientes contra uma mesma classe neste filtro.</p></article>;
}

function HeroTop({ r, tone, meta }) {
  return (
    <div className="mu-hero">
      <div className={`mu-glyph ${tone}`}><ClassGlyph cls={r.cls} size={40} /></div>
      <div style={{ minWidth: 0, display: "grid", gap: 4 }}>
        <div className="mu-name">{r.label}{r.clsLabel !== r.label && <span>{r.clsLabel}</span>}</div>
        <div className="stat-sub"><b>{r.wins}V {r.losses}D</b> · <b>{fmt.dec(r.kda, 2)}:1</b> KDA · {fmt.dec(r.deaths, 1)} mortes por partida</div>
        <div className="mu-champs">{r.champs.slice(0, 6).map((c) => (
          <span key={c.champ} title={`${E.champDisplay(meta, c.champ, c.champId)}: ${c.w}V ${c.n - c.w}D`}><ChampIcon meta={meta} id={c.champId} keyName={c.champ} size={24} /><small className={c.w / c.n >= 0.5 ? "good" : "bad"}>{c.w}-{c.n - c.w}</small></span>
        ))}</div>
      </div>
      <Ring value={r.rate} size={92} stroke={8} color={tone === "good" ? C.blue : C.red}><span><CountUp value={(r.rate || 0) * 100} format={(x) => `${fmt.dec(x, 0)}%`} /><small>WIN RATE</small></span></Ring>
    </div>
  );
}

function Compare({ r, base }) {
  const g = diffTxt(r.gd10, base.gd10, "ouro"), d = diffTxt(r.deaths, base.deaths, "", true);
  return (
    <div className="mu-cmp">
      {g && <div><span className="k">Ouro sobre o jungler aos 10</span><b className={g.better == null ? "" : g.better ? "good" : "bad"}>{g.text}</b><span className="dim">sua média {g.base ?? "—"}</span></div>}
      {d && <div><span className="k">Mortes por partida</span><b className={d.better == null ? "" : d.better ? "good" : "bad"}>{d.text}</b><span className="dim">sua média {d.base ?? "—"}</span></div>}
      <div><span className="k">Participação nos abates</span><b>{pct(r.kp)}</b><span className="dim">{r.n} partidas</span></div>
    </div>
  );
}

function BestTile({ r, board, ov, base, meta, onShow }) {
  return (
    <article className="tile span-6 mu-tile good" style={{ "--i": 0 }}>
      <TileHead icon="crown" title="Melhor matchup" sub="a classe de jungler que você mais vence"
        tip="Subclasse do jungler inimigo (wiki oficial do League of Legends) com o maior win rate no filtro atual. Com poucas partidas, o win rate é puxado para a sua média, para não destacar um 2 a 0 por acaso." />
      <HeroTop r={r} tone="good" meta={meta} />
      <Compare r={r} base={base} />
      <div className="mu-board">
        {board.map((b, k) => (
          <button key={b.key} type="button" className={`mu-row ${b.key === r.key ? "me" : ""}`} style={{ "--k": k }} onClick={() => onShow(b.key, b.cls)} title={`Ver as partidas contra ${b.label} na tabela`}>
            <span className="mu-pos"><ClassGlyph cls={b.cls} size={14} /></span>
            <span className="mu-who">{b.label}<small>{b.n} partidas</small></span>
            <span className="ct-bar"><i style={{ width: `${Math.round((b.rate || 0) * 100)}%` }} /><b className="ct-half" /></span>
            <span className={`mu-wr ${b.rate >= (ov ?? 0.5) ? "good" : "bad"}`}>{pct(b.rate)}</span>
          </button>
        ))}
      </div>
      <p className="note" style={{ margin: 0 }}>Clique numa classe para ver as partidas dela na tabela. A linha no meio da barra marca 50%.</p>
    </article>
  );
}

function WorstTile({ r, ov, base, meta, onShow }) {
  const tip = CLASS_TIP[r.key];
  const guide = MI.CLASS_GUIDE[r.cls];
  const champs = r.champs.filter((c) => c.n - c.w > 0).slice(0, 4);
  return (
    <article className="tile span-6 mu-tile bad" style={{ "--i": 1 }}>
      <TileHead icon="deaths" title="Pior matchup" sub="a classe de jungler que mais vence você"
        tip="Subclasse do jungler inimigo com o menor win rate no filtro atual (suavizado pela sua média quando há poucas partidas). Embaixo, contra quem você mais perdeu e como jogar contra." />
      <HeroTop r={r} tone="bad" meta={meta} />
      <Compare r={r} base={base} />
      <div className="mu-steps">
        <div className="eyebrow">Como jogar contra</div>
        <ol>
          {tip && <li>{tip}</li>}
          {guide && r.cls !== "specialist" && <li>{guide.briar}</li>}
          {r.cls === "specialist" && <li>Aqui cada campeão tem uma regra própria: confira a nota de cada um no guia de matchups de Briar (as letras ao lado dos nomes abaixo).</li>}
          {champs.length > 0 && <li>Abra uma derrota contra {champs.slice(0, 2).map((c) => E.champDisplay(meta, c.champ, c.champId)).join(" e ")} em Partidas em destaque ou no Histórico: veja em que minuto o ouro vira e onde foi a primeira morte.</li>}
        </ol>
      </div>
      {champs.length > 0 && <div className="mu-lost">
        <div className="eyebrow">Contra quem você mais perdeu</div>
        {champs.map((c) => { const t = briarTier(c.champ, E.champDisplay(meta, c.champ, c.champId)); return (
          <div key={c.champ} className="mu-lost-row">
            <ChampIcon meta={meta} id={c.champId} keyName={c.champ} size={22} />
            <span>{E.champDisplay(meta, c.champ, c.champId)}</span>
            {t && <span className={`tier-chip t${t.replace("+", "p")}`} title={`Guia de matchups de Briar do L0ganJG: ${TIER_LABEL[t]}`}>{t}</span>}
            <span className="dim">{c.w}V {c.n - c.w}D</span>
          </div>
        ); })}
      </div>}
      <div className="mu-actions">
        <button type="button" className="btn sm" onClick={() => onShow(r.key, r.cls)}>Ver as partidas contra {r.label} na tabela</button>
        <a className="btn sm ghost" href={BRIAR_GUIDE_URL} target="_blank" rel="noopener noreferrer">Guia de matchups de Briar</a>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Partidas em destaque: 3 vitórias para repetir e 2 derrotas para revisar
export function MatchupGames({ ctx }) {
  const { games, meta } = ctx;
  const rows = useMemo(() => MI.groupByClass(games, meta, "sub"), [games, meta]);
  const worst = useMemo(() => MI.bestWorst(rows, overallOf(games)).worst, [rows, games]);
  const list = useMemo(() => MI.reviewGames(games, meta, { worstKey: worst?.key || null }), [games, meta, worst]);
  if (!list.length) return null;
  return (
    <div className="grid">
      <article className="tile span-12 hl-tile" style={{ "--i": 2 }}>
        <TileHead icon="history" title="Partidas em destaque" sub="3 vitórias para repetir e 2 derrotas para revisar · clique para abrir"
          tip="Vitórias: as de maior nota do jungler no filtro, uma por jungler inimigo. Derrotas: primeiro as contra o seu pior matchup, depois as com mais ouro perdido para o jungler aos 10 e mais mortes no início." />
        <div className="mlist">
          {list.map((x, k) => {
            const g = x.g;
            return (
              <div key={g.id} className={`mrow hl-row ${g.win ? "win" : ""}`} style={{ "--k": k }} onClick={() => ctx.openMatch(g.id)} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") ctx.openMatch(g.id); }}>
                <div className="mrow-res"><b>{g.win ? "Vitória" : "Derrota"}</b><span>{timeAgo(g.start)}</span><span>{fmt.dur(g.duration)}</span></div>
                <div className="mrow-ch"><ChampIcon meta={meta} id={g.champId} keyName={g.champ} size={40} /><span className="vs">VS</span><ChampIcon meta={meta} id={g.oppChampId} keyName={g.oppChamp} size={28} /></div>
                <div className="hl-who">
                  <b>{E.champDisplay(meta, g.oppChamp, g.oppChampId)}</b>
                  <span>{x.c ? `${x.c.label} · ${x.c.clsLabel}` : "classe desconhecida"}</span>
                  <span className={`hl-tier ${g.win ? "good" : "bad"}`}>{g.win ? "para repetir" : "para revisar"}</span>
                </div>
                <div className="mrow-kda"><b>{g.k} / <span className="d">{g.d}</span> / {g.a}</b><span>{fmt.dec(g.kda, 2)} KDA · {fmt.pct(g.kp)} KP</span></div>
                <div className="hl-why">{x.reasons.map((r, j) => <span key={j} className={`sg-r ${r.tone}`}>{r.text}</span>)}</div>
                <div className="mrow-items iconrow">{(g.finalItems || []).slice(0, 6).map((id, j) => <ItemIcon key={j} meta={meta} id={id} size={24} />)}</div>
              </div>
            );
          })}
        </div>
      </article>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Como as classes se enfrentam: o ciclo da wiki, com o seu win rate em cada classe.
// Clicar numa classe troca a explicação ao lado (sem sair do lugar).
export function ClassCycle({ ctx, sel, onPick }) {
  const { games, meta } = ctx;
  const byCls = useMemo(() => new Map(MI.groupByClass(games, meta, "cls").map((r) => [r.key, r])), [games, meta]);
  const cur = sel || "fighter";
  const R = 132, cx = 200, cy = 200, nodeR = 32, spX = 462;
  const ang = (i) => (-90 + i * 72) * (Math.PI / 180);
  const pos = (i, rad = R) => ({ x: cx + rad * Math.cos(ang(i)), y: cy + rad * Math.sin(ang(i)) });
  const trim = Math.asin((nodeR + 7) / R);
  const arc = (i) => {
    const a0 = ang(i) + trim, a1 = ang(i + 1) - trim;
    const p0 = { x: cx + R * Math.cos(a0), y: cy + R * Math.sin(a0) }, p1 = { x: cx + R * Math.cos(a1), y: cy + R * Math.sin(a1) };
    return `M${p0.x.toFixed(1)},${p0.y.toFixed(1)} A${R},${R} 0 0 1 ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
  };
  const mid = (i) => { const a = (ang(i) + ang(i + 1)) / 2; return { x: cx + (R + 26) * Math.cos(a), y: cy + (R + 26) * Math.sin(a) }; };
  // setas de utilidade do Controlador (no centro) para todas as classes do círculo
  const spoke = (i) => { const a = ang(i), r0 = nodeR - 2 + 8, r1 = R - nodeR - 8; return `M${(cx + r0 * Math.cos(a)).toFixed(1)},${(cy + r0 * Math.sin(a)).toFixed(1)} L${(cx + r1 * Math.cos(a)).toFixed(1)},${(cy + r1 * Math.sin(a)).toFixed(1)}`; };
  const wrOf = (cls) => byCls.get(cls);
  const rel = MI.CLASS_RELATIONS[cur];
  const strongSet = new Set(Object.keys(rel?.strong || {})), weakSet = new Set(Object.keys(rel?.weak || {}));
  const Node = ({ cls, p, i, center }) => {
    const r = wrOf(cls);
    const tone = cls === cur ? "on" : strongSet.has(cls) ? "beats" : weakSet.has(cls) ? "loses" : "";
    const outer = i != null;
    const lab = !outer ? { x: 0, y: nodeR + 12 } : { x: (nodeR + 15) * Math.cos(ang(i)), y: (nodeR + 15) * Math.sin(ang(i)) + 4 };
    const anchor = !outer || Math.abs(Math.cos(ang(i))) < 0.4 ? "middle" : Math.cos(ang(i)) > 0 ? "start" : "end";
    return (
      <g className={`cc-node ${tone} ${cls === "fighter" ? "mine" : ""}`} transform={`translate(${p.x},${p.y})`} onClick={() => onPick(cls)} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") onPick(cls); }}>
        <title>{`${CLASSES[cls].label}${r ? ` · você ${pct(r.rate)} em ${r.n} partida${r.n > 1 ? "s" : ""}` : ""}`}</title>
        <circle r={nodeR + 6} className="cc-ring" />
        <circle r={center ? nodeR - 2 : nodeR} className="cc-disc" />
        <g transform="translate(-13,-17)"><ClassGlyph cls={cls} size={26} /></g>
        <text y={20} className="cc-wr">{r ? pct(r.rate) : "—"}</text>
        <text x={lab.x} y={lab.y} className="cc-label" textAnchor={anchor}>{CLASSES[cls].label}</text>
      </g>
    );
  };
  return (
    <Card title="Como as classes se enfrentam" eyebrow="guia de classes · ciclo da wiki oficial do League of Legends"
      tip="Adaptado da página Champion classes (Interaction) da wiki oficial do League of Legends: cada classe costuma ganhar das duas seguintes no sentido das setas e sofrer contra as duas anteriores. O Controlador fica no centro porque a utilidade dele vale contra todas; o Especialista fica fora do ciclo. Os números nos círculos são o seu win rate contra junglers de cada classe, no filtro atual.">
      <div className="cc-grid">
        <div className="cc-svg-wrap">
          <svg viewBox="-42 4 578 392" className="cc-svg" role="img" aria-label="Ciclo das classes. Clique numa classe para ver como ela joga e contra quem ganha.">
            <defs>
              <marker id="cc-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" className="cc-head" /></marker>
              <marker id="cc-arrow-u" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" className="cc-head util" /></marker>
            </defs>
            {MI.CYCLE.map((c, i) => <path key={"s" + c} d={spoke(i)} className="cc-arc util" markerEnd="url(#cc-arrow-u)" />)}
            {MI.CYCLE.map((c, i) => <path key={c} d={arc(i)} className="cc-arc" markerEnd="url(#cc-arrow)" />)}
            {MI.CYCLE.map((c, i) => { const m = mid(i); return <text key={"l" + c} x={m.x} y={m.y} className="cc-arrow-label">{MI.ARROW[c].label}</text>; })}
            <text x={cx} y={cy - 46} className="cc-arrow-label util">utilidade</text>
            {MI.CYCLE.map((c, i) => <Node key={c} cls={c} p={pos(i)} i={i} />)}
            <Node cls="controller" p={{ x: cx, y: cy }} center />
            <Node cls="specialist" p={{ x: spX, y: cy }} />
          </svg>
          <div className="cc-legend"><span><i className="beats" />ganha dessas</span><span><i className="loses" />sofre contra essas</span><span><i className="mine" />a classe da Briar</span></div>
        </div>
        <ClassInfo cls={cur} r={wrOf(cur)} byCls={byCls} onPick={onPick} meta={meta} />
      </div>
    </Card>
  );
}

// Explicação ao lado do ciclo: como a classe joga e como ela se dá com as outras
function ClassInfo({ cls, r, byCls, onPick, meta }) {
  const G = MI.CLASS_GUIDE[cls], P = MI.CLASS_PLAY[cls], Rl = MI.CLASS_RELATIONS[cls];
  const subs = Object.entries(SUBCLASSES).filter(([, s]) => s.cls === cls).map(([k]) => k);
  const relRow = (c, why, tone) => {
    const x = byCls.get(c);
    return (
      <button key={c} type="button" className={`cc-rel-row ${tone}`} onClick={() => onPick(c)} title={`Ver ${CLASSES[c].label}`}>
        <span className="ico"><ClassGlyph cls={c} size={16} /></span>
        <span className="t"><b>{CLASSES[c].label}</b><span>{why}</span></span>
        <span className="n">{x ? <><b className={x.rate >= 0.5 ? "good" : "bad"}>{pct(x.rate)}</b><small>você · {x.n}</small></> : <small>sem partidas</small>}</span>
      </button>
    );
  };
  const labels = Rl?.labels || { strong: "Ganha de", weak: "Sofre contra" };
  const isMine = cls === "fighter";
  const s1 = MI.strongAgainst("fighter").map((c) => byCls.get(c)).filter(Boolean), w1 = MI.weakAgainst("fighter").map((c) => byCls.get(c)).filter(Boolean);
  const agg = (list) => { const n = list.reduce((s, x) => s + x.n, 0), w = list.reduce((s, x) => s + x.wins, 0); return n ? { n, rate: w / n } : null; };
  return (
    <div className="cc-info" key={cls}>
      <div className="cc-info-head">
        <span className={`cc-info-ico ${isMine ? "mine" : ""}`}><ClassGlyph cls={cls} size={30} /></span>
        <div style={{ minWidth: 0 }}>
          <h3>{CLASSES[cls].label}</h3>
          <span className="dim">{[...subs.map((k) => SUBCLASSES[k].label).filter((l) => l !== CLASSES[cls].label), ...(MI.attributesOf(cls).length ? [MI.attributesOf(cls).join(" e ")] : [])].join(" · ") || (cls === "specialist" ? "fora do ciclo" : "utilidade para o time")}</span>
        </div>
        {r ? <span className="cc-info-wr"><b className={r.rate >= 0.5 ? "good" : "bad"}>{pct(r.rate)}</b><small>você · {r.wins}V {r.losses}D</small></span> : <span className="cc-info-wr"><small>sem partidas contra essa classe</small></span>}
      </div>
      <div className="cc-play">
        <div><span className="k">O que quer</span><p>{P.wants}</p></div>
        <div><span className="k">Como se protege</span><p>{P.protects}</p></div>
        <div><span className="k">Na selva</span><p>{(MI.JUNGLE_EXAMPLES[cls] || []).join(" · ")}</p></div>
      </div>
      {Rl?.examples ? (
        <div className="cc-rel">
          <div className="eyebrow">Cada um com a sua regra</div>
          {Object.entries(Rl.examples).map(([name, why]) => (
            <div key={name} className="cc-rel-row static"><span className="ico"><ClassGlyph cls="specialist" size={16} /></span><span className="t"><b>{name}</b><span>{why}</span></span></div>
          ))}
        </div>
      ) : (
        <div className="cc-rel">
          <div className="eyebrow good">{labels.strong}</div>
          {Object.entries(Rl.strong).map(([c, why]) => relRow(c, why, "good"))}
          <div className="eyebrow bad" style={{ marginTop: 6 }}>{labels.weak}</div>
          {Object.entries(Rl.weak).map(([c, why]) => relRow(c, why, "bad"))}
          {Rl.alone && <div className="cc-rel-row static bad"><span className="ico"><ClassGlyph cls={cls} size={16} /></span><span className="t"><b>Quando está sozinho</b><span>{Rl.alone}</span></span></div>}
        </div>
      )}
      <div className={`cc-briar ${isMine ? "" : "other"}`}>
        <div className="eyebrow">{isMine ? "Na prática com a Briar · Lutadora (Mergulhadora)" : `A Briar contra ${PLURAL[cls]}`}</div>
        <p>{isMine ? `${G.strong} ${G.weak}` : G.briar}</p>
        {isMine && (
          <div className="cc-briar-nums">
            {(() => { const a = agg(s1); return <span><span className="k">Onde o ciclo dá vantagem</span><b className={a && a.rate >= 0.5 ? "good" : "bad"}>{a ? pct(a.rate) : "—"}</b><small>{s1.map((x) => x.label).join(" e ") || "Tanque e Matador"}{a ? ` · ${a.n} partidas` : ""}</small></span>; })()}
            {(() => { const a = agg(w1); return <span><span className="k">Onde o ciclo dá desvantagem</span><b className={a && a.rate >= 0.5 ? "good" : "bad"}>{a ? pct(a.rate) : "—"}</b><small>{w1.map((x) => x.label).join(" e ") || "Mago e Atirador"}{a ? ` · ${a.n} partidas` : ""}</small></span>; })()}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Guia de cada classe: menu de cards e a explicação da classe escolhida
const PLURAL = { fighter: "Lutadores", slayer: "Matadores", tank: "Tanques", mage: "Magos", marksman: "Atiradores", controller: "Controladores", specialist: "Especialistas" };
// Arte de cada carta, em ordem de preferência: a que o coletor (2.3.2+) já mandou dentro dos dados,
// a arte de carregamento do Data Dragon, o splash do Community Dragon e, para a Briar, o splash do banner.
function artSources(meta, cls) {
  const key = MI.CLASS_ART[cls];
  const id = Object.entries(meta?.champions || {}).find(([, c]) => c.key === key)?.[0];
  const out = [];
  const emb = meta?.visual?.classArt?.[cls];
  if (emb) out.push({ src: emb, kind: "loading" });
  out.push({ src: `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${key}_0.jpg`, kind: "loading" });
  if (id) out.push({ src: `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-splashes/${id}/${id}000.jpg`, kind: "splash" });
  const sp = meta?.visual?.splash?.[key];
  if (sp) out.push({ src: sp, kind: "splash" });
  return out;
}
export function ClassMenu({ ctx, sel, setSel, onShow, anchorRef }) {
  const { games, meta } = ctx;
  const byCls = useMemo(() => new Map(MI.groupByClass(games, meta, "cls").map((r) => [r.key, r])), [games, meta]);
  const bySub = useMemo(() => new Map(MI.groupByClass(games, meta, "sub").map((r) => [r.key, r])), [games, meta]);
  const [artIdx, setArtIdx] = useState({});
  const arts = useMemo(() => Object.fromEntries(MI.CLASS_ORDER.map((c) => [c, artSources(meta, c)])), [meta]);
  const cls = sel || "fighter";
  const G = MI.CLASS_GUIDE[cls];
  const r = byCls.get(cls);
  const subs = Object.entries(SUBCLASSES).filter(([, s]) => s.cls === cls).map(([k]) => k);
  const strong = MI.strongAgainst(cls), weak = MI.weakAgainst(cls), attrs = MI.attributesOf(cls);
  const chip = (c) => <button key={c} type="button" className="cg-cls" onClick={() => setSel(c)}><ClassGlyph cls={c} size={14} />{CLASSES[c].label}</button>;
  return (
    <section className="card span-12 cg" ref={anchorRef}>
      <div className="card-head"><div><div className="eyebrow">guia de classes · escolha uma classe</div><h2>Guia de cada classe</h2></div></div>
      <div className="cg-grid">
        <div className="cg-menu" role="tablist" aria-label="Classes">
          {MI.CLASS_ORDER.map((c) => (
            <button key={c} type="button" role="tab" aria-selected={c === cls} className={`cg-card ${c === cls ? "on" : ""}`} onClick={() => setSel(c)} title={`${CLASSES[c].label} · arte: ${MI.CLASS_ART[c]}`}>
              <span className="cg-fallback" aria-hidden="true"><ClassGlyph cls={c} size={52} /></span>
              {(() => { const a = arts[c][artIdx[c] || 0]; return a ? <img key={a.src.slice(0, 80)} src={a.src} alt="" className={a.kind} referrerPolicy="no-referrer" onError={() => setArtIdx((x) => ({ ...x, [c]: (x[c] || 0) + 1 }))} /> : null; })()}
              <span className="cg-shine" aria-hidden="true" />
              <span className="cg-label"><ClassGlyph cls={c} size={34} /><b className={CLASSES[c].label.length > 9 ? "long" : ""}>{CLASSES[c].label}</b></span>
            </button>
          ))}
        </div>
        <div className="cg-detail">
          <div className="cg-title"><span className="cg-ico"><ClassGlyph cls={cls} size={30} /></span><div><h3>{CLASSES[cls].label}</h3>
            <span className="dim">{[...subs.map((s) => SUBCLASSES[s].label).filter((l) => l !== CLASSES[cls].label), ...(attrs.length ? [`atributos: ${attrs.join(" e ")}`] : [])].join(" · ") || (cls === "specialist" ? "fora do ciclo de classes" : "utilidade para o time")}</span></div></div>
          <h4>Descrição da classe</h4>
          <p>{G.desc}</p>
          <div className={`cg-subs ${subs.length === 1 ? "one" : ""}`}>{subs.map((s) => { const x = bySub.get(s); return (
            <div key={s} className="cg-sub">
              <b>{SUBCLASSES[s].label}<em>{(MI.SUB_EXAMPLES[s] || []).join(" • ")}</em></b>
              <span>{SUBCLASSES[s].desc}</span>
              <small>{x ? `você: ${pct(x.rate)} em ${x.n} partida${x.n > 1 ? "s" : ""}` : "você: sem partidas contra essa subclasse"}</small>
            </div>
          ); })}</div>
          <div className="cg-chips"><span className="k">Na selva</span>{(MI.JUNGLE_EXAMPLES[cls] || []).map((n) => <span key={n} className="cg-name">{n}</span>)}</div>
          <h4 className="good">Pontos fortes e contra quem essa classe é forte</h4>
          <p>{G.strong}</p>
          {(() => { const list = strong.length ? strong : Object.keys(MI.CLASS_RELATIONS[cls]?.strong || {}); const lab = MI.CLASS_RELATIONS[cls]?.labels?.strong || "Ganha de";
            return list.length ? <div className="cg-chips"><span className="k">{lab}</span>{list.map(chip)}</div> : <div className="cg-chips"><span className="k">Depende do campeão</span>{Object.keys(MI.CLASS_RELATIONS[cls]?.examples || {}).map((n) => <span key={n} className="cg-name">{n}</span>)}</div>; })()}
          <h4 className="bad">Pontos fracos e contra quem essa classe é fraca</h4>
          <p>{G.weak}</p>
          {(() => { const list = weak.length ? weak : Object.keys(MI.CLASS_RELATIONS[cls]?.weak || {}); const lab = MI.CLASS_RELATIONS[cls]?.labels?.weak || "Sofre contra";
            return list.length ? <div className="cg-chips"><span className="k">{lab}</span>{list.map(chip)}</div> : <div className="cg-chips"><span className="k">Como punir</span><span className="cg-name">tire a ferramenta principal dele antes de lutar</span></div>; })()}
          <h4>Com a Briar contra essa classe</h4>
          <p>{G.briar}</p>
          <div className="cg-me">
            {r ? <>
              <div className="cg-me-top"><b className={r.rate >= 0.5 ? "good" : "bad"}>{pct(r.rate)}</b><span>{r.wins}V {r.losses}D em {r.n} partida{r.n > 1 ? "s" : ""} contra {PLURAL[cls]} no filtro</span></div>
              <div className="mu-champs">{r.champs.slice(0, 8).map((c) => (
                <span key={c.champ} title={`${E.champDisplay(meta, c.champ, c.champId)}: ${c.w}V ${c.n - c.w}D`}><ChampIcon meta={meta} id={c.champId} keyName={c.champ} size={24} /><small className={c.w / c.n >= 0.5 ? "good" : "bad"}>{c.w}-{c.n - c.w}</small></span>
              ))}</div>
              <button type="button" className="btn sm" onClick={() => onShow(null, cls)}>Ver essas partidas na tabela</button>
            </> : <>
              <div className="cg-me-top"><b>—</b><span>Você ainda não enfrentou junglers dessa classe neste filtro.</span></div>
              <span className="dim">Quando aparecer um {(MI.JUNGLE_EXAMPLES[cls] || [])[0] || "deles"} do outro lado, use as dicas acima e volte aqui para ver o resultado.</span>
            </>}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Ao lado da tabela por classe: o jungler que você mais vence e o que pede mais cuidado
export function JunglerSpotlight({ ctx, rows, onShowChamp }) {
  const { games, meta } = ctx;
  const ov = overallOf(games) ?? 0.5;
  const el = rows.filter((r) => r.n >= 3);
  const sc = (r) => (r.wins + 3 * ov) / (r.n + 3);
  const best = [...el].sort((a, b) => sc(b) - sc(a) || b.n - a.n)[0];
  const worst = [...el].sort((a, b) => sc(a) - sc(b) || b.n - a.n)[0];
  const block = (r, tone) => {
    if (!r) return <p className="muted">Pouca amostra (precisa de 3 partidas contra o mesmo jungler).</p>;
    const name = E.champDisplay(meta, r.champ, r.champId);
    const t = briarTier(r.champ, name);
    return (
      <button type="button" className={`js-card ${tone}`} onClick={() => onShowChamp(r.champ)} title={`Ver o confronto contra ${name}`}>
        <ChampIcon meta={meta} id={r.champId} keyName={r.champ} size={56} />
        <span className="js-mid">
          <b>{name}</b>
          <span>{r.wins}V {r.losses}D · KDA {fmt.dec(r.kda, 2)} · ouro aos 10 {fmt.signed(r.gold10)}</span>
          {t && <span className="js-tier"><span className={`tier-chip t${t.replace("+", "p")}`}>{t}</span> guia: {TIER_LABEL[t]}</span>}
        </span>
        <Ring value={r.rate} size={64} stroke={9} color={tone === "good" ? C.blue : C.red}><span>{pct(r.rate)}</span></Ring>
      </button>
    );
  };
  return (
    <article className="tile span-5 js-tile" style={{ "--i": 3 }}>
      <TileHead icon="jungle" title="Junglers em destaque" sub="no filtro atual" tip="O jungler inimigo que você mais vence e o que mais vence você, com pelo menos 3 partidas (win rate puxado para a sua média quando há poucas). Clique para abrir o confronto na tabela de cima." />
      <div className="eyebrow good">Jungler que você mais vence</div>
      {block(best && best.rate >= ov ? best : null, "good")}
      <div className="eyebrow bad" style={{ marginTop: 12 }}>Jungler para tomar mais cuidado</div>
      {block(worst && worst.rate < ov && worst !== best ? worst : null, "bad")}
    </article>
  );
}
