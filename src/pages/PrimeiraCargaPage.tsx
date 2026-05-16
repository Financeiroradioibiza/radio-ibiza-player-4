/**
 * Primeira sincronização após escolher o PDV — rota dedicada (sem cartão do player).
 * Conteúdo em portal sobre `document.body` (z-index alto) para não ficar por baixo de nada no shell
 * nem de outra janela PWA no mesmo DOM.
 * Só navega para `/player` após download concluído **e** operador confirmar o formulário de contactos.
 */

import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';

import { IBIZA_SHELL_VERSION } from '@/api/config';
import { PrimeiraCargaBemVindo } from '@/components/PrimeiraCargaBemVindo';
import { useProgramacaoSync } from '@/hooks/useProgramacaoSync';
import { verificarAtualizacaoShell } from '@/player/appShellUpdate';
import { useAppStore } from '@/store/app';

const ATRASO_ANTES_PLAYER_MS = 900;

export function PrimeiraCargaPage() {
  const navigate = useNavigate();
  const playlistData = useAppStore((s) => s.playlistData);
  const pdvNome = useAppStore((s) => s.pdv?.nome);
  const logout = useAppStore((s) => s.logout);

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

  useEffect(() => {
    void verificarAtualizacaoShell({ versaoLocal: IBIZA_SHELL_VERSION, motivo: 'sync' });
  }, []);

  useEffect(() => {
    if (playlistData == null) {
      setCadastroConfirmado(false);
    }
  }, [playlistData]);

  useEffect(() => {
    if (!downloadConcluido || !cadastroConfirmado) return;
    const t = window.setTimeout(() => {
      navigate('/player', { replace: true });
    }, ATRASO_ANTES_PLAYER_MS);
    return () => clearTimeout(t);
  }, [downloadConcluido, cadastroConfirmado, navigate]);

  async function handleSair() {
    await logout();
    navigate('/login', { replace: true });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483647] overflow-y-scroll overflow-x-hidden overscroll-y-contain bg-ibiza-shell text-zinc-100"
      aria-hidden={false}
    >
      <div className="mx-auto w-full max-w-md px-4 py-6 sm:px-6 sm:py-10">
        <PrimeiraCargaBemVindo
          midiaDownload={midiaDownload}
          busy={busy}
          erroSinc={erroSinc}
          onRefetch={refetch}
          onSair={handleSair}
          pdvNome={pdvNome}
          downloadConcluido={downloadConcluido}
          cadastroConfirmado={cadastroConfirmado}
          onCadastroLojaConfirmado={() => setCadastroConfirmado(true)}
        />
        <p className="mt-4 text-center text-[10px] tabular-nums text-zinc-600">
          Shell {IBIZA_SHELL_VERSION}
        </p>
      </div>
    </div>,
    document.body,
  );
}
