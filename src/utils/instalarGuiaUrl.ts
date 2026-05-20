import { IBIZA_SHELL_VERSION, IBIZA_SHELL_VERSION_MOBILE } from '@/api/config';

/**
 * URL do guia PWA estático. Query `v` força o browser a pedir HTML novo após cada
 * deploy (complementa `Cache-Control` + regra Workbox `NetworkOnly`).
 */
export function getInstalarGuiaUrl(opts?: { mobile?: boolean }): string {
  const mobile = opts?.mobile === true;
  const v = mobile ? IBIZA_SHELL_VERSION_MOBILE : IBIZA_SHELL_VERSION;
  const path = mobile ? '/m/instalar.html' : '/instalar.html';
  const q = encodeURIComponent(v.length > 0 ? v : '0');
  return `${path}?v=${q}`;
}
