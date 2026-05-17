/**
 * Tela principal do player — reprodução em loop das playlists tipo N (ambiente).
 * Sincroniza /playlist/ e /agendas/ na primeira entrada; engine completa nas próximas etapas do roadmap.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { clsx } from 'clsx';

import { usePlayerViewportScale } from '@/hooks/usePlayerViewportScale';
import { useAppStore } from '../store/app';
import { useProgramacaoSync } from '../hooks/useProgramacaoSync';
import { useAtlAutomatico } from '../hooks/useAtlAutomatico';
import { usePingLoop } from '../hooks/usePingLoop';
import { usePlayer } from '../player/loop';
import { isCtrlPlacaCarroEnabled } from '../utils/pdvPermissions';
import { mensagensAvisoVermelhoCadastroPdv } from '../utils/pdvAvisoCodificado';
import { PwaInstallBanner } from '../components/PwaInstallBanner';
import { ThemeToggle } from '../components/ThemeToggle';
import { ShoppingPanel } from '../components/ShoppingPanel';
import { FeedbackPanel } from '../components/FeedbackPanel';
import { PlaylistsPanel } from '../components/PlaylistsPanel';
import { PainelAvisoIePdv } from '../components/PainelAvisoIePdv';
import type { SavedVehicleAnnouncementClip } from '../utils/avisoVeiculoText';

/** Cartão principal — mock `radio_ibiza_player.html` (#1a1525); largura um pouco maior que 380px para caber os três WhatsApp (ex.: «Atendimento»). */
const PLAYER_CARD_ROOT_CLASS =
  'mx-auto flex w-full max-w-[420px] min-h-[440px] min-w-[272px] shrink-0 flex-col';

type PainelAtalhosInferior = null | 'shopping' | 'playlists' | 'feedback';

/** Mesmo dígito «wa.me» usado pelo atalho de Feedback (WhatsApp pré-preenchido). */
const FEEDBACK_WA_ME = '5521997595141';

/** Links WhatsApp (`wa.me`) — rótulos alinhados ao mock HTML (Financeiro = linha Cobrança). */
const WHATSAPP_BOTOES_CONTATO: ReadonlyArray<{ label: string; waMe: string }> = [
  { label: 'Suporte', waMe: FEEDBACK_WA_ME },
  { label: 'Financeiro', waMe: '5521998314822' },
  { label: 'Atendimento', waMe: '5521997040227' },
];

/** Formulário de dados no site da Rádio Ibiza — abre noutra aba. */
const CADASTRO_RADIO_IBIZA_URL = 'https://cadastro-radioibiza.netlify.app/';

function IconSkipBack({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 18V6h2v12H6zm3.5-6L18 6v12l-8.5-6z" />
    </svg>
  );
}

