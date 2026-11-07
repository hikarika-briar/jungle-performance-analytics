// Blocos da aba Hábitos que dependem do lado do mapa, das estratégias do Early Game e das classes
// dos campeões: início por lado, objetivos por lado, estratégias e "para onde ir primeiro".
import * as E from "./engine.js";
import * as EG from "./early.js";
import * as SI from "./situations.js";
import { SUBCLASSES, subLabel, subTitle } from "./classes.js";
import { C, Tip } from "./ui.jsx";
const React = window.React;
const { useMemo, useState } = React;

const EMERALD = "#2FCF7E";
const pct = (v) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const wrOf = (l) => (l.length ? l.filter((p) => p.win).length / l.length : null);
const MIN_ME = 5, MIN_CH = 10;
const wrTag = (d, min) => (!d || !d.n ? null : d.n >= min ? <span className="dim"> · {pct(d.wr)} WR</span> : <span className="dim"> · {d.n} part.</span>);
const SIDE = { 100: { key: "azul", label: "Lado azul", cls: "blue" }, 200: { key: "vermelho", label: "Lado vermelho", cls: "red" } };

function dist(list, f, keys) {
  const known = list.filter((p) => f(p) != null);
  return keys.map((k) => { const sub = known.filter((p) => f(p) === k); return { key: k, n: sub.length, share: known.length ? sub.length / known.length : null, wr: wrOf(sub) }; });
}

function Stack({ d, labels, colors, who }) {
  const total = d.reduce((s, x) => s + x.n, 0);
  return (
    <div className="hb-stack" aria-label={who}>
      <span className="who">{who}</span>
      <span className="bar">{total ? d.map((x, i) => x.n ? <i key={x.key} style={{ width: `${(x.n / total) * 100}%`, background: colors[i % colors.length] }} title={`${labels[x.key]}: ${pct(x.n / total)} · ${x.n} partidas`}>{x.n / total >= 0.14 ? pct(x.n / total) : ""}</i> : null) : <span className="dim" style={{ padding: "0 6px", fontSize: ".72rem" }}>sem partidas</span>}</span>
    </div>
  );
}
// Bloco: barras (você e Challengers) e linhas com fatia e win rate de cada opção
function Block({ title, tip, me, ch, labels, colors }) {
  const keys = me.map((x) => x.key).filter((k) => (me.find((x) => x.key === k)?.n || 0) + (ch.find((x) => x.key === k)?.n || 0) > 0);
  const fm = me.filter((x) => keys.includes(x.key)), fc = ch.filter((x) => keys.includes(x.key));
  const tm = fm.reduce((s, x) => s + x.n, 0) || 1, tc = fc.reduce((s, x) => s + x.n, 0) || 1;
  return (
    <div className="sd-block">
      <div className="sd-block-head"><span>{title}</span>{tip && <Tip text={tip} />}</div>
      <Stack d={fm} labels={labels} colors={colors} who="Você" />
      <Stack d={fc} labels={labels} colors={colors} who="Challengers" />
      <table className="hb-mini">
        <thead><tr><th /><th className="num">Você</th><th className="num">Challengers</th></tr></thead>
        <tbody>{keys.map((k) => {
          const a = me.find((x) => x.key === k), b = ch.find((x) => x.key === k);
          return <tr key={k}><td><i className="dot" style={{ background: colors[me.findIndex((x) => x.key === k) % colors.length] }} />{labels[k]}</td>
            <td className="num">{pct((a?.n || 0) / tm)}{wrTag(a, MIN_ME)}</td><td className="num">{pct((b?.n || 0) / tc)}{wrTag(b, MIN_CH)}</td></tr>;
        })}</tbody>
      </table>
    </div>
  );
}

// Quantas partidas em cada lado e a win rate de cada lado (você e Challengers)
export function SidesHeader({ mine, chal }) {
  const row = (who, list, tone) => {
    const b = list.filter((p) => p.team === 100), r = list.filter((p) => p.team === 200);
    const n = b.length + r.length || 1;
    return (
      <div className={`sd-row ${tone}`}>
        <span className="who">{who} <span className="dim">({b.length + r.length})</span></span>
        <span className="bar"><i className="blue" style={{ width: `${(b.length / n) * 100}%` }}>{b.length / n >= 0.2 ? `Azul ${pct(b.length / n)}` : ""}</i><i className="red" style={{ width: `${(r.length / n) * 100}%` }}>{r.length / n >= 0.2 ? `Vermelho ${pct(r.length / n)}` : ""}</i></span>
        <span className="wr"><span>WR no azul <b>{b.length ? pct(wrOf(b)) : "—"}</b></span><span>WR no vermelho <b>{r.length ? pct(wrOf(r)) : "—"}</b></span></span>
      </div>
    );
  };
  return <div className="sd-head">{row("Você", mine, "me")}{row("Challengers", chal, "ch")}</div>;
}

