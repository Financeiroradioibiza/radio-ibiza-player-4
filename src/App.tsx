import { useEffect } from 'react';
import clsx from 'clsx';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import {
  IBIZA_SHELL_VERSION,
  IBIZA_SHELL_VERSION_MOBILE,
  IBIZA_TARGET,
  applyIbizaPwaTouchOsLayoutAttr,
} from './api/config';
import { useUiThemeStore } from './store/uiThemeStore';
import { useAppStore } from './store/app';
import { forcarRenovacaoCacheShellAposInstalacaoPwa, verificarAtualizacaoShell } from './player/appShellUpdate';
import { LoginPage as DesktopLoginPage } from '@/shells/desktop/pages/LoginPage';
import { SelecionarPdvPage as DesktopSelecionarPdvPage } from '@/shells/desktop/pages/SelecionarPdvPage';
import { PlayerPage as DesktopPlayerPage } from '@/shells/desktop/pages/PlayerPage';
import { PrimeiraCargaPage as DesktopPrimeiraCargaPage } from '@/shells/desktop/pages/PrimeiraCargaPage';
import { LoginPage as MobileLoginPage } from '@/shells/mobile/pages/LoginPage';
import { SelecionarPdvPage as MobileSelecionarPdvPage } from '@/shells/mobile/pages/SelecionarPdvPage';
import { PlayerPage as MobilePlayerPage } from '@/shells/mobile/pages/PlayerPage';
import { PrimeiraCargaPage as MobilePrimeiraCargaPage } from '@/shells/mobile/pages/PrimeiraCargaPage';
import { LoadingScreen } from './components/LoadingScreen';
import { DebugDiagFloating } from './components/DebugDiagFloating';
import { PlayerTabLeaseGuard } from './components/PlayerTabLeaseGuard';
import PlayerLayoutSandboxPage from './pages/PlayerLayoutSandboxPage';
import { AvisosOperadorAdminPage } from './pages/AvisosOperadorAdminPage';
import { MobileShellUrlSync } from '@/shells/MobileShellUrlSync';
import { useShell } from '@/shells/ShellContext';
import { MOBILE_ROUTE_PREFIX } from '@/shells/constants';
import { normalizePathname } from '@/shells/routeMap';

/** Rotas de protótipo visual; só ativas com `npm run dev` ou `VITE_ENABLE_LAYOUT_SANDBOX=1` no `.env`. */
const LAYOUT_SANDBOX_PATHS = new Set(['/sandbox/player-layouts', '/dev/layouts']);

/** HTML estático em `public/instalador-desktop/` — fora do bundle React. */
function InstaladorDesktopEscape() {
  useEffect(() => {
    window.location.replace('/instalador-desktop/index.html');
  }, []);
  return <LoadingScreen mensagem="A abrir página do instalador…" />;
}

function layoutSandboxEnabled(): boolean {
  return (
    import.meta.env.DEV === true ||
    import.meta.env.MODE === 'development' ||
    import.meta.env.VITE_ENABLE_LAYOUT_SANDBOX === '1'
  );
}

function LayoutSandboxGate() {
  if (layoutSandboxEnabled()) {
    return <PlayerLayoutSandboxPage />;
  }
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-6 py-12 text-zinc-900 dark:text-zinc-100">
      <h1 className="text-xl font-bold text-amber-700 dark:text-amber-200">Protótipos de layout (sandbox)</h1>
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
        Esta rota só carrega os mocks quando o projeto corre em <strong className="text-zinc-900 dark:text-white">modo desenvolvimento</strong>{' '}
        (<code className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs dark:bg-zinc-800">npm run dev</code>
        ), ou quando define no ficheiro <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs dark:bg-zinc-800">.env</code> local:
      </p>
      <pre className="overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-100/90 p-4 text-xs text-zinc-800 dark:border-white/10 dark:bg-black/50 dark:text-zinc-200">
        VITE_ENABLE_LAYOUT_SANDBOX=1
      </pre>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Se já usou o player aqui antes, em Chrome abra <strong className="text-zinc-800 dark:text-zinc-200">DevTools → Application → Service Workers</strong>{' '}
        e use <em>Unregister</em>; depois recarregue (evita bundle antigo em cache).
      </p>
      <a
        href="/"
        className="inline-flex w-fit rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
      >
        Ir ao início
      </a>
    </div>
  );
}

