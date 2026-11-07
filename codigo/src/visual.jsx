// Peças visuais da v2: ícone de invocador com borda animada, emblema de elo e arte do banner.
// A borda e o emblema reserva são desenhos próprios, no estilo do cliente (dourado + hextech).
import { TIER_COLOR, TIER_PT, normTier, isApex } from "./rank.js";
import { trimImage } from "./icons.js";
const React = window.React;
const { useMemo, useState, useEffect } = React;

// Emblemas recortados (sem a borda transparente), guardados enquanto a página estiver aberta.
const trimCache = new Map();
function useTrimmed(src) {
  const [st, setSt] = useState(() => (src ? trimCache.get(src) || null : null));
  useEffect(() => {
    if (!src) { setSt(null); return; }
    const hit = trimCache.get(src);
    if (hit) { setSt(hit); return; }
    let alive = true;
    const done = (r) => { trimCache.set(src, r); if (alive) setSt(r); };
    trimImage(src).then(done, () => done({ src, ar: 1 }));
    return () => { alive = false; };
  }, [src]);
  return st;
}

export function SummonerCrest({ icon, level, size = 132, initials = "?" }) {
  const ticks = useMemo(() => Array.from({ length: 36 }, (_, i) => i * 10), []);
  return (
    <div className="crest" style={{ "--size": `${size}px` }}>
      <div className="crest-glow" aria-hidden="true" />
      <svg className="crest-frame" viewBox="0 0 200 200" aria-hidden="true">
        <defs>
          <linearGradient id="cg-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F0E6D2" /><stop offset=".45" stopColor="#C8AA6E" /><stop offset="1" stopColor="#5b4520" />
          </linearGradient>
          <linearGradient id="cg-teal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#CDFAFA" /><stop offset="1" stopColor="#0397AB" />
          </linearGradient>
        </defs>
        {/* asas laterais */}
        {[1, -1].map((sx) => (
          <g key={sx} transform={`translate(100 100) scale(${sx} 1) translate(-100 -100)`} fill="url(#cg-gold)" opacity=".95">
            <path d="M36 92 L4 70 L22 92 Z" />
            <path d="M34 100 L0 100 L24 106 Z" opacity=".85" />
            <path d="M36 108 L8 128 L26 110 Z" opacity=".75" />
            <path d="M38 96 L28 100 L38 104 Z" fill="url(#cg-teal)" />
          </g>
        ))}
        {/* anéis */}
        <g className="spin-rev">
          {ticks.map((a) => <rect key={a} x="99.2" y="21" width="1.6" height={a % 30 === 0 ? 7 : 4} fill="#C8AA6E" opacity={a % 30 === 0 ? 0.9 : 0.45} transform={`rotate(${a} 100 100)`} />)}
        </g>
        <g className="spin"><circle cx="100" cy="100" r="70" fill="none" stroke="url(#cg-teal)" strokeWidth="1.2" strokeDasharray="3 6" opacity=".7" /></g>
        <circle cx="100" cy="100" r="64.5" fill="none" stroke="url(#cg-gold)" strokeWidth="3.4" />
        <circle cx="100" cy="100" r="61" fill="none" stroke="#010A13" strokeWidth="1.5" />
        {/* coroa superior */}
        <path d="M84 40 L92 28 L100 36 L108 28 L116 40 L108 37 L100 44 L92 37 Z" fill="url(#cg-gold)" />
        <path d="M100 10 L106 20 L100 30 L94 20 Z" fill="url(#cg-teal)" stroke="#F0E6D2" strokeWidth=".8" />
        {/* ponta inferior */}
        <path d="M86 160 L100 176 L114 160 L107 162 L100 168 L93 162 Z" fill="url(#cg-gold)" />
      </svg>
      <div className="crest-icon">{icon ? <img src={icon} alt="Ícone de invocador" /> : <div style={{ display: "grid", placeItems: "center", height: "100%", fontFamily: "var(--font-title)", fontSize: size * 0.3, color: "#C8AA6E" }}>{initials}</div>}</div>
      {level != null && <div className="crest-level">{level}</div>}
    </div>
  );
}

