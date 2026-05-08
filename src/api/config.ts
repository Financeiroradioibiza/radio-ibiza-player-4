/**
 * Configuração da API do webservice Radio Ibiza.
 *
 * A URL base muda entre dev e produção:
 * - DEV: `/api` → proxy do Vite → cloud
 * - PROD: ou URL direta do cloud (precisa CORS) ou `VITE_WEBSERVICE_URL=/api`
 *         com reverse proxy na hospedagem (repo: `netlify.toml` no Netlify)
 */

const isDev = import.meta.env.DEV;

/**
 * Base URL da API.
 *
 * Sobrescrever: `VITE_WEBSERVICE_URL` no build — ver `.env.example`.
 * Netlify: já define `/api` em `netlify.toml` (proxy, sem CORS no PHP).
 */
const rawWs = import.meta.env.VITE_WEBSERVICE_URL;
export const API_BASE_URL = isDev
  ? '/api'
  : typeof rawWs === 'string' && rawWs.length > 0
    ? rawWs.replace(/\/$/, '')
    : 'https://cloud.radioibiza.com.br/services/webservice';

/**
 * Diagnóstico de rede (`[ibiza-rede]` + botão «Copiar diagnóstico»):
 * - build com `VITE_DEBUG_REDE=1`, ou
 * - em execução: URL `?debug_rede=1` (ou `debugRede=1`), ou
 * - `localStorage` / `sessionStorage` chave `radio_ibiza_debug_rede` = `1`
 *
 * Último caso sem rebuild — útil em Netlify sem injetar debug no bundle global.
 */
const envDebugRede =
  import.meta.env.VITE_DEBUG_REDE === '1' || import.meta.env.VITE_DEBUG_REDE === 'true';

export function isDebugRedeEnabled(): boolean {
  if (envDebugRede) return true;
  if (typeof window === 'undefined') return false;
  try {
    if (window.sessionStorage.getItem('radio_ibiza_debug_rede') === '1') return true;
    if (window.localStorage.getItem('radio_ibiza_debug_rede') === '1') return true;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('debug_rede') === '1' || sp.get('debugRede') === '1') return true;
  } catch {
    //
  }
  return false;
}

/** Logs de rede no console: use isDebugRedeEnabled(). Mantido como alias do env para compat. */
export const DEBUG_REDE = envDebugRede;

/** Path + query com `token` truncado para log — nunca logar corpo POST (senhas). */
export function redactUrlForLog(absUrl: URL): string {
  const clone = new URL(absUrl.href);
  const tok = clone.searchParams.get('token');
  if (tok != null && tok.length > 0) {
    clone.searchParams.set(
      'token',
      tok.length > 10 ? `${tok.slice(0, 4)}…${tok.slice(-2)}` : '***',
    );
  }
  const q = clone.searchParams.toString();
  return q ? `${clone.pathname}?${q}` : clone.pathname;
}

/**
 * Limites operacionais — copiados do Config.as do player antigo
 * para manter o mesmo comportamento de bloqueio/sincronização.
 */
export const LIMITES = {
  /** Após N pings consecutivos falhos, o player se desativa (18h × 30 dias) */
  LIMIT_TIMES_PING_OFF: 540,

  /** Intervalo do ping em minutos */
  TIME_TO_PING_MIN: 60,

  /** Verifica agenda local a cada N segundos */
  TIME_TO_CHECK_AGENDA_LOCAL_SEC: 50,

  /** Busca agenda na nuvem a cada N minutos */
  TIME_TO_CHECK_AGENDA_NUVEM_MIN: 20,

  /** Após N horas sem usar modo manual, volta pro automático */
  TIME_TO_UNSET_PLAYER_MANUAL_H: 12,

  /** Timeout padrão de qualquer requisição HTTP, em ms */
  REQUEST_TIMEOUT_MS: 30_000,

  /**
   * Player AS3: a próxima faixa ambient sobe nos últimos N segundos da atual (crossfade de volume).
   */
  MIXAGEM_ANTES_FIM_SEC: 10,
  /** Duração do fade linear entre as duas faixas (≤ janela acima). */
  MIXAGEM_FADE_SEC: 8,

  /**
   * Se a faixa ambiente já passou deste tempo (s), «voltar» reinicia do zero;
   * senão tenta a faixa ambiente anterior (histórico de um passo).
   */
  SKIP_BACK_RESTART_SEC: 3,
} as const;

/**
 * Versão informada ao webservice no ping.
 * Usar prefixo "WEB" pra diferenciar dos players AS3 antigos no painel admin.
 */
export const VERSAO_PLAYER = '4.0.0_WEB';

/**
 * Identificador estável do «aparelho» no PWA: UUID em `localStorage`.
 * O mesmo valor vai no parâmetro `ma` do `/ping/` (no lugar do MAC do AS3).
 * A sessão em IndexedDB grava `install_device_id` igual a este ID na primeira
 * ativação — cópia só do banco sem o localStorage deste navegador falha o boot.
 */
export function getDeviceId(): string {
  const KEY = 'radio_ibiza_device_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
