/**
 * Casca Electron — janela única apontada para o player Radio Ibiza.
 *
 * Estratégia (ver DEC-009 em DECISIONS.md):
 *   1. Por padrão, carrega `https://player4.radioibiza.com.br` (PWA em produção).
 *      Vantagem: a UI/lógica atualiza automaticamente a cada deploy no Netlify,
 *      sem precisar reinstalar `.exe`.
 *   2. Se o `loadURL` falhar (sem internet na primeira execução, DNS quebrado etc.),
 *      faz fallback automático para `dist/index.html` empacotado junto.
 *      Vantagem: o player nunca trava em tela em branco.
 *
 * Overrides para dev e testes:
 *   - `VITE_DEV_SERVER_URL=http://127.0.0.1:5173` → modo dev local
 *   - `ELECTRON_START_URL=https://...`            → apontar para outro host
 *   - `ELECTRON_FORCE_LOCAL=1`                    → ignora URL remota, usa `dist/`
 */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { app, BrowserWindow } from 'electron';
import { registerStorageIpc } from './storage-handlers.mjs';

const PRODUCAO_URL = 'https://player4.radioibiza.com.br';

/**
 * No Windows com «Alterar o tamanho do texto das aplicações» a 125% / 150%, o Chromium
 * segue esse factor e toda a UI Tailwind parece gigante num 1920×1080.
 * `force-device-scale-factor=1` faz o Electron tratar pixels como escala neutra (~100%).
 * Para respeitar a escala do sistema (melhor para acessibilidade): definir env
 * `ELECTRON_RESPECT_DISPLAY_SCALE=1` antes de iniciar (ver package.json scripts).
 */
if (
  process.env.ELECTRON_RESPECT_DISPLAY_SCALE !== '1' &&
  process.env.ELECTRON_RESPECT_DISPLAY_SCALE !== 'true'
) {
  app.commandLine.appendSwitch('force-device-scale-factor', '1');
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distHtml = path.join(__dirname, '..', 'dist', 'index.html');
const preloadPath = path.join(__dirname, 'preload.mjs');

function resolverUrlInicial() {
  if (process.env.VITE_DEV_SERVER_URL) return process.env.VITE_DEV_SERVER_URL;
  if (process.env.ELECTRON_START_URL) return process.env.ELECTRON_START_URL;
  if (process.env.ELECTRON_FORCE_LOCAL === '1') return '';
  return PRODUCAO_URL;
}

async function carregarComFallback(win, url) {
  if (!url) {
    return win.loadURL(pathToFileURL(distHtml).href);
  }
  try {
    await win.loadURL(url);
  } catch (err) {
    console.warn(`[electron] Falha ao carregar ${url}, caindo para dist/ local:`, err?.message);
    await win.loadURL(pathToFileURL(distHtml).href);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#09090b',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
    },
  });

  const startUrl = resolverUrlInicial();

  // DevTools só em dev (URL apontando para localhost).
  if (
    startUrl &&
    (startUrl.includes('localhost') || startUrl.includes('127.0.0.1'))
  ) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  void carregarComFallback(win, startUrl);
}

app.whenReady().then(() => {
  registerStorageIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
