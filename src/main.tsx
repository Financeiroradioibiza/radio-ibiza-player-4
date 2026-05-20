import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { applyIbizaPwaTouchOsLayoutAttr } from '@/api/config';
import { applyUiThemeToDocument } from '@/theme/uiThemeConstants';
import { useUiThemeStore } from '@/store/uiThemeStore';

applyIbizaPwaTouchOsLayoutAttr();

/** Garante DOM alinhado ao Zustand após hidratação do bundle (script em `index.html` já pintou o tema). */
applyUiThemeToDocument(useUiThemeStore.getState().theme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
