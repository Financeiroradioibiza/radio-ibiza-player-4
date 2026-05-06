/**
 * Tela principal do player — reprodução em loop das playlists tipo N (ambiente).
 * Sincroniza /playlist/ e /agendas/ na primeira entrada; engine completa nas próximas etapas do roadmap.
 */

import { useEffect, useMemo, useState } from 'react';

import { useAppStore } from '../store/app';
import { useProgramacaoSync } from '../hooks/useProgramacaoSync';
import { usePingLoop } from '../hooks/usePingLoop';
import { usePlayer } from '../player/loop';
import { isCtrlPlayerEnabled, isCtrlPlacaCarroEnabled } from '../utils/pdvPermissions';
import { mensagemAvisoInscricaoEstadual } from '../utils/pdvAvisoCodificado';
import { PwaInstallBanner } from '../components/PwaInstallBanner';
import { AvisoVeiculosPanel } from '../components/AvisoVeiculosPanel';
import { VinhetasPanel } from '../components/VinhetasPanel';
import { FeedbackPanel } from '../components/FeedbackPanel';
import { PainelAvisoIePdv } from '../components/PainelAvisoIePdv';
import type { SavedVehicleAnnouncementClip } from '../utils/avisoVeiculoText';

const MODO_LABEL: Record<'ambient' | 'vinheta_vp' | 'vinheta_va', string> = {
  ambient: 'Ambiente',
  vinheta_vp: 'Vinheta programada',
  vinheta_va: 'Vinheta agendada',
};

