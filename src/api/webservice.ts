/**
 * Cliente HTTP do webservice Radio Ibiza.
 *
 * Cada função aqui mapeia 1:1 um endpoint do WebserviceController.php.
 * Toda a documentação do que cada um faz está em PROTOCOLO_WEBSERVICE.md.
 *
 * Convenções:
 * - Funções que recebem `token` o passam como query param (é como o backend espera).
 * - Erros de rede lançam `WebserviceError`. Erros de "lógica" do webservice
 *   (token_invalido, usuario_invalido) NÃO lançam — voltam no body normalmente,
 *   e quem chama decide o que fazer. Isso bate com o comportamento do AS3 original.
 */

import {
  API_BASE_URL,
  LIMITES,
  VERSAO_PLAYER,
  getDeviceId,
  isDebugRedeEnabled,
  redactUrlForLog,
} from './config';
import { redeTrace } from '../debug/redeDiag';
import type {
  LoginResponse,
  LoginByTokenResponse,
  PlaylistResponse,
  AgendaResponse,
  SaveExecutadaParams,
  SaveAtualizadasParams,
  GetPdvsApiResponse,
  GetPdvsResult,
  GetPdvsRow,
  PdvListItem,
  Token,
  PdvData,
  ClienteData,
  FlagSN,
} from '../types/webservice';

export class WebserviceError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'WebserviceError';
  }
}

// ============================================================================
// Helpers internos
// ============================================================================

interface RequestOptions {
  method?: 'GET' | 'POST';
  query?: Record<string, string | number | undefined>;
  /** Chaves repetidas na query (?a=1&a=2), ex.: músicas marcadas baixadas. */
  queryAppend?: ReadonlyArray<readonly [string, string]>;
  /** form-urlencoded simples — uma entrada por chave */
  body?: Record<string, string | number>; // form-urlencoded
  /** Pares repetidos (`append`) — usado quando o servidor espera array (ex.: musicas[]=1&musicas[]=2) */
  formPairs?: ReadonlyArray<readonly [string, string]>;
  signal?: AbortSignal;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', query, queryAppend, body, formPairs, signal } = opts;

  // Monta URL com query string
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, String(v));
      }
    }
  }
  if (queryAppend?.length) {
    for (const [k, v] of queryAppend) {
      url.searchParams.append(k, v);
    }
  }

  // Timeout — combinamos signal externo com nosso próprio
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(
    () => timeoutController.abort(),
    LIMITES.REQUEST_TIMEOUT_MS,
  );

  // Junta os signals (externo + timeout) — se algum disparar, cancela
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutController.signal])
    : timeoutController.signal;

  const t0 = performance.now();
  try {
    const init: RequestInit = {
      method,
      signal: combinedSignal,
    };

    if (formPairs?.length) {
      const form = new URLSearchParams();
      for (const [k, v] of formPairs) form.append(k, v);
      init.body = form;
      init.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    } else if (body) {
      // Webservice antigo espera form-urlencoded em POST
      const form = new URLSearchParams();
      for (const [k, v] of Object.entries(body)) form.set(k, String(v));
      init.body = form;
      init.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    }

    const response = await fetch(url.toString(), init);
    const ms = Math.round(performance.now() - t0);

    if (!response.ok) {
      throw new WebserviceError(
        `HTTP ${response.status} em ${path}`,
        undefined,
        response.status,
      );
    }

    // O webservice sempre retorna JSON (via $this->Json()), mas em alguns
    // erros raros pode retornar texto. Tentamos parse com graça.
    const text = await response.text();
    try {
      const parsed = JSON.parse(text) as T;
      redeTrace('ibiza-rede', 'info', method, redactUrlForLog(url), response.status, `${ms}ms`);
      return parsed;
    } catch {
      throw new WebserviceError(
        `Resposta não-JSON de ${path}: ${text.slice(0, 200)}`,
      );
    }
  } catch (err) {
    const ms = Math.round(performance.now() - t0);
    const st = err instanceof WebserviceError ? err.status : undefined;
    redeTrace('ibiza-rede', 'error', method, redactUrlForLog(url), st ?? 'falhou', `${ms}ms`, err);
    if (err instanceof WebserviceError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new WebserviceError(`Timeout em ${path}`, err);
    }
    throw new WebserviceError(`Falha de rede em ${path}`, err);
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// Normalização (respostas CakePHP com IDs string, etc.)
// ============================================================================

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toFlagSN(v: unknown): FlagSN {
  return v === 'N' ? 'N' : 'S';
}

function recordFromModel(v: unknown, label: string): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) {
    throw new Error(`${label}_ausente`);
  }
  return v as Record<string, unknown>;
}

