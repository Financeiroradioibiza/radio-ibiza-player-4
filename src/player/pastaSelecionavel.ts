/**
 * Pastas ambiente cujo **nome contém Evento ou Extra como palavra** (painel pode mandar só
 * «EVENTO» / «EXTRA» ou títulos longos tipo «Evento - Dia de luxo», «Extra - Domingo animado»).
 * Ao selecionar, só esta pasta toca até o operador desmarcar ou a pasta sumir da grade.
 *
 * Limite `\b(EVENTO|EXTRA)\b` após normalizar acentos/maiúsculas evita falsos positivos
 * no plural («eventos» sem quebra após EVENTO), em «extr…» onde EXTRA não vai sozinho, etc.
 */

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
