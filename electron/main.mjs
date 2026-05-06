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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distHtml = path.join(__dirname, '..', 'dist', 'index.html');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
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
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
