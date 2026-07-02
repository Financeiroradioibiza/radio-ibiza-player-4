/**
 * Preload — expõe `window.electronAPI` (ver `src/storage/FileSystemStorage.ts`).
 * Manter assinaturas alinhadas com `ElectronAPI`.
 *
 * Modo TI: cartão desktop (`ibiza-desk`), não forçar touch ecrã-cheio.
 */

import { contextBridge, ipcRenderer } from 'electron';

/** Modo TI: sessão em `sessao.json` (ProgramData) via IPC — partilhada entre utilizadores. */
const isLojaPack = process.argv.includes('--ibiza-loja-pack');

/** Lazy — IPC sync só na 1.ª chamada. */
let machineDeviceIdCache = null;

function getMachineDeviceIdLazy() {
  if (machineDeviceIdCache !== null) return machineDeviceIdCache;
  try {
    machineDeviceIdCache = ipcRenderer.sendSync('storage:getMachineDeviceIdSync') || '';
  } catch {
    machineDeviceIdCache = '';
  }
  return machineDeviceIdCache;
}

const storageApi = {
  readJson: (file) => ipcRenderer.invoke('storage:readJson', file),
  writeJson: (file, data) => ipcRenderer.invoke('storage:writeJson', file, data),
  patchJson: (file, patch) => ipcRenderer.sendSync('storage:patchJsonSync', file, patch),
  logEvent: (msg) => ipcRenderer.sendSync('storage:logEventSync', msg),
  listExecucoes: () => ipcRenderer.invoke('storage:listExecucoes'),
  addExecucao: (exec) => ipcRenderer.invoke('storage:addExecucao', exec),
  updateExecucao: (id, patch) => ipcRenderer.invoke('storage:updateExecucao', id, patch),
  removeExecucao: (id) => ipcRenderer.invoke('storage:removeExecucao', id),
  clearExecucoes: () => ipcRenderer.invoke('storage:clearExecucoes'),
  saveAudio: (musica_id, data) => ipcRenderer.invoke('storage:saveAudio', musica_id, data),
  audioExists: (musica_id) => ipcRenderer.invoke('storage:audioExists', musica_id),
  getAudioPath: (musica_id) => ipcRenderer.invoke('storage:getAudioPath', musica_id),
  removeAudio: (musica_id) => ipcRenderer.invoke('storage:removeAudio', musica_id),
  clearAllAudio: () => ipcRenderer.invoke('storage:clearAllAudio'),
  listMusicas: () => ipcRenderer.invoke('storage:listMusicas'),
  upsertMusica: (m) => ipcRenderer.invoke('storage:upsertMusica', m),
  removeMusicaIndex: (musica_id) => ipcRenderer.invoke('storage:removeMusicaIndex', musica_id),
  clearMusicasIndex: () => ipcRenderer.invoke('storage:clearMusicasIndex'),
};

const playerLeaseApi = {
  read: () => ipcRenderer.sendSync('playerLease:readSync'),
  write: (holderId, beat) => ipcRenderer.sendSync('playerLease:writeSync', holderId, beat),
  clearIfHeldBy: (holderId) => ipcRenderer.sendSync('playerLease:clearSync', holderId),
  getMeta: () => ipcRenderer.sendSync('playerLease:getMetaSync'),
};

/** Expor IPC logo — antes de qualquer DOM/layout (renderer depende disto no arranque). */
try {
  if (isLojaPack) {
    contextBridge.exposeInMainWorld('ibizaLojaPack', { videoBridgeEnabled: true });
    contextBridge.exposeInMainWorld('electronAPI', { storage: storageApi });
  } else {
    contextBridge.exposeInMainWorld('electronAPI', {
      getMachineDeviceId: () => getMachineDeviceIdLazy(),
      isWinTiMultiUser: true,
      getStorageDiag: () => ipcRenderer.sendSync('storage:getDiagSync'),
      storage: storageApi,
      playerLease: playerLeaseApi,
    });
  }
} catch (e) {
  console.error('[preload] Falha ao expor electronAPI:', e);
}

/** Activa layout desktop na casca Electron (.exe TI) — cartão centrado, não ecrã cheio touch. */
function marcarLayoutElectronWin() {
  document.documentElement.setAttribute('data-electron-win-shell', '');
  document.documentElement.removeAttribute('data-ibiza-pwa-touch-os');
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', marcarLayoutElectronWin, { once: true });
  } else {
    marcarLayoutElectronWin();
  }

  new MutationObserver(() => {
    const el = document.documentElement;
    if (!el.hasAttribute('data-electron-win-shell')) {
      marcarLayoutElectronWin();
    } else if (el.hasAttribute('data-ibiza-pwa-touch-os')) {
      el.removeAttribute('data-ibiza-pwa-touch-os');
    }
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-electron-win-shell', 'data-ibiza-pwa-touch-os'],
  });
}
