import type { ClienteData, PdvData } from '@/types/webservice';

/**
 * Códigos no campo «inscrição estadual» do cadastro → mensagem única na tela do player.
 * Só faz efeito com coincidência exata (após trim; maiúsculas/minúsculas ignoradas).
 */
const AVISOS_IE: Record<string, string> = {
  ALERTACORTE: 'Atenção , cobranças em aberto. Falar com setor de Cobrança.',
  CADASTRO: 'Atenção, cadastro desatualizado. Favor atualização de cadastro acima.',
};

function stringDoCampo(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return '';
}

function normalizarNomeCampo(key: string): string {
  return key
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/_/g, '');
}

/**
 * Lê valor em `pdv` ou `cliente` — o Cake costuma usar `inscricao_estadual`, mas já vimos camelCase ou IE sozinho.
 */
function valorInscricaoEstadualEmRegistro(rec: Record<string, unknown>): string {
  const chavesExplicitas = [
    'inscricao_estadual',
    'insc_estadual',
    'ins_estadual',
    'ie',
    'InscricaoEstadual',
  ];
  for (const k of chavesExplicitas) {
    if (k in rec) {
      const s = stringDoCampo(rec[k]).trim();
      if (s) return s;
    }
  }

  for (const [k, v] of Object.entries(rec)) {
    const nk = normalizarNomeCampo(k);
    if (nk === 'ie') {
      const s = stringDoCampo(v).trim();
      if (s) return s;
    }
    if (nk.includes('inscricao') && nk.includes('estadual')) {
      const s = stringDoCampo(v).trim();
      if (s) return s;
    }
  }
  return '';
}

function valorInscricaoEstadualFontes(pdv: PdvData | null, cliente: ClienteData | null): string {
  if (pdv) {
    const s = valorInscricaoEstadualEmRegistro(pdv as Record<string, unknown>);
    if (s) return s;
  }
  if (cliente) {
    return valorInscricaoEstadualEmRegistro(cliente as Record<string, unknown>);
  }
  return '';
}

/**
 * Retorna a mensagem a mostrar sob «Atualização de cadastro», ou `null` se o campo
 * não for exatamente `ALERTACORTE` ou `CADASTRO`.
 */
export function mensagemAvisoInscricaoEstadual(
  pdv: PdvData | null,
  cliente: ClienteData | null,
): string | null {
  const trimmed = valorInscricaoEstadualFontes(pdv, cliente).trim();
  if (!trimmed) return null;

  const chave = trimmed.toUpperCase();
  const msg = AVISOS_IE[chave];
  return msg ?? null;
}
