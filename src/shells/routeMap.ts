import { MOBILE_ROUTE_PREFIX } from './constants';

/** Rotas da app (sem prefixo) que existem em desktop e em `/m/*`. */
export const APP_ROUTE_SEGMENTS = [
  'login',
  'selecionar-pdv',
  'primeira-carga',
  'player',
] as const;

export type AppRouteSegment = (typeof APP_ROUTE_SEGMENTS)[number];

export function normalizePathname(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

export function pathHasMobilePrefix(pathname: string): boolean {
  const n = normalizePathname(pathname);
  return n === MOBILE_ROUTE_PREFIX || n.startsWith(`${MOBILE_ROUTE_PREFIX}/`);
}

/** `/login` → `/m/login` (preserva só o segmento da app). */
export function desktopPublicPathToMobile(pathname: string): string | null {
  const n = normalizePathname(pathname);
  for (const seg of APP_ROUTE_SEGMENTS) {
    if (n === `/${seg}`) return `${MOBILE_ROUTE_PREFIX}/${seg}`;
  }
  return null;
}

/** Lista para redirect quando o dispositivo usa shell mobile mas a URL ainda é a do desktop. */
export function shouldSyncUrlToMobilePrefix(pathname: string): boolean {
  if (pathHasMobilePrefix(pathname)) return false;
  return desktopPublicPathToMobile(pathname) != null;
}
