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
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { app, BrowserWindow, Menu, nativeImage } from 'electron';
import { registerStorageIpc } from './storage-handlers.mjs';

const PRODUCAO_URL = 'https://player4.radioibiza.com.br';

/** Largura ~ PWA instalada no Chrome (cartão desktop ~300px + margens). */
const JANELA_LARGURA = 420;
const JANELA_ALTURA = 880;

/**
 * Opcional: força escala 100% no Chromium (PDVs com UI «gigante» a 125%/150%).
 * Por defeito respeitamos a escala do Windows — igual ao PWA no Chrome.
 */
if (
  process.env.ELECTRON_FORCE_SCALE_1 === '1' ||
  process.env.ELECTRON_FORCE_SCALE_1 === 'true'
) {
  app.commandLine.appendSwitch('force-device-scale-factor', '1');
}

if (process.platform === 'win32') {
  app.setAppUserModelId('com.radioibiza.player');
}

// PDV desktop: permite `HTMLMediaElement.play()` sem gesto (rádio ao abrir / ao iniciar o Windows).
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distHtml = path.join(__dirname, '..', 'dist', 'index.html');
const preloadPath = path.join(__dirname, 'preload.mjs');

/** Ícone da janela / barra de tarefas (play gradiente — mesmo da PWA). */
function resolverIconeJanela() {
  const candidatos = [];
  if (app.isPackaged) {
    candidatos.push(path.join(process.resourcesPath, 'RadioIbiza.ico'));
    if (process.platform === 'win32') candidatos.push(process.execPath);
  }
  candidatos.push(path.join(__dirname, '..', 'build', 'icon.ico'));
  for (const p of candidatos) {
    const img = nativeImage.createFromPath(p);
    if (!img.isEmpty()) return img;
  }
  return undefined;
}

function opcoesBarraTituloWindows() {
  if (process.platform !== 'win32') return {};
  return {
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#08080a',
      symbolColor: '#e4e4e7',
      height: 36,
    },
  };
}

function isLojaPack() {
  return fs.existsSync(path.join(__dirname, 'loja-pack.flag'));
}

function resolverUrlInicial() {
  if (process.env.VITE_DEV_SERVER_URL) return process.env.VITE_DEV_SERVER_URL;
  if (process.env.ELECTRON_START_URL) return process.env.ELECTRON_START_URL;
  if (process.env.ELECTRON_FORCE_LOCAL === '1') return '';
  /** Pacote loja (v0.1): bundle local com ponte vídeo; depois pode passar só URL remota + flag. */
  if (isLojaPack() && process.env.ELECTRON_LOJA_REMOTE !== '1') return '';
  return PRODUCAO_URL;
}

/** Activa ponte duck (127.0.0.1:3199) só no pacote loja — nunca nos ~4000 players normais. */
function activarPonteVideoLoja(win) {
  if (!isLojaPack()) return;
  const inject = () => {
    void win.webContents.executeJavaScript(
      `try{localStorage.setItem('ibiza_video_bridge','1')}catch(e){}`,
    );
  };
  win.webContents.on('did-finish-load', inject);
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
  const icon = resolverIconeJanela();
  const win = new BrowserWindow({
    width: JANELA_LARGURA,
    height: JANELA_ALTURA,
    minWidth: 340,
    minHeight: 560,
    center: true,
    show: false,
    backgroundColor: '#08080a',
    autoHideMenuBar: true,
    ...(icon ? { icon } : {}),
    ...opcoesBarraTituloWindows(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  win.setMenuBarVisibility(false);

  win.once('ready-to-show', () => {
    win.show();
  });

  const startUrl = resolverUrlInicial();
  activarPonteVideoLoja(win);

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
  Menu.setApplicationMenu(null);
  registerStorageIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
