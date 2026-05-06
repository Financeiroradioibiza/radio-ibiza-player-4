import type { ClienteData, PdvData } from '@/types/webservice';

/**
 * Códigos vindos do cadastro («contato extra» / nome completo, ou outro campo que replique esse texto na API).
 * Só estas palavras exatas — após trim; maiúsculas/minúsculas ignoradas.
 */
const AVISOS_CODIGO: Record<string, string> = {
  ALERTACORTE: 'Atenção , cobranças em aberto. Falar com setor de Cobrança.',
  CADASTRO: 'Atenção, cadastro desatualizado. Favor atualização de cadastro acima.',
};

const CODIGOS_SET = new Set(Object.keys(AVISOS_CODIGO));

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

function valorNomeContatoExtraEmRegistro(rec: Record<string, unknown>): string {
  const chavesExplicitas = [
    'nome_completo_contato_extra',
    'nome_completocontato_extra',
    'contato_extra_nome_completo',
    'nome_contato_extra',
    'contato_extra_nome',
    'nm_completo_contato_extra',
    'nm_contato_extra',
    'nomeCompletoContatoExtra',
    'NomeCompletoContatoExtra',
    'nomeCompletoDoContatoExtra',
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
      nk.includes('nome') || nk.includes('completo') || nk.includes('fullname') || nk === 'contatoextra';
    if (temContatoExtra && pareceNome) {
      const s = stringDoCampo(v).trim();
      if (s) return s;
    }
    if (nk.includes('nome') && nk.includes('completo') && nk.includes('extra')) {
      const s = stringDoCampo(v).trim();
      if (s) return s;
    }
  }
  return '';
}

/**
 * Qualquer string no JSON que seja exatamente um dos dois códigos (aninhado incluso).
 */
function valorCodigoAvisoQualquerCampoProfundo(root: Record<string, unknown>, depth = 0): string {
  if (depth > 8) return '';

  for (const v of Object.values(root)) {
    if (typeof v === 'string') {
      const raw = v.trim();
      if (raw && CODIGOS_SET.has(raw.toUpperCase())) return raw;
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      const nested = valorCodigoAvisoQualquerCampoProfundo(v as Record<string, unknown>, depth + 1);
      if (nested) return nested;
    } else if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === 'string') {
          const raw = item.trim();
          if (raw && CODIGOS_SET.has(raw.toUpperCase())) return raw;
        } else if (item && typeof item === 'object' && !Array.isArray(item)) {
          const nested = valorCodigoAvisoQualquerCampoProfundo(item as Record<string, unknown>, depth + 1);
          if (nested) return nested;
        }
      }
    }
  }
  return '';
}

function coletaTextosPrioridadeContatoExtra(pdv: PdvData | null, cliente: ClienteData | null): string[] {
  const out: string[] = [];
  for (const ent of [pdv, cliente]) {
    if (!ent) continue;
    const flat = ent as Record<string, unknown>;
    const a = valorNomeContatoExtraEmRegistro(flat);
    if (a) out.push(a);

    const sub = flat.ContatoExtra ?? flat.contato_extra ?? flat.Contato_Extra;
    if (sub && typeof sub === 'object' && !Array.isArray(sub)) {
      const b = valorNomeContatoExtraEmRegistro(sub as Record<string, unknown>);
      if (b) out.push(b);
      const deepSub = valorCodigoAvisoQualquerCampoProfundo(sub as Record<string, unknown>);
      if (deepSub) out.push(deepSub);
    }
  }
  return out;
}

function valorNomeContatoExtraFontes(pdv: PdvData | null, cliente: ClienteData | null): string {
  for (const s of coletaTextosPrioridadeContatoExtra(pdv, cliente)) {
    const t = s.trim();
    if (CODIGOS_SET.has(t.toUpperCase())) return t;
  }

  for (const ent of [pdv, cliente]) {
    if (!ent) continue;
    const deep = valorCodigoAvisoQualquerCampoProfundo(ent as Record<string, unknown>);
    if (deep) return deep.trim();
  }

  return '';
}

/**
 * Mensagem sob «Atualização de cadastro», ou `null` se não houver exatamente `ALERTACORTE` ou `CADASTRO`.
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
