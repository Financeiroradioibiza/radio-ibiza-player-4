/**
 * Isolamento Player 5 (sistema novo) ↔ webservice legado (cloud.radioibiza / envyron).
 * Ver DEC-013 e docs/AMBIENTE-TESTE-DEPLOY.md.
 */

/** Hosts do webservice legado — Player 5 NUNCA pode usar. */
const PRODUCTION_WS_HOSTS = ['cloud.radioibiza.com.br', 'envyron.radioibiza.com.br'] as const;

/** Hosts autorizados para o webservice novo (deploy + dev local). */
export const PLAYER5_WS_HOSTS = [
  '127.0.0.1',
  'localhost',
  'cloud2.radioibiza.app.br',
] as const;

/** Player 5 em produção (Netlify site separado). */
export const PLAYER5_PUBLIC_ORIGIN = 'https://player5.radioibiza.app.br';

/** Webservice novo (portal-ibiza no Envyron). */
export const PLAYER5_API_PUBLIC_ORIGIN = 'https://cloud2.radioibiza.app.br';

export function isProductionWebserviceHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return PRODUCTION_WS_HOSTS.some((prod) => h === prod || h.endsWith(`.${prod}`));
}

export function isAllowedPlayer5WebserviceHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return PLAYER5_WS_HOSTS.some((ok) => h === ok || h.endsWith(`.${ok}`));
}

/** Player 5: bloqueia boot se a API apontar para o webservice legado. */
export function assertPlayer5Isolation(apiBaseUrl: string, isDev: boolean): void {
  const base = apiBaseUrl.replace(/\/$/, '');

  /** Netlify player5: `/api` → proxy para cloud2.radioibiza.app.br (netlify.player5.toml). */
  if (base === '/api' || base.startsWith('/api/')) {
    if (isDev) {
      throw new Error(
        '[Player 5] Em dev local use VITE_WEBSERVICE_URL=http://127.0.0.1:3000/api. ' +
          'O proxy /api do Vite aponta para o legado.',
      );
    }
    return;
  }

  let host: string;
  try {
    host = new URL(base).hostname;
  } catch {
    throw new Error(`[Player 5] URL da API inválida (${apiBaseUrl}).`);
  }

  if (isProductionWebserviceHost(host)) {
    throw new Error(
      `[Player 5] BLOQUEADO: API aponta para o legado (${host}). ` +
        `Use ${PLAYER5_API_PUBLIC_ORIGIN}/api ou dev local.`,
    );
  }

  if (!isAllowedPlayer5WebserviceHost(host)) {
    throw new Error(
      `[Player 5] Host da API não autorizado (${host}). ` +
        `Permitidos: ${PLAYER5_WS_HOSTS.join(', ')}.`,
    );
  }
}

export const PLAYER5_ENV_LABEL = 'PLAYER 5 — SISTEMA NOVO';
