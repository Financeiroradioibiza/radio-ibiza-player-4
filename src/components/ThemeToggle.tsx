/**
 * Alterna pele **noturna** (atual, `data-ui-theme="night"`) e **diurna** (`light`).
 */

import { useUiThemeStore } from '@/store/uiThemeStore';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const theme = useUiThemeStore((s) => s.theme);
  const toggleTheme = useUiThemeStore((s) => s.toggleTheme);
  const isNight = theme === 'night';

  return (
    <button
      type="button"
      onClick={() => toggleTheme()}
      className={
        'rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ibiza-magenta/50 ' +
        'border-zinc-300/80 bg-white/80 text-zinc-700 hover:bg-white dark:border-white/15 dark:bg-white/10 dark:text-zinc-200 dark:hover:bg-white/15 ' +
        className
      }
      title={isNight ? 'Mudar para tema diurno' : 'Mudar para tema noturno'}
      aria-pressed={isNight}
      aria-label={isNight ? 'Ativar tema diurno' : 'Ativar tema noturno'}
    >
      {isNight ? 'Dia' : 'Noite'}
    </button>
  );
}
