// Mapa do Summoner's Rift com os eventos de um trecho da partida (abates, mortes, objetivos e torres),
// numerados na mesma ordem da lista ao lado.
import { RIFT_MAP } from "./map_art.js";
import { ChampIcon, fmt } from "./ui.jsx";
const React = window.React;
const { useMemo, useRef, useState, useEffect } = React;

// Coordenada do jogo (x, y da Riot) -> posição na imagem, em % da largura e da altura.
export function riftToPct(x, y) {
  if (x == null || y == null) return null;
  const h = RIFT_MAP.H;
  const w = h[6] * x + h[7] * y + h[8];
  const px = (h[0] * x + h[1] * y + h[2]) / w, py = (h[3] * x + h[4] * y + h[5]) / w;
  if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
  return { left: Math.max(1.5, Math.min(98.5, (px / RIFT_MAP.w) * 100)), top: Math.max(2, Math.min(98, (py / RIFT_MAP.h) * 100)) };
}

// Eventos no mesmo lugar (mesma luta, torre e inibidor juntos) ficam espalhados em volta do ponto
// real, com uma linha fininha até ele, para nenhum número ficar escondido.
function spread(pins, thr) {
  const ar = RIFT_MAP.w / RIFT_MAP.h;
  const near = (a, b) => Math.hypot(a.left - b.left, (a.top - b.top) / ar) < thr;
  const groups = [];
  for (const p of pins) {
    const g = groups.find((gr) => gr.some((q) => near(q, p)));
    if (g) g.push(p); else groups.push([p]);
  }
  return groups.flatMap((g) => {
    if (g.length === 1) return [{ ...g[0], ax: g[0].left, ay: g[0].top }];
    const cx = g.reduce((s, p) => s + p.left, 0) / g.length, cy = g.reduce((s, p) => s + p.top, 0) / g.length;
    const r = thr * (0.62 + g.length * 0.1);
    return g.map((p, i) => {
      const a = -Math.PI / 2 + (i / g.length) * Math.PI * 2;
      return { ...p, ax: p.left, ay: p.top, left: cx + Math.cos(a) * r, top: cy + Math.sin(a) * r * ar };
    });
  });
}

export const MAP_KIND_LABEL = {
  death: "Sua morte", kill: "Seu abate", assist: "Assistência", "obj-ally": "Objetivo do seu time",
  "obj-enemy": "Objetivo inimigo", "bld-ally": "Estrutura destruída pelo seu time", "bld-enemy": "Estrutura perdida", "jg-enemy": "Jungler inimigo",
  start: "Posição a 1:00", ward: "Ward (local aproximado)", clear: "Full clear (local aproximado)", "recall-end": "Recall (base)",
};

