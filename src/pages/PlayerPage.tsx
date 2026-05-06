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

const MODO_LABEL: Record<'ambient' | 'vinheta_vp' | 'vinheta_va', string> = {
  ambient: 'Ambiente',
  vinheta_vp: 'Vinheta programada',
  vinheta_va: 'Vinheta agendada',
};

/** Logo oficial (PNG transparente — marca no topo do player) */
const BRAND_LOGO_PNG = 'https://assinatura-logo.netlify.app/logo.png';

/**
 * Atalhos rápidos — só UI por enquanto (clique noop).
 *
 * Três estilos possíveis (troque `quickActionStyle` para experimentar):
 * - `glass-pills`: cápsulas translúcidas + texto colorido (implementado abaixo)
 * - `soft-row`: linha única com separadores verticais discretos (só texto)
 * - `filled-compact`: blocos levemente mais sólidos em grid 2×3
 */
type QuickActionStyle = 'glass-pills' | 'soft-row' | 'filled-compact';

const quickActionStyle: QuickActionStyle = 'filled-compact';

const QUICK_ACTIONS: ReadonlyArray<{
  label: string;
  textClass: string;
  borderClass: string;
}> = [
  { label: 'Vinhetas', textClass: 'text-ibiza-magenta', borderClass: 'border-ibiza-magenta/25' },
  { label: 'Aviso veículos', textClass: 'text-amber-400/90', borderClass: 'border-amber-500/20' },
  { label: 'Configuração', textClass: 'text-ibiza-purple', borderClass: 'border-ibiza-purple/25' },
  { label: 'Suporte', textClass: 'text-ibiza-sky', borderClass: 'border-ibiza-sky/25' },
  { label: 'Contatos', textClass: 'text-ibiza-lemon/90', borderClass: 'border-ibiza-lemon/25' },
];

function IconSkipBack({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 18V6h2v12H6zm3.5-6L18 6v12l-8.5-6z" />
    </svg>
  );
}

