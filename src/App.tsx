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

  if (status === 'inicializando') {
    return <LoadingScreen mensagem="Inicializando..." />;
  }

  return (
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
