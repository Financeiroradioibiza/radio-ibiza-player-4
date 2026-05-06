/**
 * Camada decorativa do painel principal — eco visual do material da marca (rede social):
 * estrela, barras de EQ, ondas. Só SVG + opacidade; não interfere em cliques ou leitura.
 */

function starPathD(cx: number, cy: number, outer: number, inner: number, spikes: number): string {
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const rad = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / spikes;
    pts.push(`${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`);
  }
  return `M ${pts[0]} L ${pts.slice(1).join(' ')} Z`;
}

export function PlayerIbizaArt() {
  const star = starPathD(50, 50, 46, 19, 8);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-[inherit]"
      aria-hidden
    >
      {/* Estrela / “explosion” — canto superior direito (identidade do perfil) */}
      <svg
        className="absolute -right-6 -top-5 h-36 w-36 text-ibiza-lemon/90 sm:h-44 sm:w-44"
        viewBox="0 0 100 100"
        fill="currentColor"
      >
        <path d={star} className="opacity-[0.22]" />
        <path
          d={star}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          className="text-ibiza-magenta/45"
        />
      </svg>

      {/* Onda / listras psicodélicas leves — base */}
      <svg
        className="absolute -bottom-3 left-0 h-24 w-[110%] text-ibiza-magenta opacity-[0.12] sm:opacity-[0.15]"
        viewBox="0 0 400 80"
        preserveAspectRatio="none"
      >
        <path fill="currentColor" d="M0,40 Q50,5 100,40 T200,40 T300,35 T400,42 L400,80 L0,80 Z" />
        <path
          fill="currentColor"
          className="text-ibiza-purple/80"
          d="M0,55 Q80,25 160,50 T320,48 T400,52 L400,80 L0,80 Z"
        />
      </svg>

      {/* Barras estilo equalizador — lateral esquerda */}
      <svg
        className="absolute bottom-10 left-3 h-28 w-16 opacity-35 sm:bottom-12 sm:left-5 sm:h-32 sm:w-20"
        viewBox="0 0 72 120"
      >
        <rect x={4} y={84} width={5} height={28} rx={2} className="fill-ibiza-magenta" />
        <rect x={11} y={60} width={5} height={52} rx={2} className="fill-ibiza-purple" />
        <rect x={18} y={74} width={5} height={38} rx={2} className="fill-ibiza-lemon" />
        <rect x={25} y={48} width={5} height={64} rx={2} className="fill-ibiza-magenta" />
        <rect x={32} y={68} width={5} height={44} rx={2} className="fill-ibiza-sky" />
        <rect x={39} y={40} width={5} height={72} rx={2} className="fill-ibiza-purple" />
        <rect x={46} y={84} width={5} height={36} rx={2} className="fill-ibiza-forest" />
        <rect x={53} y={54} width={5} height={58} rx={2} className="fill-ibiza-magenta" />
        <rect x={60} y={70} width={5} height={42} rx={2} className="fill-ibiza-lemon" />
      </svg>

      {/* Círculos abstratos — canto inferior direito */}
      <div className="absolute -bottom-16 -right-16 h-48 w-48 rounded-full border border-ibiza-sky/15 bg-gradient-to-br from-ibiza-purple/10 to-transparent" />
      <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full border border-ibiza-magenta/10" />
    </div>
  );
}
