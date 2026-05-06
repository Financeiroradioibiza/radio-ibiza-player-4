import type { PdvData } from '@/types/webservice';

/**
 * Códigos no campo «inscrição estadual» do cadastro → mensagem única na tela do player.
 * Só faz efeito com coincidência exata (após trim; maiúsculas/minúsculas ignoradas).
 */
const AVISOS_IE: Record<string, string> = {
  ALERTACORTE: 'Atenção , cobranças em aberto. Falar com setor de Cobrança.',
  CADASTRO: 'Atenção, cadastro desatualizado. Favor atualização de cadastro acima.',
};

function valorInscricaoEstadualPdv(pdv: PdvData | null): string {
  if (!pdv) return '';
  const r = pdv as Record<string, unknown>;
  for (const key of ['inscricao_estadual', 'ins_estadual', 'ie']) {
    const v = r[key];
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return '';
}

/**
 * Retorna a mensagem a mostrar sob «Atualização de cadastro», ou `null` se o campo
 * não for exatamente `ALERTACORTE` ou `CADASTRO`.
 */
export function mensagemAvisoInscricaoEstadual(pdv: PdvData | null): string | null {
  const trimmed = valorInscricaoEstadualPdv(pdv).trim();
  if (!trimmed) return null;

  const chave = trimmed.toUpperCase();
  const msg = AVISOS_IE[chave];
  return msg ?? null;
}
