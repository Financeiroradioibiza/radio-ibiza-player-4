/**
 * Primeira sincronização após escolher o PDV — rota dedicada (sem cartão do player).
 * Conteúdo em portal sobre `document.body` (z-index alto) para não ficar por baixo de nada no shell
 * nem de outra janela PWA no mesmo DOM.
 * Navegação para `/player` após `playlistData` existir, `busy === false` e um breve «concluído» visível.
 */

import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';

import { PrimeiraCargaBemVindo } from '@/components/PrimeiraCargaBemVindo';
import { useProgramacaoSync } from '@/hooks/useProgramacaoSync';
import { useAppStore } from '@/store/app';

const ATRASO_ANTES_PLAYER_MS = 900;

export function PrimeiraCargaPage() {
  const navigate = useNavigate();
  const playlistData = useAppStore((s) => s.playlistData);
  const logout = useAppStore((s) => s.logout);

  const programacaoSync = useProgramacaoSync();
  const { busy, erroSinc, refetch, midiaDownload } = programacaoSync;

  const [prontoParaAbrirPlayer, setProntoParaAbrirPlayer] = useState(false);

  useLayoutEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (playlistData == null || busy) {
      setProntoParaAbrirPlayer(false);
      return;
    }
    setProntoParaAbrirPlayer(true);
    const t = window.setTimeout(() => {
      navigate('/player', { replace: true });
    }, ATRASO_ANTES_PLAYER_MS);
    return () => clearTimeout(t);
  }, [playlistData, busy, navigate]);

  async function handleSair() {
    await logout();
    navigate('/login', { replace: true });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483647] flex flex-col items-center justify-center overflow-x-hidden overflow-y-auto bg-ibiza-shell px-4 py-10 text-zinc-100 sm:px-6"
      aria-hidden={false}
    >
      <PrimeiraCargaBemVindo
        midiaDownload={midiaDownload}
        busy={busy}
        erroSinc={erroSinc}
        onRefetch={refetch}
        onSair={handleSair}
        prontoParaAbrirPlayer={prontoParaAbrirPlayer}
      />
    </div>,
    document.body,
  );
}
