import { useEffect } from 'react';
import clsx from 'clsx';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { IBIZA_SHELL_VERSION, IBIZA_TARGET } from './api/config';
import { useAppStore } from './store/app';
import { forcarRenovacaoCacheShellAposInstalacaoPwa, verificarAtualizacaoShell } from './player/appShellUpdate';
import { LoginPage } from './pages/LoginPage';
import { SelecionarPdvPage } from './pages/SelecionarPdvPage';
import { PlayerPage } from './pages/PlayerPage';
import { PrimeiraCargaPage } from './pages/PrimeiraCargaPage';
import { LoadingScreen } from './components/LoadingScreen';
import { DebugDiagFloating } from './components/DebugDiagFloating';
import { PlayerTabLeaseGuard } from './components/PlayerTabLeaseGuard';
import PlayerLayoutSandboxPage from './pages/PlayerLayoutSandboxPage';

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
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-6 py-12 text-zinc-100">
      <h1 className="text-xl font-bold text-amber-200">Protótipos de layout (sandbox)</h1>
      <p className="text-sm leading-relaxed text-zinc-300">
        Esta rota só carrega os mocks quando o projeto corre em <strong className="text-white">modo desenvolvimento</strong>{' '}
        (<code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">npm run dev</code>
        ), ou quando define no ficheiro <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">.env</code> local:
      </p>
      <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/50 p-4 text-xs text-zinc-200">
        VITE_ENABLE_LAYOUT_SANDBOX=1
      </pre>
      <p className="text-sm text-zinc-400">
        Se já usou o player aqui antes, em Chrome abra <strong className="text-zinc-200">DevTools → Application → Service Workers</strong>{' '}
        e use <em>Unregister</em>; depois recarregue (evita bundle antigo em cache).
      </p>
      <a
        href="/"
        className="inline-flex w-fit rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
      >
        Ir ao início
      </a>
    </div>
  );
}

function PlayerRouteGate() {
  const token = useAppStore((s) => s.token);
  const playlistData = useAppStore((s) => s.playlistData);
  if (!token?.token) return <Navigate to="/login" replace />;
  if (playlistData == null) return <Navigate to="/primeira-carga" replace />;
  return (
    <PlayerTabLeaseGuard>
      <PlayerPage />
    </PlayerTabLeaseGuard>
  );
}

/** Só há sessão; redirecionar para `/player` é feito em `PrimeiraCargaPage` quando `!busy` (evita cortar o sync). */
function PrimeiraCargaRouteGate() {
  const token = useAppStore((s) => s.token);
  if (!token?.token) return <Navigate to="/login" replace />;
  return <PrimeiraCargaPage />;
}

export default function App() {
  const location = useLocation();
  const status = useAppStore((s) => s.status);
  const hidratar = useAppStore((s) => s.hidratar);

  const pathNorm = location.pathname.replace(/\/+$/, '') || '/';
  /** Player encostado ao topo reduz faixa preta «em baixo» no PWA/janela alta; padding igual ao hook `usePlayerViewportScale`. */
  const shellPlayer = pathNorm === '/player';
  const isPrimeiraCargaPath = pathNorm === '/primeira-carga';
  const isLayoutSandboxPath = LAYOUT_SANDBOX_PATHS.has(pathNorm);
  const isInstaladorDesktopPath =
    pathNorm === '/instalador-desktop' || location.pathname.startsWith('/instalador-desktop/');

  // No primeiro render, hidrata o estado do IndexedDB
  useEffect(() => {
    void hidratar();
  }, [hidratar]);

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
    void verificarAtualizacaoShell({ versaoLocal: IBIZA_SHELL_VERSION, motivo: 'daily' });
  }, []);

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

  return (
    <div
      className={clsx(
        'flex w-full min-w-0 flex-col items-center overflow-x-auto overflow-y-auto bg-ibiza-shell py-4 text-zinc-100 sm:py-6',
        shellPlayer ? 'min-h-0 justify-start' : 'min-h-dvh justify-center',
      )}
    >
      {status === 'inicializando' && !isLayoutSandboxPath && !isInstaladorDesktopPath ? (
        <LoadingScreen mensagem="Inicializando..." />
      ) : (
        <>
          <Routes>
            <Route path="/sandbox/player-layouts" element={<LayoutSandboxGate />} />
            <Route path="/dev/layouts" element={<LayoutSandboxGate />} />
            <Route path="/instalador-desktop" element={<InstaladorDesktopEscape />} />
            <Route path="/instalador-desktop/" element={<InstaladorDesktopEscape />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/selecionar-pdv" element={<SelecionarPdvPage />} />
            <Route path="/primeira-carga" element={<PrimeiraCargaRouteGate />} />
            <Route path="/player" element={<PlayerRouteGate />} />

            {/* Roteamento padrão baseado no status */}
            <Route path="*" element={<RouteByStatus />} />
          </Routes>
          {!isLayoutSandboxPath && !isInstaladorDesktopPath && !isPrimeiraCargaPath ? (
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
  const status = useAppStore((s) => s.status);
  const cliente_id = useAppStore((s) => s.cliente_id);
  const token = useAppStore((s) => s.token);
  const playlistData = useAppStore((s) => s.playlistData);

  if (!token && cliente_id) return <Navigate to="/selecionar-pdv" replace />;
  if (!token) return <Navigate to="/login" replace />;
  if (status === 'sincronizando' || status === 'tocando' || status === 'pausado' || status === 'desativado') {
    if (playlistData == null) return <Navigate to="/primeira-carga" replace />;
    return <Navigate to="/player" replace />;
  }
  return <Navigate to="/login" replace />;
}
