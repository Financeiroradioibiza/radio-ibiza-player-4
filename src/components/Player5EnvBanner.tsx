import { IBIZA_TARGET } from '@/api/config';
import { PLAYER5_ENV_LABEL } from '@/api/sandboxGuard';

/** Faixa fixa no topo — impossível confundir Player 5 (sistema novo) com a produção. */
export function Player5EnvBanner() {
  if (IBIZA_TARGET !== '5') return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[9999] border-b border-amber-500/60 bg-amber-600 px-3 py-1.5 text-center text-xs font-semibold tracking-wide text-zinc-950 shadow-lg"
      role="status"
      aria-live="polite"
    >
      {PLAYER5_ENV_LABEL}
    </div>
  );
}
