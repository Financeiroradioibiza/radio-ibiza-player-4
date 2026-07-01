/**
 * Fábrica do Storage.
 *
 * Build W (.exe modo TI): SEMPRE FileSystemStorage → sessao.json em ProgramData.
 * Nunca IndexedDB para sessão no .exe (login antigo ficava em %APPDATA%/IndexedDB).
 */

import type { Storage } from './Storage';
import { IndexedDBStorage } from './IndexedDBStorage';
import { FileSystemStorage } from './FileSystemStorage';
import { isWinTiElectron } from '@/utils/isWinTiElectron';

const IS_ELECTRON_WIN_BUILD = import.meta.env.VITE_IBIZA_TARGET === 'W';

function isElectronStorageReady(): boolean {
  return typeof window !== 'undefined' && window.electronAPI?.storage != null;
}

function createStorage(): Storage {
  if (IS_ELECTRON_WIN_BUILD || isElectronStorageReady()) {
    if (!isElectronStorageReady()) {
      console.error(
        '[storage] Build W sem electronAPI.storage — reinstale o .exe recente. Login NÃO irá para ProgramData.',
      );
    } else if (isWinTiElectron()) {
      console.info(
        '[storage] Modo TI — sessao.json em ProgramData (partilhada entre utilizadores Windows)',
      );
    } else {
      console.info('[storage] Modo Electron (FileSystemStorage / IPC)');
    }
    return new FileSystemStorage();
  }
  console.info('[storage] Modo PWA (IndexedDB + Cache Storage)');
  return new IndexedDBStorage();
}

let storageInstance: Storage | null = null;

function resolveStorage(): Storage {
  if (!storageInstance) {
    storageInstance = createStorage();
  }
  return storageInstance;
}

/** Reavalia se o preload ficou pronto depois do primeiro import. */
export function rebindStorageIfElectronReady(): void {
  if (IS_ELECTRON_WIN_BUILD) {
    if (!(storageInstance instanceof FileSystemStorage) && isElectronStorageReady()) {
      storageInstance = createStorage();
    }
    return;
  }
  if (!isElectronStorageReady()) return;
  if (storageInstance instanceof FileSystemStorage) return;
  storageInstance = createStorage();
}

export const storage: Storage = new Proxy({} as Storage, {
  get(_target, prop) {
    const impl = resolveStorage();
    const value = impl[prop as keyof Storage];
    if (typeof value === 'function') {
      return (value as (...args: unknown[]) => unknown).bind(impl);
    }
    return value;
  },
});

export type { Storage } from './Storage';
export { SESSAO_INICIAL, CONFIGS_INICIAL } from './Storage';
