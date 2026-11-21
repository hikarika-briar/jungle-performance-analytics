// Detalhe da partida: apresentação (resumo no topo), placar dos 10 jogadores, duelo de junglers
// (onde você superou e onde tomou gap) e as jogadas de cada jungler com a resposta do outro.
import * as E from "./engine.js";
import * as MR from "./match_report.js";
import * as ST from "./study.js";
import * as RK from "./rank.js";
import { fmt, C, Card, Tip, ChampIcon, ItemIcon, RuneIcon } from "./ui.jsx";
const React = window.React;
const { useMemo, useState } = React;

const POS_PT = { TOP: "Topo", JUNGLE: "Selva", MIDDLE: "Meio", BOTTOM: "Atirador", UTILITY: "Suporte" };
const MULTI = { 2: "Double kill", 3: "Triple kill", 4: "Quadra kill", 5: "Penta kill" };
const QUEUE_SHORT = { 420: "Ranq. Solo/Duo", 440: "Ranq. Flex", 400: "Normal", 430: "Normal", 490: "Partida Rápida", 480: "Swiftplay", 700: "Clash" };

const mil = (v) => (v == null ? "—" : Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : fmt.int(v));
function ago(ts) {
  if (!ts) return "";
  const m = Math.max(0, (Date.now() - ts) / 60000);
  if (m < 60) return `há ${Math.max(1, Math.round(m))} min`;
  const h = m / 60;
  if (h < 24) return `há ${Math.round(h)} h`;
  const d = h / 24;
  return d < 30 ? `há ${Math.round(d)} dia${Math.round(d) > 1 ? "s" : ""}` : fmt.date(ts);
}
function splitRiotId(rid, fallback) {
  if (!rid) return [fallback, ""];
  const i = rid.lastIndexOf("#");
  return i > 0 ? [rid.slice(0, i), rid.slice(i)] : [rid, ""];
}

function SpellIcon({ meta, id, size = 18 }) {
  if (!id) return <span className="gi item empty" style={{ width: size, height: size }} />;
  const name = meta?.spells?.[String(id)]?.name || `Feitiço ${id}`;
  const src = meta?.icons?.spell?.[String(id)];
  return <span className="gi item" style={{ width: size, height: size, fontSize: size * 0.4 }} title={name} role="img" aria-label={name}>{src ? <img src={src} alt="" /> : name.slice(0, 2)}</span>;
}

function RankText({ r }) {
  if (!r) return null;
  if (!RK.normTier(r.tier)) return <span className="mp-rank unranked">Sem elo</span>;
  return <span className="mp-rank" style={{ color: RK.TIER_COLOR[RK.normTier(r.tier)] }}>{RK.rankLabel(r, { lp: false })}</span>;
}

function ScoreRing({ score, badge, size = 74 }) {
  const k = score == null ? 0 : Math.max(0, Math.min(1, (score - 1) / 9));
  const color = score == null ? C.fg3 : score >= 7 ? C.gold : score >= 5.5 ? C.blue : score >= 4 ? C.fg2 : C.red;
  const r = 44, len = 2 * Math.PI * r;
  return (
    <div className="mp-ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#0d1b2d" strokeWidth="7" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="7" strokeDasharray={len} strokeDashoffset={len * (1 - k)} transform="rotate(-90 50 50)" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
      </svg>
      <div className="v"><b style={{ color }}>{score == null ? "—" : fmt.dec(score, 1)}</b>{badge && <span className={`mp-badge ${badge === "MVP" ? "mvp" : "ace"}`}>{badge}</span>}</div>
    </div>
  );
}

// Elo médio de um grupo de jogadores (só os que têm elo); null com menos de 3.
export function avgRank(ranks) {
  const v = ranks.map((r) => RK.rankValue(r)).filter((x) => x != null);
  if (v.length < 3) return null;
  return { ...RK.valueToRank(v.reduce((a, b) => a + b, 0) / v.length), n: v.length };
}
export function lobbyRanks(g, myRank) {
  const me = g.raw.me;
  const r = (p) => (p.pid === me.pid ? myRank : p.rank);
  const team = (t) => avgRank((g.participants || []).filter((p) => p.teamId === t).map(r).filter(Boolean));
  return { all: avgRank((g.participants || []).map(r).filter(Boolean)), [g.teamId]: team(g.teamId), [g.teamId === 100 ? 200 : 100]: team(g.teamId === 100 ? 200 : 100) };
}

