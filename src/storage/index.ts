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
import { isElectronShell } from '@/utils/isElectronShell';

export function isElectronStorageReady(): boolean {
  return typeof window !== 'undefined' && window.electronAPI?.storage != null;
}

function shouldUseFileSystemStorage(): boolean {
  /** Só quando o preload expôs IPC — evita throw antes do bridge no arranque. */
  return isElectronStorageReady();
}

function createStorage(): Storage {
  if (shouldUseFileSystemStorage()) {
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
  storageInstance = new FileSystemStorage();
}

/** Aguarda preload/IPC antes de hidratar ou gravar login (modo TI). */
export async function waitForElectronStorage(maxMs = 15000): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    rebindStorageIfElectronReady();
    if (isElectronStorageReady()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return isElectronStorageReady();
}

/** `.exe` modo TI ou build W dentro do Electron — grava em ProgramData, não IndexedDB. */
export function isTiProgramDataStorageContext(): boolean {
  if (isWinTiElectron()) return true;
  return import.meta.env.VITE_IBIZA_TARGET === 'W' && isElectronShell();
}

function bridgeDiagMessage(): string {
  if (typeof window === 'undefined') return 'sem window';
  const api = window.electronAPI;
  if (!api) return 'electronAPI ausente (preload não carregou — reinstale o .exe TI recente)';
  if (!api.storage) return 'electronAPI.storage ausente (preload incompleto — reinstale o .exe TI recente)';
  return '';
}

/**
 * Modo TI / build W: exige FileSystemStorage (ProgramData) antes de gravar login.
 * Falha visível se o preload/IPC não ligar — evita login silencioso no IndexedDB.
 */
export async function requireFileSystemStorage(maxWaitMs = 8000): Promise<FileSystemStorage> {
  if (!isTiProgramDataStorageContext()) {
    const impl = resolveStorage();
    if (impl instanceof FileSystemStorage) return impl;
    throw new Error('FileSystemStorage indisponível neste contexto.');
  }

  const ok = await waitForElectronStorage(maxWaitMs);
  rebindStorageIfElectronReady();
  resolveStorage();

  if (storageInstance instanceof FileSystemStorage) {
    try {
      await window.electronAPI?.storage?.logEvent?.('renderer-fs-ready');
    } catch {
      //
    }
    return storageInstance;
  }

  const diag = bridgeDiagMessage();
  throw new Error(
    diag ||
      (ok
        ? 'Storage do .exe não ligou ao ProgramData. Feche todas as janelas do player, reinstale o .exe TI recente e abra de novo.'
        : 'Storage do .exe não respondeu a tempo. Feche todas as janelas do player, reinstale o .exe TI recente e abra de novo.'),
  );
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
