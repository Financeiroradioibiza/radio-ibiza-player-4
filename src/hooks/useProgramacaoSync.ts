import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../store/app';
import { pingMarcacao } from '../player/pingMarcacao';
import { syncCachedDownloadsReportToServer } from '../player/downloadReport';
import { expurgarCacheAudioForaPrograma } from '../player/programacaoCache';
import { fetchProgramacao, type FetchProgramacaoResult } from './fetchProgramacao';
import { iniciarPrefetchProgramacaoEmBackground } from '../player/programacaoRefresh';

function mensagemListaAmigavel(codigo: string): string {
  const map: Record<string, string> = {
    token_invalido: 'Sessão inválida. Entre novamente.',
    playlists_ausentes: 'Servidor não retornou playlists para este PDV.',
    resposta_invalida: 'Resposta inválida do servidor.',
    timeout_download:
      'Demorou demais ao baixar. Verifique a conexão e tente de novo.',
  };
  return map[codigo] ?? codigo.replace(/_/g, ' ');
}

const TEMPO_LIMITE_FETCH_MS = 90_000;
const TEMPO_LIMITE_SYNC_REPORT_MS = 15_000;

/**
 * Na primeira entrada no player (ou sem cache): baixa `/playlist/`, `/agendas/`,
 * grava a programação **antes** do prefetch de MP3 (não perde dados se fechar a aba)
 * e retoma downloads em falta na próxima abertura.
 */
export function useProgramacaoSync() {
  const tokenRec = useAppStore((s) => s.token);
  const playlistData = useAppStore((s) => s.playlistData);
  const pdvStatus = useAppStore((s) => s.pdv?.status);
  const salvarProgramacaoCompleta = useAppStore((s) => s.salvarProgramacaoCompleta);
  const setStatus = useAppStore((s) => s.setStatus);
  const logout = useAppStore((s) => s.logout);

  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [midiaDownload, setMidiaDownload] = useState<{ done: number; total: number } | null>(
    null,
  );

  const refetch = useCallback(() => {
    setErro(null);
    setTick((n) => n + 1);
  }, []);

  useEffect(() => {
    const token = tokenRec?.token;
    if (!token) {
      setBusy(false);
      setErro(null);
      setMidiaDownload(null);
      return;
    }

    if (useAppStore.getState().playlistData != null) {
      setBusy(false);
      setMidiaDownload(null);
      return;
    }

    if (pdvStatus === 'I') {
      setBusy(false);
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

      if (useAppStore.getState().playlistData != null) {
        setBusy(false);
        return;
      }

      setBusy(true);
      setErro(null);

      const timeoutPack = new Promise<FetchProgramacaoResult>(
        (resolve) => {
          window.setTimeout(
            () => resolve({ ok: false, error: 'timeout_download' }),
            TEMPO_LIMITE_FETCH_MS,
          );
        },
      );

      try {
        const pack = await Promise.race([fetchProgramacao(token), timeoutPack]);

        if (!alive) return;

        if (useAppStore.getState().playlistData != null) {
          setBusy(false);
          return;
        }

        if (!pack.ok) {
          if (pack.error === 'token_invalido') {
            await logout();
            return;
          }
          setErro(mensagemListaAmigavel(pack.error));
          return;
        }

        /** Grava listas/agendas logo após o JSON — fechar o browser não apaga a programação. */
        await salvarProgramacaoCompleta(pack.playlist, pack.agendas);
        await expurgarCacheAudioForaPrograma(pack.playlist);

        if (!alive) return;

        const snap = useAppStore.getState();
        if (snap.pdv?.status === 'I') {
          useAppStore.setState({ status: 'desativado', conviteGesturaAudio: false });
          return;
        }
        setStatus('tocando');

        /** Prefetch continua em job global (retoma na próxima abertura se interromper). */
        void iniciarPrefetchProgramacaoEmBackground(pack.playlist, {
          cancelarJobAnterior: false,
          onProgress: (done, total) => {
            if (alive) setMidiaDownload({ done, total });
          },
        }).finally(() => {
          if (!alive) return;
          setMidiaDownload(null);
          pingMarcacao.aposBaixarConteudo();
          void Promise.race([
            syncCachedDownloadsReportToServer(),
            new Promise<void>((resolve) => {
              window.setTimeout(resolve, TEMPO_LIMITE_SYNC_REPORT_MS);
            }),
          ]);
        });
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
  }, [tokenRec?.token, pdvStatus, salvarProgramacaoCompleta, setStatus, logout, tick]);

  const precisaAguardar =
    Boolean(tokenRec?.token) && playlistData === null;

  return {
    precisaAguardar,
    busy,
    erroSinc: erro,
    refetch,
    midiaDownload,
  };
}

export type ProgramacaoSyncApi = ReturnType<typeof useProgramacaoSync>;