function IconPlay({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}

function IconPause({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
    </svg>
  );
}

function IconSkipForward({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16 18h-2V6h2v12zM6 6l8.5 6L6 18V6z" />
    </svg>
  );
}

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
  const transporteBloqueado = !transporteOk;

  const noop = (): void => {
    /* reservado: rotas futuras */
  };

  function quickActionButtonClasses(item: (typeof QUICK_ACTIONS)[number]): string {
    const base =
      'text-sm font-medium transition select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20';
    if (quickActionStyle === 'soft-row') {
      return `${base} rounded-lg px-3 py-2 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200 ${item.textClass}`;
    }
    if (quickActionStyle === 'filled-compact') {
      return `${base} rounded-xl border ${item.borderClass} bg-zinc-950/70 px-4 py-3 ${item.textClass} hover:bg-zinc-900/90`;
    }
    /* glass-pills */
    return `${base} rounded-full border ${item.borderClass} bg-white/[0.04] px-4 py-2 backdrop-blur-sm ${item.textClass} hover:bg-white/[0.08]`;
  }

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

      <div className="w-full min-h-0 flex-1">
        <div className="rounded-[1.35rem] bg-gradient-to-br from-ibiza-magenta/55 via-ibiza-purple/35 to-ibiza-lemon/25 p-px shadow-ibiza-pop">
          <div className="flex min-h-[min(560px,calc(100dvh-11rem))] min-h-0 flex-col rounded-[1.3rem] border border-white/10 bg-zinc-950/75 p-6 shadow-panel backdrop-blur-md sm:min-h-[min(620px,calc(100dvh-10rem))] sm:p-8">
            <header className="relative mb-6 border-b border-white/10 pb-6">
              <button
                type="button"
                onClick={() => void logout()}
                className="absolute right-0 top-0 rounded-xl border border-zinc-600/80 bg-black/30 px-4 py-2 text-xs font-semibold text-zinc-400 transition hover:border-ibiza-magenta/35 hover:text-zinc-200"
              >
                Sair
              </button>

              <div className="px-4 pt-1 text-center sm:px-12">
                <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                  <span className="bg-gradient-to-r from-ibiza-magenta via-ibiza-lemon to-ibiza-sky bg-clip-text text-transparent">
                    Radio Ibiza
                  </span>
                </h1>

                {cliente && (
                  <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
                    <p className="text-sm text-zinc-500">
                      <span className="font-medium text-zinc-300">{cliente.nome}</span>
                      {pdv && (
                        <>
                          {' '}
                          <span className="text-zinc-600">·</span>{' '}
                          <span className="text-zinc-400">{pdv.nome}</span>
                        </>
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={noop}
                      className="inline-flex cursor-default items-center gap-1.5 rounded-full border border-zinc-600/45 bg-zinc-950/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 transition hover:border-zinc-500/50 hover:text-zinc-400"
                      aria-label="Sessão ativa"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" aria-hidden />
                      sessão
                    </button>
                  </div>
                )}
              </div>
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
                  <div className="mb-5 flex flex-wrap justify-center gap-2 text-[11px] font-semibold uppercase tracking-wider shrink-0">
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
                    <p className="mb-4 text-center text-xs text-zinc-600">
                      Controle local de play/pausa está desabilitado pelo painel (ctrl_player=N).
                    </p>
                  )}

                  {pdv?.ctrl_playlists === 'N' && status !== 'desativado' && (
                    <p className="mb-4 text-center text-xs text-zinc-600">
                      Troca manual de playlist está desabilitada pelo painel.
                    </p>
                  )}

                  {erroPlayer && (
                    <div className="mb-4 rounded-xl border border-amber-800/60 bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
                      {erroPlayer}
                    </div>
                  )}

                  {playlistAmbiente && (
                    <div className="flex min-h-[min(300px,38vh)] min-h-0 flex-1 flex-col overflow-hidden rounded-[1.25rem] border border-white/10 bg-zinc-950/55 p-6 sm:min-h-[min(340px,40vh)] sm:p-8">
                      <div className="rounded-2xl border border-zinc-700/80 bg-black/30 px-4 py-4 text-center backdrop-blur-sm sm:px-6 sm:py-4">
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
                        ) : (
                          <p className="text-sm text-zinc-600">Aguardando reprodução…</p>
                        )}
                      </div>

                      <div className="mt-6 flex items-center justify-center gap-4 sm:gap-6">
                        <button
                          type="button"
                          className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-600/60 bg-black/35 text-zinc-500 transition hover:border-zinc-500 hover:text-zinc-300 disabled:cursor-not-allowed"
                          disabled
                          title="Em breve"
                          aria-label="Faixa anterior"
                          onClick={noop}
                        >
                          <IconSkipBack className="h-5 w-5" />
                        </button>

                        <div
                          className={transporteBloqueado ? 'pointer-events-none opacity-40' : ''}
                          title={transporteBloqueado ? 'Controle desabilitado no painel' : undefined}
                        >
                          {status === 'tocando' ? (
                            <button
                              type="button"
                              onClick={() => setStatus('pausado')}
                              className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-zinc-900/90 text-zinc-100 shadow-panel transition hover:border-ibiza-magenta/40"
                              aria-label="Pausar"
                            >
                              <IconPause className="h-7 w-7" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setStatus('tocando')}
                              className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-ibiza-magenta via-ibiza-purple to-fuchsia-600 text-white shadow-ibiza-pop transition hover:brightness-110"
                              aria-label="Tocar"
                            >
                              <IconPlay className="h-7 w-7 translate-x-0.5" />
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-600/60 bg-black/35 text-zinc-500 transition hover:border-zinc-500 hover:text-zinc-300 disabled:cursor-not-allowed"
                          disabled
                          title="Em breve"
                          aria-label="Próxima faixa"
                          onClick={noop}
                        >
                          <IconSkipForward className="h-5 w-5" />
                        </button>
                      </div>

                      <div
                        className={
                          quickActionStyle === 'soft-row'
                            ? 'mt-8 flex flex-wrap items-center justify-center gap-1 border-t border-white/5 pt-6'
                            : quickActionStyle === 'filled-compact'
                              ? 'mt-8 grid grid-cols-2 gap-2 border-t border-white/5 pt-6 sm:grid-cols-3'
                              : 'mt-8 flex flex-wrap justify-center gap-2 border-t border-white/5 pt-6'
                        }
                      >
                        {QUICK_ACTIONS.map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={noop}
                            className={quickActionButtonClasses(item)}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>

                      <div className="min-h-0 flex-1" aria-hidden />
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
