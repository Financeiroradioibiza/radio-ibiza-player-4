/**
 * Tela principal do player — reprodução em loop das playlists tipo N (ambiente).
 * Sincroniza /playlist/ e /agendas/ na primeira entrada; engine completa nas próximas etapas do roadmap.
 */

import { useAppStore } from '../store/app';
import { useProgramacaoSync } from '../hooks/useProgramacaoSync';
import { usePingLoop } from '../hooks/usePingLoop';
import { usePlayer } from '../player/loop';
import { isCtrlPlayerEnabled } from '../utils/pdvPermissions';

const MODO_LABEL: Record<'ambient' | 'vinheta_vp' | 'vinheta_va', string> = {
  ambient: 'Ambiente',
  vinheta_vp: 'Vinheta programada',
  vinheta_va: 'Vinheta agendada',
};

export function PlayerPage() {
  const pdv = useAppStore((s) => s.pdv);
  const cliente = useAppStore((s) => s.cliente);
  const status = useAppStore((s) => s.status);
  const setStatus = useAppStore((s) => s.setStatus);
  const logout = useAppStore((s) => s.logout);

  const { precisaAguardar, busy, erroSinc, refetch } = useProgramacaoSync();
  usePingLoop();
  const { faixaAtual, playlistAmbiente, modoReproducao, erro: erroPlayer } = usePlayer();

  const sincronizandoUi = precisaAguardar && (busy || !erroSinc);
  const transporteOk = status !== 'desativado' && isCtrlPlayerEnabled(pdv);

  return (
    <div className="flex h-full flex-col bg-zinc-950 p-6 text-zinc-100">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-light text-ibiza-gold">Radio Ibiza Player</h1>
          {cliente && (
            <p className="text-sm text-zinc-500">
              {cliente.nome} {pdv && `· ${pdv.nome}`}
            </p>
          )}
        </div>
        <button
          onClick={() => void logout()}
          className="text-sm text-zinc-500 hover:text-zinc-300"
        >
          Sair
        </button>
      </header>

      <main className="flex flex-1 flex-col">
        {sincronizandoUi && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-zinc-300">Baixando programação e agendas…</p>
            <p className="mt-2 text-xs text-zinc-600">Isso pode levar alguns instantes na primeira vez.</p>
          </div>
        )}

        {!sincronizandoUi && erroSinc && (
          <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            <p>{erroSinc}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 rounded bg-zinc-800 px-3 py-1.5 text-zinc-200 hover:bg-zinc-700"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {!sincronizandoUi && !erroSinc && precisaAguardar === false && (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-zinc-500 shrink-0">
              <span>
                Estado:{' '}
                <span className="text-zinc-300">{status}</span>
              </span>
              <span>
                Modo: <span className="text-zinc-300">{MODO_LABEL[modoReproducao]}</span>
              </span>
              {playlistAmbiente && (
                <span>
                  Playlist:{' '}
                  <span className="text-zinc-300">{playlistAmbiente.nome}</span>
                </span>
              )}
            </div>

            {pdv?.ctrl_player === 'N' && status !== 'desativado' && (
              <p className="mb-4 text-xs text-zinc-600">
                Controle local de play/pausa está desabilitado pelo painel (ctrl_player=N).
              </p>
            )}

            {pdv?.ctrl_playlists === 'N' && status !== 'desativado' && (
              <p className="mb-4 text-xs text-zinc-600">
                Troca manual de playlist está desabilitada pelo painel.
              </p>
            )}

            {erroPlayer && (
              <div className="mb-4 rounded border border-amber-900/80 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
                {erroPlayer}
              </div>
            )}

            {status === 'pausado' && transporteOk && (playlistAmbiente || faixaAtual) && (
              <div className="mb-4 max-w-md shrink-0 rounded border border-zinc-700 bg-zinc-900/50 px-3 py-3 text-xs text-zinc-400">
                <p>
                  {faixaAtual ? (
                    <>
                      Os navegadores exigem um toque nesta página para o áudio. Prima{' '}
                      <span className="text-zinc-300">«Tocar»</span> para continuar.
                    </>
                  ) : (
                    <>
                      Prima <span className="text-zinc-300">«Tocar»</span> para iniciar o som. Isto é
                      normal em sites com áudio (política do navegador).
                    </>
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => setStatus('tocando')}
                  className="mt-3 w-full rounded-lg border border-ibiza-gold/50 bg-ibiza-gold/10 px-4 py-2.5 text-sm font-medium text-ibiza-gold hover:bg-ibiza-gold/20 sm:w-auto"
                >
                  Tocar
                </button>
              </div>
            )}

            {faixaAtual && (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-6 text-center">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Tocando agora</p>
                <p className="mt-2 text-lg font-medium text-zinc-100">{faixaAtual.musica.titulo}</p>
                <p className="mt-1 text-sm text-zinc-400">{faixaAtual.artista.nome}</p>

                {transporteOk && status === 'tocando' && (
                  <div className="mt-8 flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setStatus('pausado')}
                      className="rounded-lg border border-ibiza-gold/50 bg-zinc-900 px-8 py-2.5 text-sm font-medium text-ibiza-gold hover:bg-zinc-800"
                    >
                      Pausar
                    </button>
                  </div>
                )}
              </div>
            )}

            {!faixaAtual && !erroPlayer && status === 'tocando' && (
              <p className="flex-1 self-center text-center text-sm text-zinc-500">
                Preparando a primeira faixa…
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
