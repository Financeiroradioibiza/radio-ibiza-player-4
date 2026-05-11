/**
 * Tela principal do player — reprodução em loop das playlists tipo N (ambiente).
 * Sincroniza /playlist/ e /agendas/ na primeira entrada; engine completa nas próximas etapas do roadmap.
 */

import { useEffect, useMemo, useState } from 'react';

import { useAppStore } from '../store/app';
import { useProgramacaoSync } from '../hooks/useProgramacaoSync';
import { useAtlAutomatico } from '../hooks/useAtlAutomatico';
import { usePingLoop } from '../hooks/usePingLoop';
import { usePlayer } from '../player/loop';
import { isCtrlPlayerEnabled, isCtrlPlacaCarroEnabled } from '../utils/pdvPermissions';
import { mensagensAvisoVermelhoCadastroPdv } from '../utils/pdvAvisoCodificado';
import { PwaInstallBanner } from '../components/PwaInstallBanner';
import { ShoppingPanel } from '../components/ShoppingPanel';
import { FeedbackPanel } from '../components/FeedbackPanel';
import { PlaylistsPanel } from '../components/PlaylistsPanel';
import { PainelAvisoIePdv } from '../components/PainelAvisoIePdv';
import type { SavedVehicleAnnouncementClip } from '../utils/avisoVeiculoText';

/**
 * Atalhos rápidos — abrem painéis com o mesmo tema visual Ibiza escuro / acentos.
 *
 * Estilos possíveis (troque `quickActionStyle` para experimentar):
 * - `glass-pills`: cápsulas translúcidas + texto colorido (implementado abaixo)
 * - `soft-row`: linha única com separadores verticais discretos (só texto)
 * - `filled-compact`: blocos levemente mais sólidos em grid 2×3
 * - `dock-row`: fila compacta (estilo dock) para layout mobile-first
 */
type QuickActionStyle = 'glass-pills' | 'soft-row' | 'filled-compact' | 'dock-row';

/** Layout compacto (mock «player fechado» + folha inferior ao abrir menu). */
const quickActionStyle: QuickActionStyle = 'dock-row';

/**
 * Escala visual do cartão inteiro (1 = 100%). ~0.7 → sensação de «70%» em tipografia, botões e ícones.
 * Usa CSS `zoom` (bom em Chromium/WebKit; Firefox pode ignorar — fallback é layout ao tamanho normal).
 */
const PLAYER_UI_SCALE = 0.7;

const QUICK_ACTIONS: ReadonlyArray<{
  label: string;
  textClass: string;
  borderClass: string;
}> = [
  { label: 'Shopping', textClass: 'text-amber-400/90', borderClass: 'border-amber-500/20' },
  { label: 'Playlists', textClass: 'text-ibiza-purple', borderClass: 'border-ibiza-purple/25' },
  { label: 'Feedback', textClass: 'text-ibiza-sky', borderClass: 'border-ibiza-sky/25' },
];

const QUICK_ACTION_TOOLTIPS: Readonly<Record<string, string>> = {
  Shopping: 'Avisos de veículo e locução por texto (se o PDV permitir).',
  Playlists: 'Pastas ambiente, vinhetas da grade e sincronizar com o servidor.',
  Feedback: 'Abre o formulário para falar com a equipe.',
};

/** Mesmo dígito «wa.me» usado pelo atalho de Feedback (WhatsApp pré-preenchido). */
const FEEDBACK_WA_ME = '5521997595141';

