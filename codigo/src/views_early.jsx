// Aba "Early Game": como os Challengers começam a partida (estratégia de ritmo), o cronograma de
// decisões da estratégia escolhida e os eventos padrão dos primeiros minutos — você × Challengers.
import * as CH from "./challenger.js";
import * as EG from "./early.js";
import { fmt, C, Card, Tip, Empty } from "./ui.jsx";
import { NoGames } from "./views_overview.jsx";
import { EarlyNumbers } from "./views_jungle.jsx";
import { RouteCloud } from "./views_map.jsx";
import { HabitsHero } from "./views_habits.jsx";
const React = window.React;
const { useMemo, useState } = React;

const pct = (v) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const clock = (s) => (s == null ? "—" : fmt.clock(s));
const LANE = { top: "top lane", mid: "mid lane", bot: "bot lane" };
const LANE_S = { top: "Top", mid: "Mid", bot: "Bot" };
const START = { bot: "Começa no lado do bot da sua selva", top: "Começa no lado do topo da sua selva", rio: "Começa no rio", inimiga: "Começa na selva inimiga" };
const CAMP = { blue: "Blue", red: "Red", sapo: "Sapo", lobos: "Lobos", galinhas: "Galinhas", pedras: "Pedras", rio: "Rio", invade: "Invasão" };
const RESULT = { abate: "com abate", sem: "sem abate", morte: "com morte" };
const OBJ = { DRAGON: "Dragão", HORDE: "Vastilarvas", RIFTHERALD: "Arauto" };
const MIN_CH = 10, MIN_ME = 5;

export function useEarly(ctx) {
  const prep = useMemo(() => CH.prepareRefs(ctx.refs), [ctx.refs]);
  const mine = useMemo(() => ctx.games.filter((g) => g.hasTL && g.position === "JUNGLE").map(EG.earlyProfile).filter(Boolean), [ctx.games]);
  const chal = useMemo(() => (prep ? prep.players.flatMap((p) => p.games).filter((g) => g.hasTL).map(EG.earlyProfile).filter(Boolean) : []), [prep]);
  const sm = useMemo(() => EG.earlySummary(mine), [mine]);
  const sc = useMemo(() => EG.earlySummary(chal), [chal]);
  return { prep, mine, chal, sm, sc };
}

const wrTxt = (x, min) => (!x || !x.n ? "" : x.n >= min ? `${pct(x.wr)} WR` : `${x.n} part.`);
const top = (d, k = 1) => [...(d || [])].filter((x) => x.n).sort((a, b) => b.share - a.share).slice(0, k);

