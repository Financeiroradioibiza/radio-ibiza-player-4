/**
 * Casca Electron — janela única apontada para o player Radio Ibiza.
 *
 * Estratégia (ver DEC-009 em DECISIONS.md):
 *   1. **Instalador modo TI (.exe empacotado):** carrega `dist/index.html` local (target W).
 *      O multiusuário (ProgramData + mesmo login) depende deste bundle — não do site remoto.
 *   2. **Dev / loja com vídeo:** pode usar URL remota (`player4…`) para actualizar sem reinstalar.
 *   3. Se `loadURL` falhar, fallback para `dist/index.html` empacotado.
 *
 * Overrides para dev e testes:
 *   - `VITE_DEV_SERVER_URL=http://127.0.0.1:5173` → modo dev local
 *   - `ELECTRON_START_URL=https://...`            → apontar para outro host
 *   - `ELECTRON_FORCE_LOCAL=1`                    → ignora URL remota, usa `dist/`
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { app, BrowserWindow, Menu, nativeImage } from 'electron';
import {
  configureWindowsMultiUserPaths,
  ensureWinSharedAclSync,
  getWinSharedRoot,
  isWinMultiUserPackaged,
} from './win-shared-storage.mjs';
import {
  registerStorageIpc,
  prepareMultiUserSessionSync,
  ensureProgramDataStorageSync,
  writeOndeEstaoOsDadosSync,
} from './storage-handlers.mjs';
import { parseJsonUtf8 } from './json-utf8.mjs';
import { writeBuildStampSync } from './programdata-constants.mjs';
import { grantSharedUsersAccessSync } from './win-acl.mjs';

/**
 * Windows: cria a árvore ProgramData + sessao.json + build-stamp.txt LOGO no load
 * do main process — SEM depender de app.isPackaged nem de qualquer deteção. Se
 * `build-stamp.txt` não aparecer em C:\ProgramData\RadioIbizaPlayer, o `.exe` é antigo.
 */
if (process.platform === 'win32') {
  try {
    const boot = ensureProgramDataStorageSync();
    writeBuildStampSync({
      empacotado: app.isPackaged ? 'sim' : 'nao',
      exe: process.execPath,
      modo: fs.existsSync(path.join(__dirname, 'loja-pack.flag')) ? 'loja' : 'ti',
      sessao_criada: boot?.sessao_json ? 'sim' : 'ja-existia',
      bootstrap: boot?.ok ? 'ok' : `falhou:${boot?.error || ''}`,
    });
  } catch (e) {
    writeBuildStampSync({ erro_boot: e instanceof Error ? e.message : String(e) });
  }
}

/** Modo TI: perfil Chromium em ProgramData — ANTES de app.ready (doc Electron). */
configureWindowsMultiUserPaths();

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
  /**
   * Pacote loja: PWA remota (actualiza sozinha) + ponte duck local.
   * Bundle `dist/` offline só com ELECTRON_LOJA_FORCE_LOCAL=1 (dev/testes).
   */
  if (isLojaPack()) {
    return process.env.ELECTRON_LOJA_FORCE_LOCAL === '1' ? '' : PRODUCAO_URL;
  }
  /**
   * .exe modo TI (W): UI vem do `dist/` empacotado no instalador.
   * O site remoto (player4) ainda não garantia multiusuário — cada perfil Windows
   * gerava outro `device_id` e apagava a sessão partilhada em ProgramData.
   */
  if (app.isPackaged) return '';
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
    await win.loadFile(distHtml);
    return;
  }
  try {
    await win.loadURL(url);
  } catch (err) {
    console.warn(`[electron] Falha ao carregar ${url}, caindo para dist/ local:`, err?.message);
    await win.loadFile(distHtml);
  }
}

function sincronizarDeviceIdMultiUsuario(win) {
  const machineId = prepareMultiUserSessionSync();
  if (!machineId) return;
  const js = `try{localStorage.setItem('radio_ibiza_device_id',${JSON.stringify(machineId)})}catch(e){}`;
  void win.webContents.executeJavaScript(js);
}

function createWindow() {
  const icon = resolverIconeJanela();
  const loja = isLojaPack();
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
      additionalArguments: loja ? ['--ibiza-loja-pack'] : [],
    },
  });

  win.setMenuBarVisibility(false);

  win.webContents.on('dom-ready', () => {
    sincronizarDeviceIdMultiUsuario(win);
  });

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

  win.webContents.on('did-finish-load', () => {
    if (isWinMultiUserPackaged()) {
      try {
        writeOndeEstaoOsDadosSync(win.webContents.getURL());
      } catch {
        //
      }
    }
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerStorageIpc();
  ensureWinSharedAclSync();
  let storageBootstrap = null;
  if (isWinMultiUserPackaged()) {
    storageBootstrap = ensureProgramDataStorageSync();
    writeOndeEstaoOsDadosSync();
    try {
      const uiTargetPath = path.join(getWinSharedRoot(), 'ui-build-target.txt');
      const distTarget = path.join(__dirname, '..', 'dist', 'ibiza-build-target.txt');
      let uiTarget = 'desconhecido';
      if (fs.existsSync(distTarget)) {
        uiTarget = fs.readFileSync(distTarget, 'utf8').trim() || uiTarget;
      }
      fs.writeFileSync(
        uiTargetPath,
        `ibizaTarget=${uiTarget}\nempacotado=sim\ndata=${new Date().toISOString()}\n`,
        'utf8',
      );
      grantSharedUsersAccessSync(uiTargetPath);
    } catch {
      //
    }
  }
  if (isWinMultiUserPackaged()) {
    try {
      const logPath = path.join(getWinSharedRoot(), 'ultimo-arranque.txt');
      const sessaoPath = path.join(getWinSharedRoot(), 'sessao.json');
      let sessaoOk = 'nao';
      let sessaoReadErr = '';
      try {
        if (fs.existsSync(sessaoPath)) {
          const raw = fs.readFileSync(sessaoPath, 'utf8');
          const s = parseJsonUtf8(raw);
          sessaoOk = s?.token?.token ? 'sim-com-token' : 'sim-sem-token';
        }
      } catch (e) {
        sessaoReadErr = e instanceof Error ? e.message : String(e);
        sessaoOk = 'erro-leitura';
      }
      fs.appendFileSync(
        logPath,
        [
          `---`,
          `data=${new Date().toISOString()}`,
          `user=${process.env.USERNAME || ''}`,
          `userData=${app.getPath('userData')}`,
          `empacotado=sim`,
          `sessao_json=${sessaoOk}`,
          sessaoReadErr ? `sessao_erro=${sessaoReadErr}` : '',
          `programdata=${getWinSharedRoot()}`,
          `storage_bootstrap=${storageBootstrap?.ok ? 'ok' : 'falhou'}`,
          storageBootstrap?.sessao_json ? 'sessao_criada_agora=sim' : 'sessao_criada_agora=nao',
          storageBootstrap?.error ? `storage_erro=${storageBootstrap.error}` : '',
        ]
          .filter(Boolean)
          .join('\n') + '\n',
        'utf8',
      );
      grantSharedUsersAccessSync(sessaoPath);
      grantSharedUsersAccessSync(logPath);
    } catch {
      //
    }
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
