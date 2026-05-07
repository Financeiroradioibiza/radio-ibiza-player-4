/**
 * Vinhetas da programação (webservice): VP / VA e horários das agendas.
 */

import { useMemo } from 'react';

import { useAppStore } from '@/store/app';
import { resumoVinhetasProgramacao } from '@/player/vinhetas';
import { PlayerSubpanelChrome, listaCardIbiza } from '@/components/PlayerSubpanelChrome';

type Props = {
  onClose: () => void;
  /** Ocupa altura disponível + rolagem interna (modo sobreposição no player). */
  layout?: 'inline' | 'overlay';
};

export function VinhetasPanel({ onClose, layout = 'inline' }: Props) {
  const playlistData = useAppStore((s) => s.playlistData);
  const agendas = useAppStore((s) => s.agendas);

  const programaNome = playlistData?.programa?.nome?.trim();

  const resumo = useMemo(
    () =>
      resumoVinhetasProgramacao(
        playlistData?.playlists ?? [],
        agendas ?? [],
        playlistData?.programa?.id ?? 0,
      ),
    [playlistData?.playlists, agendas, playlistData?.programa?.id],
  );

  return (
    <PlayerSubpanelChrome
      titulo="Vinhetas"
      accent="magenta"
      onClose={onClose}
      subtitulo={
        programaNome
          ? `VP / VA no programa «${programaNome}» — horários segundo a grade.`
          : 'Vinhetas programadas ou agendadas na grade atual.'
      }
      rootClassName={
        layout === 'overlay' ? 'flex h-full min-h-0 flex-col space-y-3' : undefined
      }
      bodyClassName={
        layout === 'overlay' ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5' : undefined
      }
    >
      <div className="space-y-3">
        {resumo.length === 0 ? (
          <p className="rounded-2xl border border-white/[0.07] bg-zinc-950/40 px-4 py-6 text-center text-sm text-zinc-500">
            Nenhuma vinheta listada até o servidor associar agendas VP ou VA — só ambiente até lá.
          </p>
        ) : (
          <ul className="space-y-3">
            {resumo.map((item) => (
              <li key={item.key} className={`${listaCardIbiza('forest')} !py-3 sm:!px-4 sm:!py-3.5`}>
                <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ibiza-forest/80">
                      Vinheta · {item.rotuloTipo}
                    </p>
                    <h3 className="mt-1 break-words text-base font-semibold leading-snug text-zinc-100">
                      {item.tituloExibicao}
                    </h3>
                    {item.nomePasta !== item.tituloExibicao ? (
                      <p className="mt-1 font-mono text-[10px] text-zinc-600">{item.nomePasta}</p>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                      item.tipo === 'VP'
                        ? 'border-ibiza-magenta/42 bg-black/35 text-ibiza-magenta/92'
                        : 'border-ibiza-sky/42 bg-black/35 text-ibiza-sky/92'
                    }`}
                  >
                    {item.tipo === 'VP' ? 'VP' : 'VA'}
                  </span>
                </div>
                <div className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">Na programação</p>
                  <ul className="space-y-1.5 text-sm leading-snug text-zinc-400">
                    <li className="flex gap-2.5">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ibiza-forest/55" aria-hidden />
                      <span>{item.horarioLinha}</span>
                    </li>
                    {item.detalhe ? (
                      <li className="flex gap-2.5">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ibiza-forest/40" aria-hidden />
                        <span className="text-[13px] leading-relaxed text-zinc-400">{item.detalhe}</span>
                      </li>
                    ) : null}
                    {item.avisoGradeOpcional ? (
                      <li className="flex gap-2.5 pt-1">
                        <span
                          className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500/70"
                          aria-hidden
                        />
                        <span className="rounded-lg border border-amber-500/22 bg-amber-950/18 px-2.5 py-1.5 text-[11px] leading-snug text-amber-100/88">
                          {item.avisoGradeOpcional}
                        </span>
                      </li>
                    ) : null}
                    {item.faixaExemplos.length > 0 ? (
                      <li className="flex gap-2.5 pt-0.5">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-600" aria-hidden />
                        <span className="text-[11px] text-zinc-500">
                          <span className="font-semibold text-zinc-500">Trechos: </span>
                          {item.faixaExemplos.join(' · ')}
                        </span>
                      </li>
                    ) : null}
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
