// Topo do Rumo ao Challenger: o seu perfil com a moldura e a borda do Challenger, o emblema do Challenger
// como objetivo e o quanto do seu jogo já está no nível deles. Tudo animado.
import * as E from "./engine.js";
import * as RK from "./rank.js";
import * as CH from "./challenger.js";
import { fmt, C, Tip, CountUp } from "./ui.jsx";
import { SummonerCrest, RankEmblem, HeroBackdrop } from "./visual.jsx";
import { REGALIA } from "./regalia.js";
import { MASTER_EMBLEM } from "./master_art.js";
import { L } from "./chal_variant.js";

const React = window.React;
const { useMemo } = React;

// Arte do fundo: a mesma escolhida para o banner da Visão Geral.
function useBannerArt(ctx) {
  const visual = ctx.meta.visual || {};
  const main = useMemo(() => CH.topChamps(ctx.pool.length ? ctx.pool : ctx.games, 1)[0] || null, [ctx.pool, ctx.games]);
  const custom = ctx.prefs?.banner || null;
  const customSrc = custom ? (custom.assetId ? "/_blob/" + custom.assetId : custom.src || null) : null;
  const champSplash = (main && visual.splash?.[main.champ]) || Object.values(visual.splash || {})[0] || null;
  return { splash: customSrc || champSplash, frame: customSrc ? custom : null };
}

