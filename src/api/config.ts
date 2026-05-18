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
  /**
   * Após N períodos de ping consecutivos sem sucesso, o player se desativa.
   * Com `TIME_TO_PING_MIN = 60`: N = 3 × 24 = 72 (três dias sem conectar ao servidor).
   */
  LIMIT_TIMES_PING_OFF: 72,

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
 * Targets suportados pelo player (ver `DEC-009` em DECISIONS.md):
 * - `WEB` — PWA hospedado (Netlify)
 * - `W`   — Electron Windows
 * - `M`   — Electron Mac (futuro)
 * - `A`   — Android (futuro)
 * - `I`   — iOS (futuro)
 *
 * Build-time o Vite injeta `VITE_IBIZA_TARGET` (ver scripts npm `build:win` etc.).
 * Runtime fallback: detecta `window.electronAPI` (exposto pelo preload do Electron).
 */
export type IbizaTarget = 'WEB' | 'W' | 'M' | 'A' | 'I';

/**
 * Versão semver do pacote (`version` no package.json) — única usada no ping ao webservice.
 */
export const PACKAGE_VERSION =
  typeof import.meta.env.VITE_PACKAGE_VERSION === 'string' && import.meta.env.VITE_PACKAGE_VERSION.length > 0
    ? import.meta.env.VITE_PACKAGE_VERSION
    : '4.0.0';

/**
 * Numeração do shell no Netlify (micro-releases: 4.0.0000 → 4.0.0001 via `ibizaShellVersion`).
 * Só compara com `/version.json`; não é enviada ao CakePHP.
 */
export const IBIZA_SHELL_VERSION =
  typeof import.meta.env.VITE_IBIZA_SHELL_VERSION === 'string' &&
  import.meta.env.VITE_IBIZA_SHELL_VERSION.length > 0
    ? import.meta.env.VITE_IBIZA_SHELL_VERSION
    : '4.0.0000';

/**
 * Origem pública do PWA — usada no Electron (`file://`) para chamar Netlify Functions.
 * Opcional: `VITE_PLAYER_PUBLIC_ORIGIN` (ex.: https://player4.radioibiza.com.br).
 */
export const IBIZA_PLAYER_PUBLIC_ORIGIN =
  typeof import.meta.env.VITE_PLAYER_PUBLIC_ORIGIN === 'string' &&
  import.meta.env.VITE_PLAYER_PUBLIC_ORIGIN.trim().length > 0
    ? import.meta.env.VITE_PLAYER_PUBLIC_ORIGIN.trim().replace(/\/$/, '')
    : 'https://player4.radioibiza.com.br';

const PATH_PLAYER_AVISOS = '/.netlify/functions/player-avisos';
const PATH_PLAYER_AVISOS_ADMIN = '/.netlify/functions/player-avisos-admin';

/**
 * URL absoluta do GET de avisos operador, ou `null` se desligado / indisponível.
 * A chamada HTTP deve falhar em silêncio para o utilizador.
 */
export function resolvePlayerAvisosUrl(): string | null {
  if (typeof window === 'undefined') return null;
  if (import.meta.env.VITE_PLAYER_AVISOS_DISABLED === '1') return null;
  try {
    const custom = import.meta.env.VITE_PLAYER_AVISOS_URL?.trim();
    if (custom) return custom;
    if (window.location.protocol === 'file:') {
      return `${IBIZA_PLAYER_PUBLIC_ORIGIN}${PATH_PLAYER_AVISOS}`;
    }
    return new URL(PATH_PLAYER_AVISOS, window.location.origin).href;
  } catch {
    return null;
  }
}

