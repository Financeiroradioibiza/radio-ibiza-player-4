/**
 * Alterna pele **noturna** (`data-ui-theme="night"`) e **diurna** (`day`).
 * Ícone: sol em modo noturno (ativa diurno), lua em modo diurno (ativa noturno).
 */

import { useUiThemeStore } from '@/store/uiThemeStore';

function IconSun({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function IconMoon({ className }: { className?: string }) {
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
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

type Props = {
  /** Classes extra no botão (ex.: tamanho no player). */
  className?: string;
};

export function ThemeToggle({ className = '' }: Props) {
  const theme = useUiThemeStore((s) => s.theme);
  const toggleTheme = useUiThemeStore((s) => s.toggleTheme);
  const isNight = theme === 'night';

  return (
    <button
      type="button"
      onClick={() => toggleTheme()}
      className={
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ibiza-magenta/50 ' +
        'border-zinc-300/80 bg-white/90 text-amber-600 hover:bg-white dark:border-white/15 dark:bg-white/10 dark:text-amber-300 dark:hover:bg-white/15 ' +
        className
      }
      title={isNight ? 'Mudar para tema diurno' : 'Mudar para tema noturno'}
      aria-pressed={isNight}
      aria-label={isNight ? 'Ativar tema diurno' : 'Ativar tema noturno'}
    >
      {isNight ? <IconSun className="h-[1.125rem] w-[1.125rem]" /> : <IconMoon className="h-[1.125rem] w-[1.125rem]" />}
    </button>
  );
}
