/**
 * URL do guia PWA estático. Query `v` força o browser a pedir HTML novo após cada
 * deploy (complementa `Cache-Control` + regra Workbox `NetworkOnly` em `/instalar.html`).
 */
export function getInstalarGuiaUrl(): string {
  const v = import.meta.env.VITE_IBIZA_SHELL_VERSION;
  const q = encodeURIComponent(typeof v === 'string' && v.length > 0 ? v : '0');
  return `/instalar.html?v=${q}`;
}