function IconSkipForward({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18 18V6h-2v12h2zm-3.5-6L6 6v12l8.5-6z" />
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

function IconBrandWhatsApp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

export function PlayerPage() {
  const [painelAtalhosInferior, setPainelAtalhosInferior] = useState<PainelAtalhosInferior>(null);
  const [sessaoClipAvisoVeiculo, setSessaoClipAvisoVeiculo] = useState<SavedVehicleAnnouncementClip | null>(
    null,
  );

  const playerCardRef = useRef<HTMLDivElement>(null);
  const viewportFit = usePlayerViewportScale(playerCardRef);

  const pdv = useAppStore((s) => s.pdv);
  const token = useAppStore((s) => s.token);
  const cliente = useAppStore((s) => s.cliente);
  const clienteIdStore = useAppStore((s) => s.cliente_id);
  const pingBloqueadoStore = useAppStore((s) => s.pingBloqueado);
  const bloqueioSerialInstalacao = useAppStore((s) => s.bloqueioSerialInstalacao);
  const programacaoPendente = useAppStore((s) => s.programacaoPendente);
  const playlistData = useAppStore((s) => s.playlistData);
  const status = useAppStore((s) => s.status);
  const conviteGesturaAudio = useAppStore((s) => s.conviteGesturaAudio);
  const setStatus = useAppStore((s) => s.setStatus);

  const programacaoSync = useProgramacaoSync();
  const { precisaAguardar, busy, erroSinc, refetch } = programacaoSync;
  usePingLoop();
  const {
    faixaAtual,
    playlistAmbiente,
    erro: erroPlayer,
    skipForward,
    skipBack,
  } = usePlayer();

  const sincronizandoUi = precisaAguardar && (busy || !erroSinc);

  const atlAutomaticoAtivo =
    !!token?.token &&
    !erroSinc &&
    precisaAguardar === false &&
    playlistData !== null &&
    !pingBloqueadoStore &&
    !bloqueioSerialInstalacao;
  useAtlAutomatico(atlAutomaticoAtivo);

  const transporteOk = status !== 'desativado';
  const transporteBloqueado = !transporteOk;
  const avisoVeiculosPermitido = transporteOk && isCtrlPlacaCarroEnabled(pdv);

  /**
   * `ctrl_player` / `ctrl_playlists` = só aviso vermelho (cadastro / financeiro), sem bloquear o player.
   * Este <details> explica apenas quando o Shopping está fechado por `ctrl_placa_carro=N`.
   */
  const mostrarDetalheRestricaoPlaca =
    status !== 'desativado' && pdv != null && pdv.ctrl_placa_carro === 'N';

  /**
   * Nome mostrado no header «▸ TOCANDO · ...».
   *
   * Estratégia: sempre que houver `faixaAtual`, procuramos no payload de
   * playlists qual delas contém aquela música — não importa o tipo (N
   * ambiente, VP programada, VA agendada). Isso resolve dois casos de uma
   * só vez:
   *
   *  1. Pastas ambiente mescladas (2+ com `tocar_sempre=S` ou agendas
   *     coincidentes): `playlistAmbiente` é uma playlist «virtual» com id
   *     negativo. Sem busca dinâmica, o header mostraria «MIX · 3 PASTAS»;
   *     com a busca, mostra a pasta real da faixa atual (BRASILIDADES, JAZZ
   *     ANIMADO, POP RADIO...).
   *  2. Vinhetas (VP/VA) tocando entre músicas: `playlistAmbiente` continua
   *     sendo a pasta ambiente do slot, mas a faixa atual é da vinheta. A
   *     busca acha a playlist da vinheta e mostra o nome dela
   *     («VINHETAS-AGENDADAS», ou o nome que o painel deu).
   *
   * Fallbacks (na ordem):
   *  - faixa atual encontrada no payload → nome da playlist dona.
   *  - sem match (música órfã) → nome de `playlistAmbiente` (pasta real ou
   *    nome composto «MIX · ...»).
   *  - sem playlist nenhuma → «SET».
   */
  const nomePastaExibida = useMemo(() => {
    const idMusicaAtual = faixaAtual?.musica?.id;
    const pastas = playlistData?.playlists ?? [];
    if (typeof idMusicaAtual === 'number' && pastas.length > 0) {
      const dona = pastas.find((p) =>
        (p.musicas ?? []).some((m) => m?.musica?.id === idMusicaAtual),
      );
      if (dona?.nome) return dona.nome;
    }
    return playlistAmbiente?.nome ?? 'SET';
  }, [playlistAmbiente, faixaAtual, playlistData]);

  const subpainelCobreAreaPrincipal = painelAtalhosInferior !== null;
  /** Modais fixos (playlists, feedback, shopping) não escurecem nem bloqueiam o cartão do player. */
  const painelEscureceEFixaConteudo =
    subpainelCobreAreaPrincipal &&
    painelAtalhosInferior !== 'playlists' &&
    painelAtalhosInferior !== 'feedback' &&
    painelAtalhosInferior !== 'shopping';

  useEffect(() => {
    if (!token) {
      setSessaoClipAvisoVeiculo(null);
    }
  }, [token]);

  /** IDs vindos do webservice na sessão (ex.: cliente 3, PDV 9766). */
  const clienteIdExibicao = cliente?.id ?? clienteIdStore;
  const pdvIdExibicao = pdv?.id;

  const textosAvisoCadastro = useMemo(() => mensagensAvisoVermelhoCadastroPdv(pdv, cliente), [pdv, cliente]);

  return (
    <div
      className="relative mx-auto min-w-0 max-w-full shrink-0 overflow-visible"
      style={
        viewportFit.boxW > 0
          ? {
              width: viewportFit.boxW,
              maxWidth: '100%',
              height: viewportFit.boxH,
            }
          : undefined
      }
    >
      <div
        ref={playerCardRef}
        className={PLAYER_CARD_ROOT_CLASS}
        style={
          viewportFit.scale < 1
            ? {
                transform: `scale(${viewportFit.scale})`,
                transformOrigin: 'top center',
              }
            : undefined
        }
      >
      <div className="w-full min-h-0 flex-1">
        <div className="relative flex min-h-0 max-h-[min(96dvh,920px)] flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-[#f8f5fc] p-4 shadow-xl dark:border-white/[0.08] dark:bg-[#1a1525]">
            {bloqueioSerialInstalacao && (
              <div
                className="absolute inset-0 z-[60] flex flex-col items-center justify-center overflow-y-auto rounded-[1.28rem] bg-zinc-900/40 px-4 py-8 backdrop-blur-[3px] dark:bg-black/50"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="bloqueio-serial-titulo"
                aria-describedby="bloqueio-serial-texto"
              >
                <div className="max-w-md text-center">
                  <p
                    id="bloqueio-serial-titulo"
                    className="text-lg font-semibold leading-snug text-zinc-900 sm:text-xl dark:text-zinc-50"
                  >
                    Player desativado
                  </p>
                  <p
                    id="bloqueio-serial-texto"
                    className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200"
                  >
                    Esta instalação não corresponde mais ao cadastro no painel — a chave foi renovada ou o ponto
                    foi reconfigurado. A reprodução foi interrompida.
                  </p>
                  <div className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {WHATSAPP_BOTOES_CONTATO.map((w) => (
                      <a
                        key={w.waMe}
                        href={`https://wa.me/${w.waMe}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Abrir WhatsApp — ${w.label}`}
                        className="flex items-center justify-center gap-2 rounded-xl border border-emerald-600/70 bg-emerald-600/90 px-3 py-2.5 text-center text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                      >
                        <svg
                          className="h-4 w-4 shrink-0"
                          viewBox="0 0 24 24"
                          aria-hidden
                          fill="currentColor"
                        >
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                        </svg>
                        WhatsApp · {w.label}
                      </a>
                    ))}
                  </div>
                  <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">
                    Fale com a equipe para revalidar esta instalação no painel.
                  </p>
                </div>
              </div>
            )}

            <div
              className={
                bloqueioSerialInstalacao ? 'pointer-events-none select-none opacity-[0.35]' : ''
              }
            >
            <header className="relative mb-3.5 shrink-0 px-0.5 text-center">
              <div className="absolute left-0 top-0 z-[5]">
                <ThemeToggle />
              </div>
              <div className="absolute right-0 top-1 flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-500">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600 dark:bg-emerald-500" aria-hidden />
                online
              </div>
              <div className="bg-gradient-to-r from-[#ff4d8d] via-[#ffb84d] to-[#4dd0ff] bg-clip-text text-[28px] font-medium leading-none text-transparent">
                Radio Ibiza
              </div>
              <p className="mt-1 text-[10px] text-zinc-500 dark:text-white/50">
                {cliente ? (
                  <>
                    <span className="uppercase tracking-wide">{cliente.nome}</span>
                    {pdv && (
                      <>
                        {' '}
                        <span className="text-zinc-300 dark:text-white/30">·</span> {pdv.nome}
                      </>
                    )}
                  </>
                ) : (
                  <>RADIOIBIZA · Player 4.0</>
                )}
              </p>
            </header>

            <main className="relative flex min-h-0 flex-1 flex-col">
              {sincronizandoUi && (
                <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
                  <div className="mb-5 h-11 w-11 animate-spin rounded-full border-2 border-zinc-200 border-t-ibiza-magenta border-r-ibiza-lemon border-b-ibiza-purple dark:border-zinc-800" />
                  <p className="text-zinc-600 dark:text-zinc-300">Baixando programação e agendas…</p>
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-600">Isso pode levar alguns instantes na primeira vez.</p>
                </div>
              )}

              {!sincronizandoUi && erroSinc && (
                <div className="rounded-2xl border border-red-300/90 bg-red-50/95 px-5 py-4 text-sm text-red-900 shadow-panel dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-200">
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
                <>
                  <div
                    className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto transition-opacity duration-200 ${
                      painelEscureceEFixaConteudo
                        ? 'pointer-events-none select-none opacity-[0.28]'
                        : ''
                    }`}
                    aria-hidden={painelEscureceEFixaConteudo ? true : undefined}
                  >
                    <PwaInstallBanner />

                    {programacaoPendente !== null && (
                      <div className="mb-3 text-center sm:mb-4">
                        <p
                          className="cursor-help text-[10px] font-medium text-amber-600/95 sm:text-[11px]"
                          title="Programação já recebida; aplica na próxima troca de faixa, avanço manual ou vinheta."
                        >
                          Programação nova pendente — entra na próxima troca.
                        </p>
                      </div>
                    )}

                    <PainelAvisoIePdv textos={textosAvisoCadastro} />

                    {status === 'desativado' && pdv?.status === 'I' && (
                      <div className="mb-3 rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2.5 text-center text-xs text-amber-950 sm:mb-4 sm:px-4 sm:text-sm dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
                        Este PDV está{' '}
                        <strong className="font-semibold text-amber-800 dark:text-amber-200">inativo</strong> no cadastro.
                        Reprodução fica bloqueada até o status voltar para ativo no painel (o servidor informa via ping).
                      </div>
                    )}

                    {erroPlayer && (
                      <div className="mb-3 rounded-xl border border-amber-300/80 bg-amber-50/90 px-3 py-2.5 text-xs text-amber-950 sm:mb-4 sm:px-4 sm:text-sm dark:border-amber-800/60 dark:bg-amber-950/25 dark:text-amber-100">
                        {erroPlayer}
                      </div>
                    )}

                    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2.5 pb-1">
                      <div className="shrink-0 rounded-[14px] border border-zinc-200/90 bg-gradient-to-br from-[#ff4d8d]/12 via-[#a878ff]/10 to-[#4dd0ff]/08 p-3.5 text-center dark:border-white/10 dark:from-[#ff4d8d]/15 dark:via-[#a878ff]/12 dark:to-[#4dd0ff]/10">
                        <div className="mb-1.5 text-[9px] tracking-[1.5px] text-[#ff4d8d]">
                          ▸ TOCANDO · {nomePastaExibida.toUpperCase()}
                        </div>
                        {faixaAtual ? (
                          <>
                            <p className="truncate text-[15px] font-medium text-zinc-900 dark:text-white">
                              {faixaAtual.musica.titulo}
                            </p>
                            <p className="mb-2.5 truncate text-[11px] text-zinc-600 dark:text-white/60">
                              {faixaAtual.artista.nome}
                            </p>
                          </>
                        ) : !erroPlayer && status === 'tocando' ? (
                          <p className="mb-2.5 truncate text-[11px] text-zinc-500 dark:text-white/50">
                            Preparando a primeira faixa…
                          </p>
                        ) : (
                          <p className="mb-2.5 truncate text-[11px] text-zinc-500 dark:text-white/45">
                            Aguardando reprodução…
                          </p>
                        )}

                        <div className="flex items-center justify-center gap-3">
                          <button
                            type="button"
                            disabled={transporteBloqueado}
                            className={
                              transporteBloqueado
                                ? 'flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-full bg-zinc-200/90 text-zinc-700 opacity-40 dark:bg-white/[0.08] dark:text-white'
                                : 'flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-zinc-200/90 text-zinc-800 transition hover:bg-zinc-300/90 dark:bg-white/[0.08] dark:text-white dark:hover:bg-white/[0.15]'
                            }
                            title={
                              transporteBloqueado
                                ? 'Controle desabilitado no painel'
                                : 'Reinicia a faixa ou volta à anterior (ambiente)'
                            }
                            aria-label="Faixa anterior"
                            onClick={() => skipBack()}
                          >
                            <IconSkipBack className="h-4 w-4" />
                          </button>

                          <div
                            className={transporteBloqueado ? 'pointer-events-none opacity-40' : ''}
                            title={transporteBloqueado ? 'Controle desabilitado no painel' : undefined}
                          >
                            {status === 'tocando' ? (
                              <button
                                type="button"
                                onClick={() => setStatus('pausado')}
                                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[#ff4d8d] text-white transition hover:scale-105"
                                title="Pausar"
                                aria-label="Pausar"
                              >
                                <IconPause className="h-5 w-5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setStatus('tocando')}
                                className={clsx(
                                  'flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[#ff4d8d] text-white transition hover:scale-105',
                                  conviteGesturaAudio &&
                                    'animate-ibiza-play-beacon ring-2 ring-[#facc15]/90 ring-offset-2 ring-offset-[#f5f3f9] dark:ring-offset-[#121014]',
                                )}
                                title={
                                  conviteGesturaAudio ? 'Toque para iniciar o som' : 'Tocar'
                                }
                                aria-label={conviteGesturaAudio ? 'Iniciar som' : 'Tocar'}
                              >
                                <IconPlay className="h-5 w-5 translate-x-px" />
                              </button>
                            )}
                          </div>

                          <button
                            type="button"
                            disabled={transporteBloqueado}
                            className={
                              transporteBloqueado
                                ? 'flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-full bg-zinc-200/90 text-zinc-700 opacity-40 dark:bg-white/[0.08] dark:text-white'
                                : 'flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-zinc-200/90 text-zinc-800 transition hover:bg-zinc-300/90 dark:bg-white/[0.08] dark:text-white dark:hover:bg-white/[0.15]'
                            }
                            title={
                              transporteBloqueado
                                ? 'Controle desabilitado no painel'
                                : 'Avançar faixa ou iniciar próxima vinheta disponível'
                            }
                            aria-label="Próxima faixa"
                            onClick={() => skipForward()}
                          >
                            <IconSkipForward className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid shrink-0 grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          disabled={!avisoVeiculosPermitido}
                          title={
                            !avisoVeiculosPermitido
                              ? 'Shopping indisponível para este cadastro (placa de carro).'
                              : 'Shopping — avisos de veículo'
                          }
                          onClick={() => setPainelAtalhosInferior('shopping')}
                          className={
                            !avisoVeiculosPermitido
                              ? 'cursor-not-allowed rounded-lg border border-[#ffa54d]/30 px-1 py-2 text-[11px] font-medium text-[#ffa54d]/40 opacity-50'
                              : 'cursor-pointer rounded-lg border border-[#ffa54d]/50 bg-transparent px-1 py-2 text-[11px] font-medium text-[#ffa54d] transition hover:bg-[#ffa54d]/10'
                          }
                        >
                          Shopping
                        </button>
                        <button
                          type="button"
                          title="Playlists — pasta ambiente"
                          onClick={() => setPainelAtalhosInferior('playlists')}
                          className="cursor-pointer rounded-lg border border-[#a878ff]/50 bg-transparent px-1 py-2 text-[11px] font-medium text-[#a878ff] transition hover:bg-[#a878ff]/10"
                        >
                          Playlists
                        </button>
                        <button
                          type="button"
                          title="Feedback — WhatsApp"
                          onClick={() => setPainelAtalhosInferior('feedback')}
                          className="cursor-pointer rounded-lg border border-[#4dd0ff]/50 bg-transparent px-1 py-2 text-[11px] font-medium text-[#4dd0ff] transition hover:bg-[#4dd0ff]/10"
                        >
                          Feedback
                        </button>
                      </div>

                      <div className="grid min-w-0 shrink-0 grid-cols-3 gap-1 sm:gap-1.5">
                        {WHATSAPP_BOTOES_CONTATO.map((w) => (
                          <a
                            key={w.waMe}
                            href={`https://wa.me/${w.waMe}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            lang="pt-BR"
                            aria-label={`Abrir WhatsApp — ${w.label}`}
                            title={`Abre conversa no WhatsApp — ${w.label}.`}
                            className="flex min-h-[2.75rem] min-w-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg bg-emerald-600 px-1 py-1.5 text-center text-[10px] font-medium leading-tight text-white transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 sm:min-h-[3rem] sm:px-1.5 sm:text-[11px]"
                          >
                            <IconBrandWhatsApp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            <span className="w-full min-w-0 hyphens-none whitespace-nowrap text-center tracking-tight">
                              {w.label}
                            </span>
                          </a>
                        ))}
                      </div>

                      <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 px-0.5 pt-0.5">
                        <p className="min-w-0 justify-self-start text-[10px] leading-snug text-zinc-500 dark:text-white/50">
                          Cliente{' '}
                          <span className="font-medium text-zinc-800 dark:text-white" title="Referência do servidor">
                            {clienteIdExibicao ?? '—'}
                          </span>
                        </p>
                        <a
                          href={CADASTRO_RADIO_IBIZA_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Abrir atualização de cadastro (abre noutro separador)"
                          title="Formulário de atualização de cadastro da Rádio Ibiza (abre noutro separador)."
                          className="shrink-0 justify-self-center whitespace-nowrap rounded-md border border-amber-600/70 px-2 py-1 text-center text-[10px] font-medium leading-none text-amber-800 transition hover:bg-amber-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 dark:border-yellow-400 dark:text-yellow-400 dark:hover:bg-yellow-400/10 dark:focus-visible:ring-yellow-400/50"
                        >
                          Atualizar cadastro
                        </a>
                        <p className="min-w-0 justify-self-end text-right text-[10px] leading-snug text-zinc-500 dark:text-white/50">
                          PDV{' '}
                          <span
                            className="font-medium text-sky-700 dark:text-[#4dd0ff]"
                            title="Referência do servidor"
                          >
                            {pdvIdExibicao ?? '—'}
                          </span>
                        </p>
                      </div>

                      {mostrarDetalheRestricaoPlaca && (
                        <details className="shrink-0 rounded-xl border border-zinc-200/90 bg-zinc-100/70 px-3 py-2 text-left dark:border-white/5 dark:bg-black/15 [&_summary::-webkit-details-marker]:hidden [&_summary]:list-none">
                          <summary className="cursor-pointer select-none text-center text-xs font-semibold text-zinc-600 underline-offset-2 transition hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-300">
                            Restrições do cadastro deste PDV
                          </summary>
                          <div className="mt-2 space-y-2 text-center text-xs text-zinc-700 dark:text-zinc-600">
                            <p
                              className="cursor-help"
                              title="O cadastro deste PDV não permite o módulo Shopping (avisos de veículo)."
                            >
                              Shopping (avisos de veículo e locução por texto) está desabilitado neste PDV — opção «placa de
                              carro» = não no cadastro.
                            </p>
                          </div>
                        </details>
                      )}
                    </div>
                  </div>

                </>
              )}
            </main>
          </div>
          </div>
        </div>
      </div>

      {painelAtalhosInferior === 'playlists' && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            className="absolute inset-0 bg-black/35 backdrop-blur-[2px] transition hover:bg-black/40 dark:bg-black/55 dark:hover:bg-black/60"
            aria-label="Fechar playlists"
            onClick={() => setPainelAtalhosInferior(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Playlists"
            className="relative z-10 h-fit w-full max-w-[400px] max-h-[min(85dvh,520px)] overflow-x-hidden overflow-y-auto rounded-2xl border border-[#a878ff]/35 bg-zinc-50 p-2.5 shadow-[0_28px_70px_rgba(0,0,0,0.22)] ring-1 ring-zinc-200/80 dark:border-[#a878ff]/45 dark:bg-zinc-950 dark:shadow-[0_28px_70px_rgba(0,0,0,0.72)] dark:ring-white/10 sm:p-3"
          >
            <PlaylistsPanel
              layout="overlay"
              onClose={() => setPainelAtalhosInferior(null)}
              programacaoSync={programacaoSync}
            />
          </div>
        </div>
      )}

      {painelAtalhosInferior === 'shopping' && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            className="absolute inset-0 bg-black/35 backdrop-blur-[2px] transition hover:bg-black/40 dark:bg-black/55 dark:hover:bg-black/60"
            aria-label="Fechar shopping"
            onClick={() => setPainelAtalhosInferior(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Shopping"
            className="relative z-10 flex h-[min(85dvh,520px)] min-h-0 w-full max-w-[400px] flex-col overflow-hidden rounded-2xl border border-[#ffa54d]/35 bg-zinc-50 p-2.5 shadow-[0_28px_70px_rgba(0,0,0,0.22)] ring-1 ring-zinc-200/80 dark:border-[#ffa54d]/45 dark:bg-zinc-950 dark:shadow-[0_28px_70px_rgba(0,0,0,0.72)] dark:ring-white/10 sm:p-3"
          >
            <ShoppingPanel
              layout="overlay"
              onClose={() => setPainelAtalhosInferior(null)}
              savedSessionClip={sessaoClipAvisoVeiculo}
              onSavedSessionClipChange={setSessaoClipAvisoVeiculo}
            />
          </div>
        </div>
      )}

      {painelAtalhosInferior === 'feedback' && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            className="absolute inset-0 bg-black/35 backdrop-blur-[2px] transition hover:bg-black/40 dark:bg-black/55 dark:hover:bg-black/60"
            aria-label="Fechar feedback"
            onClick={() => setPainelAtalhosInferior(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Feedback"
            className="relative z-10 h-fit w-full max-w-[400px] max-h-[min(85dvh,520px)] overflow-x-hidden overflow-y-auto rounded-2xl border border-[#4dd0ff]/35 bg-zinc-50 p-2.5 shadow-[0_28px_70px_rgba(0,0,0,0.22)] ring-1 ring-zinc-200/80 dark:border-[#4dd0ff]/45 dark:bg-zinc-950 dark:shadow-[0_28px_70px_rgba(0,0,0,0.72)] dark:ring-white/10 sm:p-3"
          >
            <FeedbackPanel
              layout="overlay"
              onClose={() => setPainelAtalhosInferior(null)}
              clienteNome={cliente?.nome}
              clienteId={clienteIdExibicao ?? undefined}
              pdvNome={pdv?.nome}
              pdvId={pdvIdExibicao ?? undefined}
            />
          </div>
        </div>
      )}

    </div>
  );
}
