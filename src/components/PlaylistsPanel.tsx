/**
 * Pastas ambiente (tipo N), pastas selecionáveis (nome contém palavras Evento ou Extra),
 * vinhetas VP/VA e «Sincronizar» no rodapé.
 */

import { useEffect, useMemo, useState } from 'react';

import { solicitarAtualizacaoProgramacaoNuvem } from '@/player/programacaoRefresh';
import { useAppStore } from '@/store/app';
import { shellUpdateContextFromLocation, verificarAtualizacaoShell } from '@/player/appShellUpdate';
import type { ProgramacaoSyncApi } from '@/hooks/useProgramacaoSync';
import { resumoPastasAmbienteProgramadas } from '@/player/resumoPastasAmbiente';
import { isPastaNomeAmbienteSelecionavel } from '@/player/pastaSelecionavel';
import { PlayerSubpanelChrome } from '@/components/PlayerSubpanelChrome';

type Props = {
  onClose: () => void;
  programacaoSync: ProgramacaoSyncApi;
  /** Ocupa a mesma área que «Tocando agora» (modo sobreposição). */
  layout?: 'inline' | 'overlay';
};

/** Paleta rotativa — uma cor por pasta/vinheta. */
const CORES_CHIP = [
  'border-emerald-500/55 bg-emerald-700/40 text-emerald-50',
  'border-sky-500/55 bg-sky-700/40 text-sky-50',
  'border-violet-500/55 bg-violet-700/40 text-violet-50',
  'border-amber-500/55 bg-amber-600/45 text-amber-950',
  'border-rose-500/55 bg-rose-700/40 text-rose-50',
  'border-teal-500/55 bg-teal-700/40 text-teal-50',
  'border-indigo-500/55 bg-indigo-700/40 text-indigo-50',
  'border-fuchsia-500/55 bg-fuchsia-700/40 text-fuchsia-50',
  'border-cyan-500/55 bg-cyan-700/40 text-cyan-50',
  'border-orange-500/55 bg-orange-700/45 text-orange-50',
] as const;

function classeCorChip(indiceGlobal: number): string {
  return CORES_CHIP[indiceGlobal % CORES_CHIP.length];
}

