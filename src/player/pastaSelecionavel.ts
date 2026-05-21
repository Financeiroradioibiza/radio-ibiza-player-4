/**
 * Pastas ambiente vindas do painel como EVENTO ou EXTRA podem ficar «selecionadas»
 * no player — só estas tocam até o operador desmarcar ou a pasta sumir da grade.
 */

const NOMES_PASTAS_SELECIONAVEIS = new Set<string>(['EVENTO', 'EXTRA']);

/** Normaliza nome de pasta para comparação (acentos ignorados). */
export function nomePastaAmbienteParaComparacao(raw: unknown): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toUpperCase();
}

/** `true` se a pasta deve aparecer como «pastas seleccionáveis» (EVENTO / EXTRA). */
export function isPastaNomeAmbienteSelecionavel(nome: string): boolean {
  return NOMES_PASTAS_SELECIONAVEIS.has(nomePastaAmbienteParaComparacao(nome));
}