/**
 * Interpreta JSON de /getPdvs/ (campo `mensagem` como array de linhas).
 */
export function parseGetPdvsResponse(raw: unknown): GetPdvsResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'resposta_invalida' };
  }

  const body = raw as GetPdvsApiResponse;
  if (typeof body.mensagem === 'string') {
    return { ok: false, error: body.mensagem };
  }

  if (!Array.isArray(body.mensagem)) {
    return { ok: false, error: 'formato_pdvs_desconhecido' };
  }

  const items: PdvListItem[] = [];
  let ocultadosInativos = 0;

  for (const rowUnknown of body.mensagem as GetPdvsRow[]) {
    try {
      const pdvRaw = recordFromModel(rowUnknown.Pdv, 'Pdv');
      const tokenArr = rowUnknown.Token;
      const firstTok =
        Array.isArray(tokenArr) && tokenArr[0]
          ? recordFromModel(tokenArr[0], 'Token')
          : null;
      const tokenStr = String(firstTok?.token ?? '').trim();
      if (!tokenStr) continue;

      const statusRaw = pdvRaw.status === 'I' ? 'I' : 'A';
      if (statusRaw === 'I') {
        ocultadosInativos += 1;
        continue;
      }
      items.push({
        token: tokenStr,
        nome: String(pdvRaw.nome ?? 'PDV sem nome'),
        cidade: String(pdvRaw.cidade ?? ''),
        uf: String(pdvRaw.uf ?? ''),
        status: statusRaw,
        atualizacao_pendente: toFlagSN(pdvRaw.atualizacao_pendente),
      });
    } catch {
      continue;
    }
  }

  return { ok: true, items, ocultadosInativos };
}

function tokenFromRecord(raw: Record<string, unknown>): Token {
  const t = String(raw.token ?? '').trim();
  return {
    token: t,
    data_inicio: String(raw.data_inicio ?? ''),
    data_fim:
      raw.data_fim === null || raw.data_fim === undefined
        ? null
        : String(raw.data_fim),
    pdv_id: toNum(raw.pdv_id),
  };
}

export function pdvDataFromApiRecord(raw: Record<string, unknown>): PdvData {
  const base: PdvData = {
    ...raw,
    id: toNum(raw.id),
    nome: String(raw.nome ?? ''),
    status: raw.status === 'I' ? 'I' : 'A',
    atualizacao_pendente: toFlagSN(raw.atualizacao_pendente),
    atualizacao_pendente_agenda: raw.atualizacao_pendente_agenda
      ? toFlagSN(raw.atualizacao_pendente_agenda)
      : undefined,
  } as PdvData;

  // Permissões do cadastro no painel — sempre S/N coerente com o Cake (`ctrl_placa_carro` = «placa de carro»).
  if (raw.ctrl_player !== undefined) {
    base.ctrl_player = toFlagSN(raw.ctrl_player);
  }
  if (raw.ctrl_placa_carro !== undefined) {
    base.ctrl_placa_carro = toFlagSN(raw.ctrl_placa_carro);
  }
  if (raw.ctrl_playlists !== undefined) {
    base.ctrl_playlists = toFlagSN(raw.ctrl_playlists);
  }

  return base;
}

const CHAVES_CONTATO_EXTRA_IRMAO = [
  'ContatoExtra',
  'contato_extra',
  'Contato_Extra',
  'contatoextra',
] as const;

