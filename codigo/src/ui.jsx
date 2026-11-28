// Componentes compartilhados e formatação (pt-BR)
import { sampleLevel, fmtClock, itemName, runeName, champDisplay } from "./engine.js";
const React = window.React;
const { useState, useMemo } = React;

export const C = {
  bg: "#010A13", bg2: "#061220", card: "#0A1628", line: "#1B2A3C", line2: "#2A3B52",
  blue: "#0AC8B9", gold: "#C8AA6E", green: "#33D69F", red: "#E84057", amber: "#E9A23B", violet: "#B57BF2",
  fg: "#F0E6D2", fg2: "#A09B8C", fg3: "#6B7A89", gold5: "#785A28", gold6: "#463714",
};

// ---------- Formatação ----------
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
export const fmt = {
  int: (v) => (isNum(v) ? Math.round(v).toLocaleString("pt-BR") : "—"),
  dec: (v, d = 1) => (isNum(v) ? v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—"),
  pct: (v, d = 0) => (isNum(v) ? `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })}%` : "—"),
  signed: (v, d = 0) => (isNum(v) ? `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })}` : "—"),
  pp: (v, d = 1) => (isNum(v) ? `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })} p.p.` : "—"),
  clock: fmtClock,
  date: (ts) => (ts ? new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"),
  dateShort: (ts) => (ts ? new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"),
  time: (ts) => (ts ? new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"),
  dur: (sec) => fmtClock(sec),
  byKind: (v, kind) => (kind === "pct" ? fmt.pct(v, 1) : kind === "int" ? fmt.int(v) : kind === "dec2" ? fmt.dec(v, 2) : fmt.dec(v, 1)),
  diffByKind: (v, kind) => (kind === "pct" ? fmt.pp(v) : kind === "int" ? fmt.signed(v, 0) : kind === "dec2" ? fmt.signed(v, 2) : fmt.signed(v, 1)),
};

// ---------- Ícones do jogo (data URI do coletor ou monograma) ----------
const initials = (name) => {
  const s = String(name || "?").replace(/^(A|O|As|Os)\s+/i, "");
  const parts = s.split(/[\s'’:-]+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : s.slice(0, 2)).toUpperCase();
};
export function ItemIcon({ meta, id, size = 26, title }) {
  if (!id) return <span className="gi item empty" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">·</span>;
  const name = itemName(meta, id);
  const src = meta?.icons?.item?.[String(id)];
  return (
    <span className="gi item" style={{ width: size, height: size, fontSize: size * 0.36 }} title={title || name} role="img" aria-label={name}>
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  );
}
export function ChampIcon({ meta, id, keyName, size = 26 }) {
  const name = champDisplay(meta, keyName, id);
  const src = meta?.icons?.champion?.[String(id)];
  return (
    <span className="gi champ" style={{ width: size, height: size, fontSize: size * 0.36 }} title={name} role="img" aria-label={name}>
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  );
}
export function RuneIcon({ meta, id, size = 24 }) {
  if (!id) return null;
  const name = runeName(meta, id);
  const src = meta?.icons?.rune?.[String(id)];
  return (
    <span className="gi rune" style={{ width: size, height: size, fontSize: size * 0.36 }} title={name} role="img" aria-label={name}>
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  );
}
export function ItemRow({ meta, ids, size = 24, arrows = false }) {
  return (
    <span className="iconrow">
      {ids.map((id, i) => (
        <React.Fragment key={i}>
          {arrows && i > 0 && <span className="arrow">›</span>}
          <ItemIcon meta={meta} id={id} size={size} />
        </React.Fragment>
      ))}
    </span>
  );
}
export function ChampName({ meta, keyName, id, size = 24 }) {
  return (
    <span className="namecell">
      <ChampIcon meta={meta} id={id} keyName={keyName} size={size} />
      <span>{champDisplay(meta, keyName, id)}</span>
    </span>
  );
}

// ---------- Pequenos indicadores ----------
export function Tip({ text }) {
  return (
    <span className="tip" tabIndex={0} aria-label={text}>
      ?<span className="bubble" role="tooltip">{text}</span>
    </span>
  );
}
export function Sample({ n, showLabel = true }) {
  const s = sampleLevel(n || 0);
  return (
    <span className={`sample l${s.level}`} title={`${s.label} (${n} partidas). Faixas práticas: <10 muito pequena, 10–19 limitada, 20–49 moderada, 50+ maior. Não são garantia de significância.`}>
      <span className="bars" aria-hidden="true"><i /><i /><i /><i /></span>
      {showLabel && <span>{n} · {s.short}</span>}
    </span>
  );
}
export function WRBar({ rate, ci, n, compact = false }) {
  if (rate == null) return <span className="dim">—</span>;
  const lo = ci ? ci[0] : rate, hi = ci ? ci[1] : rate;
  return (
    <div className="wrbar" title={ci ? `Win rate ${fmt.pct(rate, 1)} · IC 95% (Wilson): ${fmt.pct(lo, 1)} a ${fmt.pct(hi, 1)} · ${n} partidas` : undefined}>
      <div className="track">
        <span className="mid" />
        <span className="ci" style={{ left: `${lo * 100}%`, width: `${Math.max(1, (hi - lo) * 100)}%` }} />
        <span className="pt" style={{ left: `${rate * 100}%`, background: rate >= 0.5 ? C.green : C.red }} />
      </div>
      {!compact && (
        <div className="txt"><strong className="num">{fmt.pct(rate, 1)}</strong><span className="dim num">{fmt.pct(lo, 0)}–{fmt.pct(hi, 0)}</span></div>
      )}
    </div>
  );
}
export function Delta({ value, kind = "dec", better = "higher", suffix = "" }) {
  if (value == null || !isNum(value)) return <span className="delta flat">—</span>;
  const eps = kind === "pct" ? 0.0005 : 0.0001;
  const dir = Math.abs(value) < eps ? "flat" : (value > 0) === (better !== "lower") ? "up" : "down";
  const cls = better == null ? "flat" : dir;
  const txt = kind === "pct" ? fmt.pp(value) : kind === "int" ? fmt.signed(value, 0) : kind === "dec2" ? fmt.signed(value, 2) : fmt.signed(value, 1);
  return <span className={`delta ${cls}`}>{txt}{suffix}</span>;
}
export function StatusChip({ status }) {
  const label = { melhorando: "▲ Melhorando", piorando: "▼ Piorando", estavel: "■ Estável / inconclusivo", inconclusivo: "■ Inconclusivo", "sem-dados": "Sem dados" }[status] || status;
  return <span className={`status ${status}`}>{label}</span>;
}

// ---------- Estrutura ----------
export function Card({ title, eyebrow, right, tip, children, className = "", span = 12 }) {
  return (
    <section className={`card span-${span} ${className}`}>
      {(title || right) && (
        <div className="card-head">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            {title && <h2>{title}{tip && <Tip text={tip} />}</h2>}
          </div>
          {right && <div className="right">{right}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
export function Empty({ title = "Sem dados para mostrar", children, action }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children && <div className="muted" style={{ maxWidth: "60ch" }}>{children}</div>}
      {action}
    </div>
  );
}
export function SubTabs({ tabs, value, onChange }) {
  return (
    <div className="subtabs" role="tablist">
      {tabs.map(([id, label]) => (
        <button key={id} role="tab" aria-selected={value === id} onClick={() => onChange(id)}>{label}</button>
      ))}
    </div>
  );
}

// ---------- Tabela ordenável ----------
export function Table({ columns, rows, initialSort, onRowClick, rowClass, selectedKey, rowKey = (r, i) => r.key ?? r.id ?? i, pageSize = 0, maxHeight }) {
  const [sort, setSort] = useState(initialSort || null);
  const [page, setPage] = useState(0);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const val = col.sortValue || ((r) => r[col.key]);
    return [...rows].sort((a, b) => {
      const va = val(a), vb = val(b);
      const na = va == null || (typeof va === "number" && !Number.isFinite(va)), nb = vb == null || (typeof vb === "number" && !Number.isFinite(vb));
      if (na && nb) return 0; if (na) return 1; if (nb) return -1;
      const r = typeof va === "string" ? va.localeCompare(vb, "pt-BR") : va - vb;
      return sort.dir === "asc" ? r : -r;
    });
  }, [rows, sort, columns]);
  const pages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const pg = Math.min(page, pages - 1);
  const shown = pageSize ? sorted.slice(pg * pageSize, pg * pageSize + pageSize) : sorted;
  const click = (c) => {
    if (c.sortable === false) return;
    setSort((s) => (s && s.key === c.key ? { key: c.key, dir: s.dir === "desc" ? "asc" : "desc" } : { key: c.key, dir: c.firstDir || "desc" }));
    setPage(0);
  };
  return (
    <>
      <div className="tablewrap" style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}>
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`${c.num ? "num" : ""} ${c.sortable === false ? "" : "sortable"}`} onClick={() => click(c)}
                  aria-sort={sort && sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
                  {c.label}{c.tip && <> <Tip text={c.tip} /></>}
                  {sort && sort.key === c.key && <span className="sorti">{sort.dir === "asc" ? "▲" : "▼"}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => {
              const k = rowKey(r, i);
              return (
                <tr key={k} className={`${onRowClick ? "clickable" : ""} ${rowClass ? rowClass(r) : ""} ${selectedKey != null && selectedKey === k ? "sel" : ""}`}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={onRowClick ? (e) => { if (e.key === "Enter") onRowClick(r); } : undefined}>
                  {columns.map((c) => <td key={c.key} className={c.num ? "num" : ""}>{c.render ? c.render(r) : r[c.key] ?? "—"}</td>)}
                </tr>
              );
            })}
            {!shown.length && <tr><td colSpan={columns.length} className="dim" style={{ textAlign: "center", padding: 18 }}>Nenhuma linha com os filtros atuais.</td></tr>}
          </tbody>
        </table>
      </div>
      {pageSize > 0 && pages > 1 && (
        <div className="pager">
          <span>{sorted.length} linhas · página {pg + 1} de {pages}</span>
          <button className="btn sm" disabled={pg === 0} onClick={() => setPage(pg - 1)}>Anterior</button>
          <button className="btn sm" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)}>Próxima</button>
        </div>
      )}
    </>
  );
}

// Colunas padrão de "linha de estatística" (n, V, D, WR, KDA, mortes...)
export function statColumns({ withDur = true, withDmg = true } = {}) {
  const cols = [
    { key: "n", label: "Partidas", num: true, render: (r) => <Sample n={r.n} /> , sortValue: (r) => r.n },
    { key: "wins", label: "V", num: true },
    { key: "losses", label: "D", num: true },
    { key: "rate", label: "Win rate", tip: "Barra cinza = intervalo de confiança de 95% (Wilson). Quanto menor a amostra, mais larga.", render: (r) => <WRBar rate={r.rate} ci={r.ci} n={r.n} /> },
    { key: "kda", label: "KDA", num: true, render: (r) => fmt.dec(r.kda, 2) },
    { key: "deaths", label: "Mortes", num: true, render: (r) => fmt.dec(r.deaths, 1) },
    { key: "csMin", label: "Farm/min", num: true, render: (r) => fmt.dec(r.csMin, 2) },
  ];
  if (withDmg) cols.push({ key: "dmgMin", label: "Dano/min", num: true, render: (r) => fmt.int(r.dmgMin) });
  if (withDur) cols.push({ key: "durMin", label: "Duração", num: true, render: (r) => (r.durMin != null ? fmt.dur(r.durMin * 60) : "—") });
  return cols;
}

// ---------- Recharts ----------
export function ChartTip({ active, payload, label, render }) {
  if (!active || !payload || !payload.length) return null;
  return <div className="tt">{render ? render(payload, label) : payload.map((p) => <div key={p.dataKey}>{p.name}: <strong>{p.value}</strong></div>)}</div>;
}
export const axisProps = { stroke: C.line2, tick: { fill: C.fg2, fontSize: 11 }, tickLine: false };
export const gridProps = { stroke: "#c8aa6e1a", strokeDasharray: "2 5", vertical: false };

// SVG do menu
export const ICONS = {
  home: "M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z",
  briar: "M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 14.4 7.2 16.9l.9-5.4L4.2 7.7l5.4-.8zM5 18.5c2.2 1.6 4.5 2.5 7 2.5s4.8-.9 7-2.5l-1.2 2.3C15.9 22 14 22.6 12 22.6s-3.9-.6-5.8-1.8z",
  habits: "M6 21a3 3 0 110-6 3 3 0 010 6zm12-12a3 3 0 110-6 3 3 0 010 6zM7.5 14.2l1.4 1.4 1.8-1.8-1.4-1.4zm3.6-3.6l1.4 1.4 1.8-1.8-1.4-1.4zm3.6-3.6l1.4 1.4.7-.7-1.4-1.4z",
  goals: "M12 2a10 10 0 100 20 10 10 0 000-20zm0 4a6 6 0 110 12 6 6 0 010-12zm0 3a3 3 0 100 6 3 3 0 000-6z",
  stats: "M4 20V10h3v10zm6.5 0V4h3v16zM17 20v-7h3v7zM3 21h18v1H3z",
  jungle: "M12 2l2.2 6.3L21 9l-5 4.3 1.6 6.7L12 16.6 6.4 20l1.6-6.7L3 9l6.8-.7z",
  sword: "M6 3l12 12-2 2L4 5V3zm12.5 13.5l2 2-1.5 1.5-2-2-2 2-1-1 4.5-4.5 1 1z",
  crown: "M3 18h18v2H3zM3 7l5 4 4-6 4 6 5-4-2 9H5z",
  bolt: "M13 2L4 14h6l-1 8 9-12h-6z",
  map: "M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z",
  challenger: "M3 18h18v2H3zM3 7l5 4 4-6 4 6 5-4-2 9H5z",
  overview: "M3 13h8V3H3zm10 8h8V11h-8zM3 21h8v-6H3zm10-18v6h8V3z",
  builds: "M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm13 0v3h3v2h-3v3h-2v-3h-3v-2h3v-3z",
  runes: "M12 2l3 6 6 1-4.5 4.4L18 20l-6-3.2L6 20l1.5-6.6L3 9l6-1z",
  early: "M12 2a10 10 0 100 20 10 10 0 000-20zm1 5v5.4l4 2.3-.8 1.4L11 13V7z",
  farm: "M5 21V10h3v11zm5.5 0V4h3v17zM16 21v-7h3v7z",
  objectives: "M12 2c-3 4-7 5-7 10a7 7 0 0014 0c0-5-4-6-7-10zm0 17a3 3 0 01-3-3c0-2 3-4 3-4s3 2 3 4a3 3 0 01-3 3z",
  deaths: "M12 2a8 8 0 00-8 8c0 3 1.6 5 3 6v4h2v-2h2v2h2v-2h2v2h2v-4c1.4-1 3-3 3-6a8 8 0 00-8-8zm-3 10a2 2 0 110-4 2 2 0 010 4zm6 0a2 2 0 110-4 2 2 0 010 4z",
  matchups: "M3 5l6 6-2 2 2 2 2-2 2 2-3 3 2 2 3-3 3 3 2-2-3-3 3-3-2-2-3 3-2-2 2-2-2-2-2 2-6-6zm15-2l-6 6 2 2 6-6V3z",
  evolution: "M3 17l6-6 4 4 8-8v4h2V3h-8v2h4l-6 6-4-4-8 8z",
  history: "M4 5h16v2H4zm0 6h16v2H4zm0 6h10v2H4z",
  coach: "M12 3a5 5 0 015 5v1h1a3 3 0 010 6h-1.3A6 6 0 0112 18a6 6 0 01-4.7-3H6a3 3 0 010-6h1V8a5 5 0 015-5zm-3 7a1 1 0 100 2 1 1 0 000-2zm6 0a1 1 0 100 2 1 1 0 000-2zm-6 11h6v1H9z",
  settings: "M19.4 13a7.6 7.6 0 000-2l2.1-1.6-2-3.5-2.5 1a7 7 0 00-1.7-1L15 3h-4l-.4 2.9a7 7 0 00-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 000 2l-2.1 1.6 2 3.5 2.5-1a7 7 0 001.7 1L11 21h4l.4-2.9a7 7 0 001.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7z",
};
export function NavIcon({ name }) {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={ICONS[name]} /></svg>;
}
export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
      <defs><linearGradient id="bmg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F0E6D2" /><stop offset="1" stopColor="#785A28" /></linearGradient></defs>
      <path d="M20 2 L38 20 L20 38 L2 20 Z" fill="#010A13" stroke="url(#bmg)" strokeWidth="1.6" />
      <path d="M20 9 L31 20 L20 31 L9 20 Z" fill="none" stroke="#463714" strokeWidth="1" />
      <path d="M13 24 C17 24 18 19 21 17 C23 15.5 25 16 27 14" fill="none" stroke="#0AC8B9" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M20.5 17.5 l-2.5 -3 M24 15.6 l-0.8 -3.4 M17 21.5 l-3.2 -1.4" stroke="#0AC8B9" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="13" cy="24" r="1.8" fill="#C8AA6E" />
    </svg>
  );
}

// ---------- Números que sobem ao aparecer ----------
export function useCountUp(target, ms = 900) {
  const [v, setV] = useState(isNum(target) ? 0 : target);
  React.useEffect(() => {
    if (!isNum(target)) { setV(target); return; }
    let reduce = false;
    try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* sem suporte */ }
    if (reduce) { setV(target); return; }
    let raf, t0;
    const step = (t) => { if (!t0) t0 = t; const k = Math.min(1, (t - t0) / ms); setV(target * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}
export function CountUp({ value, format = (x) => fmt.int(x) }) {
  const v = useCountUp(value);
  return <>{isNum(v) ? format(v) : "—"}</>;
}

// ---------- Rosca (win rate, metas) ----------
export function Ring({ value, size = 112, stroke = 9, color = C.blue, track = "#0d1b2d", children, className = "donut" }) {
  const r = (100 - stroke) / 2, len = 2 * Math.PI * r;
  const [on, setOn] = useState(false);
  React.useEffect(() => { const t = setTimeout(() => setOn(true), 60); return () => clearTimeout(t); }, []);
  const k = isNum(value) ? Math.max(0, Math.min(1, value)) : 0;
  return (
    <div className={className} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx="50" cy="50" r={r} fill="none" stroke="#000" strokeOpacity=".35" strokeWidth={stroke + 2} strokeDasharray="1 6" />
        <circle className="arc" cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="butt"
          strokeDasharray={len} strokeDashoffset={on ? len * (1 - k) : len} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
      </svg>
      <div className="val">{children}</div>
    </div>
  );
}

// ---------- Comparação frente a frente ----------
// row: { key, label, tip, a, b, fmt: "pct"|"int"|"dec1"|"dec2", better: "higher"|"lower"|"neutral", mode: "rel"|"abs"|"pp", scale, sig, na, nb }
const VERDICTS = [[3, "Empate técnico"], [10, "Um pouco melhor"], [25, "Melhor"], [50, "Bem melhor"], [Infinity, "Muito melhor"]];
export function vsScore(r, nameA, nameB) {
  if (!isNum(r.a) || !isNum(r.b)) return { winner: null, w: 0, verdict: "sem dados" };
  if (r.better === "neutral") return { winner: null, w: 0, verdict: "estilo, sem melhor ou pior" };
  const higher = r.better !== "lower";
  const diff = r.a - r.b;
  if (Math.abs(diff) < 1e-12) return { winner: null, w: 0, verdict: "Empate" };
  const winner = (diff > 0) === higher ? "a" : "b";
  const mode = r.mode || (r.fmt === "pct" ? "pp" : "rel");
  let pct, amount;
  if (mode === "pp") {
    const pp = Math.abs(diff) * 100;
    pct = pp * 2.5;
    amount = `${higher ? "+" : ""}${fmt.dec(pp, 1)} p.p.${higher ? "" : " a menos"}`;
  } else if (mode === "abs") {
    const scale = r.scale || Math.max(Math.abs(r.a), Math.abs(r.b), 1);
    pct = (Math.abs(diff) / scale) * 100;
    amount = `${higher ? "+" : ""}${fmt.int(Math.abs(diff))}${higher ? "" : " a menos"}`;
  } else {
    const worse = winner === "a" ? r.b : r.a;
    pct = (Math.abs(diff) / Math.max(Math.abs(worse), 1e-9)) * 100;
    if (!higher) pct = (Math.abs(diff) / Math.max(Math.abs(r.a), Math.abs(r.b))) * 100;
    amount = higher ? `+${fmt.dec(pct, pct < 10 ? 1 : 0)}%` : `${fmt.dec(pct, pct < 10 ? 1 : 0)}% a menos`;
  }
  const word = VERDICTS.find(([lim]) => pct < lim)[1];
  const tie = pct < 3;
  const name = winner === "a" ? nameA : nameB;
  const unsure = r.sig === false;
  return {
    winner: tie ? null : winner, w: Math.min(100, Math.sqrt(pct) * 10), unsure,
    verdict: tie ? <>Empate técnico</> : unsure ? <><b>{name}</b> · {amount} · pode ser acaso</> : <><b>{name}: {word.toLowerCase()}</b> · {amount}</>,
  };
}
const fmtVs = (v, r) => (r.render ? r.render(v) : !isNum(v) ? "—" : r.fmt === "pct" ? fmt.pct(v, 1) : r.fmt === "int" ? fmt.int(v) : r.fmt === "dec2" ? fmt.dec(v, 2) : fmt.dec(v, 1));
const TONES = { gold: C.gold, teal: C.blue, violet: C.violet, emerald: "#2FCF7E" };
export function Versus({ a, b, rows, compact = false, foot }) {
  const ta = a.tone || "gold", tb = b.tone || "teal";
  const scored = rows.map((r) => ({ ...r, ...vsScore(r, a.short || a.name, b.short || b.name) }));
  const winsA = scored.filter((r) => r.winner === "a" && !r.unsure).length;
  const winsB = scored.filter((r) => r.winner === "b" && !r.unsure).length;
  return (
    <div className={`vs2 ${compact ? "compact" : ""}`} style={{ "--ca": TONES[ta], "--cb": TONES[tb] }}>
      <div className="vs2-head">
        <div className={`vs2-side a tone-${ta}`}>{a.icon}<div style={{ minWidth: 0 }}><div className="vs2-name">{a.name}</div>{a.sub && <div className="vs2-sub">{a.sub}</div>}</div><div className="vs2-score">{winsA}<small>VENCE</small></div></div>
        <div className="vs2-badge" aria-hidden="true"><span>VS</span></div>
        <div className={`vs2-side b tone-${tb}`}>{b.icon}<div style={{ minWidth: 0 }}><div className="vs2-name">{b.name}</div>{b.sub && <div className="vs2-sub">{b.sub}</div>}</div><div className="vs2-score">{winsB}<small>VENCE</small></div></div>
      </div>
      {scored.map((r, k) => (
        <div key={r.key} className={`vs2-row ${r.winner ? "win-" + r.winner : ""} ${r.unsure ? "unsure" : ""}`} style={{ "--k": k }}>
          <div className="vs2-val a">{fmtVs(r.a, r)}{r.na != null && <small>{r.na}</small>}</div>
          <div className="vs2-mid">
            <div className="vs2-label">{r.label}{r.tip && <Tip text={r.tip} />}</div>
            <div className="vs2-bar" aria-hidden="true">
              <span className="half a">{r.winner === "a" && <i style={{ width: `${r.w}%` }} />}</span>
              <span className="half b">{r.winner === "b" && <i style={{ width: `${r.w}%` }} />}</span>
            </div>
            <div className="vs2-verdict">{r.verdict}</div>
          </div>
          <div className="vs2-val b">{fmtVs(r.b, r)}{r.nb != null && <small>{r.nb}</small>}</div>
        </div>
      ))}
      {foot && <div className="vs2-foot">{foot}</div>}
    </div>
  );
}