// Elo do dono do painel na época da partida (histórico), ou o elo atual dos outros (coletor 1.9+).
function rankAtGame(ctx, g) {
  if (g.subject) return g.subjectRank || null;
  const hist = RK.rankHistory(ctx.dataset, ctx.prefs?.rankManual);
  const before = hist.filter((h) => h.t <= g.start + 3600e3).pop();
  return before || null;
}

// ---------------------------------------------------------------------------
export function MatchHero({ g, meta, ctx, ratings }) {
  const me = g.raw.me, opp = g.raw.opp;
  const mine = ratings?.byPid.get(me.pid);
  const oppP = opp ? g.participants.find((p) => p.pid === opp.pid) : null;
  const elite = (g.elite || []).filter((e) => e.me).length;
  const myRank = rankAtGame(ctx, g);
  const teams = [g.participants.filter((p) => p.teamId === 100), g.participants.filter((p) => p.teamId === 200)];
  return (
    <div className={`mp-hero ${g.win ? "w" : "l"}`}>
      <div className="mp-res">
        <b>{g.win ? "Vitória" : "Derrota"}</b>
        <span>{QUEUE_SHORT[g.queueId] || E.QUEUE_NAMES[g.queueId] || "Partida"}</span>
        <span className="num">{fmt.dur(g.duration)}</span>
        <span className="dim">{ago(g.start)}</span>
      </div>
      <div className="mp-champs">
        <span className="mp-ch big"><ChampIcon meta={meta} id={g.champId} keyName={g.champ} size={58} /><i>{me.level}</i></span>
        <span className="dim">vs</span>
        {opp && <span className="mp-ch"><ChampIcon meta={meta} id={opp.championId} keyName={opp.championName} size={44} /><i>{opp.level ?? oppP?.level}</i></span>}
      </div>
      <div className="mp-kda">
        <div className="k"><b>{g.k}</b> / <b className="bad">{g.d}</b> / <b>{g.a}</b></div>
        <div className="sub">{g.perfect ? "KDA perfeito" : `${fmt.dec(g.kda, 2)} KDA`} · {fmt.pct(g.kp)} KP</div>
        {MULTI[me.multi] && <span className="mp-multi">{MULTI[me.multi]}</span>}
      </div>
      <div className="mp-stats">
        <span><b>{g.cs}</b> CS <span className="dim">({fmt.dec(g.csMin, 1)}/min)</span></span>
        <span><b>{mil(g.dmg)}</b> de dano</span>
        <span><b>{elite}</b> objetivo{elite === 1 ? "" : "s"} épico{elite === 1 ? "" : "s"}</span>
        {myRank && <RankText r={myRank} />}
        {(() => { const lb = lobbyRanks(g, myRank).all; return lb ? <span className="mp-lobby">Partida de elo médio <RankText r={lb} /></span> : null; })()}
      </div>
      <div className="mp-score">
        <ScoreRing score={mine?.score} badge={mine?.badge} />
        {mine?.place && !mine.badge && <span className="dim">{mine.place}º lugar</span>}
      </div>
      <div className="mp-build">
        <div className="mp-sr">
          <SpellIcon meta={meta} id={me.spells?.[0]} size={22} /><SpellIcon meta={meta} id={me.spells?.[1]} size={22} />
          <RuneIcon meta={meta} id={g.keystone} size={22} /><RuneIcon meta={meta} id={g.subStyle} size={22} />
        </div>
        <div className="mp-items">{(me.items || []).map((id, i) => <ItemIcon key={i} meta={meta} id={id} size={26} />)}</div>
      </div>
      <div className="mp-teams">
        {teams.map((t, i) => (
          <div key={i} className={`mp-team ${i ? "red" : "blue"}`}>
            {t.map((p) => <span key={p.pid} className={p.pid === me.pid ? "me" : opp && p.pid === opp.pid ? "opp" : ""}><ChampIcon meta={meta} id={p.championId} keyName={p.championName} size={22} /></span>)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
const OBJ_KEYS = [["tower", "Torres"], ["dragon", "Dragões"], ["horde", "Vastilarvas"], ["riftHerald", "Arauto"], ["atakhan", "Atakhan"], ["baron", "Barão"], ["inhibitor", "Inibidores"]];

export function Scoreboard({ g, meta, ratings, ctx }) {
  const me = g.raw.me, opp = g.raw.opp;
  const myRank = rankAtGame(ctx, g);
  const full = (p) => (p.pid === me.pid ? { ...p, ...me } : opp && p.pid === opp.pid ? { ...p, ...opp } : p);
  const rows = g.participants.map(full);
  const maxDmg = Math.max(1, ...rows.map((p) => p.dmg || 0), ...rows.map((p) => p.dmgTaken || 0));
  const lobby = lobbyRanks(g, myRank);
  const missingRanks = g.participants.filter((p) => p.pid !== me.pid && !p.rank).length;
  const order = [g.teamId, g.teamId === 100 ? 200 : 100];
  return (
    <div className="sb">
      {order.map((team) => {
        const list = rows.filter((p) => p.teamId === team).sort((a, b) => ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"].indexOf(a.position) - ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"].indexOf(b.position));
        const tObj = (g.teams || []).find((t) => t.teamId === team) || {};
        const win = list[0]?.win;
        const k = list.reduce((s, p) => s + (p.k || 0), 0), d = list.reduce((s, p) => s + (p.d || 0), 0), a = list.reduce((s, p) => s + (p.a || 0), 0);
        const gold = list.reduce((s, p) => s + (p.gold || 0), 0);
        return (
          <div key={team} className={`sb-team ${team === 100 ? "blue" : "red"}`}>
            <div className="sb-head">
              <span className={`res-chip ${win ? "w" : "l"}`}>{win ? "Vitória" : "Derrota"}</span>
              <span className="dim">{team === g.teamId ? E.voiceOf(g).team : "time inimigo"} · lado {team === 100 ? "azul" : "vermelho"}</span>
              {(tObj.bans || []).some((b) => b > 0) && <span className="sb-bans"><span className="dim">Banimentos</span>{tObj.bans.filter((b) => b > 0).map((b, i) => <ChampIcon key={i} meta={meta} id={b} keyName={meta.champions?.[String(b)]?.key} size={18} />)}</span>}
              <span className="sb-obj">{OBJ_KEYS.filter(([key]) => (g.teams || []).some((t) => t.objectives?.[key]?.kills)).map(([key, label]) => <span key={key}>{label} <b>{tObj.objectives?.[key]?.kills ?? 0}</b></span>)}</span>
              {lobby[team] && <span className="sb-avg">elo médio <RankText r={lobby[team]} /></span>}
              <span className="sb-tot"><b>{k}/{d}/{a}</b> · {mil(gold)} de ouro</span>
            </div>
            <div className="sb-scroll">
              <table className="sb-table">
                <thead><tr><th>Jogador</th><th className="num">Nota</th><th className="num">KDA</th><th>Dano <span className="dim">causado / recebido</span></th><th className="num">Ouro</th><th className="num">CS</th><th className="num">Visão</th><th>Itens</th></tr></thead>
                <tbody>
                  {list.map((p) => {
                    const r = ratings?.byPid.get(p.pid);
                    const champName = E.champDisplay(meta, p.championName, p.championId);
                    const [nm, tag] = splitRiotId(p.riotId, champName);
                    const rank = p.pid === me.pid ? myRank : p.rank;
                    return (
                      <tr key={p.pid} className={p.pid === me.pid ? "me" : opp && p.pid === opp.pid ? "opp" : ""}>
                        <td>
                          <div className="sb-player">
                            <span className="mp-ch"><ChampIcon meta={meta} id={p.championId} keyName={p.championName} size={34} /><i>{p.level}</i></span>
                            <span className="sb-sr">
                              <SpellIcon meta={meta} id={p.spells?.[0]} size={15} /><SpellIcon meta={meta} id={p.spells?.[1]} size={15} />
                              {(p.keystone || (p.pid === me.pid && g.keystone)) ? <RuneIcon meta={meta} id={p.keystone || g.keystone} size={15} /> : <span />}
                              {(p.subStyle || (p.pid === me.pid && g.subStyle)) ? <RuneIcon meta={meta} id={p.subStyle || g.subStyle} size={15} /> : <span />}
                            </span>
                            <span className="sb-name">
                              <span className="n"><b>{nm}</b><span className="dim">{tag}</span>{r?.badge && <span className={`mp-badge ${r.badge === "MVP" ? "mvp" : "ace"}`}>{r.badge}</span>}</span>
                              <span className="s">{[p.riotId ? champName : null, POS_PT[p.position]].filter(Boolean).join(" · ")}{rank ? <> · <RankText r={rank} /></> : null}</span>
                            </span>
                          </div>
                        </td>
                        <td className="num"><b className="sb-score" style={{ color: r?.score >= 7 ? C.gold : r?.score >= 5.5 ? C.blue : r?.score < 4 ? C.red : C.fg }}>{r?.score == null ? "—" : fmt.dec(r.score, 1)}</b><span className="dim sb-place">{r?.place ? `${r.place}º lugar` : ""}</span></td>
                        <td className="num"><span className="sb-kda">{p.k} / <span className="bad">{p.d}</span> / {p.a}</span><span className="dim sb-place">{fmt.dec(((p.k || 0) + (p.a || 0)) / Math.max(1, p.d || 0), 2)}</span></td>
                        <td>
                          <div className="sb-dmg"><span className="dv">{mil(p.dmg)}</span><span className="bar"><i className="out" style={{ width: `${((p.dmg || 0) / maxDmg) * 100}%` }} /></span></div>
                          {p.dmgTaken != null && <div className="sb-dmg"><span className="dv dim">{mil(p.dmgTaken)}</span><span className="bar"><i className="in" style={{ width: `${((p.dmgTaken || 0) / maxDmg) * 100}%` }} /></span></div>}
                        </td>
                        <td className="num">{mil(p.gold)}</td>
                        <td className="num">{fmt.int((p.cs || 0) + (p.pid === me.pid || (opp && p.pid === opp.pid) ? p.jcs || 0 : 0))}</td>
                        <td className="num">{p.vision == null ? "—" : fmt.int(p.vision)}</td>
                        <td><div className="sb-items">{(p.items || []).slice(0, 7).map((id, i) => <ItemIcon key={i} meta={meta} id={id} size={20} />)}</div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      <p className="note">A nota (1 a 10) compara os 10 jogadores desta partida: combate, dano, ouro, visão, dano a objetivos e linha de frente, com pesos diferentes por posição. 5,5 é a média desta partida. MVP é o melhor do time vencedor; ACE, o melhor do time derrotado. O elo dos outros jogadores é o atual (a Riot não informa o elo na época da partida){g.subject ? "" : "; o seu é o da época"}.{missingRanks ? ` O elo de ${missingRanks} jogador(es) ainda não foi buscado: o coletor completa aos poucos, a cada atualização.` : ""}{g.participants.some((p) => p.vision == null) ? " Visão e dano recebido dos outros jogadores aparecem a partir do coletor 1.9." : ""}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
function DuelCard({ m, oppName, first, V }) {
  const good = m.verdict === "won";
  const ratio = m.me && m.opp && m.me > 0 && m.opp > 0 ? Math.max(m.me, m.opp) / Math.min(m.me, m.opp) : null;
  const diff = m.key === "kp" || m.key === "resp" ? fmt.pp(m.me - m.opp, 0) : ratio && ratio >= 1.5 ? `${fmt.dec(ratio, 1)}x` : fmt.signed(m.me - m.opp, m.key === "csMin" ? 1 : 0);
  return (
    <div className={`duel-card ${good ? "won" : "lost"} ${first ? "first" : ""}`}>
      <div className="dc-top"><span className="dim">{m.group}</span>{first && <span className="dc-tag">Comece aqui</span>}<span className={`dc-diff ${good ? "good" : "bad"}`}>{diff}</span></div>
      <div className="dc-title">{m.label}</div>
      <div className="dc-vs"><b>{m.fmt(m.me)}</b><span className="dim">{V.s}</span><span className="x">×</span><b className="o">{m.fmt(m.opp)}</b><span className="dim">{oppName}</span></div>
      <p>{m.sentence}</p>
      {m.extra && <p className="dim dc-extra">Onde: topo {m.extra.me.top} · meio {m.extra.me.mid} · bot {m.extra.me.bot} · selva/rio {m.extra.me.jungle + m.extra.me.river}  ×  {oppName}: topo {m.extra.opp.top} · meio {m.extra.opp.mid} · bot {m.extra.opp.bot} · selva/rio {m.extra.opp.jungle + m.extra.opp.river}</p>}
      {m.habitText && <p className="dim dc-habit">{m.habitText}</p>}
    </div>
  );
}

export function DuelReport({ duel, moments }) {
  if (!duel) return null;
  const { won, lost, even, oppName } = duel;
  const V = duel.voice || E.voiceOf(null);
  const lostBlock = lost.length > 0 && <><div className="eyebrow duel-sec">{V.lost} · <span className="dim" style={{ textTransform: "none", letterSpacing: 0 }}>o que a partida mostra</span></div>
        <div className="duel-grid">{lost.map((m, i) => <DuelCard key={m.key} m={m} oppName={oppName} first={!V.ref && i === 0} V={V} />)}</div></>;
  const wonBlock = won.length > 0 && <><div className="eyebrow duel-sec">{V.won}</div>
        <div className="duel-grid">{won.map((m, i) => <DuelCard key={m.key} m={m} oppName={oppName} first={V.ref && i === 0} V={V} />)}</div></>;
  const total = won.length + lost.length + even.length;
  return (
    <div className="duel">
      <div className="duel-head">
        <div>
          <div className="duel-verdict">{won.length > lost.length ? `${V.S} superou o ${oppName} em ${won.length} de ${total} pontos` : won.length < lost.length ? `O ${oppName} levou a melhor em ${lost.length} de ${total} pontos` : `Duelo equilibrado: ${won.length} a ${lost.length}`}</div>
          <div className="duel-bar" aria-hidden="true">
            {won.map((m) => <i key={m.key} className="won" title={m.label} />)}{even.map((m) => <i key={m.key} className="even" title={m.label} />)}{lost.map((m) => <i key={m.key} className="lost" title={m.label} />)}
          </div>
        </div>
        <div className="duel-legend"><span><i className="won" />superou</span><span><i className="even" />empate</span><span><i className="lost" />tomou gap</span></div>
      </div>
      {moments && moments.length > 0 && <DecisiveMoments moments={moments} V={V} />}
      {V.ref ? <>{wonBlock}{lostBlock}</> : <>{lostBlock}{wonBlock}</>}
      {even.length > 0 && <p className="note">Empate (diferença menor que 8%): {even.map((m) => `${m.label.toLowerCase()} (${m.fmt(m.me)} × ${m.fmt(m.opp)})`).join(", ")}.</p>}
    </div>
  );
}

// As maiores viradas de ouro do time (janelas de 2 minutos) e o que o jungler fez nelas.
function DecisiveMoments({ moments, V }) {
  const max = Math.max(...moments.map((m) => Math.abs(m.gain)), 1);
  return (
    <div className="dm">
      <div className="eyebrow duel-sec">Momentos que decidiram a partida <span className="dim" style={{ textTransform: "none", letterSpacing: 0 }}>· maiores mudanças no ouro do {V.team}</span></div>
      <div className="dm-grid">{moments.map((m) => (
        <div key={m.from} className={`dm-card ${m.gain >= 0 ? "up" : "down"}`}>
          <div className="dm-top"><span className="t">{fmt.clock(m.from)}–{fmt.clock(m.to)}</span><b>{m.gain >= 0 ? "+" : "−"}{fmt.int(Math.abs(m.gain))}</b><span className="dim">de ouro</span></div>
          <span className="dm-bar"><i style={{ width: `${(Math.abs(m.gain) / max) * 100}%` }} /></span>
          <div className="dm-what">{m.what.join(" · ") || "Farm e pressão nas lanes"}</div>
          <div className={`dm-role ${m.involved ? "good" : "dim"}`}>{V.S} {m.role}</div>
          <div className="dim dm-state">Time de {fmt.signed(m.before)} para {fmt.signed(m.after)}</div>
        </div>
      ))}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
const RESP_TONE = { counter: "good", contest: "good", trade: "good", cross: "good", invade: "good", fought: "warn", near: "warn", "team-trade": "warn", none: "bad", dead: "dim", target: "dim" };

function PlayList({ title, plays, score, who, onPick, side }) {
  return (
    <div className={`plays-col ${side}`}>
      <div className="plays-head">
        <div className="eyebrow">{title}</div>
        <div className="plays-score"><b>{score.answered}</b> de <b>{score.live}</b> respondidas{score.dead ? <span className="dim"> · {score.dead} fora da conta ({who} morto ou alvo)</span> : null}</div>
      </div>
      {plays.length ? (
        <div className="plays-list">
          {plays.map((p, i) => (
            <button key={i} type="button" className="play" onClick={() => onPick && onPick(Math.min(p.t, p.response.t ?? p.t))} title="Ver este momento na linha do tempo">
              <span className="t">{fmt.clock(p.t)}</span>
              <span className={`pk ${p.kind}`} aria-hidden="true" />
              <span className="pt">{p.text}</span>
              <span className={`pr ${RESP_TONE[p.response.kind] || "dim"}`}>{p.response.text}</span>
            </button>
          ))}
        </div>
      ) : <p className="muted">Nenhuma jogada registrada.</p>}
    </div>
  );
}

export function PlaysReport({ duel, onPick }) {
  const pr = duel?.plays;
  if (!pr) return null;
  return (
    <div className="plays">
      <div className="split">
        <PlayList title={`Jogadas do ${duel.oppName} e ${(duel.voice || E.voiceOf(null)).did}`} plays={pr.theirs} score={pr.theirsScore} who={(duel.voice || E.voiceOf(null)).s} onPick={onPick} side="theirs" />
        <PlayList title={`${(duel.voice || E.voiceOf(null)).plays} e o que o ${duel.oppName} fez`} plays={pr.mine} score={pr.mineScore} who={duel.voice?.ref ? `o ${duel.oppName}` : "ele"} onPick={onPick} side="mine" />
      </div>
      <p className="note">Jogada: abate com participação do jungler até os 20 minutos, ou objetivo épico do time dele. Resposta: o que o outro jungler fez de 25 s antes até 60 s depois. Conta como resposta lutar no local (counter-gank ou contestar), fazer um objetivo ou derrubar uma torre do outro lado (troca), abater alguém do outro lado do mapa ou entrar na selva inimiga. "Invadiu" e "por perto" usam a posição de minuto em minuto da timeline, então são aproximados.</p>
    </div>
  );
}

export function useMatchReport(g, meta, ctx, pool) {
  const ratings = useMemo(() => (g ? MR.matchRatings(g) : null), [g]);
  const duel = useMemo(() => (g && g.raw?.opp && g.hasTL ? MR.junglerDuel(g, meta, pool || ctx.all) : null), [g, meta, ctx.all, pool]);
  const moments = useMemo(() => (g && g.hasTL ? ST.decisiveMoments(g, meta) : []), [g, meta]);
  return { ratings, duel, moments };
}
