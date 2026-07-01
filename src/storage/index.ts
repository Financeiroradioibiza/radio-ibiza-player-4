/**
 * Fábrica do Storage — escolhe a implementação certa baseada no ambiente.
 *
 * Modo TI (.exe W): `FileSystemStorage` → `sessao.json` em ProgramData via IPC
 * (ficheiro partilhado entre todos os utilizadores Windows). IndexedDB no perfil
 * Chromium não é fiável entre contas — cada utilizador pode ficar com DB vazio.
 *
 * Pacote loja / dev Electron: também FileSystemStorage (IPC → ProgramData).
 */

import type { Storage } from './Storage';
import { IndexedDBStorage } from './IndexedDBStorage';
import { FileSystemStorage } from './FileSystemStorage';
import { isWinTiElectron } from '@/utils/isWinTiElectron';

function isElectron(): boolean {
  return typeof window !== 'undefined' && window.electronAPI?.storage != null;
}

function createStorage(): Storage {
  if (isElectron()) {
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

export const storage: Storage = createStorage();

export type { Storage } from './Storage';
export { SESSAO_INICIAL, CONFIGS_INICIAL } from './Storage';