// Emblema animado: imagem coletada (recortada) ou um brasão próprio na cor do elo.
// Animação: entrada, flutuação, halo pulsando, brilho que passa sobre o desenho e faíscas subindo.
export function RankEmblem({ tier, rank, size = 96, images }) {
  const t = normTier(tier);
  const raw = t && images ? images[t] : null;
  const trimmed = useTrimmed(raw);
  const color = TIER_COLOR[t] || "#6B7A89";
  const ar = trimmed ? Math.max(0.8, Math.min(1.8, trimmed.ar)) : 1;
  const w = size, h = Math.round(raw ? size / ar : size);
  const sparks = useMemo(() => Array.from({ length: 7 }, (_, i) => ({ left: `${12 + ((i * 37) % 76)}%`, delay: `${(i * 0.55) % 3.6}s`, dur: `${2.8 + (i % 3) * 0.6}s` })), []);
  const label = t ? `${TIER_PT[t]}${isApex(t) ? "" : " " + (rank || "")}` : "Sem elo";
  return (
    <span className="emblem live" style={{ width: w, height: h, "--tier": color, "--tier-a": `${color}66` }} title={label} role="img" aria-label={label}>
      <i className="em-halo" aria-hidden="true" />
      <span className="em-float">
        {raw ? (trimmed ? <>
          <img src={trimmed.src} alt="" />
          <i className="em-sheen" aria-hidden="true" style={{ WebkitMaskImage: `url("${trimmed.src}")`, maskImage: `url("${trimmed.src}")` }} />
        </> : null) : <TierCrest tier={t} rank={rank} />}
      </span>
      {t && <span className="em-sparks" aria-hidden="true">{sparks.map((p, i) => <i key={i} style={{ left: p.left, animationDelay: p.delay, animationDuration: p.dur }} />)}</span>}
      {raw && t && !isApex(t) && rank && <span className="em-div">{rank}</span>}
    </span>
  );
}

export function TierCrest({ tier, rank }) {
  const c = TIER_COLOR[tier] || "#6B7A89";
  const id = `tc-${tier || "none"}`;
  const hex = (r, cx = 60, cy = 62) => Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-m`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F0E6D2" /><stop offset=".35" stopColor={c} /><stop offset="1" stopColor="#1a1408" />
        </linearGradient>
        <radialGradient id={`${id}-g`} cx=".5" cy=".4" r=".6">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".95" /><stop offset=".35" stopColor={c} /><stop offset="1" stopColor="#020a14" />
        </radialGradient>
      </defs>
      <path d="M20 62 L4 48 L14 66 Z M100 62 L116 48 L106 66 Z" fill={`url(#${id}-m)`} opacity=".9" />
      <path d="M22 74 L8 76 L22 82 Z M98 74 L112 76 L98 82 Z" fill={`url(#${id}-m)`} opacity=".7" />
      {isApex(tier) && <path d="M44 22 L50 8 L56 18 L60 4 L64 18 L70 8 L76 22 Z" fill={`url(#${id}-m)`} />}
      <polygon points={hex(44)} fill={`url(#${id}-m)`} />
      <polygon points={hex(37)} fill="#06101d" stroke="#000" strokeWidth="1" />
      <polygon points={hex(31)} fill="none" stroke={c} strokeOpacity=".5" strokeWidth="1" />
      <path d="M60 36 L80 62 L60 88 L40 62 Z" fill={`url(#${id}-g)`} stroke="#F0E6D2" strokeOpacity=".7" strokeWidth="1" />
      <path d="M60 36 L60 88 M40 62 L80 62" stroke="#fff" strokeOpacity=".25" strokeWidth="1" />
      {!isApex(tier) && rank && <text x="60" y="114" textAnchor="middle" fontFamily="Cinzel, serif" fontWeight="700" fontSize="14" fill="#F0E6D2">{rank}</text>}
    </svg>
  );
}

