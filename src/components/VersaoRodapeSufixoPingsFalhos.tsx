import type { ReactNode } from 'react';

import { LIMITES } from '@/api/config';
import { useAppStore } from '@/store/app';

/**
 * Quando não há rede, após pelo menos uma tentativa de ping sem sucesso, mostra `(N)`
 * em vermelho: períodos de ping restantes até a desativação automática (`LIMIT_TIMES_PING_OFF`).
 */
export function VersaoRodapeSufixoPingsFalhos(): ReactNode {
  const online = useAppStore((s) => s.online);
  const pingTimes = useAppStore((s) => s.pingTimes);
  const pingBloqueado = useAppStore((s) => s.pingBloqueado);

  if (online || pingBloqueado || pingTimes <= 0) return null;

  const restantes = LIMITES.LIMIT_TIMES_PING_OFF - pingTimes;
  if (!Number.isFinite(restantes) || restantes < 1) return null;

  return (
    <span
      className="font-semibold text-red-600 tabular-nums dark:text-red-400"
      title="Períodos de ping restantes antes da desativação automática por falta de comunicação com o servidor (sem rede)."
      aria-label={`${restantes} períodos de ping restantes antes do bloqueio por falha de comunicação`}
    >
      {' '}
      ({restantes})
    </span>
  );
}
