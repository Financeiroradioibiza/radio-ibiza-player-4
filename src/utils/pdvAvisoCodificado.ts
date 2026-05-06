import type { ClienteData, PdvData } from '@/types/webservice';

/**
 * Códigos no «nome completo do contato extra» do cadastro (PDV ou cliente).
 * Mesmas palavras de antes: só `ALERTACORTE` e `CADASTRO` (trim; maiúsculas/minúsculas ignoradas).
 */
const AVISOS_CODIGO: Record<string, string> = {
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
 * Nome onde o cadastro externo guarda o contato extra — chaves vistas em Cake / formulários PT-BR / camelCase.
 */
function valorNomeContatoExtraEmRegistro(rec: Record<string, unknown>): string {
  const chavesExplicitas = [
    'nome_completo_contato_extra',
    'nome_contato_extra',
    'contato_extra_nome',
    'nm_contato_extra',
    'nomeCompletoContatoExtra',
    'NomeCompletoContatoExtra',
    /** Alguns formulários só têm um campo texto «contato extra». */
    'contato_extra',
  ];
  for (const k of chavesExplicitas) {
    if (k in rec) {
      const s = stringDoCampo(rec[k]).trim();
      if (s) return s;
    }
  }

  for (const [k, v] of Object.entries(rec)) {
    const nk = normalizarNomeCampo(k);
    const temContatoExtra = nk.includes('contato') && nk.includes('extra');
    const pareceNome =
      nk.includes('nome') || nk.includes('completo') || nk === 'contatoextra';
    if (temContatoExtra && pareceNome) {
      const s = stringDoCampo(v).trim();
      if (s) return s;
    }
  }
  return '';
}

function valorNomeContatoExtraFontes(pdv: PdvData | null, cliente: ClienteData | null): string {
  if (pdv) {
    const s = valorNomeContatoExtraEmRegistro(pdv as Record<string, unknown>);
    if (s) return s;
  }
  if (cliente) {
    return valorNomeContatoExtraEmRegistro(cliente as Record<string, unknown>);
  }
  return '';
}

/**
 * Mensagem sob «Atualização de cadastro», ou `null` se o nome do contato extra
 * não for exatamente um dos dois códigos conhecidos.
 */
export function mensagemAvisoCodigoContatoExtra(
  pdv: PdvData | null,
  cliente: ClienteData | null,
): string | null {
  const trimmed = valorNomeContatoExtraFontes(pdv, cliente).trim();
  if (!trimmed) return null;

  const chave = trimmed.toUpperCase();
  const msg = AVISOS_CODIGO[chave];
  return msg ?? null;
}