// frame: { x, y, zoom } em %, para enquadrar uma imagem escolhida pelo usuário.
export function HeroBackdrop({ splash, frame }) {
  const dots = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ left: `${(i * 53) % 100}%`, delay: `${(i * 0.7) % 7}s`, dur: `${6 + (i % 5)}s` })), []);
  const x = frame?.x ?? 70, y = frame?.y ?? 22, z = (frame?.zoom ?? 100) / 100;
  return (
    <>
      {splash ? <div className="hero-bg"><img src={splash} alt="" style={{ objectPosition: `${x}% ${y}%`, transform: z !== 1 ? `scale(${z})` : undefined, transformOrigin: `${x}% ${y}%` }} /></div> : <><div className="hero-art" /><HeroSigil /></>}
      <div className="hero-veil" />
      <div className="hero-particles" aria-hidden="true">{dots.map((d, i) => <i key={i} style={{ left: d.left, animationDelay: d.delay, animationDuration: d.dur }} />)}</div>
    </>
  );
}

export function JungleGlyph({ size = 14 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M12 2c1.8 3 4.6 4.6 8 5-1 5-3.6 8.7-8 15C7.6 15.7 5 12 4 7c3.4-.4 6.2-2 8-5zm0 5.5c-.9 1.3-2.1 2.2-3.6 2.7.6 2.2 1.8 4.3 3.6 6.8 1.8-2.5 3-4.6 3.6-6.8-1.5-.5-2.7-1.4-3.6-2.7z" />
    </svg>
  );
}

// Arte de fundo do banner quando ainda não há splash: anéis hextech (desenho próprio).
function HeroSigil() {
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);
  return (
    <svg className="hero-sigil" viewBox="0 0 520 520" aria-hidden="true">
      <defs>
        <radialGradient id="hs-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#0AC8B9" stopOpacity=".35" /><stop offset=".6" stopColor="#0AC8B9" stopOpacity=".05" /><stop offset="1" stopColor="#0AC8B9" stopOpacity="0" /></radialGradient>
        <linearGradient id="hs-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F0E6D2" /><stop offset="1" stopColor="#785A28" /></linearGradient>
      </defs>
      <circle cx="260" cy="260" r="250" fill="url(#hs-glow)" />
      <g className="r1">
        <circle cx="260" cy="260" r="230" fill="none" stroke="url(#hs-gold)" strokeWidth="1.2" opacity=".6" />
        {ticks.map((a) => <rect key={a} x="259" y="26" width="2" height={a % 30 === 0 ? 16 : 7} fill="#C8AA6E" opacity={a % 30 === 0 ? 0.8 : 0.35} transform={`rotate(${a} 260 260)`} />)}
      </g>
      <g className="r2">
        <circle cx="260" cy="260" r="180" fill="none" stroke="#0AC8B9" strokeWidth="1" strokeDasharray="4 10" opacity=".55" />
        {[0, 60, 120, 180, 240, 300].map((a) => <path key={a} d="M260 70 L270 84 L260 98 L250 84 Z" fill="none" stroke="#C8AA6E" strokeWidth="1.2" opacity=".7" transform={`rotate(${a} 260 260)`} />)}
      </g>
      <polygon points="260,150 355,205 355,315 260,370 165,315 165,205" fill="none" stroke="url(#hs-gold)" strokeWidth="1.5" opacity=".5" />
      <polygon points="260,190 320,225 320,295 260,330 200,295 200,225" fill="#0AC8B9" fillOpacity=".05" stroke="#0AC8B9" strokeOpacity=".4" strokeWidth="1" />
      <path d="M260 215 L290 260 L260 305 L230 260 Z" fill="#0AC8B9" fillOpacity=".18" stroke="#CDFAFA" strokeOpacity=".6" />
    </svg>
  );
}
