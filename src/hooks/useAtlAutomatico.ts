import { useEffect, useRef } from 'react';

import { solicitarAtualizacaoProgramacaoNuvem } from '@/player/programacaoRefresh';
import {
  podeEnfileirarAtlAutomatico,
  registrarAtlAutomaticoBemSucedido,
} from '@/player/atlSupport';

/** Intervalo entre tentativas de ATL em segundo plano (~35 min). */
const INTERVALO_TICK_MS = 35 * 60 * 1000;
/** Primeira tentativa após o painel ficar pronto (deixa passar sync/ping inicial). */
const ATRASO_INICIAL_MS = 90 * 1000;

/**
 * ATL automático: até 3× por dia (calendário local), com intervalo mínimo de 2 h entre sucessos.
 * Reutiliza `solicitarAtualizacaoProgramacaoNuvem` com `origem: 'auto'` (ping + /playlist + /agendas).
 */
export function useAtlAutomatico(ativo: boolean): void {
  const rodandoRef = useRef(false);

  useEffect(() => {
    if (!ativo) return;

    const executar = async () => {
      if (rodandoRef.current) return;
      if (!navigator.onLine) return;
      if (!podeEnfileirarAtlAutomatico(Date.now()).ok) return;

      rodandoRef.current = true;
      try {
        const res = await solicitarAtualizacaoProgramacaoNuvem({ origem: 'auto' });
        if (res.ok) {
          registrarAtlAutomaticoBemSucedido(Date.now());
        }
      } finally {
        rodandoRef.current = false;
      }
    };

    const intervalo = window.setInterval(() => void executar(), INTERVALO_TICK_MS);
    const primeiro = window.setTimeout(() => void executar(), ATRASO_INICIAL_MS);
    return () => {
      window.clearInterval(intervalo);
      window.clearTimeout(primeiro);
    };
  }, [ativo]);
}
