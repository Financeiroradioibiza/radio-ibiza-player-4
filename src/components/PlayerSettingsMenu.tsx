/**
 * Menu de ajustes do player (engrenagem) — extensível no futuro.
 * **Só shell desktop / PWA Windows no PC** — não usar em `shells/mobile`.
 */

import { useEffect, useRef, useState } from 'react';

import {
  abrirConfiguracaoInicializacaoWindows,
  iniciarComWindows,
  isChromeStandalonePwa,
  shouldShowPlayerSettingsMenu,
} from '@/utils/windowsPwa';

function IconGear({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

type Props = {
  className?: string;
  density?: 'default' | 'compact';
  /** Botão no rodapé: menu abre para cima. */
  menuOpensAbove?: boolean;
};

export function PlayerSettingsMenu({
  className = '',
  density = 'default',
  menuOpensAbove = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(
    () => () => {
      if (feedbackTimerRef.current != null) window.clearTimeout(feedbackTimerRef.current);
    },
    [],
  );

  if (!shouldShowPlayerSettingsMenu()) return null;

  const isCompact = density === 'compact';
  const btnSize = isCompact ? 'h-6 w-6 rounded-md' : 'h-8 w-8 rounded-lg';
  const iconCls = isCompact ? 'h-3 w-3' : 'h-[1.125rem] w-[1.125rem]';
  const chromePwa = isChromeStandalonePwa();

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    if (feedbackTimerRef.current != null) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => setFeedback(null), 9000);
  };

  const handleStartup = () => {
    setOpen(false);
    const mode = iniciarComWindows();
    if (mode === 'bat') {
      showFeedback('Abra o arquivo baixado');
    }
  };

  const handleStartupSettings = () => {
    setOpen(false);
    abrirConfiguracaoInicializacaoWindows();
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          `flex ${btnSize} shrink-0 items-center justify-center border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ibiza-magenta/50 ` +
          'border-zinc-300/80 bg-white/90 text-zinc-600 hover:bg-white dark:border-white/15 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/15'
        }
        title="Ajustes"
        aria-label="Ajustes do player"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <IconGear className={iconCls} />
      </button>

      {feedback && (
        <p
          role="status"
          className={
            `pointer-events-none absolute right-0 z-[81] max-w-[11rem] rounded-lg border border-emerald-500/40 bg-emerald-950/95 px-2 py-1 text-center text-[10px] leading-snug text-emerald-100 shadow-md ` +
            (menuOpensAbove ? 'bottom-[calc(100%+0.35rem)]' : 'top-[calc(100%+0.35rem)]')
          }
        >
          {feedback}
        </p>
      )}

      {open && (
        <div
          role="menu"
          className={
            `absolute right-0 z-[80] min-w-[13.5rem] overflow-hidden rounded-xl border border-zinc-200/90 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-zinc-900 ` +
            (menuOpensAbove
              ? 'bottom-[calc(100%+0.35rem)]'
              : 'top-[calc(100%+0.35rem)]')
          }
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleStartup}
            className="flex w-full px-3 py-2.5 text-left text-sm text-zinc-800 transition hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-white/10"
          >
            {chromePwa ? 'Ativar ao ligar o PC' : 'Iniciar com o Windows'}
          </button>
          {chromePwa && (
            <button
              type="button"
              role="menuitem"
              onClick={handleStartupSettings}
              className="flex w-full border-t border-zinc-200/80 px-3 py-2.5 text-left text-sm text-zinc-600 transition hover:bg-zinc-100 dark:border-white/10 dark:text-zinc-400 dark:hover:bg-white/10"
            >
              Lista do Windows…
            </button>
          )}
        </div>
      )}
    </div>
  );
}
