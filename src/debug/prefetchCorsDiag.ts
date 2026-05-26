/**
 * Log em memória da pipeline de prefetch MP3 (`ensurePlaybackUrl`) só quando
 * `isDebugRedeEnabled()` está activo (?debug_rede=1, storage, ou VITE_DEBUG_REDE).
 *
 * URLs: por defeito **`token`** truncado (`redactUrlForLog`). Modo opcional (**só junto**
 * com rede debug:** `?debug_prefetch_token=1`, ou `radio_ibiza_diag_prefetch_token_completo`
 * na sessionStorage, ou build `VITE_IBIZA_DIAG_PREFETCH_TOKEN_COMPLETO=1`) mostra query completa.
 */

import { isDebugRedeEnabled, redactUrlForLog } from '../api/config';

const MAX_LINHAS = 200;
const MAX_MOSTRADAS_NA_UI = 80;

export type PrefetchCorsDiagLinha = { iso: string; msg: string };

const linhas: PrefetchCorsDiagLinha[] = [];
const listeners = new Set<() => void>();

/**
 * Opcional (**exige `isDebugRedeEnabled()`**): pedido explícito em URL, storage ou env Vite
 * (`VITE_IBIZA_DIAG_PREFETCH_TOKEN_COMPLETO`) — só para testes com equipa própria.
 */
export function prefetchCorsDiagMostrarTokenCompleto(): boolean {
  if (!isDebugRedeEnabled() || typeof window === 'undefined') return false;
  try {
    const env = String(import.meta.env?.VITE_IBIZA_DIAG_PREFETCH_TOKEN_COMPLETO ?? '')
      .trim()
      .toLowerCase();
    if (env === '1' || env === 'true' || env === 'yes') return true;

    const sp = new URLSearchParams(window.location.search);
    if (sp.get('debug_prefetch_token') === '1') return true;

    if (window.sessionStorage.getItem('radio_ibiza_diag_prefetch_token_completo') === '1')
      return true;
  } catch {
    //
  }
  return false;
}

export function prefetchCorsDiagRedactFetchUrl(remotoRelOuAbsoluto: string): string {
  if (typeof window === 'undefined') return remotoRelOuAbsoluto.slice(0, 120);
  try {
    const u = new URL(remotoRelOuAbsoluto, window.location.origin);
    if (prefetchCorsDiagMostrarTokenCompleto()) {
      return `${u.hostname}${u.pathname}${u.search}`;
    }
    return `${u.hostname}${redactUrlForLog(u)}`;
  } catch {
    return '[url-inválida]';
  }
}

export function prefetchCorsDiagPush(mensagem: string): void {
  if (!isDebugRedeEnabled() || typeof window === 'undefined') return;
  const iso = new Date().toISOString();
  linhas.push({ iso, msg: mensagem });
  if (linhas.length > MAX_LINHAS) linhas.splice(0, linhas.length - MAX_LINHAS);
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* noop */
    }
  }
}

export function prefetchCorsDiagUltimasLinhas(): PrefetchCorsDiagLinha[] {
  return linhas.slice(-MAX_MOSTRADAS_NA_UI);
}

export function prefetchCorsDiagSubscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Cabeçalho + linhas (`token` omitido nos GET salvo modo `prefetchCorsDiagMostrarTokenCompleto`). */
export function prefetchCorsDiagTextoCabecalhoELog(cabecalho: Record<string, string>): string {
  const h = Object.entries(cabecalho)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const body = prefetchCorsDiagUltimasLinhas()
    .map((x) => `${x.iso} ${x.msg}`)
    .join('\n');
  return `${h}\n---\n${body}`;
}
