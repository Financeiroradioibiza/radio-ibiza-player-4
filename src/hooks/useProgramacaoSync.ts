import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../store/app';
import { isCtrlPlayerEnabled } from '../utils/pdvPermissions';
import { pingMarcacao } from '../player/pingMarcacao';
import { syncCachedDownloadsReportToServer } from '../player/downloadReport';
import { fetchProgramacao } from './fetchProgramacao';

function mensagemListaAmigavel(codigo: string): string {
  const map: Record<string, string> = {
    token_invalido: 'Sessão inválida. Entre novamente.',
    playlists_ausentes: 'Servidor não retornou playlists para este PDV.',
    resposta_invalida: 'Resposta inválida do servidor.',
  };
  return map[codigo] ?? codigo.replace(/_/g, ' ');
}

/**
 * Na primeira entrada no player (ou sem cache): baixa /playlist/ e /agendas/
 * em paralelo e persiste no store + IndexedDB.
 */
export function useProgramacaoSync() {
  const tokenRec = useAppStore((s) => s.token);
  const playlistData = useAppStore((s) => s.playlistData);
  const pdvStatus = useAppStore((s) => s.pdv?.status);
  const salvarPlaylist = useAppStore((s) => s.salvarPlaylist);
  const salvarAgendas = useAppStore((s) => s.salvarAgendas);
  const setStatus = useAppStore((s) => s.setStatus);
  const logout = useAppStore((s) => s.logout);

  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => {
    setErro(null);
    setTick((n) => n + 1);
  }, []);

  useEffect(() => {
    const token = tokenRec?.token;
    if (!token || playlistData != null) return;

    if (pdvStatus === 'I') {
      setErro(
        'Este PDV está inativo no cadastro. Reative o PDV no painel para baixar e tocar a programação.',
      );
      return;
    }

    let alive = true;

    void (async () => {
      if (!navigator.onLine) {
        setErro('Sem conexão. Conecte-se à internet para baixar a programação.');
        return;
      }

      setBusy(true);
      setErro(null);

      try {
        const pack = await fetchProgramacao(token);

        if (!alive) return;

        if (!pack.ok) {
          if (pack.error === 'token_invalido') {
            await logout();
            return;
          }
          setErro(mensagemListaAmigavel(pack.error));
          return;
        }

        await salvarPlaylist(pack.playlist);
        await salvarAgendas(pack.agendas);
        pingMarcacao.aposBaixarConteudo();
        await syncCachedDownloadsReportToServer();
        const snap = useAppStore.getState();
        if (snap.pdv?.status === 'I') {
          useAppStore.setState({ status: 'desativado' });
          return;
        }
        if (isCtrlPlayerEnabled(snap.pdv)) {
          useAppStore.setState({ status: 'pausado' });
        } else {
          setStatus('tocando');
        }
      } catch (e) {
        if (!alive) return;
        console.error(e);
        setErro('Não foi possível baixar a programação. Tente novamente.');
      } finally {
        if (alive) setBusy(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [
    tokenRec?.token,
    playlistData,
    pdvStatus,
    salvarPlaylist,
    salvarAgendas,
    setStatus,
    logout,
    tick,
  ]);

  const precisaAguardar = playlistData === null;

  return {
    /** Ainda sem `playlistData` no store */
    precisaAguardar,
    /** Requisição em andamento */
    busy,
    erroSinc: erro,
    refetch,
  };
}
