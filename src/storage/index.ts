/**
 * Fábrica do Storage.
 *
 * **PWA (produção Netlify):** `VITE_IBIZA_TARGET=WEB`, sem `window.electronAPI`
 * → sempre `IndexedDBStorage` (comportamento inalterado).
 *
 * **Build W (.exe modo TI):** `FileSystemStorage` → sessao.json em ProgramData.
 */

import type { Storage } from './Storage';
import { IndexedDBStorage } from './IndexedDBStorage';
import { FileSystemStorage } from './FileSystemStorage';
import { isWinTiElectron } from '@/utils/isWinTiElectron';

const IS_ELECTRON_WIN_BUILD = import.meta.env.VITE_IBIZA_TARGET === 'W';

function isElectronStorageReady(): boolean {
  return typeof window !== 'undefined' && window.electronAPI?.storage != null;
}

function shouldUseFileSystemStorage(): boolean {
  /** Preload presente = .exe; nunca IndexedDB (login ia para perfil Chromium, não sessao.json). */
  if (isElectronStorageReady()) return true;
  return IS_ELECTRON_WIN_BUILD;
}

function createStorage(): Storage {
  if (shouldUseFileSystemStorage()) {
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
  rebindStorageIfElectronReady();
  if (!storageInstance) {
    storageInstance = createStorage();
  }
  return storageInstance;
}

/** Garante FileSystemStorage quando o preload expõe IPC (evita bundle WEB antigo no .exe). */
export function rebindStorageIfElectronReady(): void {
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
