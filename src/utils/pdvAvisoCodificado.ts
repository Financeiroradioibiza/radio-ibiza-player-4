import type { ClienteData, PdvData } from '@/types/webservice';

/**
 * Códigos vindos do cadastro («contato extra» / nome completo).
 * Matching flexível apenas em ramos claramente ligados ao contato extra (ver coleta).
 * Varredura exata global no objeto inteiro só para string === código (evita falsos CADASTRO).
 */
const AVISOS_CODIGO: Record<string, string> = {
  ALERTACORTE: 'Atenção , cobranças em aberto. Falar com setor de Cobrança.',
  CADASTRO: 'Atenção, cadastro desatualizado. Favor atualização de cadastro acima.',
};

const CODIGOS_SET = new Set(Object.keys(AVISOS_CODIGO));
/** Ordem maior → menor ajuda quando houver dois candidatos implausíveis; hoje só dois tamanhos. */
const CODIGOS_POR_TAMANHO = [...CODIGOS_SET].sort((a, b) => b.length - a.length);

const CHAVES_EXPLICITAS_NOME_CONTATO_EXTRA = [
  'nome_completo_contato_extra',
  'nome_completocontato_extra',
  'contato_extra_nome_completo',
  'nome_contato_extra',
  'contato_extra_nome',
  'nm_completo_contato_extra',
  'nm_contato_extra',
  'nomeCompletoContatoExtra',
  'NomeCompletoContatoExtra',
  'Nome_Completo_Contato_Extra',
  'nomeCompletoDoContatoExtra',
  'contato_extra',
  'NomeExtra',
  'nome_extra_contato',
] as const;

const MAX_CHARS_STRING_COLETA = 480;

function stringDoCampo(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return '';
}

/** Remove acento para comparar códigos (ASCII esperado nos literais ALERTACORTE/CADASTRO). */
function semAcento(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

function stripBoeCaracterInvisivel(s: string): string {
  return s.replace(/^\uFEFF+|\uFEFF+$|\u200B+/g, '').trim();
}

function normalizarNomeCampo(key: string): string {
  return key
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/_/g, '');
}

/** Chaves Cake / cadastro relacionadas ao «nome» do contato extra. */
function chavePossivelNomeContatoExtra(k: string): boolean {
  if ((CHAVES_EXPLICITAS_NOME_CONTATO_EXTRA as readonly string[]).includes(k)) return true;

  const nk = normalizarNomeCampo(k);
  if (nk.includes('contato') && nk.includes('extra')) return true;

  const compact = nk.replace(/[^a-z0-9]/g, '');
  if (compact.includes('nomecompletocontatoextra')) return true;
  if (compact.includes('nomecontatoextra')) return true;

  const pareceNome =
    nk.includes('nome') || nk.includes('completo') || nk.includes('fullname') || nk === 'contatoextra';
  const temCx = nk.includes('contato') && nk.includes('extra');
  return (temCx && pareceNome) || (nk.includes('nome') && nk.includes('completo') && nk.includes('extra'));
}

function chaveSubobjetoContatoExtra(k: string): boolean {
  const nk = normalizarNomeCampo(k);
  return nk === 'contatoextra' || (nk.includes('contato') && nk.includes('extra'));
}

/** True se texto “parece só o código”, com espaços/_/- entre palavras (ex.: «ALERTA CORTE»). */
function extrairCodigoDeTextoContatoFlexivel(raw: string): string | null {
  const base = stripBoeCaracterInvisivel(semAcento(raw));
  if (!base || base.length > MAX_CHARS_STRING_COLETA) return null;

  const alto = base.toUpperCase();
  /** Só letras/números — «alerta corte» ↔ ALERTACORTE */
  const compactTot = alto.replace(/[^A-Z0-9]/g, '');
  /** Tokens quando o servidor manda dois campos lado a lado sem ser um único «nome». */
  const tokens = alto
    .replace(/[^\p{L}\p{N}_-]+/gu, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/[^A-Z0-9]/gi, ''))
    .filter(Boolean);

  for (const code of CODIGOS_POR_TAMANHO) {
    const up = code.toUpperCase();

    // Exato já normalizado só com letras
    if (compactTot === up) return code;

    for (const t of tokens) {
      const cu = semAcento(t).toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (cu === up) return code;
    }

    // Prefixo ou sufixo curto típico de cópia/cola com ruído (ex.: "; ALERTACORTE").
    const pos = compactTot.indexOf(up);
    if (pos !== -1) {
      const restoPref = pos;
      const restoSuf = compactTot.length - pos - up.length;
      if (restoPref <= 6 && restoSuf <= 6 && compactTot.length <= up.length + 12) return code;
    }
  }

  return null;
}

/**
 * Todas strings em ramos relacionados ao contato extra.
 * Em subárvores `ContatoExtra`/`contato_extra` recolhe todas as strings até profundidade segura,
 * porque o servidor pode usar nomes diversos («nm_completo», etc.).
 */