/** Links WhatsApp (`wa.me` — apenas dígitos, sem +). */
const WHATSAPP_BOTOES_CONTATO: ReadonlyArray<{ label: string; waMe: string }> = [
  { label: 'Suporte', waMe: FEEDBACK_WA_ME },
  { label: 'Cobrança', waMe: '5521998314822' },
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

type PainelAtalhosInferior = null | 'shopping' | 'playlists' | 'feedback';

export function PlayerPage() {
  const [painelAtalhosInferior, setPainelAtalhosInferior] = useState<PainelAtalhosInferior>(null);
  const [sessaoClipAvisoVeiculo, setSessaoClipAvisoVeiculo] = useState<SavedVehicleAnnouncementClip | null>(
    null,
  );

  const pdv = useAppStore((s) => s.pdv);
  const token = useAppStore((s) => s.token);
  const cliente = useAppStore((s) => s.cliente);
  const clienteIdStore = useAppStore((s) => s.cliente_id);
  const pingBloqueadoStore = useAppStore((s) => s.pingBloqueado);
  const bloqueioSerialInstalacao = useAppStore((s) => s.bloqueioSerialInstalacao);
  const programacaoPendente = useAppStore((s) => s.programacaoPendente);
  const playlistData = useAppStore((s) => s.playlistData);
  const status = useAppStore((s) => s.status);
  const setStatus = useAppStore((s) => s.setStatus);

  const programacaoSync = useProgramacaoSync();
  const { precisaAguardar, busy, erroSinc, refetch, midiaDownload } = programacaoSync;
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
    !sincronizandoUi &&
    !erroSinc &&
    precisaAguardar === false &&
    playlistData !== null &&
    !pingBloqueadoStore &&
    !bloqueioSerialInstalacao;
  useAtlAutomatico(atlAutomaticoAtivo);

  const transporteOk = status !== 'desativado' && isCtrlPlayerEnabled(pdv);
  const transporteBloqueado = !transporteOk;
  const avisoVeiculosPermitido =
    transporteOk && isCtrlPlacaCarroEnabled(pdv);

  /** Pelo menos um aviso de restrição (cadastro PDV); mostrado dentro de <details> para poupar linhas. */
  const temAvisosRestricaoCadastroPdv =
    status !== 'desativado' &&
    pdv != null &&
    (pdv.ctrl_player === 'N' || pdv.ctrl_playlists === 'N' || pdv.ctrl_placa_carro === 'N');

  const subpainelCobreAreaPrincipal = painelAtalhosInferior !== null;
  /** Shopping escurece e bloqueia o restante; Playlists e Feedback deixam o player legível e utilizável. */
  const painelEscureceEFixaConteudo =
    subpainelCobreAreaPrincipal &&
    painelAtalhosInferior !== 'playlists' &&
    painelAtalhosInferior !== 'feedback';

  useEffect(() => {
    if (!token) {
      setSessaoClipAvisoVeiculo(null);
    }
  }, [token]);

  const noop = (): void => {
    /* reservado: rotas futuras */
  };

  /** IDs vindos do webservice na sessão (ex.: cliente 3, PDV 9766). */
  const clienteIdExibicao = cliente?.id ?? clienteIdStore;
  const pdvIdExibicao = pdv?.id;

  const textosAvisoCadastro = useMemo(() => mensagensAvisoVermelhoCadastroPdv(pdv, cliente), [pdv, cliente]);

  /** Mesmo visual dos pills «Online», «Playlist» no topo da área do player. */
  const idsSessaoPillClass =
    'inline-flex min-h-[2.25rem] max-w-full items-center justify-center rounded-full border border-zinc-700/80 bg-black/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 backdrop-blur-sm';

  function quickActionButtonClasses(item: (typeof QUICK_ACTIONS)[number]): string {
    const base =
      'text-sm font-medium transition select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20';
    if (quickActionStyle === 'dock-row') {
      return `${base} shrink-0 rounded-xl border ${item.borderClass} bg-zinc-950/85 px-3 py-2.5 text-xs sm:px-4 sm:text-sm ${item.textClass} hover:bg-zinc-900/95`;
    }
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
    <div
      className="mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col px-3 py-4 sm:max-w-xl sm:px-5 sm:py-6 lg:max-w-2xl"
      style={{ zoom: PLAYER_UI_SCALE }}
    >
      <div className="w-full min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col rounded-[1.35rem] bg-gradient-to-br from-ibiza-magenta/55 via-ibiza-purple/35 to-ibiza-lemon/25 p-px shadow-ibiza-pop">
          <div className="relative flex min-h-0 max-h-[min(96dvh,920px)] flex-1 flex-col overflow-hidden rounded-[1.3rem] border border-white/10 bg-zinc-950/75 p-4 shadow-panel backdrop-blur-md sm:p-5">
            {bloqueioSerialInstalacao && (
              <div
                className="absolute inset-0 z-[60] flex flex-col items-center justify-center overflow-y-auto rounded-[1.28rem] bg-black/50 px-4 py-8 backdrop-blur-[3px]"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="bloqueio-serial-titulo"
                aria-describedby="bloqueio-serial-texto"
              >
                <div className="max-w-md text-center">
                  <p
                    id="bloqueio-serial-titulo"
                    className="text-lg font-semibold leading-snug text-zinc-50 sm:text-xl"
                  >
                    Player desativado
                  </p>
                  <p id="bloqueio-serial-texto" className="mt-3 text-sm leading-relaxed text-zinc-200">
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
                  <p className="mt-6 text-xs text-zinc-400">
                    Fale com a equipe para revalidar esta instalação no painel.
                  </p>
                </div>
              </div>
            )}

            {precisaAguardar && midiaDownload && (
              <div
                className="absolute inset-0 z-[55] flex flex-col items-center justify-center overflow-y-auto rounded-[1.28rem] bg-zinc-950/88 px-5 py-10 backdrop-blur-md"
                role="status"
                aria-live="polite"
                aria-busy="true"
              >
                <div className="w-full max-w-md text-center">
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-ibiza-magenta/90">
                    Rádio Ibiza
                  </p>
                  <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-zinc-50 sm:text-3xl">
                    Bem-vindo
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                    Estamos baixando toda a programação para a memória deste aparelho. Quando a barra
                    completar, você poderá tocar (o navegador pode pedir um toque para liberar o som).
                  </p>
                  <div className="mt-8 w-full">
                    <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                      <span>Baixando faixas</span>
                      <span className="tabular-nums text-ibiza-lemon/90">
                        {midiaDownload.done} / {midiaDownload.total}
                      </span>
                    </div>
                    <div className="mt-2 h-4 w-full overflow-hidden rounded-full border border-white/15 bg-black/50 shadow-inner">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-ibiza-magenta via-ibiza-purple to-ibiza-lemon transition-[width] duration-300 ease-out"
                        style={{
                          width:
                            midiaDownload.total > 0
                              ? `${Math.min(100, Math.round((midiaDownload.done / midiaDownload.total) * 100))}%`
                              : '0%',
                        }}
                      />
                    </div>
                  </div>
                  <p className="mt-6 text-xs text-zinc-500">
                    Dúvidas ou suporte — fale com a gente no WhatsApp.
                  </p>
                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {WHATSAPP_BOTOES_CONTATO.map((w) => (
                      <a
                        key={w.waMe}
                        href={`https://wa.me/${w.waMe}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center rounded-xl border border-emerald-600/60 bg-emerald-700/25 px-2 py-2.5 text-center text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-600/35"
                      >
                        {w.label}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div
              className={
                bloqueioSerialInstalacao ? 'pointer-events-none select-none opacity-[0.35]' : ''
              }
            >
            <header className="shrink-0 border-b border-white/10 pb-3 sm:pb-4">
              <div className="px-1 pt-0.5 text-center sm:px-4">
                <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                  <span className="bg-gradient-to-r from-ibiza-magenta via-ibiza-lemon to-ibiza-sky bg-clip-text text-transparent">
                    Radio Ibiza
                  </span>
                </h1>

                {cliente && (
                  <div className="mt-2 flex flex-col items-center justify-center sm:mt-3">
                    <p className="max-w-[95%] truncate text-center text-xs text-zinc-500 sm:text-sm">
                      <span className="font-medium text-zinc-300">{cliente.nome}</span>
                      {pdv && (
                        <>
                          {' '}
                          <span className="text-zinc-600">·</span>{' '}
                          <span className="text-zinc-400">{pdv.nome}</span>
                        </>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </header>

            <main className="relative flex min-h-0 flex-1 flex-col">
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
                <>
                  <div
                    className={`flex min-h-0 flex-1 flex-col overflow-y-auto transition-opacity duration-200 ${
                      painelEscureceEFixaConteudo
                        ? 'pointer-events-none select-none opacity-[0.28]'
                        : ''
                    }`}
                    aria-hidden={painelEscureceEFixaConteudo ? true : undefined}
                  >
                    <PwaInstallBanner />
                    <div className="mb-3 flex flex-wrap justify-center gap-2 text-[10px] font-semibold uppercase tracking-wider sm:mb-4 sm:text-[11px]">
                      {cliente && (
                        <span
                          role="status"
                          className={`${idsSessaoPillClass} cursor-help gap-1.5 normal-case lowercase`}
                          title="Login e PDV válidos: o player permanece ativo neste aparelho até você sair."
                          aria-label="Online: login e PDV selecionados com sucesso"
                        >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/90" aria-hidden />
                          online
                        </span>
                      )}
                      {playlistAmbiente && (
                        <span
                          className={`${idsSessaoPillClass} cursor-help`}
                          title="Pasta ambiente em uso — conforme a grade de horários do servidor ou «tocar sempre»."
                        >
                          Playlist:{' '}
                          <span className="font-bold normal-case text-ibiza-forest">{playlistAmbiente.nome}</span>
                        </span>
                      )}
                    </div>

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
                      <div className="mb-3 rounded-xl border border-amber-900/50 bg-amber-950/20 px-3 py-2.5 text-center text-xs text-amber-100 sm:mb-4 sm:px-4 sm:text-sm">
                        Este PDV está <strong className="font-semibold text-amber-200">inativo</strong> no cadastro.
                        Reprodução fica bloqueada até o status voltar para ativo no painel (o servidor informa via ping).
                      </div>
                    )}

                    {erroPlayer && (
                      <div className="mb-3 rounded-xl border border-amber-800/60 bg-amber-950/25 px-3 py-2.5 text-xs text-amber-100 sm:mb-4 sm:px-4 sm:text-sm">
                        {erroPlayer}
                      </div>
                    )}

                    <div className="flex min-h-0 flex-1 flex-col gap-3 pb-1">
                      {playlistAmbiente && (
                        <div className="flex shrink-0 flex-col overflow-hidden rounded-[1.15rem] border border-white/10 bg-zinc-950/55 p-4 sm:rounded-[1.25rem] sm:p-5">
                          <div className="rounded-xl border border-zinc-700/80 bg-black/30 px-3 py-3 text-center backdrop-blur-sm sm:rounded-2xl sm:px-5 sm:py-3.5">
                            {faixaAtual ? (
                              <>
                                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-ibiza-magenta sm:text-[10px] sm:tracking-[0.22em]">
                                  Tocando agora
                                </p>
                                <p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-zinc-50 sm:mt-2 sm:text-base">
                                  {faixaAtual.musica.titulo}
                                </p>
                                <p className="mt-0.5 line-clamp-1 text-xs text-zinc-400 sm:text-sm">
                                  {faixaAtual.artista.nome}
                                </p>
                              </>
                            ) : !erroPlayer && status === 'tocando' ? (
                              <p className="text-xs text-zinc-500 sm:text-sm">Preparando a primeira faixa…</p>
                            ) : (
                              <p className="text-xs text-zinc-600 sm:text-sm">Aguardando reprodução…</p>
                            )}
                          </div>

                          <div className="mt-4 flex items-center justify-center gap-3 sm:mt-5 sm:gap-5">
                            <button
                              type="button"
                              disabled={transporteBloqueado}
                              className={
                                transporteBloqueado
                                  ? 'flex h-10 w-10 cursor-not-allowed items-center justify-center rounded-full border border-zinc-700/40 bg-black/20 text-zinc-600 opacity-40 sm:h-11 sm:w-11'
                                  : 'flex h-10 w-10 cursor-help items-center justify-center rounded-full border border-zinc-600/60 bg-black/35 text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200 sm:h-11 sm:w-11'
                              }
                              title={
                                transporteBloqueado
                                  ? 'Controle desabilitado no painel'
                                  : 'Reinicia a faixa ou volta à anterior (ambiente)'
                              }
                              aria-label="Faixa anterior"
                              onClick={() => skipBack()}
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
                                  className="flex h-12 w-12 cursor-help items-center justify-center rounded-full border border-white/10 bg-zinc-900/90 text-zinc-100 shadow-panel transition hover:border-ibiza-magenta/40 sm:h-14 sm:w-14"
                                  title="Pausar"
                                  aria-label="Pausar"
                                >
                                  <IconPause className="h-6 w-6 sm:h-7 sm:w-7" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setStatus('tocando')}
                                  className="flex h-12 w-12 cursor-help items-center justify-center rounded-full bg-gradient-to-r from-ibiza-magenta via-ibiza-purple to-fuchsia-600 text-white shadow-ibiza-pop transition hover:brightness-110 sm:h-14 sm:w-14"
                                  title="Tocar"
                                  aria-label="Tocar"
                                >
                                  <IconPlay className="h-6 w-6 translate-x-0.5 sm:h-7 sm:w-7" />
                                </button>
                              )}
                            </div>

                            <button
                              type="button"
                              disabled={transporteBloqueado}
                              className={
                                transporteBloqueado
                                  ? 'flex h-10 w-10 cursor-not-allowed items-center justify-center rounded-full border border-zinc-700/40 bg-black/20 text-zinc-600 opacity-40 sm:h-11 sm:w-11'
                                  : 'flex h-10 w-10 cursor-help items-center justify-center rounded-full border border-zinc-600/60 bg-black/35 text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200 sm:h-11 sm:w-11'
                              }
                              title={
                                transporteBloqueado
                                  ? 'Controle desabilitado no painel'
                                  : 'Avançar faixa ou iniciar próxima vinheta disponível'
                              }
                              aria-label="Próxima faixa"
                              onClick={() => skipForward()}
                            >
                              <IconSkipForward className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="shrink-0 rounded-[1.1rem] border border-white/10 bg-black/20 px-2 py-2.5 sm:rounded-[1.2rem] sm:px-3 sm:py-3">
                        <div
                          className={
                            quickActionStyle === 'dock-row'
                              ? 'flex flex-nowrap justify-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:justify-center'
                              : quickActionStyle === 'soft-row'
                                ? 'flex flex-wrap items-center justify-center gap-1'
                                : quickActionStyle === 'filled-compact'
                                  ? 'grid grid-cols-2 gap-2 sm:grid-cols-4'
                                  : 'flex flex-wrap justify-center gap-2'
                          }
                        >
                          {QUICK_ACTIONS.map((item) => (
                            <button
                              key={item.label}
                              type="button"
                              onClick={
                                item.label === 'Shopping'
                                  ? () => setPainelAtalhosInferior('shopping')
                                  : item.label === 'Playlists'
                                    ? () => setPainelAtalhosInferior('playlists')
                                    : item.label === 'Feedback'
                                      ? () => setPainelAtalhosInferior('feedback')
                                      : noop
                              }
                              disabled={item.label === 'Shopping' && !avisoVeiculosPermitido}
                              title={
                                item.label === 'Shopping' && !avisoVeiculosPermitido
                                  ? 'Desabilitado pelo painel (controle do player ou aviso de veículo).'
                                  : QUICK_ACTION_TOOLTIPS[item.label]
                              }
                              className={
                                item.label === 'Shopping' && !avisoVeiculosPermitido
                                  ? `${quickActionButtonClasses(item)} cursor-not-allowed opacity-40`
                                  : `${quickActionButtonClasses(item)} cursor-help`
                              }
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="shrink-0 space-y-4 rounded-[1.05rem] border border-white/10 bg-zinc-950/40 px-3 pb-4 pt-3 sm:px-4">
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            {WHATSAPP_BOTOES_CONTATO.map((w) => (
                              <a
                                key={w.waMe}
                                href={`https://wa.me/${w.waMe}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Abrir WhatsApp — ${w.label}`}
                                title={`Abre conversa no WhatsApp — ${w.label}.`}
                                className="flex cursor-help items-center justify-center gap-2 rounded-xl border border-emerald-600/70 bg-emerald-600/90 px-3 py-2.5 text-center text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
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

                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
                            <div className="flex justify-center">
                              <span
                                className={`${idsSessaoPillClass} cursor-help`}
                                aria-label={
                                  clienteIdExibicao != null
                                    ? `Cliente número ${clienteIdExibicao} (referência do servidor)`
                                    : 'Cliente (ID ainda indisponível)'
                                }
                                title="Identificador do cliente no cadastro (referência do servidor)."
                              >
                                Cliente:{' '}
                                <span className="ml-1 font-bold normal-case tracking-normal text-ibiza-lemon">
                                  {clienteIdExibicao ?? '—'}
                                </span>
                              </span>
                            </div>
                            <a
                              href={CADASTRO_RADIO_IBIZA_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="Abrir atualização de cadastro (abre noutro separador)"
                              title="Formulário de atualização de cadastro da Rádio Ibiza (abre noutro separador)."
                              className="flex min-h-[2.25rem] w-full cursor-help items-center justify-center rounded-full border border-amber-500/80 bg-gradient-to-r from-amber-400/95 to-yellow-400/95 px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-amber-950 shadow-sm transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                            >
                              Atualização de cadastro
                            </a>
                            <div className="flex justify-center">
                              <span
                                className={`${idsSessaoPillClass} cursor-help`}
                                aria-label={
                                  pdvIdExibicao != null
                                    ? `PDV número ${pdvIdExibicao} (referência do servidor)`
                                    : 'PDV (ID ainda indisponível)'
                                }
                                title="Identificador do ponto de venda no cadastro (referência do servidor)."
                              >
                                PDV:{' '}
                                <span className="ml-1 font-bold normal-case tracking-normal text-ibiza-sky">
                                  {pdvIdExibicao ?? '—'}
                                </span>
                              </span>
                            </div>
                          </div>

                          {temAvisosRestricaoCadastroPdv && (
                            <details className="rounded-xl border border-white/5 bg-black/15 px-3 py-2 text-left [&_summary::-webkit-details-marker]:hidden [&_summary]:list-none">
                              <summary className="cursor-pointer select-none text-center text-xs font-semibold text-zinc-500 underline-offset-2 transition hover:text-zinc-300">
                                Restrições do cadastro deste PDV
                              </summary>
                              <div className="mt-2 space-y-2 text-center text-xs text-zinc-600">
                                {pdv?.ctrl_player === 'N' && (
                                  <p className="cursor-help" title="O painel desativou botões de transporte neste PDV.">
                                    Controle local de play/pausa está desabilitado pelo painel (ctrl_player=N).
                                  </p>
                                )}
                                {pdv?.ctrl_playlists === 'N' && (
                                  <p className="cursor-help" title="Troca manual de pasta ambiente não permitida para este PDV.">
                                    Troca manual de playlist está desabilitada pelo painel.
                                  </p>
                                )}
                                {pdv?.ctrl_placa_carro === 'N' && (
                                  <p
                                    className="cursor-help"
                                    title="O cadastro deste PDV não permite o módulo Shopping (avisos de veículo)."
                                  >
                                    Shopping (avisos de veículo e locução por texto) está desabilitado neste PDV — opção
                                    «placa de carro» = não no cadastro.
                                  </p>
                                )}
                              </div>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>

                  {subpainelCobreAreaPrincipal && (
                    <>
                      {painelAtalhosInferior !== 'playlists' && painelAtalhosInferior !== 'feedback' && (
                        <button
                          type="button"
                          className="absolute inset-0 z-30 rounded-b-[1.15rem] bg-black/55 backdrop-blur-[1.5px] transition hover:bg-black/60 sm:rounded-b-[1.2rem]"
                          aria-label="Fechar painel"
                          onClick={() => setPainelAtalhosInferior(null)}
                        />
                      )}
                      <div
                        className={
                          painelAtalhosInferior === 'shopping'
                            ? 'absolute inset-0 z-40 flex min-h-0 flex-col overflow-hidden rounded-[1.28rem] bg-zinc-950 p-3 ring-1 ring-zinc-700/70 sm:p-4'
                            : painelAtalhosInferior === 'feedback'
                              ? 'absolute inset-x-0 bottom-0 top-[clamp(10rem,28dvh,42vh)] z-40 flex min-h-0 flex-col overflow-hidden rounded-t-[1.35rem] border border-zinc-700 bg-zinc-950 p-3 pb-5 shadow-[0_-8px_24px_rgba(0,0,0,0.55)] sm:inset-x-1 sm:top-[clamp(9.25rem,26dvh,40vh)] sm:p-4 sm:pb-6'
                              : 'absolute inset-x-0 bottom-0 top-[clamp(11.5rem,34dvh,46vh)] z-40 flex min-h-0 flex-col overflow-hidden rounded-t-[1.35rem] border border-zinc-700 bg-zinc-950 p-3 pb-4 shadow-[0_-8px_24px_rgba(0,0,0,0.55)] sm:inset-x-1 sm:top-[clamp(11rem,32dvh,44vh)] sm:p-4 sm:pb-5'
                        }
                        role="dialog"
                        aria-modal="true"
                        aria-label={
                          painelAtalhosInferior === 'shopping'
                            ? 'Shopping'
                            : painelAtalhosInferior === 'playlists'
                              ? 'Playlists'
                              : painelAtalhosInferior === 'feedback'
                                ? 'Feedback'
                                : 'Painel'
                        }
                      >
                        {painelAtalhosInferior === 'playlists' && (
                          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                            <PlaylistsPanel
                              layout="overlay"
                              onClose={() => setPainelAtalhosInferior(null)}
                              programacaoSync={programacaoSync}
                            />
                          </div>
                        )}
                        {painelAtalhosInferior === 'shopping' && (
                          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                            <ShoppingPanel
                              layout="overlay"
                              onClose={() => setPainelAtalhosInferior(null)}
                              savedSessionClip={sessaoClipAvisoVeiculo}
                              onSavedSessionClipChange={setSessaoClipAvisoVeiculo}
                            />
                          </div>
                        )}
                        {painelAtalhosInferior === 'feedback' && (
                          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                            <FeedbackPanel
                              layout="overlay"
                              onClose={() => setPainelAtalhosInferior(null)}
                              clienteNome={cliente?.nome}
                              clienteId={clienteIdExibicao ?? undefined}
                              pdvNome={pdv?.nome}
                              pdvId={pdvIdExibicao ?? undefined}
                            />
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </main>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