/**
 * O Cake às vezes manda o bloco de contato extra como objeto **irmão** de `pdv`
 * no array achatado de `loginByToken` / `ping`. Anexamos em `contato_extra` no PDV
 * para o restante do app (ex.: aviso ALERTACORTE) enxergar.
 */
function pdvRecordComContatoExtraIrmao(
  pdvRec: Record<string, unknown>,
  merged: Record<string, unknown>,
): Record<string, unknown> {
  const jaTem =
    pdvRec.contato_extra != null ||
    pdvRec.ContatoExtra != null ||
    pdvRec.Contato_Extra != null ||
    (pdvRec.contatoextra != null &&
      typeof pdvRec.contatoextra === 'object' &&
      !Array.isArray(pdvRec.contatoextra));
  if (jaTem) return pdvRec;

  for (const k of CHAVES_CONTATO_EXTRA_IRMAO) {
    const blob = merged[k];
    if (blob && typeof blob === 'object' && !Array.isArray(blob)) {
      return { ...pdvRec, contato_extra: blob };
    }
  }
  return pdvRec;
}

export function clienteDataFromApiRecord(raw: Record<string, unknown>): ClienteData {
  const base = { ...raw };
  return {
    ...base,
    id: toNum(raw.id),
    nome: String(raw.nome ?? ''),
    status: raw.status === 'I' ? 'I' : 'A',
    logotipo: String(raw.logotipo ?? ''),
  } as ClienteData;
}

/**
 * Objeto único típico de `extractFromLoginByToken` → shapes usados pelo store.
 */
export function sessionFromLoginByTokenMerge(merged: Record<string, unknown>): {
  token: Token;
  pdv: PdvData;
  cliente: ClienteData;
} {
  const tokenRec = recordFromModel(merged.token, 'token');
  const pdvRec = pdvRecordComContatoExtraIrmao(
    recordFromModel(merged.pdv, 'pdv'),
    merged,
  );
  const clienteRec = recordFromModel(merged.cliente, 'cliente');

  const token = tokenFromRecord(tokenRec);
  if (!token.token) {
    throw new Error('token_vazio');
  }

  return {
    token,
    pdv: pdvDataFromApiRecord(pdvRec),
    cliente: clienteDataFromApiRecord(clienteRec),
  };
}

// ============================================================================
// Endpoints públicos
// ============================================================================

/**
 * Interpreta JSON de `POST /login/`.
 * O CakePHP por vezes devolve `mensagem` como objeto `{"0":"valido","1":"123"}`
 * em vez de array `["valido","123"]` — nesse caso `Array.isArray` falhava e a UI
 * mostrava «login inválido» mesmo com credenciais corretas.
 */
export type ParsedLogin =
  | { ok: true; clienteId: number }
  | { ok: false; codigo: string };

export function parseLoginResponse(raw: unknown): ParsedLogin {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, codigo: 'resposta_desconhecida' };
  }
  const mensagem = (raw as { mensagem?: unknown }).mensagem;

  if (mensagem === 'usuario_invalido') return { ok: false, codigo: 'usuario_invalido' };
  if (mensagem === 'metodo_invalido') return { ok: false, codigo: 'metodo_invalido' };
  if (typeof mensagem === 'string') {
    return { ok: false, codigo: mensagem };
  }

  function tryValidoPair(first: unknown, second: unknown): ParsedLogin | null {
    if (typeof first !== 'string') return null;
    const head = first.trim().toLowerCase();
    if (head !== 'valido') return null;
    if (second === undefined || second === null) return null;
    const clienteId = Number(second);
    if (Number.isFinite(clienteId) && clienteId > 0) {
      return { ok: true, clienteId };
    }
    const alt = Number(String(second).trim());
    if (Number.isFinite(alt) && alt > 0) {
      return { ok: true, clienteId: alt };
    }
    return null;
  }

  if (Array.isArray(mensagem) && mensagem.length >= 2) {
    const hit = tryValidoPair(mensagem[0], mensagem[1]);
    if (hit) return hit;
  }

  if (mensagem && typeof mensagem === 'object' && !Array.isArray(mensagem)) {
    const o = mensagem as Record<string, unknown>;
    const hit = tryValidoPair(o['0'], o['1']);
    if (hit) return hit;
  }

  if (isDebugRedeEnabled()) {
    const tipo =
      mensagem === null || mensagem === undefined
        ? String(mensagem)
        : Array.isArray(mensagem)
          ? `array(len=${mensagem.length})`
          : typeof mensagem;
    console.info('[ibiza-login] parseLoginResponse: formato de mensagem não reconhecido', { tipo });
  }

  return { ok: false, codigo: 'resposta_desconhecida' };
}