export function EventMap({ items, meta, active, onActive, focusT, caption, labels, path }) {
  const L = { ...MAP_KIND_LABEL, ...(labels || {}) };
  // O tamanho dos números acompanha a largura do mapa, e o espaçamento entre eventos próximos também.
  const box = useRef(null);
  const [mw, setMw] = useState(520);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([en]) => setMw(Math.round(en.contentRect.width) || 520));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pin = mw < 420 ? 20 : 24;
  const thr = Math.max(3.6, ((pin + 4) / mw) * 100);
  const pins = useMemo(() => spread(items.filter((e) => e.n != null).map((e) => ({ ...e, ...riftToPct(e.x, e.y) })), thr), [items, thr]);
  const cur = items.find((e) => e.key === active) || items.find((e) => e.kind === "death" && e.t === focusT) || null;
  const narrow = mw < 420;
  const capEl = cur && (
    <div className={`rmap-cap ${narrow ? "below" : ""}`}>
      {cur.n != null && <span className={`rmap-num ${cur.kind}`}>{cur.n}</span>}
      {cur.champ && <ChampIcon meta={meta} id={cur.champId} keyName={cur.champ} size={22} />}
      <span className="t">{fmt.clock(cur.t)}</span>
      <span className="txt">{cur.text}</span>
      {cur.n == null && <span className="dim"> · sem local no mapa</span>}
      {cur.n != null && cur.approx && <span className="dim"> · aproximado</span>}
    </div>
  );
  return (
    <div className="rmap-wrap">
      <div className="rmap" ref={box} style={{ aspectRatio: `${RIFT_MAP.w} / ${RIFT_MAP.h}`, "--pin": `${pin}px` }} onMouseLeave={() => onActive(null)}>
        <img src={RIFT_MAP.src} alt="Mapa do Summoner's Rift" draggable={false} />
        <div className="rmap-shade" />
        <svg className="rmap-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {path && path.length > 1 && <polyline className="rmap-path" points={path.map((p) => riftToPct(p.x, p.y)).filter(Boolean).map((q) => `${q.left},${q.top}`).join(" ")} vectorEffect="non-scaling-stroke" />}
          {pins.filter((p) => p.ax !== p.left || p.ay !== p.top).map((p) => (
            <line key={p.key} x1={p.ax} y1={p.ay} x2={p.left} y2={p.top} className={p.key === active ? "on" : ""} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {(path || []).filter((p) => p.m != null || p.base).map((p, i) => { const q = riftToPct(p.x, p.y); return q ? <span key={"m" + i} className={`rmap-min ${p.base ? "base" : ""}`} style={{ left: `${q.left}%`, top: `${q.top}%` }} title={p.base ? `Saiu da base · ${fmt.clock(p.t)}` : `Posição aos ${p.m}:00`}>{p.base ? "B" : p.m}</span> : null; })}
        {pins.filter((p) => p.ax !== p.left || p.ay !== p.top).map((p) => (
          <span key={"a" + p.key} className={`rmap-anchor ${p.kind}`} style={{ left: `${p.ax}%`, top: `${p.ay}%` }} />
        ))}
        {pins.map((p) => (
          <button key={p.key} type="button" className={`rmap-pin ${p.kind} ${p.approx ? "approx" : ""} ${p.key === active ? "on" : ""} ${p.kind === "death" && p.t === focusT ? "focus" : ""}`}
            style={{ left: `${p.left}%`, top: `${p.top}%` }} onMouseEnter={() => onActive(p.key)} onFocus={() => onActive(p.key)} onClick={() => onActive(p.key)}
            aria-label={`${p.n}. ${fmt.clock(p.t)} ${p.text}`}>
            {p.n}
          </button>
        ))}
        {cur && !narrow && capEl}
        {!pins.length && <div className="rmap-empty">Nenhum evento com local neste trecho.</div>}
      </div>
      {cur && narrow && capEl}
      <div className="rmap-legend">
        {caption && <span className="rmap-title">{caption}</span>}
        {["start", "ward", "clear", "death", "kill", "assist", "jg-enemy", "obj-ally", "obj-enemy", "bld-ally", "bld-enemy", "recall-end"].filter((k) => pins.some((p) => p.kind === k)).map((k) => (
          <span key={k}><i className={`rmap-dot ${k}`} />{L[k]}</span>
        ))}
      </div>
    </div>
  );
}

// Rota dos dois junglers nos primeiros minutos: posição de minuto em minuto (número = minuto),
// a primeira ward (local aproximado) e os abates de cada um. A posição real entre dois minutos não é conhecida.
export function PathsMap({ paths, meName = "Você", oppName = "Jungler inimigo", meta, meChamp, oppChamp, focus, onFocus }) {
  const [hover, setHover] = useState(null);
  const [own, setOwn] = useState(null);
  if (!paths) return null;
  // Filtro: clicar num jungler mostra só a rota dele (controlado pelo card de cima, quando houver)
  const sel = onFocus ? focus || null : own;
  const setSel = (v) => (onFocus ? onFocus(v) : setOwn(v));
  const toggle = (who) => setSel(sel === who ? null : who);
  const hl = sel || hover;
  const show = (who) => !sel || sel === who;
  const P = (pt) => riftToPct(pt.x, pt.y);
  const line = (pts) => pts.map(P).filter(Boolean).map((p) => `${p.left},${p.top}`).join(" ");
  const meP = paths.me.filter((p) => p.t > 0), opP = paths.opp.filter((p) => p.t > 0);
  const name = (who) => (who === "me" ? meName : oppName);
  const ev = paths.events || { me: [], opp: [] };
  const kills = paths.kills.filter((k) => !sel || k.who === sel || k.who === `${sel}-death`);
  return (
    <div className="pmap-wrap">
      <div className={`rmap pmap ${sel ? "solo" : ""}`} style={{ aspectRatio: `${RIFT_MAP.w} / ${RIFT_MAP.h}`, "--pin": "20px" }}>
        <img src={RIFT_MAP.src} alt="Mapa do Summoner's Rift" draggable={false} />
        <div className="rmap-shade" />
        <svg className="rmap-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {show("opp") && <polyline points={line(opP)} className={`pl opp ${hl === "me" ? "dim" : ""}`} vectorEffect="non-scaling-stroke" />}
          {show("me") && <polyline points={line(meP)} className={`pl me ${hl === "opp" ? "dim" : ""}`} vectorEffect="non-scaling-stroke" />}
        </svg>
        {[["opp", opP], ["me", meP]].filter(([who]) => show(who)).map(([who, pts]) => pts.map((p) => {
          const q = P(p); if (!q) return null;
          return <span key={who + p.t} className={`pm-pt ${who} ${hl && hl !== who ? "dim" : ""}`} style={{ left: `${q.left}%`, top: `${q.top}%` }} title={`${name(who)} · ${Math.round(p.t / 60)}:00 · ${Math.round(p.camps)} campos`}>{Math.round(p.t / 60)}</span>;
        }))}
        {paths.ward && show("me") && (() => { const q = P(paths.ward); return q ? <span className="pm-ward" style={{ left: `${q.left}%`, top: `${q.top}%` }} title={`Primeira ward de ${meName} · ${fmt.clock(paths.ward.t)} · local aproximado`}>W</span> : null; })()}
        {kills.map((k, i) => { const q = P(k); if (!q) return null; return <span key={i} className={`pm-kill ${k.who}`} style={{ left: `${q.left}%`, top: `${q.top}%` }} title={`${fmt.clock(k.t)} · ${k.who === "me" ? `abate de ${meName}` : k.who === "opp" ? `abate de ${oppName}` : k.who === "me-death" ? `${meName} morreu` : `${oppName} morreu`}`}>✕</span>; })}
        {["me", "opp"].filter(show).map((who) => (ev[who] || []).filter((e) => e.k !== "start").map((e, i) => {
          const q = P(e); if (!q) return null;
          return <span key={who + e.k + i} className={`pm-ev ${who} ${hl && hl !== who ? "dim" : ""}`} style={{ left: `${q.left}%`, top: `${q.top}%` }} title={`${name(who)} · ${fmt.clock(e.t)} · ${e.label}`}><b>{fmt.clock(e.t)}</b>{sel ? ` ${e.label}` : ""}</span>;
        }))}
      </div>
      <div className="pmap-legend">
        {[["me", meChamp], ["opp", oppChamp]].map(([who, ch]) => (
          <button key={who} type="button" className={`pml ${who} ${sel === who ? "on" : ""} ${sel && sel !== who ? "off" : ""}`} aria-pressed={sel === who}
            onClick={() => toggle(who)} onMouseEnter={() => setHover(who)} onMouseLeave={() => setHover(null)}>
            {ch && <ChampIcon meta={meta} id={ch.id} keyName={ch.key} size={18} />}<i />{name(who)}</button>
        ))}
        {sel && <button type="button" className="pml all" onClick={() => setSel(null)}>Ver os dois</button>}
        {paths.ward && <span><b className="pm-ward sm">W</b>1ª ward (local aproximado)</span>}<span><b className="pm-kill sm me">✕</b>abate</span>
      </div>
      <RouteRhythm ev={ev} sel={sel} name={name} onPick={toggle} meChamp={meChamp} oppChamp={oppChamp} meta={meta} />
      <p className="note" style={{ margin: 0 }}>Número = minuto do jogo (a Riot grava a posição uma vez por minuto; entre dois pontos o caminho é uma linha reta). As etiquetas com horário marcam o que cada um fez: fim dos campos, 1ª jogada numa lane e 1º recall. Clique num jungler para ver só a rota dele.</p>
    </div>
  );
}

// Ritmo do início: os momentos de cada jungler em sequência, com o tempo entre um e outro,
// e uma régua fina de 0 a 7 minutos para ver o espaçamento.
function RouteRhythm({ ev, sel, name, onPick, meChamp, oppChamp, meta }) {
  const rows = [["me", meChamp], ["opp", oppChamp]].filter(([who]) => (ev[who] || []).length && (!sel || sel === who));
  if (!rows.length) return null;
  const maxT = Math.max(420, ...rows.flatMap(([who]) => ev[who].map((e) => e.t))) + 10;
  const ticks = []; for (let m = 1; m * 60 < maxT; m++) ticks.push(m);
  return (
    <div className="rhythm">
      <div className="rh-head"><span>Ritmo do início</span><span className="dim">o tempo entre uma ação e a próxima</span></div>
      {rows.map(([who, ch]) => (
        <button key={who} type="button" className={`rh-row ${who} ${sel === who ? "on" : ""}`} onClick={() => onPick(who)} aria-pressed={sel === who} title={`Ver só a rota de ${name(who)}`}>
          <span className="rh-who">{ch && <ChampIcon meta={meta} id={ch.id} keyName={ch.key} size={20} />}<b>{name(who)}</b></span>
          <span className="rh-body">
            <span className="rh-bar">
              {ticks.map((m) => <i key={m} className="rh-tick" style={{ left: `${(m * 60 / maxT) * 100}%` }} />)}
              {ev[who].map((e, i) => <i key={e.k + i} className="rh-dot" style={{ left: `${(e.t / maxT) * 100}%` }} title={`${fmt.clock(e.t)} · ${e.label}`} />)}
            </span>
            <span className="rh-chips">
              {ev[who].map((e, i) => {
                const prev = ev[who][i - 1];
                return (
                  <React.Fragment key={e.k + i}>
                    {prev && <span className="rh-gap">{e.t - prev.t < 5 ? "junto ›" : `+${fmt.clock(e.t - prev.t)} ›`}</span>}
                    <span className={`rh-chip ${e.k}`}><b>{fmt.clock(e.t)}</b> {e.label}</span>
                  </React.Fragment>
                );
              })}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

// Nuvem de posições: onde os junglers de um grupo de partidas estavam em cada minuto (1 a 6).
// Cada ponto é uma partida num minuto; o número fica no lugar mais comum daquele minuto.
export const MINUTE_COLORS = ["#F0E6D2", "#8ff0ff", "#0AC8B9", "#C8AA6E", "#f472b6", "#B57BF2", "#60a5fa", "#fb923c", "#a3e635", "#f87171"];
// filter: null (minutos 1 a 6 de todas as partidas), { m, k } (as partidas que estavam em k no minuto m:
// mostra os 10 minutos delas, com o minuto m em destaque) ou { k } (todos os pontos em k, de 1 a 10 min).
export function RouteCloud({ games, team, label, filter = null }) {
  const side = games.filter((g) => g.team === team);
  const cell = filter && filter.m != null;
  const sel = cell ? side.filter((g) => g.minutes?.[filter.m - 1] === filter.k) : side;
  const upTo = filter ? 10 : 6;
  const pts = [];
  for (const g of sel) for (const [m, x, y] of g.pts || []) {
    if (m > upTo) continue;
    if (filter && !cell && g.minutes?.[m - 1] !== filter.k) continue;
    const q = riftToPct(x, y); if (q) pts.push({ m, ...q });
  }
  // lugar mais comum de cada minuto: célula de uma grade de 12 × 12 com mais pontos (média dos pontos dela)
  const modes = [];
  for (let m = 1; m <= upTo; m++) {
    const cells = new Map();
    for (const p of pts) if (p.m === m) { const k = `${Math.floor(p.left / 8.4)}|${Math.floor(p.top / 8.4)}`; if (!cells.has(k)) cells.set(k, []); cells.get(k).push(p); }
    const best = [...cells.values()].sort((a, b) => b.length - a.length)[0];
    if (best && (!filter || best.length >= 2)) modes.push({ m, left: best.reduce((s, p) => s + p.left, 0) / best.length, top: best.reduce((s, p) => s + p.top, 0) / best.length, n: best.length, of: pts.filter((p) => p.m === m).length });
  }
  const n = sel.length;
  const big = (m) => cell && m === filter.m;
  return (
    <div className="pmap-wrap">
      <div className={`rmap pmap rcloud ${filter ? "filtered" : ""}`} style={{ aspectRatio: `${RIFT_MAP.w} / ${RIFT_MAP.h}` }}>
        <img src={RIFT_MAP.src} alt="Mapa do Summoner's Rift" draggable={false} />
        <div className="rmap-shade" />
        <svg className="rmap-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {pts.map((p, i) => <circle key={i} cx={p.left} cy={p.top} r={big(p.m) || (filter && !cell) ? 1.3 : 0.9} fill={MINUTE_COLORS[p.m - 1]}
            opacity={cell ? (big(p.m) ? 0.85 : 0.32) : filter ? 0.8 : n > 60 ? 0.38 : 0.55} />)}
          {(!filter || cell) && <polyline points={modes.map((p) => `${p.left},${p.top}`).join(" ")} className="pl rc-path" vectorEffect="non-scaling-stroke" />}
        </svg>
        {modes.map((p) => <span key={p.m} className={`pm-pt rc-pt ${big(p.m) ? "big" : ""}`} style={{ left: `${p.left}%`, top: `${p.top}%`, background: MINUTE_COLORS[p.m - 1] }} title={`${p.m}:00 · ${Math.round((p.n / Math.max(1, p.of)) * 100)}% dos pontos desse minuto perto daqui`}>{p.m}</span>)}
        {!n && <div className="rmap-empty">{filter ? "Nenhuma partida deste lado nesse filtro." : "Nenhuma partida deste lado."}</div>}
      </div>
      <div className="pmap-legend">
        {label && <span className="rmap-title">{label}</span>}
        {MINUTE_COLORS.slice(0, upTo).map((c, i) => <span key={i} className={big(i + 1) ? "on" : ""}><i className="rc-dot" style={{ background: c }} />{i + 1}:00</span>)}
      </div>
    </div>
  );
}
