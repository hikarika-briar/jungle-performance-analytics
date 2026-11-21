// Painéis do Rumo ao Challenger, logo abaixo do topo: a referência em melhor fase nas últimas 20,
// uma partida para assistir ligada ao seu foco principal, o seu perfil comparado e o que eles estão jogando.
import * as E from "./engine.js";
import * as CH from "./challenger.js";
import { fmt, C, Tip, Ring, CountUp, ChampIcon, ChartTip } from "./ui.jsx";
import { TileHead } from "./views_home.jsx";
import { fmtV } from "./views_challenger.jsx";
import { L } from "./chal_variant.js";

const React = window.React;
const { useMemo } = React;
const R = window.Recharts;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

const patchNum = (p) => String(p || "").split(".").map((x) => Number(x) || 0).reduce((s, x, i) => s + x * (i === 0 ? 1000 : 1), 0);
const lgUrl = (matchId) => { const m = /^([A-Z]+)\d*_(\d+)$/.exec(String(matchId || "")); return m ? `https://www.leagueofgraphs.com/match/${m[1].toLowerCase()}/${m[2]}` : null; };

export function ChallengerPanels({ ctx, cmp, cmpAll, meta, highlights = null }) {
  const myRecent = ctx.pool.length ? ctx.pool : ctx.games;
  return (
    <>
      <div className="grid">
        <TopRefTile players={cmpAll.players} myGames={myRecent} meta={meta} i={0} />
        <WatchTile cmp={cmp} myGames={ctx.games} meta={meta} i={1} />
      </div>
      {highlights && <div className="grid">{highlights}</div>}
      <div className="grid">
        <RadarTile cmp={cmp} n={ctx.games.length} i={2} />
        {L().key === "briar"
          ? <OppTile players={cmpAll.players} myGames={myRecent} meta={meta} i={3} />
          : <ChampsTile players={cmpAll.players} myGames={myRecent} meta={meta} i={3} />}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Referência em melhor fase: win rate e KDA nas últimas 20 de cada um, com você na mesma régua.
function TopRefTile({ players, myGames, meta, i }) {
  const rows = useMemo(() => {
    const list = players.map((p) => {
      const s = E.recentSummary(p.games, 20);
      return { id: p.id, name: p.riotId, s, champs: CH.topChamps(p.games.slice(0, 20), 3), me: false };
    });
    list.push({ id: "me", name: "Você", s: E.recentSummary(myGames, 20), champs: CH.topChamps(myGames.slice(0, 20), 3), me: true });
    return list.filter((r) => r.s.n >= 8).sort((a, b) => (b.s.rate ?? 0) - (a.s.rate ?? 0) || (b.s.kda?.value ?? 0) - (a.s.kda?.value ?? 0));
  }, [players, myGames]);
  const top = rows.find((r) => !r.me);
  if (!top) return null;
  const myPos = rows.findIndex((r) => r.me) + 1;
  const url = CH.opggUrl(top.name);
  const [nm, tg] = top.name.split("#");
  return (
    <article className="tile span-5 ct-top" style={{ "--i": i }}>
      <TileHead icon="crown" title="Em melhor fase" sub="últimas 20 de cada" tip="Win rate nas últimas 20 partidas de cada jogador de referência (até a data da coleta), com o KDA como desempate. Você entra na mesma régua, com as suas últimas 20." />
      <div className="ct-hero">
        <div className="ct-avatar">
          <span className="ct-avatar-ring" aria-hidden="true" />
          <ChampIcon meta={meta} id={top.champs[0]?.champId} keyName={top.champs[0]?.champ} size={70} />
          <span className="ct-rank">1º</span>
        </div>
        <div style={{ minWidth: 0, display: "grid", gap: 4 }}>
          <div className="ct-name">{url ? <a href={url} target="_blank" rel="noopener noreferrer">{nm}</a> : nm}<span>#{tg}</span></div>
          <div className="stat-sub"><b>{top.s.wins}V {top.s.losses}D</b> · <b>{fmt.dec(top.s.kda?.value, 2)}:1</b> KDA · {fmt.dec(top.s.k, 1)}/{fmt.dec(top.s.d, 1)}/{fmt.dec(top.s.a, 1)}</div>
          <div className="ct-champs">{top.champs.map((c) => <span key={c.champ} title={`${E.champDisplay(meta, c.champ, c.champId)}: ${c.n} partidas, ${c.w}V`}><ChampIcon meta={meta} id={c.champId} keyName={c.champ} size={22} /><small>{c.n}</small></span>)}</div>
          <div className="wlrow" title="Da mais antiga (esquerda) para a mais recente (direita)">{[...top.s.seq].reverse().map((w, k) => <i key={k} className={w ? "w" : ""} style={{ "--k": k }} />)}</div>
        </div>
        <Ring value={top.s.rate} size={92} stroke={8} color={C.gold}><span><CountUp value={(top.s.rate || 0) * 100} format={(x) => `${fmt.dec(x, 0)}%`} /><small>WIN RATE</small></span></Ring>
      </div>
      <div className="ct-board">
        {rows.map((r, k) => (
          <div key={r.id} className={`ct-row ${r.me ? "me" : ""}`} style={{ "--k": k }}>
            <span className="ct-pos">{k + 1}</span>
            <span className="ct-who" title={r.name}>{r.me ? "Você" : r.name.split("#")[0]}</span>
            <span className="ct-bar"><i style={{ width: `${Math.round((r.s.rate || 0) * 100)}%` }} /><b className="ct-half" /></span>
            <span className="ct-wr">{fmt.pct(r.s.rate)}</span>
            <span className="ct-kda">{fmt.dec(r.s.kda?.value, 1)}</span>
          </div>
        ))}
      </div>
      <div className="dim" style={{ fontSize: "0.74rem" }}>Você está em <b style={{ color: C.gold }}>{myPos}º de {rows.length}</b> nas últimas 20. Coluna da direita: KDA. A linha no meio da barra marca 50%.</div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Partida para assistir: um jogo de referência em que o seu foco principal saiu muito bem,
// de preferência com o seu campeão (ou um parecido) e do patch atual (o replay ainda pode ser baixado).
function WatchTile({ cmp, myGames, meta, i }) {
  const pick = useMemo(() => {
    const focus = cmp.focus[0];
    const r = focus?.lead;
    if (!r) return null;
    const cand = CH.exampleGames(cmp.players, r.key, 12);
    if (!cand.length) return null;
    const allGames = cmp.players.flatMap((p) => p.games);
    const curPatch = allGames.reduce((best, g) => (patchNum(g.patch) > patchNum(best) ? g.patch : best), "");
    const main = CH.topChamps(myGames, 1)[0]?.champ;
    const fight = (g) => { const t = CH.champTags(meta, g); return t.includes("Fighter") || t.includes("Assassin"); };
    const score = (x) => (x.g.win ? 4 : 0) + (x.g.champ === main ? 5 : fight(x.g) ? 2 : 0) + (x.g.patch === curPatch ? 3 : 0) + (x.g.start / 1e13);
    const sorted = [...cand].sort((a, b) => score(b) - score(a));
    return { focus, r, best: sorted[0], alts: sorted.slice(1, 3), curPatch, main };
  }, [cmp, myGames, meta]);
  if (!pick) return null;
  const { focus, r, best, alts, curPatch } = pick;
  const g = best.g;
  const url = CH.opggUrl(best.player.riotId, best.player.server);
  const lg = lgUrl(g.id);
  const champ = E.champDisplay(meta, g.champ, g.champId), opp = E.champDisplay(meta, g.oppChamp, g.oppChampId);
  const replayOk = g.patch === curPatch && !(best.player.server && best.player.server !== "BR");
  return (
    <article className="tile span-7 ct-watch" style={{ "--i": i }}>
      <TileHead icon="early" title="Partida para assistir" sub={`foco: ${focus.label.toLowerCase()}`} tip={`Escolhida entre as partidas das referências em que o seu foco principal (o primeiro do ${L().coach}, logo abaixo) saiu melhor. Dá preferência a vitórias, ao seu campeão ou a um parecido, e ao patch atual, porque o cliente só baixa replays do patch atual.`} />
      <div className="cw-main">
        <div className="cw-champ">
          <span className="cw-glow" aria-hidden="true" />
          <ChampIcon meta={meta} id={g.champId} keyName={g.champ} size={84} />
          <span className="cw-vs">vs</span>
          <ChampIcon meta={meta} id={g.oppChampId} keyName={g.oppChamp} size={36} />
        </div>
        <div style={{ minWidth: 0, display: "grid", gap: 6 }}>
          <div className="cw-title">{champ} <span>vs {opp}</span></div>
          <div className="stat-sub">{url ? <a href={url} target="_blank" rel="noopener noreferrer">{best.player.riotId}</a> : best.player.riotId} · {fmt.dateShort(g.start)} {fmt.time(g.start)} · {fmt.dur(g.duration)} · patch {g.patch}</div>
          <div className="cw-tags">
            <span className={`res-chip ${g.win ? "w" : "l"}`}>{g.win ? "Vitória" : "Derrota"}</span>
            <span className="htag">{g.k}/{g.d}/{g.a}</span>
            {replayOk ? <span className="htag teal">Replay disponível no cliente</span> : best.player.server && best.player.server !== "BR" ? <span className="htag">Servidor {best.player.server}</span> : <span className="htag">Patch antigo: só os detalhes</span>}
          </div>
        </div>
      </div>
      <div className="cw-why">
        <div><span className="lbl">Nesta partida</span><b>{fmtV(best.v, r)}</b><small>{r.short || r.label}</small></div>
        <div><span className="lbl">Você</span><b className="me">{fmtV(r.me, r)}</b><small>sua média no filtro</small></div>
        <div><span className="lbl">{L().one}</span><b className="chal">{fmtV(r.band.center, r)}</b><small>média deles</small></div>
      </div>
      {r.look && <p className="cw-look"><b>O que observar:</b> {r.look}.</p>}
      <ol className="cw-steps">
        {best.player.server && best.player.server !== "BR" ? <li>Jogador do servidor <b>{best.player.server}</b>: o replay só abre no cliente desse servidor. Use o op.gg ou o League of Graphs abaixo para ver a partida.</li> : <li>No cliente, procure <b>{best.player.riotId}</b> e abra o perfil.</li>}
        <li>Em Histórico de partidas, ache a de <b>{fmt.dateShort(g.start)} com {champ}</b>.</li>
        <li>{replayOk ? "Clique para baixar o replay e assista." : "O replay saiu do cliente com a troca de patch; os links abaixo mostram a partida minuto a minuto."}</li>
      </ol>
      <div className="cw-links">
        {lg && <a className="btn sm" href={lg} target="_blank" rel="noopener noreferrer">Ver a partida no League of Graphs</a>}
        {url && <a className="btn sm ghost" href={url} target="_blank" rel="noopener noreferrer">Perfil no op.gg</a>}
      </div>
      {alts.length > 0 && <div className="cw-alts">
        <span className="lbl">Outras opções</span>
        {alts.map((x) => <div key={x.g.id} className="cw-alt"><ChampIcon meta={meta} id={x.g.champId} keyName={x.g.champ} size={22} /><span>{x.player.riotId.split("#")[0]} · {E.champDisplay(meta, x.g.champ, x.g.champId)} vs {E.champDisplay(meta, x.g.oppChamp, x.g.oppChampId)}</span><span className="dim">{fmt.dateShort(x.g.start)} · {x.g.win ? "V" : "D"} · {fmtV(x.v, r)}</span></div>)}
      </div>}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Perfil em radar: 100 = o nível dos Challengers (a média deles) em cada eixo. Você aparece em % desse nível:
// 92 quer dizer 92% do que eles fazem (para mortes, menos é melhor, então a conta é invertida).
const RADAR_AXES = [
  ["td10", "Início"], ["earlyGanks", "Ganks"], ["jcs10", "Farm de selva"], ["csMin", "Farm"],
  ["objPart", "Objetivos"], ["kp", "Participação"], ["deaths", "Sobrevivência"], ["redeaths", "Disciplina"],
];
const EMERALD = "#2FCF7E";
function RadarTile({ cmp, n, i }) {
  const data = useMemo(() => {
    const all = [...cmp.rows, ...cmp.behavior];
    return RADAR_AXES.map(([key, label]) => {
      const r = all.find((x) => x.key === key);
      const ref = r?.band?.center;
      if (!r || !isNum(r.me) || !isNum(ref) || ref <= 0 || r.me < 0) return null;
      const pct = r.better === "lower" ? (r.me > 0 ? ref / r.me : 1.3) : r.me / ref;
      return { label, me: Math.max(8, Math.min(130, pct * 100)), pct, chal: 100, raw: r };
    }).filter(Boolean);
  }, [cmp]);
  if (data.length < 4) return null;
  const close = data.filter((d) => d.pct >= 0.9).length;
  const above = data.filter((d) => d.pct >= 1).length;
  return (
    <article className="tile span-6 rd-tile" style={{ "--i": i }}>
      <TileHead icon="stats" title={`Seu perfil × ${L().radar}`} sub={`${n} partidas suas`} tip={`Cada eixo compara você com a média dos ${L().refsWord}. O anel dourado é o nível deles (100%); a área verde é você, em % desse nível. Em mortes e mortes em sequência, menos é melhor, então a conta é invertida: morrer mais aparece como uma porcentagem menor.`} />
      <div className="chart" style={{ height: 300 }}>
        <R.ResponsiveContainer>
          <R.RadarChart data={data} outerRadius="70%" margin={{ top: 8, right: 48, bottom: 8, left: 48 }}>
            <defs>
              <radialGradient id="rd-chal"><stop offset="0" stopColor="#3FB6FF" stopOpacity=".05" /><stop offset=".8" stopColor="#3FB6FF" stopOpacity=".2" /><stop offset="1" stopColor="#8FF0FF" stopOpacity=".35" /></radialGradient>
              <radialGradient id="rd-me"><stop offset="0" stopColor={EMERALD} stopOpacity=".2" /><stop offset="1" stopColor={EMERALD} stopOpacity=".45" /></radialGradient>
            </defs>
            <R.PolarGrid stroke="#c8aa6e2b" />
            <R.PolarAngleAxis dataKey="label" tick={{ fill: C.fg2, fontSize: 11 }} />
            <R.PolarRadiusAxis domain={[0, 125]} tick={false} axisLine={false} />
            <R.Radar name={L().radar} dataKey="chal" stroke={C.gold} strokeWidth={2.2} fill="url(#rd-chal)" fillOpacity={1} dot={{ r: 2.5, fill: "#8FF0FF", stroke: C.gold }} isAnimationActive={false} />
            <R.Radar name="Você" dataKey="me" stroke={EMERALD} strokeWidth={2.5} fill="url(#rd-me)" fillOpacity={1} dot={{ r: 3.5, fill: EMERALD, stroke: "#010A13" }} isAnimationActive={false} />
            <R.Tooltip content={<ChartTip render={(pl) => { const d = pl[0].payload; return <><div>{d.raw.label}</div><div style={{ color: EMERALD }}>Você: {fmtV(d.raw.me, d.raw)} <span className="dim">({fmt.pct(d.pct)} do nível deles)</span></div><div style={{ color: C.gold }}>Challenger: {fmtV(d.raw.band.center, d.raw)}</div></>; }} />} />
          </R.RadarChart>
        </R.ResponsiveContainer>
      </div>
      <div className="legend"><span><i style={{ background: EMERALD }} />Você</span><span><i style={{ background: "linear-gradient(90deg, #C8AA6E, #3FB6FF)" }} />{L().radar} (média = 100%)</span><span className="dim">90% ou mais do nível deles em {close} de {data.length} eixos{above ? ` · acima em ${above}` : ""}</span></div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Mono Briar: os junglers que eles mais enfrentam, o win rate deles e o seu contra o mesmo campeão.
function OppTile({ players, myGames, meta, i }) {
  const { rows, total } = useMemo(() => {
    const map = new Map();
    let total = 0;
    for (const p of players) for (const g of p.games) {
      if (!g.oppChamp) continue;
      total++;
      const o = map.get(g.oppChamp) || { champ: g.oppChamp, champId: g.oppChampId, n: 0, w: 0, mn: 0, mw: 0 };
      o.n++; if (g.win) o.w++; map.set(g.oppChamp, o);
    }
    for (const g of myGames) {
      const o = g.oppChamp && map.get(g.oppChamp);
      if (o) { o.mn++; if (g.win) o.mw++; }
    }
    return { rows: [...map.values()].sort((a, b) => b.n - a.n).slice(0, 8), total };
  }, [players, myGames]);
  if (!rows.length) return null;
  const max = rows[0].n;
  return (
    <article className="tile span-6" style={{ "--i": i }}>
      <TileHead icon="jungle" title="Contra quem eles jogam" sub={`${total} partidas deles`} tip="Os junglers inimigos mais comuns nas partidas dos mono Briar, com o win rate deles contra cada um. Na última coluna, o seu win rate contra o mesmo campeão (no filtro atual)." />
      <div className="cp-list">
        <div className="cp-row v5 cp-head"><span /><span>Jungler inimigo</span><span>Partidas</span><span>Mono Briar</span><span>Você</span></div>
        {rows.map((r, k) => (
          <div key={r.champ} className="cp-row v5" style={{ "--k": k }}>
            <ChampIcon meta={meta} id={r.champId} keyName={r.champ} size={30} />
            <div style={{ minWidth: 0 }}>
              <div className="cp-name">{E.champDisplay(meta, r.champ, r.champId)}</div>
              <div className="cp-bar"><i style={{ width: `${(r.n / max) * 100}%` }} /></div>
            </div>
            <div className="cp-num"><b>{r.n}</b><small>{fmt.pct(r.n / total)}</small></div>
            <div className={`cp-wr ${r.w / r.n >= 0.5 ? "good" : "bad"}`}>{fmt.pct(r.w / r.n)}</div>
            {r.mn
              ? <div className={`cp-wr ${r.mw / r.mn >= 0.5 ? "good" : "bad"}`}>{fmt.pct(r.mw / r.mn)}<small>{r.mn} jogo{r.mn > 1 ? "s" : ""}</small></div>
              : <div className="cp-wr"><small>sem jogos</small></div>}
          </div>
        ))}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// O que eles estão jogando: campeões nas últimas 20 de cada referência.
function ChampsTile({ players, myGames, meta, i }) {
  const { rows, total, main } = useMemo(() => {
    const map = new Map();
    let total = 0;
    for (const p of players) for (const g of p.games.slice(0, 20)) {
      total++;
      const o = map.get(g.champ) || { champ: g.champ, champId: g.champId, n: 0, w: 0, who: new Set() };
      o.n++; if (g.win) o.w++; o.who.add(p.riotId.split("#")[0]); map.set(g.champ, o);
    }
    return { rows: [...map.values()].sort((a, b) => b.n - a.n).slice(0, 8), total, main: CH.topChamps(myGames, 1)[0]?.champ };
  }, [players, myGames]);
  if (!rows.length) return null;
  const max = rows[0].n;
  return (
    <article className="tile span-6" style={{ "--i": i }}>
      <TileHead icon="jungle" title={`Picks dos ${L().many}`} sub={`últimas 20 de cada · ${total} partidas`} tip="Campeões nas últimas 20 partidas de cada jogador de referência. A barra mostra quantas vezes o campeão foi escolhido; ao lado, o win rate e quantos jogadores diferentes o usaram." />
      <div className="cp-list">
        {rows.map((r, k) => (
          <div key={r.champ} className={`cp-row ${r.champ === main ? "mine" : ""}`} style={{ "--k": k }}>
            <ChampIcon meta={meta} id={r.champId} keyName={r.champ} size={30} />
            <div style={{ minWidth: 0 }}>
              <div className="cp-name">{E.champDisplay(meta, r.champ, r.champId)}{r.champ === main && <span className="cp-tag">seu main</span>}</div>
              <div className="cp-bar"><i style={{ width: `${(r.n / max) * 100}%` }} /></div>
            </div>
            <div className="cp-num"><b>{r.n}</b><small>{fmt.pct(r.n / total)}</small></div>
            <div className={`cp-wr ${r.w / r.n >= 0.5 ? "good" : "bad"}`}>{fmt.pct(r.w / r.n)}<small>{r.who.size} jog.</small></div>
          </div>
        ))}
      </div>
    </article>
  );
}
