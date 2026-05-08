/**
 * Moldura visual comum aos subpainéis do player (Playlists, Vinhetas, etc.) — tema escuro + acento Ibiza.
 */

import type { ReactNode } from 'react';

export type PlayerSubpanelAccent = 'magenta' | 'purple' | 'sky' | 'forest';

const ACCENT_META: Record<
  PlayerSubpanelAccent,
  { gradient: string; title: string; glow: string }
> = {
  magenta: {
    gradient: 'from-ibiza-magenta via-fuchsia-500/85 to-purple-600/70',
    title: 'text-ibiza-magenta/95',
    glow: 'shadow-[0_0_28px_-8px_rgba(236,72,153,0.45)]',
  },
  purple: {
    gradient: 'from-ibiza-purple via-violet-500/80 to-fuchsia-700/65',
    title: 'text-ibiza-purple/95',
    glow: 'shadow-[0_0_28px_-8px_rgba(167,139,250,0.4)]',
  },
  sky: {
    gradient: 'from-ibiza-sky via-sky-500/75 to-cyan-700/65',
    title: 'text-ibiza-sky/95',
    glow: 'shadow-[0_0_28px_-8px_rgba(56,189,248,0.38)]',
  },
  forest: {
    gradient: 'from-ibiza-forest via-emerald-600/78 to-teal-800/62',
    title: 'text-ibiza-forest/95',
    glow: 'shadow-[0_0_28px_-10px_rgba(52,211,153,0.35)]',
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
}: Props) {
  const m = ACCENT_META[accent];

  return (
    <div className={rootClassName ?? 'space-y-5'}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
        <div className="min-w-0 flex-1">
          <div
            className={`mb-2 h-1 w-full max-w-[9rem] rounded-full bg-gradient-to-r ${m.gradient} ${m.glow}`}
            aria-hidden
          />
          <h2 className={`text-lg font-bold tracking-tight sm:text-xl ${m.title}`}>{titulo}</h2>
          {subtitulo ? (
            <p className="mt-1.5 max-w-prose text-xs leading-relaxed text-zinc-500">{subtitulo}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={closeDisabled}
          aria-label="Fechar este painel"
          title="Fechar este painel"
          className="shrink-0 cursor-help rounded-xl border border-zinc-600/70 bg-zinc-950/90 px-3.5 py-2 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Fechar
        </button>
      </div>
      {bodyClassName ? <div className={bodyClassName}>{children}</div> : children}
    </div>
  );
}