/**
 * POST /login/ — autentica usuário (email + senha).
 * Retorna o cliente_id em caso de sucesso.
 *
 * ⚠️ A senha trafega em texto. Em produção PRECISA ser HTTPS.
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const resp = await request<LoginResponse>('/login/', {
    method: 'POST',
    body: { email, password },
  });
  /** Só em modo teste: ajuda suporte sem logar e-mail nem senha (corpo POST nunca entra no histórico). */
  if (isDebugRedeEnabled()) {
    const msg = (resp as { mensagem?: unknown }).mensagem;
    let desc: string;
    if (msg === undefined) desc = '(sem campo mensagem)';
    else if (typeof msg === 'string') desc = msg;
    else {
      try {
        const s = JSON.stringify(msg);
        desc = s.length > 280 ? `${s.slice(0, 277)}…` : s;
      } catch {
        desc = String(msg);
      }
    }
    redeTrace('ibiza-rede', 'info', 'POST /login/ resposta.mensagem:', desc);
  }
  return resp;
}

/**
 * GET `/updatePdvInstalado/` — após escolher o PDV, marca `pdvs.instalado = 'S'`.
 * O `/getPdvs/` no CakePHP só devolve linhas com **`Pdv.instalado = 'N'`** (player AIR chamava ao confirmar).
 */
export async function updatePdvInstalado(params: {
  token: string;
  pdv_id: number;
}): Promise<void> {
  await request<unknown>('/updatePdvInstalado/', {
    query: {
      token: params.token,
      pdv_id: params.pdv_id,
    },
  });
}

/**
 * GET /getPdvs/ — lista PDVs do cliente (servidor: em geral só `instalado = 'N'` — ver PHP).
 */
export async function getPdvs(params: {
  cliente_id: number | string;
  uf?: string;
  cidade?: string;
  nome?: string;
}): Promise<GetPdvsResult> {
  const raw = await request<unknown>('/getPdvs/', {
    query: {
      id: params.cliente_id,
      uf: params.uf,
      cidade: params.cidade,
      nome: params.nome,
    },
  });
  return parseGetPdvsResponse(raw);
}

/**
 * GET /loginByToken/ — valida token e retorna dados do PDV/cliente.
 * É chamado depois que o usuário escolhe um PDV na tela de seleção.
 *
 * Resposta vem como ARRAY: [{ token: ... }, { pdv: ... }, { cliente: ... }]
 * — quem consome geralmente quer "achatar". Veja extractFromLoginByToken().
 */
export async function loginByToken(token: string): Promise<LoginByTokenResponse> {
  return request<LoginByTokenResponse>('/loginByToken/', {
    query: { token },
  });
}

/**
 * Helper que achata o array de objetos do loginByToken pra um objeto único.
 * Lida com o caso de resposta de erro (mensagem: 'token_invalido').
 */
export function extractFromLoginByToken(resp: LoginByTokenResponse) {
  if (!Array.isArray(resp)) {
    return { error: resp.mensagem ?? 'erro_desconhecido' as const, data: null };
  }
  const merged = resp.reduce(
    (acc, item) => ({ ...acc, ...item }),
    {} as Record<string, unknown>,
  );
  return { error: null, data: merged };
}

export type ParsedPing =
  | { kind: 'ok'; pdv: PdvData; mensagem: string }
  | { kind: 'token_invalido' }
  | { kind: 'fail'; detail: string };

