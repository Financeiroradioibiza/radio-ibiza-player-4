/**
 * Configuração da API do webservice Radio Ibiza.
 *
 * A URL base muda entre dev e produção:
 * - DEV: usa proxy do Vite em /api → resolve CORS
 * - PROD: precisa apontar diretamente, e o servidor TEM que ter CORS configurado
 *         (ou o app tem que estar no mesmo domínio do webservice)
 */

const isDev = import.meta.env.DEV;

/**
 * Base URL da API.
 *
 * Em dev: /api → o Vite faz proxy para /services/webservice no servidor real
 * Em prod: aponta direto pro webservice (precisa de CORS no servidor!)
 *
 * Sobrescrever URL (staging / mirror): variável em build — ver `.env.example`
 * e `deploy/cors-snippet.exemplo.txt` (CORS no servidor do webservice).
 */
export const API_BASE_URL = isDev
  ? '/api'
  : (import.meta.env.VITE_WEBSERVICE_URL ?? 'https://cloud.radioibiza.com.br/services/webservice');

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
} as const;

/**
 * Versão informada ao webservice no ping.
 * Usar prefixo "WEB" pra diferenciar dos players AS3 antigos no painel admin.
 */
export const VERSAO_PLAYER = '4.0.0_WEB';

/**
 * Identificador único do dispositivo (substitui o MAC address que o AS3 lia).
 * No PWA, geramos um UUID na primeira execução e guardamos no localStorage.
 * Não é tão único quanto MAC mas o webservice só usa isso pra logging.
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
