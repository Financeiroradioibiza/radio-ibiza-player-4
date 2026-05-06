/**
 * Tela principal do player — reprodução em loop das playlists tipo N (ambiente).
 * Sincroniza /playlist/ e /agendas/ na primeira entrada; engine completa nas próximas etapas do roadmap.
 */

import { useAppStore } from '../store/app';
import { useProgramacaoSync } from '../hooks/useProgramacaoSync';
import { usePingLoop } from '../hooks/usePingLoop';
import { usePlayer } from '../player/loop';
import { isCtrlPlayerEnabled } from '../utils/pdvPermissions';
import { PwaInstallBanner } from '../components/PwaInstallBanner';
import { PlayerIbizaArt } from '../components/PlayerIbizaArt';

const MODO_LABEL: Record<'ambient' | 'vinheta_vp' | 'vinheta_va', string> = {
  ambient: 'Ambiente',
  vinheta_vp: 'Vinheta programada',
  vinheta_va: 'Vinheta agendada',
};

/** Logo oficial (PNG transparente — marca no topo do player) */
const BRAND_LOGO_PNG = 'https://assinatura-logo.netlify.app/logo.png';

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
    <div className="mx-auto flex min-h-full w-full max-w-4xl flex-1 flex-col px-4 py-6 sm:px-6 lg:py-8">
      <div className="mb-5 flex w-full justify-center px-2">
        <img
          src={BRAND_LOGO_PNG}
          alt="Radio Ibiza"
          width={320}
          height={120}
          decoding="async"
          loading="eager"
          className="h-16 w-auto max-w-[min(100%,280px)] object-contain drop-shadow-[0_4px_24px_rgba(225,29,140,0.25)] sm:h-20"
        />
      </div>

      {/* Mesmo shell visual da tela de login — vidro + borda em gradiente */}
      <div className="w-full min-h-0 flex-1">
        <div className="rounded-[1.35rem] bg-gradient-to-br from-ibiza-magenta/55 via-ibiza-purple/35 to-ibiza-lemon/25 p-px shadow-ibiza-pop">
          <div className="flex min-h-[min(560px,calc(100dvh-11rem))] min-h-0 flex-col rounded-[1.3rem] border border-white/10 bg-zinc-950/75 p-6 shadow-panel backdrop-blur-md sm:min-h-[min(620px,calc(100dvh-10rem))] sm:p-8">
            <header className="mb-6 flex shrink-0 items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
                  <span className="bg-gradient-to-r from-ibiza-magenta via-ibiza-lemon to-ibiza-sky bg-clip-text text-transparent">
                    Radio Ibiza
                  </span>{' '}
                  <span className="text-zinc-100">Player</span>
                </h1>
                {cliente && (
                  <p className="mt-0.5 text-sm text-zinc-500">
                    {cliente.nome} {pdv && <span className="text-zinc-400">· {pdv.nome}</span>}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-xl border border-zinc-600/80 bg-black/30 px-4 py-2 text-xs font-semibold text-zinc-400 transition hover:border-ibiza-magenta/35 hover:text-zinc-200"
              >
                Sair
              </button>
            </header>

            <main className="flex min-h-0 flex-1 flex-col">
              {sincronizandoUi && (
                <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
                  <div className="mb-5 h-11 w-11 animate-spin rounded-full border-2 border-zinc-800 border-t-ibiza-magenta border-r-ibiza-lemon border-b-ibiza-purple" />
                  <p className="text-zinc-300">Baixando programação e agendas…</p>
                  <p className="mt-2 text-xs text-zinc-600">Isso pode levar alguns instantes na primeira vez.</p>
                </div>
              )}

              {!sincronizandoUi && erroSinc && (
                <div className="rounded-2xl border border-red-900/60 bg-red-950/35 px-5 py-4 text-sm text-red-200 shadow-panel">
                  <p>{erroSinc}</p>
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="mt-4 w-full rounded-xl bg-gradient-to-r from-ibiza-magenta via-ibiza-purple to-fuchsia-600 px-4 py-2.5 text-sm font-bold text-white shadow-ibiza-pop transition hover:brightness-110 sm:w-auto"
                  >
                    Tentar novamente
                  </button>
                </div>
              )}

              {!sincronizandoUi && !erroSinc && precisaAguardar === false && (
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                  <PwaInstallBanner />
                  <div className="mb-5 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wider shrink-0">
                    <span className="rounded-full border border-zinc-700/80 bg-black/30 px-3 py-1.5 text-zinc-500 backdrop-blur-sm">
                      Estado:{' '}
                      <span className="font-bold lowercase text-ibiza-magenta">{status}</span>
                    </span>
                    <span className="rounded-full border border-zinc-700/80 bg-black/30 px-3 py-1.5 text-zinc-500 backdrop-blur-sm">
                      Modo:{' '}
                      <span className="font-bold normal-case text-ibiza-purple">{MODO_LABEL[modoReproducao]}</span>
                    </span>
                    {playlistAmbiente && (
                      <span className="rounded-full border border-zinc-700/80 bg-black/30 px-3 py-1.5 text-zinc-500 backdrop-blur-sm">
                        Playlist:{' '}
                        <span className="font-bold normal-case text-ibiza-forest">{playlistAmbiente.nome}</span>
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
                    <div className="mb-4 rounded-xl border border-amber-800/60 bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
                      {erroPlayer}
                    </div>
                  )}

                  {playlistAmbiente && transporteOk && (
                    <div className="relative flex min-h-[min(340px,42vh)] min-h-0 flex-1 flex-col overflow-hidden rounded-[1.25rem] border border-white/10 bg-ibiza-card-wash p-6 shadow-ibiza-pop backdrop-blur-sm sm:min-h-[min(380px,44vh)] sm:p-8 lg:p-10">
                      <div className="pointer-events-none absolute -left-24 top-1/2 z-0 h-64 w-64 -translate-y-1/2 rounded-full bg-ibiza-magenta/20 blur-3xl" />
                      <div className="pointer-events-none absolute -right-20 -top-16 z-0 h-48 w-48 rounded-full bg-ibiza-purple/25 blur-3xl" />
                      <PlayerIbizaArt />
                      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-6">
                        <div className="rounded-2xl border border-zinc-700/80 bg-black/30 px-4 py-4 text-center shadow-inner backdrop-blur-sm sm:px-6 sm:py-4 sm:text-left">
                          {faixaAtual ? (
                            <>
                              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-ibiza-magenta">
                                Tocando agora
                              </p>
                              <p className="mt-2 line-clamp-2 text-base font-semibold leading-snug text-zinc-50 sm:text-lg">
                                {faixaAtual.musica.titulo}
                              </p>
                              <p className="mt-1 line-clamp-1 text-sm text-zinc-400">{faixaAtual.artista.nome}</p>
                            </>
                          ) : !erroPlayer && status === 'tocando' ? (
                            <p className="text-sm text-zinc-500">Preparando a primeira faixa…</p>
                          ) : null}
                        </div>

                        <div className="flex justify-center">
                          {status === 'tocando' ? (
                            <button
                              type="button"
                              onClick={() => setStatus('pausado')}
                              className="rounded-xl border border-zinc-600/80 bg-black/30 px-12 py-3 text-sm font-bold text-zinc-100 shadow-panel transition hover:border-ibiza-magenta/50 hover:text-ibiza-magenta"
                            >
                              Pausar
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setStatus('tocando')}
                              className="rounded-xl bg-gradient-to-r from-ibiza-magenta via-ibiza-purple to-fuchsia-600 px-12 py-3 text-sm font-bold text-white shadow-ibiza-pop transition hover:brightness-110"
                            >
                              Tocar
                            </button>
                          )}
                        </div>

                        <div className="min-h-0 flex-1" aria-hidden />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