function PlayerRouteGate() {
  const { path, shell } = useShell();
  const token = useAppStore((s) => s.token);
  const playlistData = useAppStore((s) => s.playlistData);
  if (!token?.token) return <Navigate to={path('/login')} replace />;
  if (playlistData == null) return <Navigate to={path('/primeira-carga')} replace />;
  const PlayerPageComponent = shell === 'mobile' ? MobilePlayerPage : DesktopPlayerPage;
  return (
    <PlayerTabLeaseGuard>
      <PlayerPageComponent />
    </PlayerTabLeaseGuard>
  );
}

/** Só há sessão; redirecionar para `/player` é feito em `PrimeiraCargaPage` quando `!busy` (evita cortar o sync). */
function PrimeiraCargaRouteGate() {
  const { path, shell } = useShell();
  const token = useAppStore((s) => s.token);
  if (!token?.token) return <Navigate to={path('/login')} replace />;
  const PrimeiraCargaPageComponent = shell === 'mobile' ? MobilePrimeiraCargaPage : DesktopPrimeiraCargaPage;
  return <PrimeiraCargaPageComponent />;
}

const THEME_COLOR_NIGHT = '#08080a';
const THEME_COLOR_DAY = '#f4f2f8';

function AppRoutesInner() {
  return (
    <>
      <MobileShellUrlSync />
      <Routes>
        <Route path="/sandbox/player-layouts" element={<LayoutSandboxGate />} />
        <Route path="/dev/layouts" element={<LayoutSandboxGate />} />
        <Route path="/instalador-desktop" element={<InstaladorDesktopEscape />} />
        <Route path="/instalador-desktop/" element={<InstaladorDesktopEscape />} />
        <Route path="/avisos-operador" element={<AvisosOperadorAdminPage />} />

        <Route path="/m" element={<Navigate to={`${MOBILE_ROUTE_PREFIX}/login`} replace />} />
        <Route path="/m/" element={<Navigate to={`${MOBILE_ROUTE_PREFIX}/login`} replace />} />

        <Route path="/login" element={<DesktopLoginPage />} />
        <Route path="/selecionar-pdv" element={<DesktopSelecionarPdvPage />} />
        <Route path="/primeira-carga" element={<PrimeiraCargaRouteGate />} />
        <Route path="/player" element={<PlayerRouteGate />} />

        <Route path={`${MOBILE_ROUTE_PREFIX}/login`} element={<MobileLoginPage />} />
        <Route path={`${MOBILE_ROUTE_PREFIX}/selecionar-pdv`} element={<MobileSelecionarPdvPage />} />
        <Route path={`${MOBILE_ROUTE_PREFIX}/primeira-carga`} element={<PrimeiraCargaRouteGate />} />
        <Route path={`${MOBILE_ROUTE_PREFIX}/player`} element={<PlayerRouteGate />} />

        <Route path="*" element={<RouteByStatus />} />
      </Routes>
    </>
  );
}

