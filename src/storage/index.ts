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

function isElectronStorageReady(): boolean {
  return typeof window !== 'undefined' && window.electronAPI?.storage != null;
}

function shouldUseFileSystemStorage(): boolean {
  /** Só quando o preload expôs IPC — evita throw antes do bridge no arranque. */
  return isElectronStorageReady();
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

/** Build W: aguarda preload/IPC antes do hidratar (evita race no 1.º frame). */
export async function waitForElectronStorage(maxMs = 8000): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    rebindStorageIfElectronReady();
    if (isElectronStorageReady()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return isElectronStorageReady();
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