// Painéis lado azul | lado vermelho, cada um com os mesmos blocos
export function SidePanels({ mine, chal, blocks }) {
  return (
    <div className="sd-panels">
      {[100, 200].map((team) => {
        const m = mine.filter((p) => p.team === team), c = chal.filter((p) => p.team === team);
        return (
          <div key={team} className={`sd-panel ${SIDE[team].cls}`}>
            <div className="sd-panel-head"><b>{SIDE[team].label}</b><span className="dim">você {m.length} · Challengers {c.length} partidas</span></div>
            {blocks.map((bl) => <Block key={bl.title} title={typeof bl.title === "function" ? bl.title(team) : bl.title} tip={bl.tip} me={dist(m, bl.f, bl.keys)} ch={dist(c, bl.f, bl.keys)} labels={typeof bl.labels === "function" ? bl.labels(team) : bl.labels} colors={bl.colors} />)}
          </div>
        );
      })}
    </div>
  );
}

// Nome do campo com o lado da selva em que ele fica para aquele time ("Red · lado do bot")
const CAMP = { blue: "Blue", red: "Red", sapo: "Sapo", lobos: "Lobos", galinhas: "Galinhas", pedras: "Pedras", rio: "Rio (ward ou leash)", invade: "Invasão nível 1" };
export function campLabels(team) {
  const out = {};
  for (const [k, name] of Object.entries(CAMP)) {
    const c = E.JUNGLE_CAMPS.find((x) => x.key === k && x.team === team);
    out[k] = c ? `${name} · lado do ${c.y > c.x ? "topo" : "bot"}` : name;
  }
  return out;
}