export default function App() {
  const location = useLocation();
  const status = useAppStore((s) => s.status);
  const hidratar = useAppStore((s) => s.hidratar);
  const uiTheme = useUiThemeStore((s) => s.theme);
  const { shell } = useShell();

  const pathNorm = normalizePathname(location.pathname);
  /** Central de avisos — rota pública; login só no formulário da página. */
  const isAvisosOperadorPath = pathNorm === '/avisos-operador';
  /** Player encostado ao topo reduz faixa preta «em baixo» no PWA/janela alta; padding igual ao hook `usePlayerViewportScale`. */
  const shellPlayer = pathNorm === '/player' || pathNorm === `${MOBILE_ROUTE_PREFIX}/player`;
  /** `/m/player`: ecrã cheio sempre (tablets com `pointer: fine` não podem cair no layout «cartão PC»). */
  const mobileRoutePlayer = pathNorm === `${MOBILE_ROUTE_PREFIX}/player`;
  const isPrimeiraCargaPath =
    pathNorm === '/primeira-carga' || pathNorm === `${MOBILE_ROUTE_PREFIX}/primeira-carga`;
  const isLayoutSandboxPath = LAYOUT_SANDBOX_PATHS.has(pathNorm);
  const isInstaladorDesktopPath =
    pathNorm === '/instalador-desktop' || location.pathname.startsWith('/instalador-desktop/');

  // No primeiro render, hidrata o estado do IndexedDB
  useEffect(() => {
    void hidratar();
  }, [hidratar]);

  /** Reaplica `data-ibiza-pwa-touch-os` após montar (media/CH estáveis; evita flash layout PC em Android). */
  useEffect(() => {
    applyIbizaPwaTouchOsLayoutAttr();
  }, []);

  /** PWA: ao confirmar a instalação do aplicativo — renova só o shell em cache (músicas intactas) e recarrega. */
  useEffect(() => {
    if (IBIZA_TARGET !== 'WEB' || import.meta.env.DEV) return;
    const onInstalled = () => {
      void forcarRenovacaoCacheShellAposInstalacaoPwa();
    };
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, []);

  /** PWA: uma vez por dia ao abrir o site, compara `/version.json` com o bundle (micro versão interna). */
  useEffect(() => {
    void verificarAtualizacaoShell({
      versaoLocal: shell === 'mobile' ? IBIZA_SHELL_VERSION_MOBILE : IBIZA_SHELL_VERSION,
      motivo: 'daily',
      shell,
    });
  }, [shell]);

  /** Em `/player` a altura da página acompanha o cartão — evita faixa preta enorme por baixo no desktop. */
  useEffect(() => {
    if (!shellPlayer) {
      document.documentElement.removeAttribute('data-player-compact');
      return;
    }
    document.documentElement.setAttribute('data-player-compact', '1');
    return () => document.documentElement.removeAttribute('data-player-compact');
  }, [shellPlayer]);

  /** Persiste ?debug_rede=1 na aba (sessionStorage) e notifica o botão de diagnóstico. */
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('debug_rede') === '1' || sp.get('debugRede') === '1') {
        if (sessionStorage.getItem('radio_ibiza_debug_rede') !== '1') {
          sessionStorage.setItem('radio_ibiza_debug_rede', '1');
          window.dispatchEvent(new CustomEvent('radio-ibiza-debug-rede'));
        }
      }
    } catch {
      //
    }
  }, []);

  useEffect(() => {
    const c = uiTheme === 'night' ? THEME_COLOR_NIGHT : THEME_COLOR_DAY;
    try {
      const meta = document.getElementById('meta-theme-color');
      if (meta && 'content' in meta) (meta as HTMLMetaElement).content = c;
    } catch {
      //
    }
  }, [uiTheme]);

  return (
    <div
      className={clsx(
        'flex w-full min-w-0 flex-col items-center bg-ibiza-shell-day text-zinc-900 dark:bg-ibiza-shell dark:text-zinc-100',
        shellPlayer
          ? mobileRoutePlayer
            ? 'h-dvh min-h-0 w-full flex-1 items-stretch justify-start overflow-hidden p-0'
            : 'ibiza-touch:h-dvh ibiza-touch:min-h-0 ibiza-touch:w-full ibiza-touch:flex-1 ibiza-touch:items-stretch ibiza-touch:overflow-hidden ibiza-touch:p-0 min-h-0 justify-start ibiza-desk:items-center ibiza-desk:overflow-x-auto ibiza-desk:overflow-y-auto ibiza-desk:py-4 sm:ibiza-desk:py-6'
          : 'min-h-dvh justify-center overflow-x-auto overflow-y-auto py-4 sm:py-6',
      )}
    >
      {status === 'inicializando' && !isLayoutSandboxPath && !isInstaladorDesktopPath && !isAvisosOperadorPath ? (
        <LoadingScreen mensagem="Inicializando..." />
      ) : (
        <>
          <AppRoutesInner />
          {!isLayoutSandboxPath && !isInstaladorDesktopPath && !isPrimeiraCargaPath && !isAvisosOperadorPath ? (
            <DebugDiagFloating />
          ) : null}
        </>
      )}
    </div>
  );
}

/**
 * Redireciona para a rota apropriada baseado no status atual.
 * Componente "roteador inteligente" que dispensa lógica espalhada.
 */
function RouteByStatus() {
  const { path } = useShell();
  const status = useAppStore((s) => s.status);
  const cliente_id = useAppStore((s) => s.cliente_id);
  const token = useAppStore((s) => s.token);
  const playlistData = useAppStore((s) => s.playlistData);

  if (!token && cliente_id) return <Navigate to={path('/selecionar-pdv')} replace />;
  if (!token) return <Navigate to={path('/login')} replace />;
  if (status === 'sincronizando' || status === 'tocando' || status === 'pausado' || status === 'desativado') {
    if (playlistData == null) return <Navigate to={path('/primeira-carga')} replace />;
    return <Navigate to={path('/player')} replace />;
  }
  return <Navigate to={path('/login')} replace />;
}