/**
 * Interpreta GET /ping/ — pode vir como objeto `{ pdv?, mensagem? }`
 * ou array como `/loginByToken/`.
 */
export function parsePingResponse(raw: unknown): ParsedPing {
  if (raw === null || raw === undefined) {
    return { kind: 'fail', detail: 'resposta_vazia' };
  }

  if (Array.isArray(raw)) {
    const ext = extractFromLoginByToken(raw as LoginByTokenResponse);
    if (ext.error === 'token_invalido') return { kind: 'token_invalido' };
    if (ext.error) return { kind: 'fail', detail: ext.error };
    const merged = ext.data!;
    const msgObj = merged as { mensagem?: unknown };
    if (msgObj.mensagem === 'token_invalido') {
      return { kind: 'token_invalido' };
    }
    const pd = merged.pdv;
    if (!pd || typeof pd !== 'object') {
      return { kind: 'fail', detail: 'pdv_ausente' };
    }
    const pdvRec = pdvRecordComContatoExtraIrmao(
      pd as Record<string, unknown>,
      merged,
    );
    return {
      kind: 'ok',
      pdv: pdvDataFromApiRecord(pdvRec),
      mensagem: 'ping_salvo',
    };
  }

  if (typeof raw !== 'object') {
    return { kind: 'fail', detail: 'formato_invalido' };
  }

  const o = raw as Record<string, unknown>;

  if (o.mensagem === 'token_invalido') {
    return { kind: 'token_invalido' };
  }

  const pdRaw = o.pdv;
  if (pdRaw && typeof pdRaw === 'object' && !Array.isArray(pdRaw)) {
    const pdvRec = pdvRecordComContatoExtraIrmao(pdRaw as Record<string, unknown>, o);
    return {
      kind: 'ok',
      pdv: pdvDataFromApiRecord(pdvRec),
      mensagem: typeof o.mensagem === 'string' ? o.mensagem : 'ping_salvo',
    };
  }

  if (typeof o.mensagem === 'string' && o.mensagem.length > 0) {
    return { kind: 'fail', detail: o.mensagem };
  }

  return { kind: 'fail', detail: 'pdv_ausente' };
}

/**
 * GET /playlist/ — pega toda a programação do PDV.
 * Esse é o endpoint mais "pesado" — pode ter dezenas de playlists com centenas de músicas.
 */
export async function getPlaylist(token: string): Promise<PlaylistResponse> {
  return request<PlaylistResponse>('/playlist/', {
    query: { token },
  });
}

/**
 * GET /agendas/ — pega as agendas (regras de quando cada playlist toca).
 *
 * @param agendaAtualizada Se 1, marca no servidor que o cliente já sincronizou
 */
export async function getAgendas(
  token: string,
  agendaAtualizada = 0,
): Promise<AgendaResponse> {
  return request<AgendaResponse>('/agendas/', {
    query: { token, agenda_atualizada: agendaAtualizada },
  });
}

/**
 * GET /vinhetas_programadas/ — vinhetas que tocam em intervalos regulares.
 */
export async function getVinhetasProgramadas(token: string): Promise<unknown> {
  return request('/vinhetas_programadas/', { query: { token } });
}

/**
 * GET /vinhetas_agendadas/ — vinhetas com data/hora específica.
 */
export async function getVinhetasAgendadas(token: string): Promise<unknown> {
  return request('/vinhetas_agendadas/', { query: { token } });
}

/**
 * GET /ping/ — heartbeat. Chamado a cada TIME_TO_PING minutos.
 *
 * O webservice retorna o estado atualizado do PDV (status, permissões,
 * se há atualização pendente). É também via ping que descobrimos quando
 * o admin desativa um PDV no painel — devemos parar de tocar.
 */