export function ChallengerHero({ ctx, cmp, cmpAll, controls, info, refs: refsProp }) {
  const { dataset, meta, isDemo } = ctx;
  const refs = refsProp || ctx.refs;
  const V = L();
  const art = useBannerArt(ctx);
  const history = useMemo(() => RK.rankHistory(dataset, ctx.prefs?.rankManual), [dataset, ctx.prefs?.rankManual]);
  const cur = RK.currentRank(dataset, history);
  const visual = meta.visual || {};
  const chalEmblems = { [V.tier]: refs?.meta?.visual?.emblems?.[V.tier] || visual.emblems?.[V.tier] || (V.tier === "MASTER" ? MASTER_EMBLEM : null) };
  const [name, tag] = String(dataset?.player?.riotId || (isDemo ? "Invocador#DEMO" : "Invocador")).split("#");
  const scored = [...cmp.gaps, ...cmp.strengths];
  const atLevel = scored.filter((r) => r.pos.status === "nivel").length;
  const near = scored.filter((r) => r.pos.status === "faixa").length;
  const below = scored.filter((r) => r.pos.status === "abaixo").length;
  const nearest = cmpAll.similar[0];
  // Segmentos: primeiro os que estão no nível, depois os que estão na faixa dos Challengers, depois o resto.
  const segs = [...Array(atLevel).fill("lvl"), ...Array(near).fill("near"), ...Array(Math.max(0, scored.length - atLevel - near)).fill("off")];
  return (
    <div className="chal-wrap">
    <section className="chal-hero">
      <HeroBackdrop splash={art.splash} frame={art.frame} />
      <div className="chal-tint" aria-hidden="true" />
      <div className="chal-inner">
        <div className="chal-crest-wrap">
          {V.key === "briar"
            ? <MasterCrest icon={visual.profileIcon} level={dataset?.profile?.summonerLevel} initials={(name || "?").slice(0, 1).toUpperCase()} />
            : <ChallengerCrest icon={visual.profileIcon} level={dataset?.profile?.summonerLevel} initials={(name || "?").slice(0, 1).toUpperCase()} />}
        </div>
        <div className="chal-id">
          <div className="eyebrow">{V.eyebrow}</div>
          <h2 className="hero-name">{name}{tag && <span>#{tag}</span>}</h2>
          <div className="chal-meter" role="img" aria-label={`${atLevel} de ${scored.length} métricas ${V.levelOf}`}>
            <div className="chal-meter-head">
              <span className="lbl">{V.level} <Tip text={`Cada segmento é uma métrica que depende de você. Destaque: igual ou melhor que a média dos ${V.many}. Segunda cor: dentro da faixa deles (entre o pior e o melhor jogador de referência). Apagado: abaixo de todos.`} /></span>
              <span className="val"><b><CountUp value={atLevel} /></b> de {scored.length}</span>
            </div>
            <div className="chal-segs">{segs.map((s, i) => <i key={i} className={s} style={{ "--k": i }} />)}</div>
            <div className="chal-meter-foot"><span><i className="dot lvl" />{atLevel} no nível</span><span><i className="dot near" />{near} na faixa deles</span><span><i className="dot off" />{below} abaixo de todos</span></div>
          </div>
          <div className="hero-tags">
            {cur && <span className="htag">Você: {RK.rankLabel(cur)}</span>}
            {nearest && <span className="htag teal">Estilo mais parecido: {nearest.label}</span>}
          </div>
        </div>
        <div className="chal-goal">
          <div className="chal-rays" aria-hidden="true" />
          <RankEmblem tier={V.tier} size={210} images={chalEmblems} />
          <div className="chal-goal-name">{V.goalName}</div>
          <div className="chal-goal-sub">{V.goalSub}</div>
        </div>
      </div>
      <div className="hero-bar chal-bar">
        {controls}
        <div className="right"><span className="dim" style={{ fontSize: "0.8rem" }}>{info}</span></div>
      </div>
    </section>
    <ChalFrame />
    </div>
  );
}

// Borda do ícone: a peça oficial do Challenger, com animação própria em volta do ícone
// (halo pulsando, duas órbitas de luz girando em sentidos opostos, ondas saindo do ícone e faíscas subindo).
function ChallengerCrest({ icon, level, initials }) {
  if (!REGALIA.crest) return <SummonerCrest icon={icon} level={level} initials={initials} size={140} />;
  const g = REGALIA.crestGeom; // círculo do ícone dentro da borda, em % da largura (cx, r) e da altura (cy)
  const center = { left: `${g.cx}%`, top: `${g.cy}%` };
  const sparks = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ x: (i % 2 ? 1 : -1) * (18 + ((i * 23) % 26)), d: `${(i * 0.43) % 4}s`, t: `${2.6 + (i % 4) * 0.5}s`, gold: i % 3 === 0 })), []);
  return (
    <div className="chal-crest" style={{ "--w": `${g.w}px`, "--r": `${g.r}`, aspectRatio: `${g.ar}` }} title="Borda do Challenger">
      <div className="cc-halo" style={center} aria-hidden="true" />
      <div className="cc-ripple" style={center} aria-hidden="true" /><div className="cc-ripple two" style={center} aria-hidden="true" />
      <div className="cc-float">
        <div className="chal-crest-icon" style={{ left: `${g.cx - g.r}%`, top: `${g.cy - g.r * g.ar}%`, width: `${g.r * 2}%` }}>
          {icon ? <img src={icon} alt="Ícone de invocador" /> : <span>{initials}</span>}
          <i className="cc-icon-shine" />
        </div>
        <img className="chal-crest-frame" src={REGALIA.crest} alt="" aria-hidden="true" />
        <i className="chal-crest-sheen" aria-hidden="true" style={{ WebkitMaskImage: `url("${REGALIA.crest}")`, maskImage: `url("${REGALIA.crest}")` }} />
        <svg className="cc-orbit" style={center} viewBox="-60 -60 120 120" aria-hidden="true">
          <defs>
            <linearGradient id="cc-o1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#8FF0FF" stopOpacity="0" /><stop offset=".7" stopColor="#8FF0FF" /><stop offset="1" stopColor="#FFFFFF" /></linearGradient>
            <linearGradient id="cc-o2" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stopColor="#F4D06F" stopOpacity="0" /><stop offset=".7" stopColor="#F4D06F" /><stop offset="1" stopColor="#FFF6DA" /></linearGradient>
            <filter id="cc-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4" /></filter>
          </defs>
          <g className="o1"><circle r="54" fill="none" stroke="url(#cc-o1)" strokeWidth="3.6" strokeDasharray="80 260" strokeLinecap="round" filter="url(#cc-blur)" /><circle r="54" fill="none" stroke="#E6FDFF" strokeWidth="1.4" strokeDasharray="40 300" strokeDashoffset="-30" strokeLinecap="round" /></g>
          <g className="o2"><circle r="58" fill="none" stroke="url(#cc-o2)" strokeWidth="2.8" strokeDasharray="64 300" strokeLinecap="round" filter="url(#cc-blur)" /><circle r="58" fill="none" stroke="#FFF6DA" strokeWidth="1.1" strokeDasharray="30 330" strokeDashoffset="-26" strokeLinecap="round" /></g>
        </svg>
      </div>
      <div className="cc-sparks" style={center} aria-hidden="true">{sparks.map((p, i) => <i key={i} className={p.gold ? "gold" : ""} style={{ "--x": `${p.x}px`, animationDelay: p.d, animationDuration: p.t }} />)}</div>
      {level != null && <div className="crest-level chal-level">{level}</div>}
    </div>
  );
}

// Página Mono Briar: o ícone do invocador sobre as asas do emblema do Mestre, com brilho roxo.
function MasterCrest({ icon, level, initials }) {
  return (
    <div className="mcrest" title="Mono Briar">
      <div className="mc-halo" aria-hidden="true" />
      <div className="mc-float">
        <img className="mc-wings" src={MASTER_EMBLEM} alt="" aria-hidden="true" />
        <div className="mc-icon">{icon ? <img src={icon} alt="" /> : <span>{initials}</span>}<i className="mc-shine" aria-hidden="true" /></div>
      </div>
      {level != null && <div className="crest-level mc-level">{level}</div>}
    </div>
  );
}

// Moldura do bloco: uma borda fina em degradê azul e dourado, com as cores correndo pela borda
// e um brilho passando de tempos em tempos.
function ChalFrame() {
  return (
    <div className="chal-frame" aria-hidden="true">
      <i className="cf-band" /><i className="cf-band glint" />
    </div>
  );
}
