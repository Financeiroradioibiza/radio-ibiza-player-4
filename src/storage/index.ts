/**
 * Fábrica do Storage — escolhe a implementação certa baseada no ambiente.
 *
 * Modo TI (.exe W): perfil Chromium em ProgramData → IndexedDB partilhado entre
 * todos os utilizadores Windows (mesmo código que PWA, pasta diferente).
 * Áudio em cache também fica no perfil partilhado.
 *
 * Pacote loja / dev Electron sem modo TI: FileSystemStorage (IPC → ProgramData).
 */

import type { Storage } from './Storage';
import { IndexedDBStorage } from './IndexedDBStorage';
import { FileSystemStorage } from './FileSystemStorage';
import { isWinTiElectron } from '@/utils/isWinTiElectron';

function isElectron(): boolean {
  return typeof window !== 'undefined' && window.electronAPI != null;
}

function createStorage(): Storage {
  if (isWinTiElectron()) {
    console.info(
      '[storage] Modo TI — IndexedDB em ProgramData (sessão partilhada entre utilizadores Windows)',
    );
    return new IndexedDBStorage();
  }
  if (isElectron()) {
    console.info('[storage] Modo Electron (FileSystemStorage / IPC)');
    return new FileSystemStorage();
  }
  console.info('[storage] Modo PWA (IndexedDB + Cache Storage)');
  return new IndexedDBStorage();
}

export const storage: Storage = createStorage();

export type { Storage } from './Storage';
export { SESSAO_INICIAL, CONFIGS_INICIAL } from './Storage';