// Primeiro objetivo do time, por lado, e a resposta direta: no azul eles focam o quê? Qual ganha mais?
const OBJ = { DRAGON: "Dragão", HORDE: "Vastilarvas", RIFTHERALD: "Arauto", nenhum: "Nenhum até os 15" };
export function objectiveAnswer(chal) {
  const lines = [];
  let best = null;
  for (const team of [100, 200]) {
    const c = chal.filter((p) => p.team === team);
    const d = dist(c, (p) => p.firstObjective, ["DRAGON", "HORDE"]);
    const top = [...d].sort((a, b) => b.n - a.n)[0];
    if (!top || !top.n) continue;
    lines.push({ team, focus: top.key, share: top.n / (c.length || 1), rows: d });
    for (const x of d) if (x.n >= MIN_CH && (!best || x.wr > best.wr)) best = { team, key: x.key, wr: x.wr, n: x.n };
  }
  return { lines, best };
}
export function ObjectiveAnswer({ chal }) {
  const a = objectiveAnswer(chal);
  if (!a.lines.length) return null;
  return (
    <div className="sd-answer">
      {a.lines.map((l) => {
        const other = l.rows.find((x) => x.key !== l.focus);
        return <p key={l.team}><b className={SIDE[l.team].cls === "blue" ? "c-blue" : "c-red"}>{SIDE[l.team].label}:</b> os Challengers vão primeiro {l.focus === "DRAGON" ? "no dragão" : "nas vastilarvas"} em <b>{pct(l.share)}</b> das partidas ({pct(l.rows.find((x) => x.key === l.focus).wr)} WR){other && other.n ? <>; {other.key === "DRAGON" ? "no dragão" : "nas vastilarvas"}, {pct(other.n / (chal.filter((p) => p.team === l.team).length || 1))} ({other.n >= MIN_CH ? `${pct(other.wr)} WR` : `${other.n} partidas`})</> : null}.</p>;
      })}
      {a.best && <p className="best">Maior win rate: <b>{a.best.key === "DRAGON" ? "focar o dragão" : "focar as vastilarvas"} jogando no {SIDE[a.best.team].label.toLowerCase()}</b>, {pct(a.best.wr)} em {a.best.n} partidas dos Challengers.</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Estratégias de início (as mesmas do Early Game)
// ---------------------------------------------------------------------------
export function StrategyDistTile({ mine, chal }) {
  const keys = useMemo(() => {
    const c = {};
    for (const p of mine) c[EG.strategyKey(p)] = (c[EG.strategyKey(p)] || 0) + 1 / mine.length;
    for (const p of chal) c[EG.strategyKey(p)] = (c[EG.strategyKey(p)] || 0) + 1 / chal.length;
    return Object.entries(c).filter(([k]) => !k.startsWith("outro")).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => k);
  }, [mine, chal]);
  const labels = Object.fromEntries(keys.map((k) => [k, EG.strategyLabel(k)]));
  const colors = ["#0ac8b9", "#f472b6", "#c8aa6e", "#a78bfa", "#60a5fa", "#86efac"];
  const me = dist(mine, EG.strategyKey, keys), ch = dist(chal, EG.strategyKey, keys);
  const tm = me.reduce((s, x) => s + x.n, 0) || 1, tc = ch.reduce((s, x) => s + x.n, 0) || 1;
  return (
    <div className="hb-tile">
      <div className="hb-tile-head"><span>Estratégia de início</span><Tip text="As mesmas estratégias da aba Early Game, com a lane da prio (a 1ª jogada numa lane). As 6 mais comuns entre você e os Challengers; a porcentagem é dentro dessas 6." /></div>
      <Stack d={me} labels={labels} colors={colors} who="Você" />
      <Stack d={ch} labels={labels} colors={colors} who="Challengers" />
      <div className="hb-rows">{keys.map((k, i) => {
        const a = me.find((x) => x.key === k), b = ch.find((x) => x.key === k);
        return (
          <div key={k} className="hb-row2">
            <div className="l"><i className="dot" style={{ background: colors[i] }} />{labels[k]}</div>
            <div className="v"><span className="me">Você <b>{pct(a.n / tm)}</b>{wrTag(a, MIN_ME)}</span><span className="ch">Challengers <b>{pct(b.n / tc)}</b>{wrTag(b, MIN_CH)}</span></div>
          </div>
        );
      })}</div>
    </div>
  );
}
export function StrategyBestTile({ mine, chal }) {
  const keepRow = (r) => r.strat !== "outro" && (r.prio || r.strat === "fullFarm");
  const mt = EG.strategyTable(mine, 6).filter(keepRow);
  const myTop = [...mt].sort((a, b) => b.wr - a.wr || b.n - a.n).slice(0, 3);
  const myLow = [...mt].sort((a, b) => a.wr - b.wr || b.n - a.n)[0];
  const chTop = EG.strategyTable(chal, 25).filter(keepRow).sort((a, b) => b.n - a.n).slice(0, 3);
  const chBest = EG.bestStrategy(chal, 40);
  const row = (r, tone, extra) => <div key={r.key} className="hb-combo"><span>{r.label}</span><span className="dim">{extra}</span><b className={tone} style={tone ? undefined : { color: C.gold }}>{pct(r.wr)}</b></div>;
  return (
    <div className="hb-tile">
      <div className="hb-tile-head"><span>Estratégias que mais ganham</span><Tip text="As estratégias do Early Game com a lane da prio. Suas: com pelo menos 6 partidas. Challengers: com pelo menos 25." /></div>
      <div className="hb-combo-sec">Suas que mais ganham</div>
      {myTop.length ? myTop.map((r) => row(r, "good", `${r.n} part.`)) : <p className="muted">Poucas partidas por estratégia. Troque o Período para "Todo o histórico".</p>}
      {myLow && myTop.length > 0 && !myTop.some((r) => r.key === myLow.key) && <><div className="hb-combo-sec">Sua que menos ganha</div>{row(myLow, "bad", `${myLow.n} part.`)}</>}
      {chBest && <><div className="hb-combo-sec">A que mais ganha nos Challengers</div>{row(chBest, null, `${chBest.n} part.`)}</>}
      <div className="hb-combo-sec">Mais comuns nos Challengers</div>
      {chTop.map((r) => row(r, null, pct(r.share)))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Para onde ir primeiro: situações de lane por classe
// ---------------------------------------------------------------------------
function SideBar({ sp, who, tone }) {
  if (!sp || !sp.n) return <div className={`sb2 ${tone}`}><span className="who">{who}</span><span className="dim">sem partidas nessa situação</span></div>;
  return (
    <div className={`sb2 ${tone}`}>
      <span className="who">{who} <span className="dim">({sp.n})</span></span>
      <span className="bar">{SI.SIDES.map((s) => sp[s].n ? <i key={s} className={s} style={{ width: `${sp[s].share * 100}%` }}>{sp[s].share >= 0.16 ? `${SI.SIDE_LABEL[s]} ${pct(sp[s].share)}` : ""}</i> : null)}</span>
      <span className="wr">{SI.SIDES.map((s) => <span key={s}>{SI.SIDE_LABEL[s]} <b>{sp[s].n >= (tone === "ch" ? MIN_CH : MIN_ME) ? pct(sp[s].wr) : sp[s].n ? `${sp[s].n}*` : "—"}</b></span>)}</span>
    </div>
  );
}
function verdict(sp, minN = MIN_CH) {
  const b = SI.bestSide(sp, minN);
  if (!b) return null;
  const s = (k) => `${SI.SIDE_LABEL[k].toLowerCase()} (${pct(sp[k].wr)} WR, ${sp[k].n} partidas)`;
  if (b.best === b.common) return <>Os Challengers vão mais para o <b>{SI.SIDE_LABEL[b.common].toLowerCase()}</b> e é também onde mais ganham: {s(b.best)}.</>;
  return <>Os Challengers vão mais para o <b>{SI.SIDE_LABEL[b.common].toLowerCase()}</b> ({pct(sp[b.common].share)}), mas ganham mais quando vão para o <b>{s(b.best)}</b>{b.clear ? "" : "; a diferença é pequena"}.</>;
}

export function SituationBoard({ mineRows, chalRows, prioBox }) {
  const [src, setSrc] = useState("me");
  const base = src === "me" ? mineRows : chalRows;
  const topPairs = useMemo(() => SI.commonPairs(base, "top", 6), [base]);
  const supPairs = useMemo(() => SI.commonPairs(base, "sup", 6), [base]);
  const [cond, setCond] = useState(() => { const t = SI.commonPairs(mineRows, "top", 1)[0], u = SI.commonPairs(mineRows, "sup", 1)[0]; return { topA: t?.a || "", topB: t?.b || "", supA: u?.a || "", supB: u?.b || "" }; });
  const opts = (lane, idx) => [...new Set([...SI.subsPresent(chalRows, lane, idx), ...SI.subsPresent(mineRows, lane, idx)])];
  const chM = SI.matching(chalRows, cond), meM = SI.matching(mineRows, cond);
  const spC = SI.sideSplit(chM), spM = SI.sideSplit(meM);
  const relaxTop = SI.sideSplit(SI.matching(chalRows, { topA: cond.topA, topB: cond.topB })), relaxSup = SI.sideSplit(SI.matching(chalRows, { supA: cond.supA, supB: cond.supB }));
  const set = (k) => (e) => setCond((c) => ({ ...c, [k]: e.target.value }));
  const sel = (k, lane, idx, label) => (
    <label className="field"><span>{label}</span>
      <select value={cond[k]} onChange={set(k)}>
        <option value="">Qualquer</option>
        {opts(lane, idx).map((s) => <option key={s} value={s}>{subTitle(s)}</option>)}
      </select>
    </label>
  );
  const PairList = ({ pairs, lane, title }) => (
    <div className="sit-list">
      <div className="sd-block-head"><span>{title}</span></div>
      {pairs.map((p) => {
        const c = SI.sideSplit(chalRows.filter((r) => r[lane][0] === p.a && r[lane][1] === p.b));
        const mineN = mineRows.filter((r) => r[lane][0] === p.a && r[lane][1] === p.b).length;
        const on = lane === "top" ? cond.topA === p.a && cond.topB === p.b : cond.supA === p.a && cond.supB === p.b;
        return (
          <button key={p.key} type="button" className={`sit-row ${on ? "on" : ""}`} onClick={() => setCond((x) => (lane === "top" ? { ...x, topA: p.a, topB: p.b } : { ...x, supA: p.a, supB: p.b }))}>
            <span className="nm"><span><b>{subLabel(p.a)}</b> <span className="x">×</span> {subLabel(p.b)}</span><small>você {mineN} · Challengers {c.total}</small></span>
            <span className="bar">{SI.SIDES.map((s) => c[s].n ? <i key={s} className={s} style={{ width: `${c[s].share * 100}%` }} title={`${SI.SIDE_LABEL[s]}: ${pct(c[s].share)} · ${c[s].n >= MIN_CH ? pct(c[s].wr) + " WR" : c[s].n + " partidas"}`} /> : null)}</span>
            <span className="v">{(() => { const b = SI.bestSide(c); return b ? <>melhor: <b>{SI.SIDE_LABEL[b.best]}</b> {pct(c[b.best].wr)}</> : <span className="dim">pouca amostra</span>; })()}</span>
          </button>
        );
      })}
    </div>
  );
  const sum = (a, b) => `${a ? subLabel(a) : "qualquer"} × ${b ? subLabel(b) : "qualquer"}`;
  return (
    <div className="sit">
      {prioBox}
      <div className="sit-grid">
        <div className="sit-sim">
          <div className="sd-block-head"><span>Monte a situação da sua partida</span><Tip text="Classes da wiki oficial do League of Legends (Champion classes), traduzidas. O 1º gank é a primeira jogada numa lane (as mesmas regras do Early Game). * menos partidas que o mínimo para mostrar a win rate." /></div>
          <div className="sit-sels">
            {sel("topA", "top", 0, "Seu top")}{sel("topB", "top", 1, "Top inimigo")}
            {sel("supA", "sup", 0, "Seu suporte")}{sel("supB", "sup", 1, "Suporte inimigo")}
          </div>
          <div className="sit-res">
            <div className="sit-res-head">Para onde foi o 1º gank · topo {sum(cond.topA, cond.topB)} · suporte {sum(cond.supA, cond.supB)}</div>
            <SideBar sp={spC} who="Challengers" tone="ch" />
            <SideBar sp={spM} who="Você" tone="me" />
            <p className="sit-verdict">{verdict(spC) || <span className="dim">Poucas partidas dos Challengers com essa combinação inteira. Veja abaixo cada lane separada.</span>}</p>
            {(spC.n < 30) && (cond.topA || cond.topB) && (cond.supA || cond.supB) && <div className="sit-relax">
              <div><span className="k">Só o topo ({sum(cond.topA, cond.topB)})</span><SideBar sp={relaxTop} who="Challengers" tone="ch" /><p className="sit-verdict">{verdict(relaxTop) || <span className="dim">pouca amostra</span>}</p></div>
              <div><span className="k">Só o bot ({sum(cond.supA, cond.supB)})</span><SideBar sp={relaxSup} who="Challengers" tone="ch" /><p className="sit-verdict">{verdict(relaxSup) || <span className="dim">pouca amostra</span>}</p></div>
            </div>}
          </div>
        </div>
        <div className="sit-common">
          <div className="chips"><span className="dim" style={{ fontSize: ".78rem", alignSelf: "center" }}>Mais comuns em:</span>
            <button className="chip" aria-pressed={src === "me"} onClick={() => setSrc("me")}>Suas partidas</button>
            <button className="chip" aria-pressed={src === "ch"} onClick={() => setSrc("ch")}>Partidas dos Challengers</button>
          </div>
          <PairList pairs={topPairs} lane="top" title="Situações mais comuns no topo (seu top × top inimigo)" />
          <PairList pairs={supPairs} lane="sup" title="Situações mais comuns no bot (seu suporte × suporte inimigo)" />
        </div>
      </div>
      <div className="sit-legend">{["juggernaut", "diver", "skirmisher", "vanguard", "warden", "enchanter", "catcher"].map((k) => <span key={k}><b>{SUBCLASSES[k].label}</b> ({SUBCLASSES[k].en}): {SUBCLASSES[k].desc}</span>)}</div>
    </div>
  );
}

// Para o plano de jogo de uma partida: a situação dela e o que os Challengers fazem nela.
export function situationVerdictFor(row, chalRows) {
  if (!row) return null;
  const exact = SI.sideSplit(SI.matching(chalRows, { topA: row.top[0], topB: row.top[1], supA: row.sup[0], supB: row.sup[1] }));
  const top = SI.sideSplit(SI.matching(chalRows, { topA: row.top[0], topB: row.top[1] }));
  const sup = SI.sideSplit(SI.matching(chalRows, { supA: row.sup[0], supB: row.sup[1] }));
  return { exact, top, sup, row };
}
export { SideBar, verdict };
