/**
 * Pastas de música tipo (N) — lista e ação «Sincronizar» no rodapé.
 */

import { useEffect, useMemo, useState } from 'react';

import { solicitarAtualizacaoProgramacaoNuvem } from '@/player/programacaoRefresh';
import { useAppStore } from '@/store/app';
import type { ProgramacaoSyncApi } from '@/hooks/useProgramacaoSync';
import { resumoPastasAmbienteProgramadas } from '@/player/resumoPastasAmbiente';
import { PlayerSubpanelChrome, listaCardIbiza } from '@/components/PlayerSubpanelChrome';

type Props = {
  onClose: () => void;
  programacaoSync: ProgramacaoSyncApi;
  /** Ocupa a mesma área que «Tocando agora» (modo sobreposição). */
  layout?: 'inline' | 'overlay';
};

export function PlaylistsPanel({ onClose, programacaoSync, layout = 'inline' }: Props) {
  const playlistData = useAppStore((s) => s.playlistData);
  const agendas = useAppStore((s) => s.agendas);
  const token = useAppStore((s) => s.token);
  const online = useAppStore((s) => s.online);
  const status = useAppStore((s) => s.status);
  const pingBloqueado = useAppStore((s) => s.pingBloqueado);
  const programacaoPendente = useAppStore((s) => s.programacaoPendente);

  const { precisaAguardar, busy, erroSinc } = programacaoSync;

  const [atualizarBusy, setAtualizarBusy] = useState(false);
  const [atualizarFlash, setAtualizarFlash] = useState<{ kind: 'ok' | 'err'; text: string } | null>(
    null,
  );

  const resumo = useMemo(
    () => resumoPastasAmbienteProgramadas(playlistData?.playlists ?? [], agendas ?? []),
    [playlistData?.playlists, agendas],
  );

  const sincronizandoUi = precisaAguardar && (busy || !erroSinc);
  const atualizarDesabilitado =
    atualizarBusy ||
    !online ||
    !token?.token ||
    sincronizandoUi ||
    precisaAguardar ||
    status === 'desativado' ||
    pingBloqueado;

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

  return (
    <PlayerSubpanelChrome
      titulo="Playlists"
      accent="forest"
      closeDisabled={atualizarBusy}
      onClose={onClose}
      rootClassName={overlay ? 'flex h-full min-h-0 flex-col space-y-3' : undefined}
      bodyClassName={overlay ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : undefined}
    >
      <div
        className={overlay ? 'flex min-h-0 flex-1 flex-col gap-2 overflow-hidden' : 'space-y-3'}
      >
        {programacaoPendente !== null && (
          <div className="shrink-0">
            <span
              className="inline-flex cursor-help text-[10px] font-semibold uppercase tracking-wide text-amber-600/95"
              title="Programação já baixada; entra na próxima troca de faixa."
            >
              Pendente
            </span>
          </div>
        )}

        {resumo.length === 0 ? (
          <p className="rounded-2xl border border-white/[0.07] bg-zinc-950/40 px-3 py-4 text-center text-xs text-zinc-100">
            Sem pastas ambiente com faixas.
          </p>
        ) : (
          <ul
            className={
              overlay
                ? 'min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pr-0.5'
                : 'space-y-2'
            }
          >
            {resumo.map((linha) => {
              const tooltipHorarios = linha.linhasHorario.join('\n');
              const inlineHorarios = linha.linhasHorario.join(' · ');
              return (
                <li
                  key={linha.key}
                  title={tooltipHorarios}
                  className={`${listaCardIbiza('forest')} !py-2.5 !pt-2.5 sm:!px-3 sm:!py-3 cursor-help`}
                >
                  <p className="text-[13px] font-semibold leading-snug text-zinc-100">{linha.tituloExibicao}</p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-zinc-100">{inlineHorarios}</p>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-2 shrink-0 flex flex-col gap-2 border-t border-white/10 pt-3">
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
                  ? 'cursor-not-allowed border-zinc-800/90 bg-black/25 text-zinc-600 opacity-50'
                  : 'cursor-help border-emerald-500/45 bg-gradient-to-r from-emerald-600/35 via-teal-600/28 to-emerald-800/30 text-emerald-50 hover:border-emerald-400/55 hover:brightness-110'
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
