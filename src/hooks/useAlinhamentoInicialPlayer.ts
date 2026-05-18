import { useEffect } from 'react';
import { useAppStore } from '@/store/app';
import { pingMarcacao } from '@/player/pingMarcacao';
import { executarCicloPing } from '@/player/pingCiclo';

/**
 * Com rede e programação já em cache (`hidratar` pôs `sincronizando`): corre **um** ciclo de ping
 * antes de `tocando`, para aplicar `atualizacao_pendente` sem começar uma faixa que seria logo trocada.
 * Offline: liberta logo para `tocando` (só cache).
 */
export function useAlinhamentoInicialPlayer() {
  const token = useAppStore((s) => s.token);
  const status = useAppStore((s) => s.status);
  const playlistData = useAppStore((s) => s.playlistData);
  const pdv = useAppStore((s) => s.pdv);
  const pingBloqueado = useAppStore((s) => s.pingBloqueado);
  const setStatus = useAppStore((s) => s.setStatus);

  useEffect(() => {
    if (status !== 'sincronizando') return;
    if (!playlistData || !token?.token) return;
    if (pdv?.status === 'I' || pingBloqueado) return;

    let cancelado = false;

    void (async () => {
      try {
        if (!navigator.onLine) {
          if (!cancelado) setStatus('tocando');
          return;
        }
        const flag = pingMarcacao.flagsParaProximoPing();
        const r = await executarCicloPing({
          token: token.token,
          pdvAtualizadoFlag: flag,
        });
        if (cancelado || r === 'logout') return;
        setStatus('tocando');
      } catch {
        if (!cancelado) setStatus('tocando');
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [status, playlistData, token?.token, pdv?.status, pingBloqueado, setStatus]);
}