/** URL do POST administrativo (mesma origem que o PWA em produção). */
export function resolvePlayerAvisosAdminUrl(): string {
  if (typeof window === 'undefined') {
    return `${IBIZA_PLAYER_PUBLIC_ORIGIN}${PATH_PLAYER_AVISOS_ADMIN}`;
  }
  try {
    const custom = import.meta.env.VITE_PLAYER_AVISOS_ADMIN_URL?.trim();
    if (custom) return custom;
    if (window.location.protocol === 'file:') {
      return `${IBIZA_PLAYER_PUBLIC_ORIGIN}${PATH_PLAYER_AVISOS_ADMIN}`;
    }
    return new URL(PATH_PLAYER_AVISOS_ADMIN, window.location.origin).href;
  } catch {
    return `${IBIZA_PLAYER_PUBLIC_ORIGIN}${PATH_PLAYER_AVISOS_ADMIN}`;
  }
}

function detectarTarget(): IbizaTarget {
  const envTarget = (import.meta.env?.VITE_IBIZA_TARGET ?? '').toString().toUpperCase();
  if (envTarget === 'WEB' || envTarget === 'W' || envTarget === 'M' || envTarget === 'A' || envTarget === 'I') {
    return envTarget;
  }
  // Sem env explícita: se o preload Electron rodou, é build desktop. Default = WEB.
  if (typeof window !== 'undefined' && (window as unknown as { electronAPI?: unknown }).electronAPI) {
    // Sem distinção W vs M aqui — em runtime de Electron sem env setada, marcamos
    // genericamente como "W" pra não confundir o WEB no painel. Build oficial sempre
    // seta `VITE_IBIZA_TARGET` corretamente; isto é só rede de segurança.
    return 'W';
  }
  return 'WEB';
}

export const IBIZA_TARGET: IbizaTarget = detectarTarget();

/** Sufixo do `/ping/` — alinha com DEC-009 (WEB em minúsculo para não confundir com Windows). */
const SUFIXO_VERSAO_WEBSERVICE: Record<IbizaTarget, string> = {
  WEB: 'w',
  W: 'W',
  M: 'M',
  A: 'A',
  I: 'I',
};

/** `major.minor` extraído do semver do pacote (patch não entra no ping). */
function baseVersaoWebservice(): string {
  const m = /^(\d+)\.(\d+)/.exec(PACKAGE_VERSION.trim());
  if (m) return `${m[1]}.${m[2]}`;
  return '4.0';
}

/**
 * PWA (target WEB): sufixo do `/ping/` distingue SO no cliente (minúsculas; não confunde
 * com `W`/`M` maiúsculos do Electron — DEC-009).
 * - `w` — Windows desktop
 * - `m` — macOS desktop (navegador / PWA instalado)
 * - `wi` — iPhone / iPad / iPod
 * - `wa` — Android
 * - `wl` — Linux e demais não cobertos
 */
function sufixoVersaoPlayerPwa(): string {
  if (typeof navigator === 'undefined') return SUFIXO_VERSAO_WEBSERVICE.WEB;

  const ua = navigator.userAgent || '';

  if (/iPhone|iPad|iPod/i.test(ua)) return 'wi';
  // iPadOS 13+ pode reportar platform «MacIntel» com toque.
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return 'wi';

  if (/Android/i.test(ua)) return 'wa';

  const platform = navigator.platform || '';
  if (/Win/i.test(platform) || /Windows/i.test(ua)) return 'w';

  if (/Mac/i.test(platform)) return 'm';

  if (/Linux/i.test(platform) || /Linux/i.test(ua)) return 'wl';

  return SUFIXO_VERSAO_WEBSERVICE.WEB;
}

/**
 * Versão informada ao webservice no ping (campo `versao_player`).
 * Formato compacto `<major>.<minor><sufixo>` — PWA em minúsculas por SO (`4.0w`, `4.0m`, …);
 * Electron uma maiúscula por target (`4.0W`, `4.0M`, …).
 */
export const VERSAO_PLAYER =
  IBIZA_TARGET === 'WEB'
    ? `${baseVersaoWebservice()}${sufixoVersaoPlayerPwa()}`
    : `${baseVersaoWebservice()}${SUFIXO_VERSAO_WEBSERVICE[IBIZA_TARGET]}`;

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