function coletaStringsRamoPossivelmenteContatoExtra(
  obj: Record<string, unknown>,
  forcadoContatoExtra: boolean,
  depth = 0,
): string[] {
  if (depth > 14) return [];
  const out: string[] = [];

  function addStr(v: unknown) {
    const s = stringDoCampo(v);
    const t = stripBoeCaracterInvisivel(s);
    if (t.length > 0 && t.length <= MAX_CHARS_STRING_COLETA) out.push(t);
  }

  for (const key of CHAVES_EXPLICITAS_NOME_CONTATO_EXTRA) {
    if (!(key in obj)) continue;
    addStr(obj[key as string]);
  }

  for (const [k, v] of Object.entries(obj)) {
    const relacionadoNomeCx = forcadoContatoExtra || chavePossivelNomeContatoExtra(k);
    const abreSubCx = relacionadoNomeCx || chaveSubobjetoContatoExtra(k);

    if (typeof v === 'string' && relacionadoNomeCx) addStr(v);

    if (v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v)) {
      const subCx = forcadoContatoExtra || abreSubCx;
      if (subCx) {
        out.push(...coletaStringsRamoPossivelmenteContatoExtra(v as Record<string, unknown>, subCx, depth + 1));
      }
      continue;
    }

    if (Array.isArray(v) && (forcadoContatoExtra || relacionadoNomeCx)) {
      const entraForced = forcadoContatoExtra;
      for (const item of v) {
        if (typeof item === 'string') addStr(item);
        else if (item !== null && item !== undefined && typeof item === 'object' && !Array.isArray(item)) {
          out.push(
            ...coletaStringsRamoPossivelmenteContatoExtra(
              item as Record<string, unknown>,
              entraForced || relacionadoNomeCx,
              depth + 1,
            ),
          );
        }
      }
    }
  }

  return out;
}

/**
 * Strings consideradas antes da varredura profunda literal no PDV inteiro.
 */
function coletaTextosPrioridadeContatoExtra(pdv: PdvData | null, cliente: ClienteData | null): string[] {
  const gathered: string[] = [];

  for (const ent of [pdv, cliente]) {
    if (!ent) continue;
    const flat = ent as Record<string, unknown>;
    gathered.push(...coletaStringsRamoPossivelmenteContatoExtra(flat, false, 0));

    const sub = flat.ContatoExtra ?? flat.contato_extra ?? flat.Contato_Extra ?? flat.contatoextra;
    if (sub && typeof sub === 'object' && !Array.isArray(sub)) {
      gathered.push(...coletaStringsRamoPossivelmenteContatoExtra(sub as Record<string, unknown>, true, 0));
    }
  }

  return [...new Set(gathered)];
}

/**
 * Qualquer string em qualquer nível igual a um código (maiúsculas após trim), sem fuzzy.
 */
function valorCodigoAvisoQualquerCampoProfundo(root: Record<string, unknown>, depth = 0): string {
  if (depth > 14) return '';

  for (const v of Object.values(root)) {
    if (typeof v === 'string') {
      const raw = stripBoeCaracterInvisivel(semAcento(v.trim())).toUpperCase();
      if (raw && CODIGOS_SET.has(raw)) return raw;
    } else if (v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v)) {
      const nested = valorCodigoAvisoQualquerCampoProfundo(v as Record<string, unknown>, depth + 1);
      if (nested) return nested;
    } else if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === 'string') {
          const raw = stripBoeCaracterInvisivel(semAcento(item.trim())).toUpperCase();
          if (raw && CODIGOS_SET.has(raw)) return raw;
        } else if (item !== null && item !== undefined && typeof item === 'object' && !Array.isArray(item)) {
          const nested = valorCodigoAvisoQualquerCampoProfundo(item as Record<string, unknown>, depth + 1);
          if (nested) return nested;
        }
      }
    }
  }
  return '';
}

function valorNomeContatoExtraFontes(pdv: PdvData | null, cliente: ClienteData | null): string {
  for (const s of coletaTextosPrioridadeContatoExtra(pdv, cliente)) {
    const fuzzy = extrairCodigoDeTextoContatoFlexivel(s);
    if (fuzzy) return fuzzy;

    const t = stripBoeCaracterInvisivel(semAcento(s)).trim().toUpperCase();
    if (t && CODIGOS_SET.has(t)) return t;
  }

  for (const ent of [pdv, cliente]) {
    if (!ent) continue;
    const deep = valorCodigoAvisoQualquerCampoProfundo(ent as Record<string, unknown>);
    if (deep) return deep.trim();
  }

  return '';
}

/**
 * Mensagem sob «Atualização de cadastro», ou `null` se não houver `ALERTACORTE` ou `CADASTRO`.
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

/** Painel vermelho abaixo de «Atualização de cadastro» quando `ctrl_playlists=N` no PDV. */
export const MENSAGEM_AVISO_CTRL_PLAYLIST_CADASTRO = AVISOS_CODIGO.CADASTRO;

/** Painel vermelho quando `ctrl_player=N` no cadastro (necessidade de cadastro regularizado). */
export const MENSAGEM_AVISO_CTRL_PLAYER_NECESSITA_CADASTRO =
  'Atenção: este PDV apresenta necessidade de cadastro junto à Radio Ibiza. Utilize o botão «Atualização de cadastro» abaixo ou fale com o suporte.';

/**
 * Textos do painel vermelho de cadastro: flags do PDV no painel + opcional código no contato extra (ALERTACORTE/CADASTRO).
 * Ordem: ctrl_player, ctrl_playlists, depois aviso por código sem repetir o mesmo texto.
 */
export function mensagensAvisoVermelhoCadastroPdv(
  pdv: PdvData | null,
  cliente: ClienteData | null,
): string[] {
  const out: string[] = [];
  if (pdv?.ctrl_player === 'N') {
    out.push(MENSAGEM_AVISO_CTRL_PLAYER_NECESSITA_CADASTRO);
  }
  if (pdv?.ctrl_playlists === 'N') {
    out.push(MENSAGEM_AVISO_CTRL_PLAYLIST_CADASTRO);
  }
  const porCodigo = mensagemAvisoCodigoContatoExtra(pdv, cliente);
  if (porCodigo && !out.includes(porCodigo)) {
    out.push(porCodigo);
  }
  return out;
}