// ---------------------------------------------------------------------------
// Estratégia de ritmo: cada padrão de início com a fatia e a win rate (Challengers × você)
// ---------------------------------------------------------------------------
function StrategyBoard({ mine, chal, sel, onSel }) {
  const tCh = useMemo(() => EG.strategyTable(chal), [chal]);
  const tMe = useMemo(() => EG.strategyTable(mine), [mine]);
  const get = (t, k) => t.find((r) => r.key === k);
  const rows = EG.STRATS.map((s) => ({ s, ch: get(tCh, s.key), me: get(tMe, s.key) }))
    .filter((r) => (r.ch?.n || 0) + (r.me?.n || 0) > 0)
    .sort((a, b) => (b.ch?.share || 0) - (a.ch?.share || 0));
  const maxShare = Math.max(0.01, ...rows.flatMap((r) => [r.ch?.share || 0, r.me?.share || 0]));
  const common = rows.find((r) => r.s.key !== "outro");
  const best = EG.bestStrategy(chal, 40);
  const mineRank = EG.strategyTable(mine, 8).filter((r) => r.strat !== "outro");
  const myBest = [...mineRank].sort((a, b) => b.wr - a.wr || b.n - a.n)[0];
  const myWorst = [...mineRank].sort((a, b) => a.wr - b.wr || b.n - a.n)[0];
  const selArch = (sel || "").split("|")[0];
  return (
    <Card title="Estratégia de ritmo de partida" eyebrow="como o jungler começa a partida" tip="Cada partida entra numa estratégia pelo que dá para medir na timeline da Riot: campos feitos antes da 1ª jogada numa lane, o momento dessa jogada, a ward do nível 1, os recalls e o que o jungler fez depois dos 6 campos. A ordem exata dos campos não aparece nos dados (a posição vem uma vez por minuto). Clique numa estratégia para ver o cronograma dela.">
      <div className="eg-highlights">
        {common?.ch && <button type="button" className="eg-hl ch" onClick={() => onSel(common.s.key)}><span className="k">Mais comum nos Challengers</span><b>{common.s.label}</b><span>{pct(common.ch.share)} das partidas · {pct(common.ch.wr)} WR</span></button>}
        {best && <button type="button" className="eg-hl ch best" onClick={() => onSel(best.key)}><span className="k">A que mais ganha nos Challengers</span><b>{best.label}</b><span>{pct(best.wr)} WR em {best.n} partidas</span></button>}
        {myBest && <button type="button" className="eg-hl me" onClick={() => onSel(myBest.key)}><span className="k">A sua que mais ganha</span><b>{myBest.label}</b><span>{pct(myBest.wr)} WR em {myBest.n} partidas</span></button>}
        {myWorst && myWorst.key !== myBest?.key && <button type="button" className="eg-hl bad" onClick={() => onSel(myWorst.key)}><span className="k">A sua que menos ganha</span><b>{myWorst.label}</b><span>{pct(myWorst.wr)} WR em {myWorst.n} partidas</span></button>}
      </div>
      <div className="eg-strats" role="list">
        <div className="eg-strat head" aria-hidden="true"><span>Estratégia</span><span className="ch">Challengers</span><span className="me">Você</span><span>Prio dos Challengers</span></div>
        {rows.map(({ s, ch, me }) => {
          const prio = ["top", "mid", "bot"].map((l) => ({ l, r: get(tCh, `${s.key}|${l}`) }));
          const prioN = prio.reduce((n, x) => n + (x.r?.n || 0), 0);
          return (
            <button type="button" role="listitem" key={s.key} className={`eg-strat ${selArch === s.key ? "on" : ""}`} onClick={() => onSel(s.key)}>
              <span className="nm"><b>{s.label}{(ch?.share || 0) < 0.05 && <span className="eg-rare">rara</span>}</b><span>{s.desc}</span></span>
              <span className="v ch"><span className="bar"><i style={{ width: `${((ch?.share || 0) / maxShare) * 100}%` }} /></span><b>{pct(ch?.share || 0)}</b><span className="wr">{wrTxt(ch, MIN_CH)}</span></span>
              <span className="v me"><span className="bar"><i style={{ width: `${((me?.share || 0) / maxShare) * 100}%` }} /></span><b>{pct(me?.share || 0)}</b><span className="wr">{wrTxt(me, MIN_ME)}</span></span>
              <span className="eg-pr">{prioN >= 6 ? <>
                <span className="pbar">{prio.map(({ l, r }) => r?.n ? <i key={l} className={l} style={{ width: `${(r.n / prioN) * 100}%` }} title={`${LANE_S[l]}: ${pct(r.n / prioN)} · ${r.n >= MIN_CH ? pct(r.wr) + " WR" : r.n + " partidas"}`} /> : null)}</span>
                <span className="plbl">{prio.filter((x) => x.r?.n).map(({ l, r }) => <span key={l}><i className={l} />{LANE_S[l]} {pct(r.n / prioN)}{r.n >= MIN_CH ? <span className="dim"> · {pct(r.wr)}</span> : null}</span>)}</span>
              </> : <span className="dim">{s.key === "fullFarm" ? "1º gank depois do clear" : "—"}</span>}</span>
            </button>
          );
        })}
      </div>
      <p className="note">WR aparece com pelo menos {MIN_CH} partidas dos Challengers ou {MIN_ME} suas; abaixo disso, o número de partidas. Diferenças de poucos pontos de win rate entre estratégias podem ser acaso: com 60 partidas, a margem é de uns 12 pontos para cima ou para baixo.</p>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Cronograma: o que acontece em cada momento, na estratégia escolhida
// ---------------------------------------------------------------------------
function OptRows({ labels, keys, ch, me, minCh = MIN_CH, minMe = MIN_ME, limit = 6 }) {
  const ks = (keys || ch.map((d) => d.key)).filter((k) => (ch.find((d) => d.key === k)?.n || 0) + (me.find((d) => d.key === k)?.n || 0) > 0)
    .sort((a, b) => (ch.find((d) => d.key === b)?.share || 0) - (ch.find((d) => d.key === a)?.share || 0)).slice(0, limit);
  if (!ks.length) return <p className="muted" style={{ margin: 0 }}>Sem partidas neste momento.</p>;
  return (
    <div className="eg-opts">
      {ks.map((k, i) => {
        const a = ch.find((d) => d.key === k), b = me.find((d) => d.key === k);
        return (
          <div key={k} className={`eg-opt ${i === 0 ? "lead" : ""}`}>
            <span className="l">{labels[k] || k}</span>
            <span className="c"><span className="bar"><i style={{ width: `${(a?.share || 0) * 100}%` }} /></span><b>{pct(a?.share || 0)}</b><span className="wr">{a?.n >= minCh ? pct(a.wr) : ""}</span></span>
            <span className="m"><b>{pct(b?.share || 0)}</b><span className="wr">{b?.n >= minMe ? pct(b.wr) : ""}</span></span>
          </div>
        );
      })}
    </div>
  );
}
function OptHead() {
  return <div className="eg-opt head" aria-hidden="true"><span className="l" /><span className="c">Challengers <span className="dim">· WR</span></span><span className="m">Você <span className="dim">· WR</span></span></div>;
}
const bandTxt = (b) => (b ? (b.p25 != null && b.p75 != null && Math.abs(b.p75 - b.p25) >= 5 ? `${clock(b.p25)} a ${clock(b.p75)}` : clock(b.p50)) : "—");

function Step({ n, title, when, children, facts }) {
  return (
    <div className="eg-step">
      <div className="eg-step-head"><span className="n">{n}</span><b>{title}</b>{when && <span className="when">{when}</span>}</div>
      {children}
      {facts && facts.length > 0 && <div className="eg-facts">{facts.filter(Boolean).map((f, i) => <div key={i} className="eg-fact"><span className="k">{f[0]}</span><b className="ch">{f[1]}</b><span className="x">×</span><b className="me">{f[2]}</b></div>)}</div>}
    </div>
  );
}

function flowOf(s) {
  const out = [];
  const st = top(s.startSide)[0];
  if (st) out.push({ k: "Início", v: { bot: "lado do bot", top: "lado do topo", rio: "rio", inimiga: "selva inimiga" }[st.key], s: pct(st.share) });
  const strat = top(s.strat)[0]?.key;
  if (strat === "reset") out.push({ k: "Clear", v: `3 campos e recall`, s: clock(s.recall1?.p50) });
  else if (s.t6?.p50 != null && ["fullGank", "fullFarm"].includes(strat)) out.push({ k: "Clear", v: "6 campos", s: clock(s.t6.p50) });
  else if (s.t3?.p50 != null) out.push({ k: "Clear", v: "3 campos", s: clock(s.t3.p50) });
  const ac = top(s.afterClear)[0];
  if (ac && ["fullFarm"].includes(strat)) out.push({ k: "Depois dos 6 campos", v: EG.CLEAR_NEXT[ac.key], s: pct(ac.share) });
  const fl = top(s.firstLane)[0], fr = s.firstResult.find((d) => d.key === "abate");
  if (fl) out.push({ k: "1º gank", v: `${LANE_S[fl.key]} · ${clock(s.firstT?.p50)}`, s: fr ? `abate em ${pct(fr.share)}` : "" });
  const nx = top(s.next)[0];
  if (nx && strat !== "fullFarm") out.push({ k: "Logo depois", v: EG.NEXT[nx.key], s: pct(nx.share) });
  if (s.recall1?.p50 != null && strat !== "reset") out.push({ k: "1º recall", v: clock(s.recall1.p50), s: "" });
  const af = top(s.after)[0], al = top(s.afterLane)[0];
  if (af) out.push({ k: "Depois do item", v: af.key === "gankDireto" || af.key === "farmGank" ? `${EG.AFTER[af.key]}${al ? ` · ${LANE_S[al.key]}` : ""}` : EG.AFTER[af.key], s: pct(af.share) });
  if (s.convDragon) out.push({ k: "Abate no bot", v: "vira dragão", s: pct(s.convDragon.got) });
  return out;
}

function Cronograma({ mine, chal, sel, setSel }) {
  const [arch, prioSel] = (sel || "ALL").split("|");
  const chA = EG.filterStrategy(chal, arch), meA = EG.filterStrategy(mine, arch);
  const chS = EG.filterStrategy(chA, sel), meS = EG.filterStrategy(meA, sel);
  const sC = useMemo(() => EG.earlySummary(chS), [chS]);
  const meFallback = meS.length < MIN_ME;
  const sM = useMemo(() => EG.earlySummary(meFallback ? mine : meS), [meS, mine, meFallback]);
  const archs = EG.STRATS.filter((s) => chal.filter((p) => p.strat === s.key).length >= 20 && s.key !== "outro");
  const prios = ["top", "mid", "bot"].filter((l) => chA.filter((p) => p.prio === l).length >= 8);
  const label = sel === "ALL" ? "Todas as estratégias" : EG.strategyLabel(sel);
  const flow = flowOf(sC);
  const isFull = ["fullGank", "fullFarm", "ALL"].includes(arch);
  const sideL = { bot: "Lado do bot da sua selva", top: "Lado do topo da sua selva", rio: "Rio", inimiga: "Selva inimiga" };
  const campTop = (s) => { const t = top(s.startCamp)[0]; return t ? `${CAMP[t.key]} ${pct(t.share)}` : "—"; };
  return (
    <Card title="Cronograma do Challenger" eyebrow="o que eles fazem em cada momento" tip="Para a estratégia escolhida, o que os Challengers fizeram em cada momento do início, com a win rate de cada escolha, e o que você fez nas suas partidas da mesma estratégia. Tempos: do 1º ao 3º quartil das partidas (metade delas cai nessa faixa).">
      <div className="eg-pick">
        <div className="chips">
          <button className="chip" aria-pressed={sel === "ALL"} onClick={() => setSel("ALL")}>Todas</button>
          {archs.map((s) => <button key={s.key} className="chip" aria-pressed={arch === s.key} onClick={() => setSel(s.key)}>{s.short}</button>)}
        </div>
        {arch !== "ALL" && prios.length > 0 && arch !== "fullFarm" && (
          <div className="chips sub"><span className="lbl">Prio</span>
            <button className="chip" aria-pressed={!prioSel} onClick={() => setSel(arch)}>Todas</button>
            {prios.map((l) => <button key={l} className="chip" aria-pressed={prioSel === l} onClick={() => setSel(`${arch}|${l}`)}>{LANE_S[l]}</button>)}
          </div>
        )}
      </div>
      <div className="eg-crono-head">
        <h3>{label}</h3>
        <span>Challengers: <b className="ch">{chS.length} partidas · {pct(sC.wr)} WR</b></span>
        <span>Você: <b className="me">{meFallback ? `${meS.length} partida${meS.length === 1 ? "" : "s"} nessa estratégia` : `${meS.length} partidas · ${pct(sM.wr)} WR`}</b>{meFallback && <span className="dim"> (comparando com todas as suas)</span>}</span>
      </div>
      {chS.length < 8 ? <p className="muted">Poucas partidas dos Challengers nessa estratégia para montar o cronograma.</p> : <>
        <div className="eg-flow">{flow.map((f, i) => (
          <React.Fragment key={i}>{i > 0 && <span className="arrow" aria-hidden="true">›</span>}
            <div className="eg-flow-i"><span className="k">{f.k}</span><b>{f.v}</b>{f.s && <span className="s">{f.s}</span>}</div>
          </React.Fragment>
        ))}</div>
        <div className="eg-steps">
          <Step n="1" title="Início" when="0:00 a 1:30" facts={[
            ["Ward no nível 1", pct(sC.ward1), pct(sM.ward1)],
            ["Ward na selva inimiga", pct(sC.ward1Deep), pct(sM.ward1Deep)],
            ["1º campo mais comum", campTop(sC), campTop(sM)],
          ]}>
            <OptHead /><OptRows labels={sideL} keys={["top", "bot", "rio", "inimiga"]} ch={sC.startSide} me={sM.startSide} />
          </Step>
          <Step n="2" title={isFull ? "Clear e o que vem depois dos 6 campos" : arch === "reset" ? "Clear e recall" : "Clear"} when={isFull ? `6 campos: ${bandTxt(sC.t6)}` : `3 campos: ${bandTxt(sC.t3)}`} facts={[
            ["3 campos", clock(sC.t3?.p50), clock(sM.t3?.p50)],
            ["6 campos", clock(sC.t6?.p50), clock(sM.t6?.p50)],
            arch === "reset" && ["Recall", clock(sC.recall1?.p50), clock(sM.recall1?.p50)],
          ]}>
            {isFull ? <><OptHead /><OptRows labels={EG.CLEAR_NEXT} keys={EG.CLEAR_NEXT_KEYS} ch={sC.afterClear} me={sM.afterClear} /></>
              : <p className="eg-step-note">{EG.STRATS.find((s) => s.key === arch)?.desc}</p>}
          </Step>
          <Step n="3" title="1º gank" when={bandTxt(sC.firstT)} facts={[
            ["Com abate", pct(sC.firstResult.find((d) => d.key === "abate")?.share), pct(sM.firstResult.find((d) => d.key === "abate")?.share)],
            ["Com morte", pct(sC.firstResult.find((d) => d.key === "morte")?.share), pct(sM.firstResult.find((d) => d.key === "morte")?.share)],
            ["Mediana", clock(sC.firstT?.p50), clock(sM.firstT?.p50)],
          ]}>
            <OptHead /><OptRows labels={{ top: "Top lane", mid: "Mid lane", bot: "Bot lane" }} keys={["top", "mid", "bot"]} ch={sC.firstLane} me={sM.firstLane} />
          </Step>
          <Step n="4" title="Logo depois do 1º gank e o 1º recall" when={`recall: ${bandTxt(sC.recall1)}`} facts={[
            ["1º recall (mediana)", clock(sC.recall1?.p50), clock(sM.recall1?.p50)],
            ["Voltou à base por morte", pct(sC.recallDeath), pct(sM.recallDeath)],
            ["2º recall (mediana)", clock(sC.recall2?.p50), clock(sM.recall2?.p50)],
          ]}>
            <OptHead /><OptRows labels={EG.NEXT} keys={EG.NEXT_KEYS} ch={sC.next} me={sM.next} limit={5} />
          </Step>
          <Step n="5" title="Depois do 1º recall" when="até 3 min depois de comprar" facts={[
            ["Gank no topo", pct(sC.afterLane.find((d) => d.key === "top")?.share), pct(sM.afterLane.find((d) => d.key === "top")?.share)],
            ["Gank no meio", pct(sC.afterLane.find((d) => d.key === "mid")?.share), pct(sM.afterLane.find((d) => d.key === "mid")?.share)],
            ["Gank no bot", pct(sC.afterLane.find((d) => d.key === "bot")?.share), pct(sM.afterLane.find((d) => d.key === "bot")?.share)],
          ]}>
            <OptHead /><OptRows labels={EG.AFTER} keys={EG.AFTER_KEYS} ch={sC.after} me={sM.after} />
          </Step>
          <Step n="6" title="Abate vira objetivo?" when="abates do jungler dos 5 aos 14 min" facts={[
            ["1ª vastilarva do time", clock(sC.grubs1T?.p50), clock(sM.grubs1T?.p50)],
            ["1º dragão do time", clock(sC.drag1T?.p50), clock(sM.drag1T?.p50)],
          ]}>
            <ConvRows sC={sC} sM={sM} />
          </Step>
        </div>
        <div className="hb-legend" style={{ marginTop: 10 }}><span><i style={{ background: C.gold }} />Challengers</span><span><i style={{ background: "#2FCF7E" }} />você</span><span className="dim">Primeira linha de cada momento: a escolha mais comum dos Challengers.</span></div>
      </>}
    </Card>
  );
}

function ConvRows({ sC, sM }) {
  const rows = [
    ["Abate no lado do bot com dragão vivo: fez o dragão em até 90 s", sC.convDragon?.got, sM.convDragon?.got, sC.convDragon, sM.convDragon],
    ["…e o inimigo fez o dragão", sC.convDragon?.lost, sM.convDragon?.lost, null, null, true],
    ["Abate no lado do topo com vastilarvas vivas: fez em até 90 s", sC.convGrubs?.got, sM.convGrubs?.got, sC.convGrubs, sM.convGrubs],
  ];
  return (
    <div className="eg-conv">
      {rows.map(([l, a, b, ca, cb, sub], i) => (
        <div key={i} className={`eg-conv-row ${sub ? "sub" : ""}`}>
          <span className="l">{l}</span>
          <b className="ch">{pct(a)}</b><span className="x">×</span><b className="me">{pct(b)}</b>
          {ca && ca.nYes >= 20 && ca.nNo >= 20 && ca.yes - ca.no >= 0.04 && <span className="wr">Challengers ganham {pct(ca.yes)} quando fazem e {pct(ca.no)} quando não</span>}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Minuto a minuto: onde estão (mapa e tabela)
// ---------------------------------------------------------------------------
const PLACE_COL = { selvaBot: "#0AC8B9", selvaTop: "#60a5fa", rio: "#8ff0ff", inimiga: "#E84057", top: "#C8AA6E", mid: "#B57BF2", bot: "#f472b6", base: "#6B7A89" };
const PLACE_IN = { base: "na base", top: "na top lane", mid: "na mid lane", bot: "na bot lane", rio: "no rio", selvaTop: "na própria selva, lado do topo", selvaBot: "na própria selva, lado do bot", inimiga: "na selva inimiga" };
const pctTxt = (v) => `${Math.round((v || 0) * 100)}%`;

function MinuteTable({ s, who, src, filt, onPick }) {
  const keys = EG.PLACE_KEYS.filter((k) => s.minutes.some((m) => (m.find((d) => d.key === k)?.share || 0) >= 0.04));
  const mine = filt && filt.src === src;
  return (
    <div className="hb-scroll">
      <table className="eg-heat">
        <thead>
          <tr><th rowSpan={2} className="who">{who}<small>{s.n} partidas</small></th><th colSpan={s.minutes.length} className="cap">minuto do jogo →</th></tr>
          <tr>{s.minutes.map((_, i) => <th key={i} className={`num ${mine && filt.m === i + 1 ? "on" : ""}`}>{i + 1}:00</th>)}</tr>
        </thead>
        <tbody>{keys.map((k) => (
          <tr key={k} className={mine && filt.k === k ? (filt.m == null ? "on" : "onrow") : ""}>
            <td><button type="button" className="eg-heat-place" onClick={() => onPick(src, k, null)} title={`Ver no mapa quando ${who === "Você" ? "você está" : "eles estão"} ${PLACE_IN[k]}`}><i className="dot" style={{ background: PLACE_COL[k] }} />{EG.PLACE[k]}</button></td>
            {s.minutes.map((m, i) => {
              const v = m.find((d) => d.key === k)?.share || 0;
              const on = mine && filt.k === k && filt.m === i + 1;
              return (
                <td key={i} className={`num ${on ? "on" : ""}`} style={{ background: v ? `color-mix(in srgb, ${PLACE_COL[k]} ${Math.round(Math.min(1, v * 1.4) * 70)}%, transparent)` : undefined, color: v >= 0.35 ? "#010a13" : undefined }}>
                  {v >= 0.03 ? <button type="button" onClick={() => onPick(src, k, i + 1)} title={`Aos ${i + 1}:00, ${pctTxt(v)} das partidas ${PLACE_IN[k]}. Clique para ver no mapa.`}>{Math.round(v * 100)}<small>%</small></button> : ""}
                </td>
              );
            })}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

// O que a célula ou a linha escolhida mostra, em texto: quantas partidas, de onde vieram e para onde foram.
function MinuteReadout({ filt, list, whoTxt, subj, team, onClear }) {
  if (!filt) return null;
  const { m, k } = filt;
  const top3 = (arr) => {
    const c = {}; for (const x of arr) if (x) c[x] = (c[x] || 0) + 1;
    const n = arr.filter(Boolean).length;
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([key, v]) => `${pctTxt(v / n)} ${PLACE_IN[key]}`).join(", ");
  };
  const wr = (arr) => (arr.length ? arr.filter((p) => p.win).length / arr.length : null);
  const side = team === 100 ? "lado azul" : "lado vermelho";
  if (m != null) {
    const at = list.filter((p) => p.minutes?.[m - 1]);
    const inK = at.filter((p) => p.minutes[m - 1] === k);
    const before = m > 1 ? top3(inK.map((p) => p.minutes[m - 2])) : "";
    const after = m < 10 ? top3(inK.map((p) => p.minutes[m])) : "";
    const w = wr(inK), wAll = wr(list);
    return (
      <div className="mm-read">
        <div className="mm-read-h"><b>Aos {m}:00, {pctTxt(inK.length / Math.max(1, at.length))} {whoTxt} estavam {PLACE_IN[k]}</b><span className="dim"> ({inK.length} de {at.length} partidas)</span>
          <button type="button" className="btn sm ghost" onClick={onClear}>Limpar filtro</button></div>
        <ul>
          {before && <li><span className="k">Um minuto antes ({m - 1}:00)</span>{before}</li>}
          {after && <li><span className="k">Um minuto depois ({m + 1}:00)</span>{after}</li>}
          {w != null && inK.length >= 5 && <li><span className="k">Win rate dessas partidas</span><b className={w >= (wAll || 0) ? "good" : "bad"}>{pctTxt(w)}</b> <span className="dim">(todas: {pctTxt(wAll)})</span></li>}
        </ul>
        <p className="note" style={{ margin: 0 }}>No mapa: só essas partidas, do {side}, nos 10 primeiros minutos; os pontos do {m}:00 ficam maiores.</p>
      </div>
    );
  }
  const by = Array.from({ length: 10 }, (_, i) => {
    const at = list.filter((p) => p.minutes?.[i]);
    return { m: i + 1, v: at.length ? at.filter((p) => p.minutes[i] === k).length / at.length : 0 };
  }).filter((x) => x.v >= 0.03).sort((a, b) => b.v - a.v).slice(0, 3);
  const went = list.filter((p) => (p.minutes || []).includes(k));
  return (
    <div className="mm-read">
      <div className="mm-read-h"><b>Quando {subj} {PLACE_IN[k]}</b><span className="dim"> ({went.length} de {list.length} partidas passaram por lá até os 10 min)</span>
        <button type="button" className="btn sm ghost" onClick={onClear}>Limpar filtro</button></div>
      <ul>
        {by.length > 0 && <li><span className="k">Minutos mais comuns</span>{by.map((x) => `${x.m}:00 (${pctTxt(x.v)})`).join(", ")}</li>}
      </ul>
      <p className="note" style={{ margin: 0 }}>No mapa: cada ponto é uma partida {PLACE_IN[k]} num minuto (cor = minuto), do {side}.</p>
    </div>
  );
}

function MinuteByMinute({ mine, chal, sel }) {
  const chS = EG.filterStrategy(chal, sel), meS0 = EG.filterStrategy(mine, sel);
  const meS = meS0.length >= MIN_ME ? meS0 : mine;
  const [who, setWho] = useState("ch");
  const [team, setTeam] = useState(100);
  const [filt, setFilt] = useState(null);
  const sC = useMemo(() => EG.earlySummary(chS), [chS]);
  const sM = useMemo(() => EG.earlySummary(meS), [meS]);
  const list = who === "ch" ? chS : meS;
  const label = sel === "ALL" ? "todas as estratégias" : EG.strategyLabel(sel).toLowerCase();
  const onPick = (src, k, m) => {
    if (filt && filt.src === src && filt.k === k && filt.m === m) { setFilt(null); return; }
    setWho(src); setFilt({ src, k, m });
  };
  const pickWho = (w) => { setWho(w); if (filt && filt.src !== w) setFilt(null); };
  // Exemplo de leitura com os dados: a célula mais forte dos Challengers entre 2:00 e 6:00
  let ex = null;
  sC.minutes.forEach((m, i) => { if (i < 1 || i > 5) return; for (const d of m) if (d.share && (!ex || d.share > ex.v)) ex = { m: i + 1, k: d.key, v: d.share }; });
  const whoTxt = who === "ch" ? "dos Challengers" : "das suas partidas";
  const nSide = list.filter((p) => p.team === team).length;
  const mapLabel = filt
    ? `${filt.m != null ? `${list.filter((p) => p.team === team && p.minutes?.[filt.m - 1] === filt.k).length} de ${nSide}` : nSide} partidas do ${team === 100 ? "lado azul" : "lado vermelho"}`
    : `${nSide} partidas do ${team === 100 ? "lado azul" : "lado vermelho"} · minutos 1 a 6`;
  return (
    <Card title="Minuto a minuto" eyebrow={`onde o jungler está · ${label}`} tip="Posição de cada jungler a cada minuto, como a Riot registra (uma vez por minuto). No mapa, cada ponto é uma partida; o número marca o lugar mais comum naquele minuto. Na tabela, cada coluna é um minuto e soma 100%. Mid lane só conta perto da rota (atravessar entre os campos do meio não conta).">
      <div className="eg-mm">
        <div className="eg-mm-map">
          <div className="chips" style={{ marginBottom: 8 }}>
            <button className="chip" aria-pressed={who === "ch"} onClick={() => pickWho("ch")}>Challengers</button>
            <button className="chip" aria-pressed={who === "me"} onClick={() => pickWho("me")}>Você{meS !== meS0 ? " (todas)" : ""}</button>
            <span className="sep" />
            <button className="chip" aria-pressed={team === 100} onClick={() => setTeam(100)}>Lado azul</button>
            <button className="chip" aria-pressed={team === 200} onClick={() => setTeam(200)}>Lado vermelho</button>
          </div>
          <RouteCloud games={list} team={team} label={mapLabel} filter={filt && filt.src === who ? filt : null} />
          <MinuteReadout filt={filt && filt.src === who ? filt : null} list={list} whoTxt={whoTxt} subj={who === "ch" ? "os Challengers estão" : "você está"} team={team} onClear={() => setFilt(null)} />
        </div>
        <div className="eg-mm-tables">
          <p className="mm-how">
            <b>Como ler:</b> cada coluna é um minuto do jogo (1:00, 2:00…) e soma 100%. O número é a parte das partidas em que o jungler estava naquele lugar naquele minuto
            {ex ? <>: por exemplo, aos <b>{ex.m}:00</b>, <b>{pctTxt(ex.v)}</b> dos Challengers estavam {PLACE_IN[ex.k]}</> : null}.
            {" "}<span className="gold">Clique num número ou no nome do lugar para ver essas partidas no mapa.</span>
          </p>
          <MinuteTable s={sC} who="Challengers" src="ch" filt={filt} onPick={onPick} />
          <MinuteTable s={sM} who={meS !== meS0 ? "Você (todas)" : "Você"} src="me" filt={filt} onPick={onPick} />
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Eventos padrão: quando cada coisa acontece (faixa do meio das partidas), você × Challengers
// ---------------------------------------------------------------------------
function EventBands({ sm, sc }) {
  const rows = [
    ["1ª ward", "firstWardT"], ["3 campos", "t3"], ["6 campos (full clear)", "t6"], ["1ª jogada numa lane", "firstT"], ["1º abate", "firstKillT"],
    ["1º recall", "recall1"], ["Troca para a Lente do Oráculo", "oracleT"], ["Nível 6", "lvl6T"], ["2º recall", "recall2"],
    ["1ª sentinela de controle", "controlT"], ["Vastilarvas do time", "grubs1T"], ["1º dragão do time", "drag1T"],
  ].filter(([, k]) => sm[k] || sc[k]);
  const maxT = 900;
  const pos = (t) => `${(Math.min(maxT, Math.max(0, t)) / maxT) * 100}%`;
  const ticks = []; for (let t = 0; t <= maxT; t += 60) ticks.push(t);
  return (
    <div className="eg-bands">
      {rows.map(([label, k]) => {
        const a = sm[k], b = sc[k];
        const d = a?.p50 != null && b?.p50 != null ? a.p50 - b.p50 : null;
        return (
          <div key={k} className="eg-band-row">
            <span className="l">{label}</span>
            <span className="track">
              {ticks.map((t) => <span key={t} className="tk" style={{ left: pos(t) }} />)}
              {b && <span className="bd ch" style={{ left: pos(b.p25), width: `calc(${pos(b.p75)} - ${pos(b.p25)})` }} title={`Challengers: metade entre ${clock(b.p25)} e ${clock(b.p75)}`} />}
              {a && <span className="bd me" style={{ left: pos(a.p25), width: `calc(${pos(a.p75)} - ${pos(a.p25)})` }} title={`Você: metade entre ${clock(a.p25)} e ${clock(a.p75)}`} />}
              {b && <i className="ch" style={{ left: pos(b.p50) }} />}
              {a && <i className="me" style={{ left: pos(a.p50) }} />}
            </span>
            <span className="t"><b>{clock(a?.p50)}</b><span className="c">{clock(b?.p50)}</span>{d != null && Math.abs(d) >= 10 && <span className={`d ${d > 0 ? "late" : "early"}`}>{d > 0 ? "+" : "−"}{fmt.clock(Math.abs(d))}</span>}</span>
          </div>
        );
      })}
      <div className="eg-band-row axis"><span className="l" /><span className="track">{ticks.filter((t) => t % 120 === 0).map((t) => <span key={t} style={{ left: pos(t) }}>{t / 60}′</span>)}</span><span className="t" /></div>
    </div>
  );
}

function StandardEvents({ sm, sc }) {
  const gold = (v) => (v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.round(Math.abs(v)).toLocaleString("pt-BR")}`);
  const facts = [
    ["Ward no nível 1", pct(sm.ward1), pct(sc.ward1)],
    ["Ward na selva inimiga no nível 1", pct(sm.ward1Deep), pct(sc.ward1Deep)],
    ["Aronguejo no início", pct(sm.crabShare), pct(sc.crabShare)],
    ["Lente do Oráculo até os 10", pct(sm.oracleBy10), pct(sc.oracleBy10)],
    ["Sentinela de controle até os 10", pct(sm.controlBy10), pct(sc.controlBy10)],
    ["Ouro × jungler inimigo aos 5", gold(sm.gd5), gold(sc.gd5)],
    ["Ouro × jungler inimigo aos 8", gold(sm.gd8), gold(sc.gd8)],
    ["À frente do jungler inimigo aos 8", pct(sm.ahead8), pct(sc.ahead8)],
    ["Mortes até os 6", sm.deaths6 == null ? "—" : fmt.dec(sm.deaths6, 2), sc.deaths6 == null ? "—" : fmt.dec(sc.deaths6, 2)],
    ["Jogadas em lane até os 8", sm.gankLanes8 == null ? "—" : fmt.dec(sm.gankLanes8, 1), sc.gankLanes8 == null ? "—" : fmt.dec(sc.gankLanes8, 1)],
  ];
  return (
    <Card title="Eventos padrão" eyebrow="quando cada coisa acontece" tip="Faixa colorida: metade das partidas (do 1º ao 3º quartil). Bolinha: a mediana. A ward e a troca do amuleto vêm do coletor 2.0 em diante. Ouro × jungler inimigo: ouro total no minuto, você menos ele (os Challengers contra os junglers deles).">
      <div className="eg-ev">
        <div className="hb-tile">
          <div className="hb-tile-head"><span>Linha do tempo dos primeiros 15 minutos</span></div>
          <EventBands sm={sm} sc={sc} />
          <div className="hb-legend"><span><i style={{ background: "#2FCF7E", borderRadius: "50%" }} />você</span><span><i style={{ background: C.gold, transform: "rotate(45deg)" }} />Challengers</span><span className="dim">+ = depois deles</span></div>
        </div>
        <div className="hb-tile">
          <div className="hb-tile-head"><span>Números do início</span></div>
          <div className="hb-vs">{facts.map(([l, a, b]) => <div key={l} className="hb-vs-row"><span className="l">{l}</span><b className="me">{a}</b><span className="x">×</span><b className="ch">{b}</b></div>)}</div>
          <div className="hb-legend"><span><i style={{ background: "#2FCF7E" }} />você</span><span><i style={{ background: C.gold }} />Challengers</span></div>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
export function Early({ ctx }) {
  const { prep, mine, chal, sm, sc } = useEarly(ctx);
  const best = useMemo(() => EG.bestStrategy(chal, 40), [chal]);
  const [selRaw, setSel] = useState(null);
  const sel = selRaw || best?.key || "ALL";
  const pick = (k) => {
    setSel(k);
    requestAnimationFrame(() => document.getElementById("eg-crono")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  if (!ctx.games.length) return <NoGames ctx={ctx} />;
  const numbers = <><div className="eg-sec-title"><span>Seus números até os 15 minutos</span></div><EarlyNumbers ctx={ctx} /></>;
  if (!prep || !chal.length) return <div className="row-gap"><Empty title="Sem jogadores de referência">Rode o coletor com as referências (atualizar_tudo.bat) para comparar o seu early game com o dos Challengers.</Empty>{numbers}</div>;
  if (!mine.length) return <div className="row-gap"><Empty title="Sem partidas de jungle com timeline neste filtro">O early game usa a timeline da partida. Ajuste o período ou a fila.</Empty>{numbers}</div>;
  const checks = EG.earlyChecks(sm, sc);
  return (
    <div className="row-gap">
      <HabitsHero checks={checks} nMine={mine.length} nChal={chal.length} nPlayers={prep.players.length} title="Early game para treinar" unit="eventos no nível Challenger"
        note="Eventos dos primeiros 10 a 15 minutos, medidos na timeline da Riot. Os tempos dos objetivos seguem o que aparece nas partidas coletadas: dragão aos 5:00 e vastilarvas aos 8:00." />
      <StrategyBoard mine={mine} chal={chal} sel={sel} onSel={pick} />
      <div id="eg-crono" className="row-gap">
        <Cronograma mine={mine} chal={chal} sel={sel} setSel={setSel} />
        <MinuteByMinute mine={mine} chal={chal} sel={sel} />
      </div>
      <StandardEvents sm={sm} sc={sc} />
      {numbers}
    </div>
  );
}

// Cartão da Visão Geral: os pontos do early game mais longe dos Challengers.
export function EarlyTile({ ctx, i, TileHead }) {
  const { prep, mine, chal, sm, sc } = useEarly(ctx);
  const checks = useMemo(() => (mine.length && chal.length ? EG.earlyChecks(sm, sc) : []), [mine, chal, sm, sc]);
  const best = useMemo(() => EG.bestStrategy(chal, 40), [chal]);
  const crit = checks.filter((c) => c.status !== "nivel").sort((a, b) => b.score - a.score).slice(0, 3);
  const at = checks.filter((c) => c.status === "nivel").length;
  return (
    <article className="tile link span-4" style={{ "--i": i }} onClick={() => ctx.go("early-game")} title="Abrir Early Game">
      <TileHead icon="early" title="Early game" sub={checks.length ? `${at} de ${checks.length} no nível` : "× Challengers"} tip="Os eventos dos primeiros minutos mais longe dos Challengers de referência, no período escolhido." />
      {!prep || !chal.length ? <p className="muted" style={{ margin: 0 }}>Rode o coletor com as referências para comparar com os Challengers.</p>
        : !mine.length ? <p className="muted" style={{ margin: 0 }}>Sem partidas de jungle com timeline neste período.</p> : <>
          <div className="eg-tile-list">
            {crit.length ? crit.map((c) => (
              <div key={c.key} className="eg-tile-row"><span className="nm">{c.title}</span><span className="v"><b className="me">{c.fmt(c.me)}</b><span className="x">×</span><b className="ch">{c.fmt(c.ch)}</b></span></div>
            )) : <p className="muted" style={{ margin: 0 }}>Tudo no nível dos Challengers neste período.</p>}
          </div>
          {best && <div className="eg-tile-best"><span className="k">Estratégia que mais ganha nos Challengers</span><b>{best.label}</b><span className="dim">{pct(best.wr)} WR em {best.n} partidas</span></div>}
        </>}
      <div className="dim" style={{ fontSize: "0.76rem" }}>Abra o Early Game para ver o cronograma completo.</div>
    </article>
  );
}
