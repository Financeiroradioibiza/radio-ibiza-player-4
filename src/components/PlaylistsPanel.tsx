/**
 * Pastas de música programadas (playlists tipo N) com nomes legíveis e horários vindos das agendas.
 * Ação «Atualizar» — mesmo fluxo de antes no topo (ping + /playlist + /agendas, programação pendente).
 */

import { useEffect, useMemo, useState } from 'react';

import { solicitarAtualizacaoProgramacaoNuvem } from '@/player/programacaoRefresh';
import { useAppStore } from '@/store/app';
import { useProgramacaoSync } from '@/hooks/useProgramacaoSync';
import { resumoPastasAmbienteProgramadas } from '@/player/resumoPastasAmbiente';
import { PlayerSubpanelChrome, listaCardIbiza } from '@/components/PlayerSubpanelChrome';

type Props = {
  onClose: () => void;
};

export function PlaylistsPanel({ onClose }: Props) {
  const playlistData = useAppStore((s) => s.playlistData);
  const agendas = useAppStore((s) => s.agendas);
  const token = useAppStore((s) => s.token);
  const online = useAppStore((s) => s.online);
  const status = useAppStore((s) => s.status);
  const pingBloqueado = useAppStore((s) => s.pingBloqueado);
  const programacaoPendente = useAppStore((s) => s.programacaoPendente);

  const { precisaAguardar, busy, erroSinc } = useProgramacaoSync();

  const [atualizarBusy, setAtualizarBusy] = useState(false);
  const [atualizarFlash, setAtualizarFlash] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const programaNome = playlistData?.programa?.nome?.trim();
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
    const t = window.setTimeout(() => setAtualizarFlash(null), 8200);
    return () => window.clearTimeout(t);
  }, [atualizarFlash]);

  async function handleAtualizar(): Promise<void> {
    if (atualizarBusy) return;
    setAtualizarBusy(true);
    setAtualizarFlash(null);
    try {
      const res = await solicitarAtualizacaoProgramacaoNuvem();
      if (res.ok) {
        setAtualizarFlash({
          kind: 'ok',
          text:
            'Lista nova recebida. Permissões e status do PDV foram conferidos no servidor. A faixa atual segue até o fim; na próxima troca vale a programação nova.',
        });
      } else {
        setAtualizarFlash({ kind: 'err', text: res.error });
      }
    } catch (e) {
      console.error(e);
      setAtualizarFlash({ kind: 'err', text: 'Falha ao atualizar. Tente de novo.' });
    } finally {
      setAtualizarBusy(false);
    }
  }

  return (
    <PlayerSubpanelChrome
      titulo="Playlists"
      accent="forest"
      closeDisabled={atualizarBusy}
      subtitulo={
        programaNome
          ? `Pastas de ambiente configuradas neste programa: «${programaNome}». Horários são os que vieram das agendas ligadas ao ponto nesta sessão.`
          : 'Pastas de ambiente configuradas nesta sessão, com horários das agendas quando existirem.'
      }
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className={listaCardIbiza('forest')}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-ibiza-forest/85">
            Sincronizar com o servidor
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
            Baixa programação e agendas, atualiza no aparelho o cadastro do PDV (player, playlists, veículos, status).
            Não corta a faixa — entra na próxima troca.
          </p>
          <button
            type="button"
            disabled={atualizarDesabilitado}
            onClick={() => void handleAtualizar()}
            title={
              atualizarDesabilitado
                ? !online
                  ? 'Sem internet — conecte para atualizar.'
                  : 'Atualizar indisponível neste estado do player.'
                : 'Baixar listas atualizadas e conferir permissões do PDV no servidor.'
            }
            aria-busy={atualizarBusy}
            className={`mt-4 w-full rounded-xl border px-4 py-3 text-[12px] font-bold uppercase tracking-wider shadow-panel transition sm:w-auto sm:min-w-[200px] ${
              atualizarDesabilitado
                ? 'cursor-not-allowed border-zinc-800/90 bg-black/25 text-zinc-600 opacity-50'
                : 'border-emerald-500/45 bg-gradient-to-r from-emerald-600/35 via-teal-600/28 to-emerald-800/30 text-emerald-50 hover:border-emerald-400/55 hover:brightness-110'
            }`}
          >
            {atualizarBusy ? 'ATUALIZAR…' : 'ATUALIZAR'}
          </button>
          {programacaoPendente !== null && (
            <p className="mt-3 text-[11px] font-medium leading-snug text-amber-600/95">
              Há lista nova já recebida — entra na próxima troca de faixa (fim da música, avançar ou vinheta).
            </p>
          )}
          {atualizarFlash?.kind === 'ok' && (
            <p className="mt-3 text-xs font-medium text-emerald-400/95">{atualizarFlash.text}</p>
          )}
          {atualizarFlash?.kind === 'err' && (
            <p className="mt-3 text-xs font-medium text-red-400">{atualizarFlash.text}</p>
          )}
        </div>

        {resumo.length === 0 ? (
          <p className="rounded-2xl border border-white/[0.07] bg-zinc-950/40 px-4 py-8 text-center text-sm text-zinc-500">
            Não há pastas tipo ambiente (N) com faixas nesta programação, ou os dados da playlist ainda não foram
            carregados.
          </p>
        ) : (
          <ul className="space-y-3">
            {resumo.map((linha) => (
              <li key={linha.key} className={listaCardIbiza('forest')}>
                <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ibiza-forest/80">Pasta</p>
                    <h3 className="mt-1 text-base font-semibold leading-snug text-zinc-100">
                      {linha.tituloExibicao}
                    </h3>
                    {linha.nomePasta !== linha.tituloExibicao ? (
                      <p className="mt-1 font-mono text-[10px] text-zinc-600">{linha.nomePasta}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded-lg border border-white/12 bg-black/35 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    Ambiente
                  </span>
                </div>
                <div className="mt-4 space-y-1.5 border-t border-white/[0.06] pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">Horários</p>
                  <ul className="space-y-1.5 text-sm leading-snug text-zinc-400">
                    {linha.linhasHorario.map((h) => (
                      <li key={h} className="flex gap-2.5">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ibiza-forest/55" aria-hidden />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PlayerSubpanelChrome>
  );
}
