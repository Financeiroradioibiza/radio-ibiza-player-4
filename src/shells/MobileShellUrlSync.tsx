/**
 * Força `/login` → `/m/login` (etc.) quando o shell mobile está activo e a barra ainda mostra a rota «desktop».
 */

import { useLayoutEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { IBIZA_TARGET, shouldUseIbizaPwaTouchShellLayout } from '@/api/config';

import { desktopPublicPathToMobile, pathHasMobilePrefix } from './routeMap';

export function MobileShellUrlSync() {
  const loc = useLocation();
  const navigate = useNavigate();

  useLayoutEffect(() => {
    if (IBIZA_TARGET !== 'WEB') return;
    if (!shouldUseIbizaPwaTouchShellLayout()) return;
    if (pathHasMobilePrefix(loc.pathname)) return;

    const target = desktopPublicPathToMobile(loc.pathname);
    if (!target) return;

    navigate(
      {
        pathname: target,
        search: loc.search,
        hash: loc.hash,
      },
      { replace: true },
    );
  }, [loc.pathname, loc.search, loc.hash, navigate]);

  return null;
}