export function PlaylistsPanel({ onClose, programacaoSync, layout = 'inline' }: Props) {
  const playlistData = useAppStore((s) => s.playlistData);
  const agendas = useAppStore((s) => s.agendas);
  const token = useAppStore((s) => s.token);
  const online = useAppStore((s) => s.online);
  const status = useAppStore((s) => s.status);
  const pingBloqueado = useAppStore((s) => s.pingBloqueado);
  const programacaoPendente = useAppStore((s) => s.programacaoPendente);
  const prefetchProgramacaoProgress = useAppStore((s) => s.prefetchProgramacaoProgress);

  /** Grade exibida: pacote pendente (já baixado) prevalece sobre o que ainda está a tocar. */
  const playlistExibicao = programacaoPendente?.playlist ?? playlistData;
  const agendasExibicao = programacaoPendente?.agendas ?? agendas;
  const exclusiveAmbientPlaylistId = useAppStore((s) => s.exclusiveAmbientPlaylistId);
  const setExclusiveAmbientPlaylistId = useAppStore((s) => s.setExclusiveAmbientPlaylistId);

  const { precisaAguardar, busy, erroSinc } = programacaoSync;

  const [atualizarBusy, setAtualizarBusy] = useState(false);
  const [atualizarFlash, setAtualizarFlash] = useState<{ kind: 'ok' | 'err'; text: string } | null>(
    null,
  );

  const resumoPastas = useMemo(
    () => resumoPastasAmbienteProgramadas(playlistExibicao?.playlists ?? [], agendasExibicao ?? []),
    [playlistExibicao?.playlists, agendasExibicao],
  );

  const pastasNormais = useMemo(
    () => resumoPastas.filter((p) => !isPastaNomeAmbienteSelecionavel(p.nomePasta)),
    [resumoPastas],
  );

  const pastasSelecionaveis = useMemo(
    () => resumoPastas.filter((p) => isPastaNomeAmbienteSelecionavel(p.nomePasta)),
    [resumoPastas],
  );

  /**
   * Mostra cada FAIXA de vinheta (VP/VA), não cada pasta. Várias agendas que apontam
   * para a mesma faixa colapsam em um único botão (dedup por `musica.id`). Pasta
   * vinheta com mais de uma música — como `VINHETAS-PROGRAMADAS` (Fortaleza Líquida +
   * Dois Pretos) — vira mais de um botão na coluna.
   */
  const vinhetasUnicas = useMemo(() => {
    type LinhaVinheta = {
      key: string;
      titulo: string;
      tipo: 'VP' | 'VA';
      playlistId: number;
    };
    const out: LinhaVinheta[] = [];
    const idsVistos = new Set<number>();
    for (const pl of playlistExibicao?.playlists ?? []) {
      const tipo = String(pl.tipo).toUpperCase();
      if (tipo !== 'VP' && tipo !== 'VA') continue;
      for (const mc of pl.musicas) {
        if (!mc.url_musica?.trim()) continue;
        const mid = Math.trunc(Number(mc.musica.id));
        if (Number.isFinite(mid)) {
          if (idsVistos.has(mid)) continue;
          idsVistos.add(mid);
        }
        const titulo = String(mc.musica.titulo ?? '').trim() || 'Vinheta';
        out.push({
          key: `vh-${pl.id}-${Number.isFinite(mid) ? mid : titulo}`,
          titulo,
          tipo: tipo as 'VP' | 'VA',
          playlistId: pl.id,
        });
      }
    }
    return out.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
  }, [playlistExibicao?.playlists]);

  const sincronizandoUi = precisaAguardar && (busy || !erroSinc);
  const atualizarDesabilitado =
    atualizarBusy ||
    !online ||
    !token?.token ||
    sincronizandoUi ||
    precisaAguardar ||
    status === 'desativado' ||
    pingBloqueado;

  const selecaoPastasBloqueada =
    status === 'desativado' || pingBloqueado || playlistData == null;

  useEffect(() => {
    if (!atualizarFlash) return;
    const t = window.setTimeout(() => setAtualizarFlash(null), 5000);
    return () => window.clearTimeout(t);
  }, [atualizarFlash]);

  async function handleAtualizar(): Promise<void> {
    if (atualizarBusy) return;
    setAtualizarBusy(true);
    setAtualizarFlash(null);
    try {
      const res = await solicitarAtualizacaoProgramacaoNuvem();
      if (res.ok) {
        setAtualizarFlash({ kind: 'ok', text: 'Recebido.' });
        void verificarAtualizacaoShell({ ...shellUpdateContextFromLocation(), motivo: 'sync' });
      } else {
        setAtualizarFlash({ kind: 'err', text: res.error });
      }
    } catch (e) {
      console.error(e);
      setAtualizarFlash({ kind: 'err', text: 'Falha ao sincronizar.' });
    } finally {
      setAtualizarBusy(false);
    }
  }

  const overlay = layout === 'overlay';
  const indiceBaseVinhetas = pastasNormais.length + pastasSelecionaveis.length;
  const listaVazia =
    pastasNormais.length === 0 && pastasSelecionaveis.length === 0 && vinhetasUnicas.length === 0;

  const chipClass =
    'inline-flex w-full min-w-0 cursor-default justify-start rounded-full border px-2.5 py-1 text-left text-[10px] font-semibold leading-tight shadow-sm sm:px-3 sm:py-1.5 sm:text-[11px]';

  return (
    <PlayerSubpanelChrome
      titulo="Playlists"
      accent="forest"
      accentBar={overlay ? 'solid' : 'gradient'}
      chromeDensity={overlay ? 'compact' : 'default'}
      closeDisabled={atualizarBusy}
      onClose={onClose}
      rootClassName={overlay ? 'flex flex-col gap-2 bg-zinc-50 dark:bg-zinc-950' : undefined}
    >
      <div
        className={
          overlay ? 'flex flex-col gap-2 bg-zinc-50 dark:bg-zinc-950' : 'space-y-3'
        }
      >
        {programacaoPendente !== null && (
          <div className="shrink-0">
            <span
              className="inline-flex cursor-help text-[10px] font-semibold uppercase tracking-wide text-amber-600/95"
              title="Sua atualização está sendo baixada e entrará na próxima música."
            >
              Pendente
            </span>
            {prefetchProgramacaoProgress != null && prefetchProgramacaoProgress.total > 0 && (
              <p className="mt-0.5 text-[10px] text-amber-700/90">
                Baixando {prefetchProgramacaoProgress.done}/{prefetchProgramacaoProgress.total}
              </p>
            )}
          </div>
        )}

        {listaVazia ? (
          <p className="rounded-2xl border border-zinc-300 bg-zinc-100 px-3 py-4 text-center text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
            Sem pastas ambiente com faixas nem vinhetas na grade.
          </p>
        ) : (
          <div
            className={
              overlay
                ? 'grid min-h-0 grid-cols-1 gap-3 rounded-xl border border-zinc-200/90 bg-zinc-100/90 p-3 sm:grid-cols-2 sm:gap-4 sm:p-4 dark:border-zinc-700 dark:bg-zinc-900'
                : 'grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4'
            }
          >
            <div className="flex min-h-0 min-w-0 flex-col gap-3">
              <div className="flex min-h-0 min-w-0 flex-col gap-2">
                <h3 className="mb-0.5 border-b border-emerald-800/45 pb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500/90 sm:text-[11px]">
                  Pastas
                </h3>
                {pastasNormais.length > 0 ? (
                  <ul className="flex flex-col gap-1.5" role="list">
                    {pastasNormais.map((linha, i) => (
                      <li key={linha.key} className="min-w-0">
                        <span
                          className={`${chipClass} truncate ${classeCorChip(i)}`}
                          title={linha.tituloExibicao}
                        >
                          {linha.tituloExibicao}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-center text-[11px] text-zinc-500 sm:text-xs">
                    Sem outras pastas ambiente (nome sem Evento nem Extra como palavra separada).
                  </p>
                )}
              </div>

              <div className="flex min-h-0 min-w-0 flex-col gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800 sm:pt-3">
                <h3 className="mb-0.5 border-b border-cyan-900/40 pb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-500/88 sm:text-[11px]">
                  Pastas selecionáveis
                </h3>
                {pastasSelecionaveis.length > 0 ? (
                  <ul className="flex flex-col gap-2" role="list">
                    {pastasSelecionaveis.map((linha, j) => {
                      const marcada = linha.playlistId === exclusiveAmbientPlaylistId;
                      const cor = classeCorChip(pastasNormais.length + j);
                      return (
                        <li key={linha.key} className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                          <span
                            className={`${chipClass} min-w-0 flex-1 truncate ${cor} ${marcada ? 'ring-2 ring-cyan-400/50' : ''}`}
                            title={linha.tituloExibicao}
                          >
                            {linha.tituloExibicao}
                          </span>
                          <button
                            type="button"
                            disabled={selecaoPastasBloqueada}
                            onClick={() =>
                              setExclusiveAmbientPlaylistId(marcada ? null : linha.playlistId)
                            }
                            title={
                              selecaoPastasBloqueada
                                ? 'Indisponível neste estado.'
                                : marcada
                                  ? 'Volta ao sorteio normal das pastas.'
                                  : 'Toca só esta pasta até desmarcar.'
                            }
                            className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide sm:min-w-[7.5rem] sm:px-3 ${
                              selecaoPastasBloqueada
                                ? 'cursor-not-allowed border-zinc-400/50 bg-zinc-200/50 text-zinc-500 opacity-60 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-600'
                                : marcada
                                  ? 'cursor-pointer border-cyan-500/50 bg-cyan-800/35 text-cyan-50 hover:brightness-110'
                                  : 'cursor-pointer border-cyan-600/40 bg-cyan-950/20 text-cyan-100 hover:border-cyan-500/55 hover:brightness-110 dark:bg-cyan-950/35'
                            }`}
                          >
                            {marcada ? 'Desmarcar' : 'Selecionar'}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-center text-[11px] text-zinc-500 sm:text-xs">
                    Nenhuma pasta cujo nome contém «Evento» ou «Extra» tem faixas na grade neste momento.
                  </p>
                )}
              </div>
            </div>

            <div className="flex min-h-0 min-w-0 flex-col gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800 sm:border-t-0 sm:border-l sm:border-zinc-200 sm:pt-0 sm:pl-5 dark:sm:border-zinc-800">
              <h3 className="mb-0.5 border-b border-fuchsia-900/40 pb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-400/88 sm:text-[11px]">
                Vinhetas
              </h3>
              {vinhetasUnicas.length > 0 ? (
                <ul className="flex flex-col gap-1.5" role="list">
                  {vinhetasUnicas.map((v, k) => (
                    <li key={v.key} className="min-w-0">
                      <span
                        className={`${chipClass} truncate ${classeCorChip(indiceBaseVinhetas + k)}`}
                        title={v.titulo}
                      >
                        {v.titulo}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-center text-[11px] text-zinc-500 sm:text-xs">Sem vinhetas na grade.</p>
              )}
            </div>
          </div>
        )}

        <div className="mt-2 shrink-0 flex flex-col gap-2 border-t border-zinc-200 bg-zinc-50/98 pt-3 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={atualizarDesabilitado}
              onClick={() => void handleAtualizar()}
              title={
                atualizarDesabilitado
                  ? !online
                    ? 'Sem internet.'
                    : 'Indisponível neste estado.'
                  : 'Baixa programa e agendas do servidor; a nova grade vale na próxima troca de faixa.'
              }
              aria-busy={atualizarBusy}
              className={`w-full rounded-lg border px-3 py-2 text-[11px] font-bold uppercase tracking-wider shadow-panel transition sm:ml-auto sm:w-auto sm:min-w-[160px] ${
                atualizarDesabilitado
                  ? 'cursor-not-allowed border-zinc-300 bg-zinc-200/60 text-zinc-500 opacity-60 dark:border-zinc-800/90 dark:bg-black/25 dark:text-zinc-600'
                  : 'cursor-pointer border-emerald-500/45 bg-gradient-to-r from-emerald-600/35 via-teal-600/28 to-emerald-800/30 text-emerald-50 hover:border-emerald-400/55 hover:brightness-110'
              }`}
            >
              {atualizarBusy ? 'Sincronizando…' : 'Sincronizar'}
            </button>
          </div>
          {atualizarFlash?.kind === 'ok' && (
            <p className="text-center text-[11px] font-medium text-emerald-400/95 sm:text-right" aria-live="polite">
              {atualizarFlash.text}
            </p>
          )}
          {atualizarFlash?.kind === 'err' && (
            <p
              className="truncate text-center text-[11px] font-medium text-red-400 sm:text-right"
              title={atualizarFlash.text}
            >
              {atualizarFlash.text}
            </p>
          )}
        </div>
      </div>
    </PlayerSubpanelChrome>
  );
}