export async function ping(params: {
  token: string;
  /** 1 se acabou de baixar conteúdo novo desde o último ping */
  pdv_atualizado?: 0 | 1;
  /** Geralmente "WIN" ou "MAC" no AS3 — usamos "WEB" no PWA */
  versao_player?: string;
}): Promise<unknown> {
  return request<unknown>('/ping/', {
    query: {
      token: params.token,
      ma: getDeviceId(),
      ip: '0.0.0.0', // o servidor pega via REMOTE_ADDR mesmo
      pdv_atualizado: params.pdv_atualizado ?? 0,
      versao_player: params.versao_player ?? VERSAO_PLAYER,
    },
  });
}

/**
 * GET /save_executadas/ — reporta que uma música terminou.
 * Fire-and-forget: erros não impedem operação.
 */
export async function saveExecutada(params: SaveExecutadaParams): Promise<void> {
  await request('/save_executadas/', {
    query: {
      token: params.token,
      playlists_musica_id: params.playlists_musica_id,
      data_execucao: params.data_execucao,
      ind_termino: params.ind_termino,
    },
  });
}

const SAVE_ATUALIZADAS_CONCORRENCIA = 4;

/**
 * Formato **legado** (player AIR / WebserviceController.php): GET com query —
 * `save_atualizadas/?token=&musica_id=&id_programa=&percentual=100`.
 * Grava `atualizadas` com `programa_id` — é isso que o painel usa no `%` por programa.
 */
async function saveAtualizadasViaGetLegado(
  token: string,
  musica_ids: number[],
  id_programa: number,
): Promise<void> {
  for (let i = 0; i < musica_ids.length; i += SAVE_ATUALIZADAS_CONCORRENCIA) {
    const chunk = musica_ids.slice(i, i + SAVE_ATUALIZADAS_CONCORRENCIA);
    await Promise.all(
      chunk.map((musica_id) =>
        request<{ mensagem?: string }>('/save_atualizadas/', {
          query: {
            token,
            musica_id,
            id_programa,
            percentual: 100,
          },
        }),
      ),
    );
  }
}

/**
 * POST com `musicas[]` — usado quando não temos `programa.id` (fallback) ou servidor novo.
 */
async function saveAtualizadasViaPostBatch(
  token: string,
  musica_ids: number[],
): Promise<void> {
  const formPairs: ReadonlyArray<readonly [string, string]> = musica_ids.map(
    (id): [string, string] => ['musicas[]', String(id)],
  );

  await request<unknown>('/save_atualizadas/', {
    method: 'POST',
    query: { token },
    formPairs,
  });
}

/**
 * Marca músicas como baixadas no servidor (barra «%» no painel).
 * Com `id_programa` (>0) usa o mesmo fluxo GET do player antigo; caso contrário POST em lote.
 */
export async function saveAtualizadas(params: SaveAtualizadasParams): Promise<void> {
  const ids = params.musica_ids
    .map((n) => Math.trunc(Number(n)))
    .filter((n) => Number.isFinite(n) && n > 0);
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;

  const idProg = Math.trunc(Number(params.id_programa ?? 0));
  if (idProg > 0) {
    try {
      await saveAtualizadasViaGetLegado(params.token, unique, idProg);
    } catch (err) {
      console.warn('[save_atualizadas] fluxo GET legado falhou; tentando POST em lote', err);
      await saveAtualizadasViaPostBatch(params.token, unique);
    }
    return;
  }

  await saveAtualizadasViaPostBatch(params.token, unique);
}

/**
 * Constrói a URL para baixar um arquivo de música.
 * NÃO faz a chamada — só monta a URL pra ser passada ao <audio> ou ao Cache Storage.
 *
 * IMPORTANTE: o webservice retorna a URL completa dentro do /playlist/ response
 * (campo `url_musica`). Use AQUELA URL preferencialmente — esta função aqui é
 * fallback ou pra caso a gente queira reescrever a URL via proxy.
 */
export function buildMusicaUrl(params: {
  token: string;
  id_musica: number;
  playlist_id: number;
}): string {
  const url = new URL(`${API_BASE_URL}/get_musica/`, window.location.origin);
  url.searchParams.set('token', params.token);
  url.searchParams.set('id_musica', String(params.id_musica));
  url.searchParams.set('playlist_id', String(params.playlist_id));
  return url.toString();
}
