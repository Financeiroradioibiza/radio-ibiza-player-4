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
          ? `Programação vinhetas (VP / VA) no programa «${programaNome}». Elas surgem entre faixas de ambiente segundo a grade e o servidor.`
          : 'Vinhetas programadas ou agendadas entre as músicas de ambiente, segundo a grade e o servidor.'
      }
      rootClassName={
        layout === 'overlay' ? 'flex h-full min-h-0 flex-col space-y-3' : undefined
      }
      bodyClassName={
        layout === 'overlay' ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5' : undefined
      }
    >
      <div className="space-y-6">
        {resumo.length === 0 ? (
          <p className="rounded-2xl border border-white/[0.07] bg-zinc-950/40 px-4 py-8 text-center text-sm text-zinc-500">
            Nenhuma vinheta listada até o servidor associar agendas VP ou VA úteis a este ponto — só ambiente até
            lá.
          </p>
        ) : (
          <ul className="space-y-3">
            {resumo.map((item) => (
              <li key={item.key} className={listaCardIbiza(item.tipo === 'VP' ? 'magenta' : 'sky')}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                      {item.rotuloTipo}
                    </p>
                    <h3 className="mt-1 break-words text-base font-semibold leading-snug text-zinc-100">
                      {item.tituloExibicao}
                    </h3>
                    {item.nomePasta !== item.tituloExibicao ? (
                      <p className="mt-1 font-mono text-[10px] tracking-tight text-zinc-600">
                        {item.nomePasta}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      item.tipo === 'VP'
                        ? 'border-ibiza-magenta/45 bg-black/35 text-ibiza-magenta/95'
                        : 'border-ibiza-sky/45 bg-black/35 text-ibiza-sky/95'
                    }`}
                  >
                    {item.tipo === 'VP' ? 'VP' : 'VA'}
                  </span>
                </div>

                <p className="mt-4 text-sm leading-snug text-zinc-200">{item.horarioLinha}</p>
                {item.detalhe ? (
                  <p className="mt-2 border-l border-white/18 pl-3 text-sm leading-relaxed text-zinc-400">
                    {item.detalhe}
                  </p>
                ) : null}
                {item.avisoGradeOpcional ? (
                  <p className="mt-3 rounded-xl border border-amber-500/22 bg-amber-950/18 px-3 py-2 text-[11px] leading-snug text-amber-100/88">
                    {item.avisoGradeOpcional}
                  </p>
                ) : null}
                {item.faixaExemplos.length > 0 ? (
                  <p className="mt-3 text-[11px] text-zinc-600">
                    <span className="font-semibold text-zinc-500">Trechos: </span>
                    {item.faixaExemplos.join(' · ')}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </PlayerSubpanelChrome>
  );
}
