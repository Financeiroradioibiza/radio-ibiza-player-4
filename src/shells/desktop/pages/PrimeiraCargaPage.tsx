/**
 * Shell desktop (`/primeira-carga`).
 *
 * Primeira sincronização após escolher o PDV — rota dedicada (sem cartão do player).
 * Conteúdo em portal sobre `document.body` (z-index alto) para não ficar por baixo de nada no shell
 * nem de outra janela PWA no mesmo DOM.
 * Só navega para `/player` após download concluído **e** operador confirmar o formulário de contactos.
 */

import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';

import { IBIZA_SHELL_VERSION, IBIZA_SHELL_VERSION_MOBILE, IBIZA_TARGET } from '@/api/config';
import { PrimeiraCargaBemVindo } from '@/components/PrimeiraCargaBemVindo';
import { useProgramacaoSync } from '@/hooks/useProgramacaoSync';
import { verificarAtualizacaoShell } from '@/player/appShellUpdate';
import { useAppStore } from '@/store/app';
import { useShell } from '@/shells/ShellContext';

const ATRASO_ANTES_PLAYER_MS = 900;

/** Uma vez por sessão do separador: `sessionStorage` evita loop de reload. */
const SESSION_PRIMEIRA_CARGA_RELOAD_KEY = 'radio_ibiza_primeira_carga_session_refreshed';

export function PrimeiraCargaPage() {
  const navigate = useNavigate();
  const { shell, path } = useShell();
  const playlistData = useAppStore((s) => s.playlistData);
  const pdvNome = useAppStore((s) => s.pdv?.nome);
  const logout = useAppStore((s) => s.logout);

  const clienteId = useAppStore((s) => s.cliente?.id ?? s.cliente_id);
  const pdvId = useAppStore((s) => s.pdv?.id);

  const programacaoSync = useProgramacaoSync();
  const { busy, erroSinc, refetch, midiaDownload } = programacaoSync;

  const [cadastroConfirmado, setCadastroConfirmado] = useState(false);

  const downloadConcluido = useMemo(
    () => playlistData != null && !busy && erroSinc == null,
    [playlistData, busy, erroSinc],
  );

  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBodyOverscroll = body.style.overscrollBehavior;
    /**
     * Scroll fica só no overlay (`fixed` + overflow). Não forçar `overflow:hidden` no
     * `body`: em alguns Chromium (Electron / Windows) isso quebra a altura do scrollport
     * interior e o conteúdo extra do cartão deixa de ser scrollável ou desenhável.
     */
    html.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    return () => {
      html.style.overflow = prevHtml;
      body.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, []);

  /**
   * WEB/PWA: ao abrir a primeira carga neste separador, um `reload` alinha cache/SW
   * antes da sincronização pesada. Uma vez por `sessionStorage`; não em dev nem no Electron.
   */
  useEffect(() => {
    if (import.meta.env.DEV) return;
    if (IBIZA_TARGET !== 'WEB') return;
    try {
      if (sessionStorage.getItem(SESSION_PRIMEIRA_CARGA_RELOAD_KEY) === '1') return;
      sessionStorage.setItem(SESSION_PRIMEIRA_CARGA_RELOAD_KEY, '1');
      window.location.reload();
    } catch {
      //
    }
  }, []);

  useEffect(() => {
    void verificarAtualizacaoShell({
      versaoLocal: shell === 'mobile' ? IBIZA_SHELL_VERSION_MOBILE : IBIZA_SHELL_VERSION,
      motivo: 'sync',
      shell,
    });
  }, [shell]);

  useEffect(() => {
    if (playlistData == null) {
      setCadastroConfirmado(false);
    }
  }, [playlistData]);

  useEffect(() => {
    if (!downloadConcluido || !cadastroConfirmado) return;
    const t = window.setTimeout(() => {
      navigate(path('/player'), { replace: true });
    }, ATRASO_ANTES_PLAYER_MS);
    return () => clearTimeout(t);
  }, [downloadConcluido, cadastroConfirmado, navigate, path]);

  async function handleSair() {
    await logout();
    navigate(path('/login'), { replace: true });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483647] overflow-y-scroll overflow-x-hidden overscroll-y-contain bg-ibiza-shell-day text-zinc-900 dark:bg-ibiza-shell dark:text-zinc-100"
      aria-hidden={false}
    >
      <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-5 sm:py-6 lg:px-6 lg:py-4">
        <PrimeiraCargaBemVindo
          midiaDownload={midiaDownload}
          busy={busy}
          erroSinc={erroSinc}
          onRefetch={refetch}
          onSair={handleSair}
          pdvNome={pdvNome}
          clienteId={clienteId}
          pdvId={pdvId}
          downloadConcluido={downloadConcluido}
          cadastroConfirmado={cadastroConfirmado}
          onCadastroLojaConfirmado={() => setCadastroConfirmado(true)}
        />
        <p className="mt-4 text-center text-[10px] tabular-nums text-zinc-600">
          Shell {shell === 'mobile' ? IBIZA_SHELL_VERSION_MOBILE : IBIZA_SHELL_VERSION}
        </p>
      </div>
    </div>,
    document.body,
  );
}
