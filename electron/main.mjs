/**
 * Casca mínima Etapa 3B — janela Electron.
 *
 * O player usa `/api` e `/ws-get_musica_cloud` (mesma origem). Isso existe no
 * Netlify/Vite, **não** em `file://` sobre `dist/` local.
 *
 * - Dev (recomendado): terminal A `npm run dev`; terminal B `npm run electron:dev`
 * - Teste contra site já deployado: `ELECTRON_START_URL=https://... npm run electron:open`
 *
 * Sem URL: tenta `dist/index.html` (login/API não funcionam até haver proxy ou URL pública).
 */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { app, BrowserWindow } from 'electron';
import { registerStorageIpc } from './storage-handlers.mjs';

/**
 * No Windows com «Alterar o tamanho do texto das aplicações» a 125% / 150%, o Chromium
 * segue esse factor e toda a UI Tailwind parece gigante num 1920×1080.
 * `force-device-scale-factor=1` faz o Electron tratar pixels como escala neutra (~100%).
 * Para respeitar a escala do sistema (melhor para acessibilidade): definir env
 * `ELECTRON_RESPECT_DISPLAY_SCALE=1` antes de iniciar (ver package.json scripts).
 *
 * PWAs instalados no Chrome/Edge não conseguem desactivar isto só com código —
 * há que usar compatibilidade de DPI no Windows ou reduzir a escala das aplicações.
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

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
    },
  });

  const startUrl =
    process.env.VITE_DEV_SERVER_URL ||
    process.env.ELECTRON_START_URL ||
    '';

  if (startUrl) {
    void win.loadURL(startUrl);
    if (startUrl.includes('localhost') || startUrl.includes('127.0.0.1')) {
      win.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    console.warn(
      '[electron] Sem VITE_DEV_SERVER_URL/ELECTRON_START_URL — abrindo dist/ local (API/proxy podem falhar).',
    );
    void win.loadURL(pathToFileURL(distHtml).href);
  }
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
