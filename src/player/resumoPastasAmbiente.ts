/**
 * Lista pastas de música tipo N (ambiente) com linhas amigáveis de horário a partir de /agendas/.
 */

import type { Agenda, Playlist } from '@/types/webservice';
import { legendaDiaSemanaAgenda, agendaLinhaHorarioVazio } from '@/player/vinhetas';
import { nomePastaParaTitulo } from '@/utils/playlistNomeExibicao';

export type PastaAmbienteResumo = {
  key: string;
  playlistId: number;
  nomePasta: string;
  tituloExibicao: string;
  linhasHorario: string[];
};

function formatoHoraCurta(h: string): string {
  const p = String(h || '00:00:00').split(':');
  const hh = p[0] ?? '00';
  const mm = p[1] ?? '00';
  return `${hh}:${mm}`;
}

function agendasDaPlaylist(playlistId: number, agendas: Agenda[] | null | undefined): Agenda[] {
  if (!agendas?.length) return [];
  return agendas.filter((a) => Number(a.playlist_id) === playlistId);
}

/**
 * Linhas só com nome da pasta (legível) + horários programados vindos das agendas ligadas ao `playlist_id`.
 */
export function resumoPastasAmbienteProgramadas(
  playlists: Playlist[],
  agendas: Agenda[] | null | undefined,
): PastaAmbienteResumo[] {
  const out: PastaAmbienteResumo[] = [];
  const list = playlists.filter((p) => String(p.tipo).toUpperCase() === 'N');

  for (const pl of list) {
    if (!pl.musicas?.some((m) => m.url_musica?.trim())) continue;

    const rel = agendasDaPlaylist(pl.id, agendas);
    let linhasHorario: string[];

    if (rel.length > 0) {
      if (rel.every(agendaLinhaHorarioVazio)) {
        linhasHorario = [
          'Sem horário programado (00:00–00:00) — selecione manualmente na grade.',
        ];
      } else {
        linhasHorario = rel.map(
          (ag) =>
            `${legendaDiaSemanaAgenda(ag)} · ${formatoHoraCurta(ag.hora_inicio)} – ${formatoHoraCurta(ag.hora_fim)}`,
        );
      }
    } else if (String(pl.tocar_sempre).toUpperCase() === 'S') {
      linhasHorario = ['Marcada como «tocar sempre» — sem linha específica em agendas.'];
    } else {
      linhasHorario = ['Sem horários listados nas agendas para esta pasta neste momento.'];
    }

    out.push({
      key: `n-${pl.id}`,
      playlistId: pl.id,
      nomePasta: pl.nome,
      tituloExibicao: nomePastaParaTitulo(pl.nome),
      linhasHorario,
    });
  }

  out.sort((a, b) => a.tituloExibicao.localeCompare(b.tituloExibicao, 'pt-BR'));

  return out;
}
