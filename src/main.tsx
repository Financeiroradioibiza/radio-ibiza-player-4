import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { applyIbizaPwaTouchOsLayoutAttr } from '@/api/config';
import { ShellProvider } from '@/shells/ShellContext';
import { applyUiThemeToDocument } from '@/theme/uiThemeConstants';
import { useUiThemeStore } from '@/store/uiThemeStore';

const electronTarget = (import.meta.env.VITE_IBIZA_TARGET ?? '').toString().toUpperCase();
/** Pacote loja / Electron offline: `file://` + HashRouter (BrowserRouter quebra rotas). */
const Router = electronTarget === 'W' || electronTarget === 'M' ? HashRouter : BrowserRouter;

applyIbizaPwaTouchOsLayoutAttr();

/** Client Hints (alta entropia): alguns WebViews só expõem `platform: Android` aqui — reforça o atributo no `<html>`. */
try {
  const uad = (navigator as Navigator & { userAgentData?: { getHighEntropyValues?: (k: string[]) => Promise<{ platform?: string }> } }).userAgentData;
  if (uad && typeof uad.getHighEntropyValues === 'function') {
    void uad.getHighEntropyValues(['platform']).then((hints: { platform?: string }) => {
      const plat = (hints.platform ?? '').trim();
      if (plat === 'Android' || plat === 'iOS') {
        document.documentElement.setAttribute('data-ibiza-pwa-touch-os', '');
      }
    });
  }
} catch {
  //
}

/** Garante DOM alinhado ao Zustand após hidratação do bundle (script em `index.html` já pintou o tema). */
applyUiThemeToDocument(useUiThemeStore.getState().theme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <ShellProvider>
        <App />
      </ShellProvider>
    </Router>
  </StrictMode>,
);
