import { useEffect, useRef } from 'react';
import { LIMITES } from '../api/config';
import { useAppStore } from '../store/app';
import { pingMarcacao } from '../player/pingMarcacao';
import { executarCicloPing } from '../player/pingCiclo';

/**
 * Ping periódico (TIME_TO_PING_MIN) mais um ping imediato ao entrar na tela Player com token.
 * O painel só mostra versão/MAC/IP e primeiro ping depois deste GET; atualiza também PDV/fila save_executadas.
 */
export function usePingLoop() {
  const tokenRec = useAppStore((s) => s.token);
  /** Evita interval duplicado em re-renders / Strict Mode */
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const tok = tokenRec?.token;
    if (!tok) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (intervalRef.current) clearInterval(intervalRef.current);

    const ms = LIMITES.TIME_TO_PING_MIN * 60 * 1000;
    /** Evita dois `run` paralelos (interval + online + imediato). */
    let runEmAndamento = false;
    /**
     * A primeira chamada (`run` imediato ao montar) não deve contar como “falha por offline”
     * — só a partir dos ciclos seguintes (intervalo / `online`) exigimos conexão.
     */
    let primeiraVezPing = true;

    const run = async () => {
      if (runEmAndamento) return;
      const { token } = useAppStore.getState();
      const tokenStr = token?.token;
      if (!tokenStr) return;

      const ignorarPenalidadeOffline = primeiraVezPing;
      primeiraVezPing = false;

      /**
       * Sem rede = o servidor não foi contactado — conta como falha de sincronização
       * (política: máximo 3 dias sem ping bem-sucedido; ver `LIMIT_TIMES_PING_OFF`).
       */
      if (!navigator.onLine) {
        if (!ignorarPenalidadeOffline) {
          await useAppStore.getState().incrementarPingFalho();
        }
        return;
      }

      runEmAndamento = true;
      const flagMarcacao = pingMarcacao.flagsParaProximoPing();

      try {
        await executarCicloPing({ token: tokenStr, pdvAtualizadoFlag: flagMarcacao });
      } finally {
        runEmAndamento = false;
      }
    };

    const onOnline = () => void run();

    intervalRef.current = setInterval(() => void run(), ms);
    window.addEventListener('online', onOnline);

    /* O painel lê versão do player / 1º ping a partir deste endpoint; só `save_executadas`
     * não popula esses campos — sem isto ficava tudo em branco até passar TIME_TO_PING_MIN. */
    void run();

    return () => {
      window.removeEventListener('online', onOnline);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [tokenRec?.token]);
}
