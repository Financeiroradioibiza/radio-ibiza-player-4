import type { PdvData, Token } from '@/types/webservice';
import { isDebugRedeEnabled } from '@/api/config';

/**
 * Origem dos dados (painel PHP 2015 / `www/services`):
 * - O botão «Redefinir serial» atualiza `tokens.token` (MD5 via `generateToken`).
 * - A «serial» exibida no cadastro é o mesmo valor que o player envia em `?token=`.
 * - `loginByToken` monta `pdv` com `getDadosPDV()` = `SELECT * FROM pdvs` apenas — sem o hash do token,
 *   embora o bloco `token` do JSON traga `{ token, data_inicio, data_fim, pdv_id, status }`.
 * - `ping` devolve o mesmo `pdv` (só colunas da tabela `pdvs`), não o objeto Token.
 *
 * Por isso **`token`** entra como chave prioritária na resposta de login, e colunas extras em `pdvs`
 * (ex.: `serial`) continuam suportadas se o backend as expuser no futuro.
 */
const CHAVES_PRIORITARIAS = [
  /** Legado: mesma string que a API usa em `?token=` — o painel chama de «serial». */
  'token',
  'serial_instalacao',
  'serial_player',
  'serial',
  'Serial',
  'SERIAL',
  'player_serial',
  'pdv_serial',
  'serial_pdv',
  'serial_painel',
  'chave_player',
  'chave_serial',
  'codigo_serial',
  'hash_serial',
  'serial_hash',
] as const;

/** Campos que podem conter a chave mas o nome varia — só string “curta” (evita colidir com texto longo). */
const CHAVE_COM_PALAVRA_SERIAL = /serial|chave|hash|player|instal|painel/i;

/** Evita apanhar descrições, nomes, URLs — a serial do painel costuma ser hex de 32 chars (MD5). */
const EXCLUIR_CHAVE =
  /^(nome|cidade|uf|cep|endereco|bairro|complemento|numero|logradouro|email|telefone|obs|programa|cliente|mensagem|url|http|logotipo)/i;

function valorCampoSerial(v: unknown): string | null {
  if (typeof v === 'string') {
    const t = v.trim();
    if (t.length > 0) return t;
    return null;
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    return String(Math.trunc(v));
  }
  return null;
}

/**
 * Formato típico no painel (ex.: `77c045cbb73b87ffe19dac018a9612cd`).
 */
function pareceHashMd5(s: string): boolean {
  return /^[a-f0-9]{32}$/i.test(s.trim());
}

/**
 * Compara duas seriais de forma estável (hex 32 em minúsculas).
 */
export function serialsInstalacaoIguais(a: string, b: string): boolean {
  const x = a.trim();
  const y = b.trim();
  if (pareceHashMd5(x) && pareceHashMd5(y)) {
    return x.toLowerCase() === y.toLowerCase();
  }
  return x === y;
}

function extrairSerialDeRegistro(row: Record<string, unknown> | null | undefined): string | null {
  if (!row) return null;

  for (const k of CHAVES_PRIORITARIAS) {
    if (!(k in row)) continue;
    const t = valorCampoSerial(row[k]);
    if (t) return t;
  }

  for (const [k, v] of Object.entries(row)) {
    if (EXCLUIR_CHAVE.test(k)) continue;
    if (!CHAVE_COM_PALAVRA_SERIAL.test(k)) continue;
    const t = valorCampoSerial(v);
    if (!t || t.length < 4) continue;
    /** Evita frases; serial do painel costuma ser hex de 32 ou string curta. */
    if (t.length <= 64 && (pareceHashMd5(t) || t.length <= 40)) return t;
  }

  /** Último recurso: único valor em 32 hex (formato do painel). */
  const hex32Candidates: string[] = [];
  for (const [k, v] of Object.entries(row)) {
    if (EXCLUIR_CHAVE.test(k)) continue;
    const t = valorCampoSerial(v);
    if (t && pareceHashMd5(t)) hex32Candidates.push(t);
  }
  if (hex32Candidates.length === 1) return hex32Candidates[0] ?? null;

  if (isDebugRedeEnabled() && Object.keys(row).length > 0) {
    try {
      const apenasChaves = Object.keys(row).sort().join(', ');
      console.info(
        `[ibiza-serial] Nenhuma serial reconhecida. Campos disponíveis no JSON: ${apenasChaves}`,
      );
    } catch {
      //
    }
  }

  return null;
}

/**
 * Lê a chave do cadastro do PDV (`loginByToken`, `/ping/`).
 *
 * Ignora propriedade `token` neste objeto: o ping legado só manda linhas da tabela `pdvs`;
 * um campo `token` vindo de merge ou JSON estranho não pode disparar troca da «serial»
 * antes de `serial_instalacao` / `serial_*` — evita falsos «Player desativado» durante reprodução.
 */
export function extrairSerialInstalacaoDoPdv(pdv: PdvData | null | undefined): string | null {
  if (!pdv) return null;
  const row = { ...(pdv as Record<string, unknown>) };
  delete row.token;
  return extrairSerialDeRegistro(row);
}

/**
 * Alguns servidores podem repetir a serial no bloco `token` da mesma resposta.
 */
export function extrairSerialInstalacaoDoToken(token: Token | null | undefined): string | null {
  if (!token) return null;
  return extrairSerialDeRegistro(token as unknown as Record<string, unknown>);
}

/**
 * Valor de referência ao gravar a sessão após escolher o PDV: no legado vem do **bloco `token`**
 * (`Token.token`); campos na tabela `pdvs` têm prioridade menor.
 */
export function extrairSerialRespostaLogin(pdv: PdvData, token: Token): string | null {
  return extrairSerialInstalacaoDoToken(token) ?? extrairSerialInstalacaoDoPdv(pdv);
}
