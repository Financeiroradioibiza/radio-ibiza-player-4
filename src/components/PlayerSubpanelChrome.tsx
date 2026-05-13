/**
 * Moldura visual comum aos subpainéis do player (Playlists, Vinhetas, etc.) — tema escuro + acento Ibiza.
 */

import type { ReactNode } from 'react';

export type PlayerSubpanelAccent = 'magenta' | 'purple' | 'sky' | 'forest';

const ACCENT_META: Record<
  PlayerSubpanelAccent,
  {
    gradient: string;
    title: string;
    glow: string;
    solidBar: string;
    voltarAoPlayerBtn: string;
  }
> = {
  magenta: {
    gradient: 'from-ibiza-magenta via-fuchsia-500/85 to-purple-600/70',
    title: 'text-ibiza-magenta/95',
    glow: 'shadow-[0_0_28px_-8px_rgba(236,72,153,0.45)]',
    solidBar: 'bg-ibiza-magenta',
    voltarAoPlayerBtn:
      'shrink-0 cursor-pointer rounded-xl border border-white/20 bg-gradient-to-r from-pink-600/65 via-fuchsia-600/50 to-purple-700/55 px-3 py-2 text-xs font-bold text-white shadow-ibiza-pop transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40',
  },
  purple: {
    gradient: 'from-ibiza-purple via-violet-500/80 to-fuchsia-700/65',
    title: 'text-ibiza-purple/95',
    glow: 'shadow-[0_0_28px_-8px_rgba(167,139,250,0.4)]',
    solidBar: 'bg-ibiza-purple',
    voltarAoPlayerBtn:
      'shrink-0 cursor-pointer rounded-xl border border-white/20 bg-gradient-to-r from-violet-600/60 via-purple-600/55 to-fuchsia-700/50 px-3 py-2 text-xs font-bold text-white shadow-ibiza-pop transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40',
  },
  sky: {
    gradient: 'from-ibiza-sky via-sky-500/75 to-cyan-700/65',
    title: 'text-ibiza-sky/95',
    glow: 'shadow-[0_0_28px_-8px_rgba(56,189,248,0.38)]',
    solidBar: 'bg-ibiza-sky',
    voltarAoPlayerBtn:
      'shrink-0 cursor-pointer rounded-xl border border-white/20 bg-gradient-to-r from-sky-600/60 via-cyan-600/52 to-teal-700/48 px-3 py-2 text-xs font-bold text-white shadow-ibiza-pop transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40',
  },
  forest: {
    gradient: 'from-ibiza-forest via-emerald-600/78 to-teal-800/62',
    title: 'text-ibiza-forest/95',
    glow: 'shadow-[0_0_28px_-10px_rgba(52,211,153,0.35)]',
    solidBar: 'bg-ibiza-forest',
    voltarAoPlayerBtn:
      'shrink-0 cursor-pointer rounded-xl border border-white/20 bg-gradient-to-r from-emerald-600/60 via-teal-600/50 to-teal-800/45 px-3 py-2 text-xs font-bold text-white shadow-ibiza-pop transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40',
  },
};

const LISTA_BORDERL: Record<PlayerSubpanelAccent, string> = {
  magenta: 'border-l-ibiza-magenta/80',
  purple: 'border-l-ibiza-purple/85',
  sky: 'border-l-ibiza-sky/80',
  forest: 'border-l-ibiza-forest/80',
};

/** Card com colchete laranja/vermelho (Shopping — aviso de veículo). */
export function listaCardShoppingVeiculo(): string {
  return [
    'rounded-2xl border border-white/[0.07]',
    'border-l-[3px] border-l-orange-500/85',
    'bg-gradient-to-br from-zinc-950/95 via-orange-950/[0.12] to-black/30',
    'px-4 py-3.5 sm:px-5 sm:py-4',
    'backdrop-blur-sm shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]',
  ].join(' ');
}

/** Card de linha dentro dos subpainéis (lista de pastas ou vinhetas). */
export function listaCardIbiza(accent: PlayerSubpanelAccent): string {
  const bl = LISTA_BORDERL[accent];
  return [
    'rounded-2xl border border-white/[0.07]',
    bl,
    'border-l-[3px] bg-gradient-to-br from-zinc-950/95 via-black/45 to-black/30 px-4 py-3.5 sm:px-5 sm:py-4',
    'backdrop-blur-sm shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]',
  ].join(' ');
}

type Props = {
  titulo: string;
  subtitulo?: string;
  accent?: PlayerSubpanelAccent;
  onClose: () => void;
  closeDisabled?: boolean;
  /** Conteúdo principal (lista, formulários…) */
  children: ReactNode;
  /** Substitui o `space-y-5` padrão do invólucro (ex.: `flex h-full min-h-0 flex-col space-y-3`) */
  rootClassName?: string;
  /** Envolve `children` (ex.: área rolável em painel full-height) */
  bodyClassName?: string;
  /** Barra de acento sem gradiente nem glow — superfície opaca (ex.: Playlists em overlay). */
  accentBar?: 'gradient' | 'solid';
  /** Cabeçalho mais baixo — ex.: modal de feedback compacto. */
  chromeDensity?: 'default' | 'compact';
};

export function PlayerSubpanelChrome({
  titulo,
  subtitulo,
  accent = 'purple',
  onClose,
  closeDisabled = false,
  children,
  rootClassName,
  bodyClassName,
  accentBar = 'gradient',
  chromeDensity = 'default',
}: Props) {
  const m = ACCENT_META[accent];
  const compact = chromeDensity === 'compact';

  return (
    <div className={rootClassName ?? 'space-y-5'}>
      <div
        className={
          compact
            ? 'flex flex-wrap items-start justify-between gap-2 border-b border-white/10 pb-2.5'
            : 'flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4'
        }
      >
        <div className="min-w-0 flex-1">
          <div
            className={
              accentBar === 'solid'
                ? `${compact ? 'mb-1.5' : 'mb-2'} h-1 w-full max-w-[9rem] rounded-full ${m.solidBar}`
                : `${compact ? 'mb-1.5' : 'mb-2'} h-1 w-full max-w-[9rem] rounded-full bg-gradient-to-r ${m.gradient} ${m.glow}`
            }
            aria-hidden
          />
          <h2
            className={`font-bold tracking-tight ${
              compact ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'
            } ${m.title}`}
          >
            {titulo}
          </h2>
          {subtitulo ? (
            <p
              className={`mt-1.5 max-w-prose leading-relaxed text-zinc-100 ${
                compact ? 'text-[11px]' : 'text-xs'
              }`}
            >
              {subtitulo}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={closeDisabled}
          aria-label="Voltar ao player"
          title="Volta à tela principal do player (a sessão continua ativa)."
          className={`${m.voltarAoPlayerBtn}${compact ? ' !px-2.5 !py-1.5 !text-[10px]' : ''}`}
        >
          Voltar ao player
        </button>
      </div>
      {bodyClassName ? <div className={bodyClassName}>{children}</div> : children}
    </div>
  );
}
