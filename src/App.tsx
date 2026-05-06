import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store/app';
import { LoginPage } from './pages/LoginPage';
import { SelecionarPdvPage } from './pages/SelecionarPdvPage';
import { PlayerPage } from './pages/PlayerPage';
import { LoadingScreen } from './components/LoadingScreen';
import { DebugDiagFloating } from './components/DebugDiagFloating';

export default function App() {
  const status = useAppStore((s) => s.status);
  const hidratar = useAppStore((s) => s.hidratar);

  // No primeiro render, hidrata o estado do IndexedDB
  useEffect(() => {
    void hidratar();
  }, [hidratar]);

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
    <div className="min-h-full min-h-dvh bg-ibiza-shell text-zinc-100">
      {status === 'inicializando' ? (
        <LoadingScreen mensagem="Inicializando..." />
      ) : (
        <>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/selecionar-pdv" element={<SelecionarPdvPage />} />
            <Route path="/player" element={<PlayerPage />} />

            {/* Roteamento padrão baseado no status */}
            <Route path="*" element={<RouteByStatus />} />
          </Routes>
          <DebugDiagFloating />
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

  if (!token && cliente_id) return <Navigate to="/selecionar-pdv" replace />;
  if (!token) return <Navigate to="/login" replace />;
  if (status === 'sincronizando' || status === 'tocando' || status === 'pausado' || status === 'desativado') {
    return <Navigate to="/player" replace />;
  }
  return <Navigate to="/login" replace />;
}
