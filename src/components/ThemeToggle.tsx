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
  /** Classes extra no botão. */
  className?: string;
  /** `compact` = ícone menor (ex.: header do player, mais no canto). */
  density?: 'default' | 'compact';
};

export function ThemeToggle({ className = '', density = 'default' }: Props) {
  const theme = useUiThemeStore((s) => s.theme);
  const toggleTheme = useUiThemeStore((s) => s.toggleTheme);
  const isNight = theme === 'night';

  const isCompact = density === 'compact';
  const btnSize = isCompact
    ? 'h-6 w-6 rounded-md'
    : 'h-8 w-8 rounded-lg';
  const iconCls = isCompact ? 'h-3 w-3' : 'h-[1.125rem] w-[1.125rem]';

  return (
    <button
      type="button"
      onClick={() => toggleTheme()}
      className={
        `flex ${btnSize} shrink-0 items-center justify-center border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ibiza-magenta/50 ` +
        'border-zinc-300/80 bg-white/90 text-amber-600 hover:bg-white dark:border-white/15 dark:bg-white/10 dark:text-amber-300 dark:hover:bg-white/15 ' +
        className
      }
      title={isNight ? 'Mudar para tema diurno' : 'Mudar para tema noturno'}
      aria-pressed={isNight}
      aria-label={isNight ? 'Ativar tema diurno' : 'Ativar tema noturno'}
    >
      {isNight ? <IconSun className={iconCls} /> : <IconMoon className={iconCls} />}
    </button>
  );
}
