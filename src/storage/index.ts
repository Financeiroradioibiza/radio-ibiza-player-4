/**
 * Fábrica do Storage — escolhe a implementação certa baseada no ambiente.
 *
 * Modo TI (.exe W): `FileSystemStorage` → `sessao.json` em ProgramData via IPC.
 * PWA / browser: IndexedDB no perfil do Chrome (por utilizador Windows).
 *
 * Inicialização lazy: o bundle pode importar este módulo antes do preload expor
 * `electronAPI` — o Proxy abaixo resolve no primeiro uso real.
 */

import type { Storage } from './Storage';
import { IndexedDBStorage } from './IndexedDBStorage';
import { FileSystemStorage } from './FileSystemStorage';
import { isWinTiElectron } from '@/utils/isWinTiElectron';

function isElectronStorageReady(): boolean {
  return typeof window !== 'undefined' && window.electronAPI?.storage != null;
}

function createStorage(): Storage {
  if (isElectronStorageReady()) {
    if (isWinTiElectron()) {
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

/** Reavalia Electron vs PWA se o primeiro acesso foi antes do preload. */
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
