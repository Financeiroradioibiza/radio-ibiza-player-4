/**
 * Preload — expõe `window.electronAPI` (ver `src/storage/FileSystemStorage.ts`).
 * Manter assinaturas alinhadas com `ElectronAPI`.
 *
 * Layout «app instalado» (pele ecrã-cheio): só aqui, sem alterar `src/` / PWA.
 * O site remoto é build WEB; repomos `data-ibiza-pwa-touch-os` se o React remover.
 */

import { contextBridge, ipcRenderer } from 'electron';

/** Modo TI: sessão em `sessao.json` (ProgramData) via IPC — partilhada entre utilizadores. */
const isLojaPack = process.argv.includes('--ibiza-loja-pack');

let machineDeviceId = '';
try {
  machineDeviceId = ipcRenderer.sendSync('storage:getMachineDeviceIdSync');
} catch {
  //
}

const storageApi = {
  readJson: (file) => ipcRenderer.invoke('storage:readJson', file),
  writeJson: (file, data) => ipcRenderer.invoke('storage:writeJson', file, data),
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

if (isLojaPack) {
  contextBridge.exposeInMainWorld('ibizaLojaPack', { videoBridgeEnabled: true });
  contextBridge.exposeInMainWorld('electronAPI', { storage: storageApi });
} else {
  contextBridge.exposeInMainWorld('electronAPI', {
    getMachineDeviceId: () => machineDeviceId || ipcRenderer.sendSync('storage:getMachineDeviceIdSync'),
    isWinTiMultiUser: true,
    storage: storageApi,
  });
}

/** Activa variantes Tailwind `ibiza-touch` — só na casca Electron (.exe). */
function marcarLayoutElectronWin() {
  document.documentElement.setAttribute('data-electron-win-shell', '');
  document.documentElement.setAttribute('data-ibiza-pwa-touch-os', '');
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
    } else if (!el.hasAttribute('data-ibiza-pwa-touch-os')) {
      el.setAttribute('data-ibiza-pwa-touch-os', '');
    }
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-ibiza-pwa-touch-os', 'data-electron-win-shell'],
  });
}
