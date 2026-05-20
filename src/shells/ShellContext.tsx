/**
 * Contexto do shell PWA: desktop vs mobile (prefixo `/m`).
 * O prefixo efectivo segue a URL (`/m/...`) ou o dispositivo (touch / SO mobile) antes do sync da barra de endereços.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import { IBIZA_TARGET, shouldUseIbizaPwaTouchShellLayout } from '@/api/config';

import { MOBILE_ROUTE_PREFIX } from './constants';
import { pathHasMobilePrefix } from './routeMap';

export type ShellKind = 'desktop' | 'mobile';

export type ShellContextValue = {
  shell: ShellKind;
  /** `''` ou `'/m'` — prefixo para `Navigate` / `navigate()`. */
  routePrefix: string;
  /** Rota pública completa (ex.: `path('/login')` → `/m/login` no shell mobile). */
  path: (relative: `/${string}` | AppRouteKey) => string;
};

/** Alias legível para `path()`. */
export type AppRouteKey =
  | '/login'
  | '/selecionar-pdv'
  | '/primeira-carga'
  | '/player'
  | '/';

const ShellReactContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const urlMobile = pathHasMobilePrefix(pathname);
  const deviceWantsMobileShell = IBIZA_TARGET === 'WEB' && shouldUseIbizaPwaTouchShellLayout();

  const value = useMemo((): ShellContextValue => {
    const useMobileRoutes = urlMobile || deviceWantsMobileShell;
    const routePrefix = useMobileRoutes ? MOBILE_ROUTE_PREFIX : '';
    const shell: ShellKind = useMobileRoutes ? 'mobile' : 'desktop';

    function path(relative: `/${string}` | AppRouteKey): string {
      if (relative === '/') {
        return routePrefix === '' ? '/' : `${routePrefix}/`;
      }
      const r = relative.startsWith('/') ? relative : `/${relative}`;
      return `${routePrefix}${r}`;
    }

    return { shell, routePrefix, path };
  }, [urlMobile, deviceWantsMobileShell, pathname]);

  return <ShellReactContext.Provider value={value}>{children}</ShellReactContext.Provider>;
}

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellReactContext);
  if (!ctx) {
    throw new Error('useShell: fora de ShellProvider (ver main.tsx).');
  }
  return ctx;
}
