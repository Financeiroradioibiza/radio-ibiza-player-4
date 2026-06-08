/**
 * Pastas ambiente cujo **nome contém Evento ou Extra como palavra** (painel pode mandar só
 * «EVENTO» / «EXTRA» ou títulos longos tipo «Evento - Dia de luxo», «Extra - Domingo animado»),
 * **ou** pastas sem «tocar sempre» e com horários todos 00:00–00:00 (ex.: «SÃO JOÃO 2026»).
 * Ao selecionar, só esta pasta toca até o operador desmarcar ou a pasta sumir da grade.
 *
 * Limite `\b(EVENTO|EXTRA)\b` após normalizar acentos/maiúsculas evita falsos positivos
 * no plural («eventos» sem quebra após EVENTO), em «extr…» onde EXTRA não vai sozinho, etc.
 */

import type { Agenda, Playlist } from '@/types/webservice';
import { agendaLinhaHorarioVazio } from '@/player/vinhetas';

/** Palavra EVENTO ou EXTRA no nome (não apenas prefixo dentro de EVENTOS). */
const RE_TOKEN_EVENTO_EXTRA = /\b(EVENTO|EXTRA)\b/u;

/** Normaliza nome de pasta para comparação (acentos ignorados, maiúsculas). */
export function nomePastaAmbienteParaComparacao(raw: unknown): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toUpperCase();
}

/** `true` se a pasta deve aparecer em «pastas selecionáveis» (nome com Evento ou Extra). */
export function isPastaNomeAmbienteSelecionavel(nome: string): boolean {
  const n = nomePastaAmbienteParaComparacao(nome);
  if (!n) return false;
  return RE_TOKEN_EVENTO_EXTRA.test(n);
}

/**
 * Pasta ambiente sem «tocar sempre» e sem janela horária real (todas as linhas 00:00–00:00
 * ou nenhuma linha em `/agendas/`) — só entra em reprodução quando o operador seleciona na grade.
 */
export function pastaAmbienteSemProgramacaoHoraria(
  pl: Pick<Playlist, 'id' | 'tocar_sempre'>,
  agendas: Agenda[] | null | undefined,
): boolean {
  if (String(pl.tocar_sempre).toUpperCase() === 'S') return false;
  const rel = (agendas ?? []).filter((a) => Number(a.playlist_id) === pl.id);
  if (rel.length === 0) return true;
  return rel.every(agendaLinhaHorarioVazio);
}

/** Evento/Extra no nome **ou** pasta ambiente só manual (sem horário / 00:00–00:00). */
export function isPastaAmbienteOperadorSelecionavel(
  pl: Pick<Playlist, 'nome' | 'id' | 'tocar_sempre'>,
  agendas: Agenda[] | null | undefined,
): boolean {
  if (isPastaNomeAmbienteSelecionavel(String(pl.nome ?? ''))) return true;
  return pastaAmbienteSemProgramacaoHoraria(pl, agendas);
}
