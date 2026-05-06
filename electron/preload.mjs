/**
 * Preload — expõe `window.electronAPI` (ver `src/storage/FileSystemStorage.ts`).
 * Manter assinaturas alinhadas com `ElectronAPI`.
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  storage: {
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
  },
});