/**
 * Atalhos rápidos — Vinhetas, Aviso veículos e Feedback abrem painéis; Configuração reservada.
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
  { label: 'Feedback', textClass: 'text-ibiza-sky', borderClass: 'border-ibiza-sky/25' },
];

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

type PainelAtalhosInferior = null | 'veiculos' | 'vinhetas' | 'feedback';

export function PlayerPage() {
  const [painelAtalhosInferior, setPainelAtalhosInferior] = useState<PainelAtalhosInferior>(null);
  const [sessaoClipAvisoVeiculo, setSessaoClipAvisoVeiculo] = useState<SavedVehicleAnnouncementClip | null>(
    null,
  );

  const pdv = useAppStore((s) => s.pdv);
  const token = useAppStore((s) => s.token);
  const cliente = useAppStore((s) => s.cliente);
  const clienteIdStore = useAppStore((s) => s.cliente_id);
  const status = useAppStore((s) => s.status);
  const setStatus = useAppStore((s) => s.setStatus);
  const logout = useAppStore((s) => s.logout);

  const { precisaAguardar, busy, erroSinc, refetch } = useProgramacaoSync();
  usePingLoop();
  const {
    faixaAtual,
    playlistAmbiente,
    modoReproducao,
    erro: erroPlayer,
    skipForward,
    skipBack,
  } = usePlayer();

  const sincronizandoUi = precisaAguardar && (busy || !erroSinc);
  const transporteOk = status !== 'desativado' && isCtrlPlayerEnabled(pdv);
  const transporteBloqueado = !transporteOk;
  const avisoVeiculosPermitido =
    transporteOk && isCtrlPlacaCarroEnabled(pdv);

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

  const textoAvisoIe = useMemo(() => mensagemAvisoInscricaoEstadual(pdv), [pdv]);

  /** Mesmo visual dos pills «Estado», «Playlist» no topo da área do player. */
  const idsSessaoPillClass =
    'inline-flex min-h-[2.25rem] max-w-full items-center justify-center rounded-full border border-zinc-700/80 bg-black/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 backdrop-blur-sm';

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

                  {pdv?.ctrl_placa_carro === 'N' && status !== 'desativado' && (
                    <p className="mb-4 text-center text-xs text-zinc-600">
                      Aviso de veículos está desabilitado no cadastro deste PDV (opção «placa de carro» = não).
                    </p>
                  )}

                  {status === 'desativado' && pdv?.status === 'I' && (
                    <div className="mb-4 rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-center text-sm text-amber-100">
                      Este PDV está <strong className="font-semibold text-amber-200">inativo</strong> no cadastro.
                      Reprodução fica bloqueada até o status voltar para ativo no painel (o servidor informa via ping).
                    </div>
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
                          disabled={transporteBloqueado}
                          className={
                            transporteBloqueado
                              ? 'flex h-11 w-11 cursor-not-allowed items-center justify-center rounded-full border border-zinc-700/40 bg-black/20 text-zinc-600 opacity-40'
                              : 'flex h-11 w-11 items-center justify-center rounded-full border border-zinc-600/60 bg-black/35 text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200'
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
                          disabled={transporteBloqueado}
                          className={
                            transporteBloqueado
                              ? 'flex h-11 w-11 cursor-not-allowed items-center justify-center rounded-full border border-zinc-700/40 bg-black/20 text-zinc-600 opacity-40'
                              : 'flex h-11 w-11 items-center justify-center rounded-full border border-zinc-600/60 bg-black/35 text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200'
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

                      <div className="mt-8 border-t border-white/5 pt-6">
                        {painelAtalhosInferior === 'veiculos' ? (
                          <AvisoVeiculosPanel
                            onClose={() => setPainelAtalhosInferior(null)}
                            savedSessionClip={sessaoClipAvisoVeiculo}
                            onSavedSessionClipChange={setSessaoClipAvisoVeiculo}
                          />
                        ) : painelAtalhosInferior === 'vinhetas' ? (
                          <VinhetasPanel onClose={() => setPainelAtalhosInferior(null)} />
                        ) : painelAtalhosInferior === 'feedback' ? (
                          <FeedbackPanel
                            onClose={() => setPainelAtalhosInferior(null)}
                            whatsappWaMeDigits={FEEDBACK_WA_ME}
                            clienteNome={cliente?.nome}
                            clienteId={clienteIdExibicao ?? undefined}
                            pdvNome={pdv?.nome}
                            pdvId={pdvIdExibicao ?? undefined}
                          />
                        ) : (
                          <>
                            <div
                              className={
                                quickActionStyle === 'soft-row'
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
                                    item.label === 'Aviso veículos'
                                      ? () => setPainelAtalhosInferior('veiculos')
                                      : item.label === 'Vinhetas'
                                        ? () => setPainelAtalhosInferior('vinhetas')
                                        : item.label === 'Feedback'
                                          ? () => setPainelAtalhosInferior('feedback')
                                          : noop
                                  }
                                  disabled={item.label === 'Aviso veículos' && !avisoVeiculosPermitido}
                                  title={
                                    item.label === 'Aviso veículos' && !avisoVeiculosPermitido
                                      ? 'Desabilitado pelo painel (controle do player ou aviso de veículo)'
                                      : undefined
                                  }
                                  className={
                                    item.label === 'Aviso veículos' && !avisoVeiculosPermitido
                                      ? `${quickActionButtonClasses(item)} cursor-not-allowed opacity-40`
                                      : quickActionButtonClasses(item)
                                  }
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                            <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-2">
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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

                              {/* Colunas alinhadas ao WhatsApp: cliente | cadastro (largura Col. Cobrança) | PDV */}
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
                                <div className="flex justify-center">
                                  <span
                                    className={idsSessaoPillClass}
                                    aria-label={
                                      clienteIdExibicao != null
                                        ? `Cliente número ${clienteIdExibicao} (referência do servidor)`
                                        : 'Cliente (ID ainda indisponível)'
                                    }
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
                                  className="flex min-h-[2.25rem] w-full items-center justify-center rounded-full border border-amber-500/80 bg-gradient-to-r from-amber-400/95 to-yellow-400/95 px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-amber-950 shadow-sm transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                                >
                                  Atualização de cadastro
                                </a>
                                <div className="flex justify-center">
                                  <span
                                    className={idsSessaoPillClass}
                                    aria-label={
                                      pdvIdExibicao != null
                                        ? `PDV número ${pdvIdExibicao} (referência do servidor)`
                                        : 'PDV (ID ainda indisponível)'
                                    }
                                  >
                                    PDV:{' '}
                                    <span className="ml-1 font-bold normal-case tracking-normal text-ibiza-sky">
                                      {pdvIdExibicao ?? '—'}
                                    </span>
                                  </span>
                                </div>
                              </div>

                              <PainelAvisoIePdv texto={textoAvisoIe} />
                            </div>
                          </>
                        )}
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
