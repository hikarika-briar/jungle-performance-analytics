// Partidas de destaque das referências (Rumo ao Challenger e Mono Briar): as melhores atuações recentes,
// no mesmo formato de "Partidas recentes" da Visão Geral, abrindo a tela completa da partida.
import * as E from "./engine.js";
import * as ST from "./study.js";
import * as RK from "./rank.js";
import { fmt, ChampIcon, ItemIcon } from "./ui.jsx";
import { TileHead, timeAgo } from "./views_home.jsx";
import { MatchDrawer } from "./views_data.jsx";
import { L } from "./chal_variant.js";

const React = window.React;
const { useMemo, useState } = React;

export function HighlightGames({ ctx, players, refs, meta, single, i = 0 }) {
  const list = useMemo(() => ST.highlightGames(players, { limit: 5, perPlayer: single ? 5 : 1 }), [players, single]);
  const [open, setOpen] = useState(null);
  if (!list.length) return null;
  const rankOf = (pl) => (refs?.players || []).find((x) => x.puuid === pl.id)?.rank || null;
  const openGame = (c) => {
    const rk = rankOf(c.player);
    setOpen({
      g: { ...c.g, subject: ST.shortName(c.player.riotId), subjectRank: rk, subjectRankLabel: rk ? RK.rankLabel(rk, { lp: true }) : "", subjectTag: `Destaque dos ${L().many}` },
      pool: c.player.games,
    });
  };
  const V = L();
  return (
    <>
      <article className="tile span-12 hl-tile" style={{ "--i": i }}>
        <TileHead icon="history" title="Partidas de destaque"
          sub={single ? "melhores atuações recentes dele · clique para abrir" : `a melhor atuação recente de cada ${V.one} · clique para abrir`}
          tip={`Entre as últimas partidas de cada ${V.one}, as de maior nota do jungler, com vitória, ouro sobre o jungler inimigo aos 10, objetivos e participação nos abates. Ao abrir, a tela é a mesma das Partidas para estudar, do ponto de vista dele.`} />
        <div className="mlist">
          {list.map((c, k) => {
            const g = c.g;
            const rk = rankOf(c.player);
            return (
              <div key={g.id} className={`mrow hl-row ${g.win ? "win" : ""}`} style={{ "--k": k }} onClick={() => openGame(c)} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") openGame(c); }}>
                <div className="mrow-res"><b>{g.win ? "Vitória" : "Derrota"}</b><span>{timeAgo(g.start)}</span><span>{fmt.dur(g.duration)}</span></div>
                <div className="mrow-ch"><ChampIcon meta={meta} id={g.champId} keyName={g.champ} size={40} /><span className="vs">VS</span><ChampIcon meta={meta} id={g.oppChampId} keyName={g.oppChamp} size={28} /></div>
                <div className="hl-who">
                  <b>{ST.shortName(c.player.riotId)}</b>
                  <span>{E.champDisplay(meta, g.champ, g.champId)} × {E.champDisplay(meta, g.oppChamp, g.oppChampId)}{c.player.server && c.player.server !== "BR" ? ` · ${c.player.server}` : ""}</span>
                  {rk && <span className="hl-tier" style={{ color: RK.TIER_COLOR[RK.normTier(rk.tier)] }}>{RK.rankLabel(rk, { lp: true })}</span>}
                </div>
                <div className="mrow-kda"><b>{g.k} / <span className="d">{g.d}</span> / {g.a}</b><span>{fmt.dec(g.kda, 2)} KDA · {fmt.pct(g.kp)} KP</span></div>
                <div className="hl-why">{c.reasons.map((r, j) => <span key={j} className={`sg-r ${r.tone}`}>{r.text}</span>)}</div>
                <div className="mrow-items iconrow">{(g.finalItems || []).slice(0, 6).map((id, j) => <ItemIcon key={j} meta={meta} id={id} size={24} />)}</div>
              </div>
            );
          })}
        </div>
      </article>
      {open && <MatchDrawer ctx={ctx} game={open.g} pool={open.pool} meta={meta} onClose={() => setOpen(null)} />}
    </>
  );
}
