/**
 * Fábrica do Storage — escolhe a implementação certa baseada no ambiente.
 *
 * Este é o ÚNICO lugar do código que conhece as duas implementações.
 * O resto do app importa de aqui (`import { storage } from '@/storage'`)
 * e usa via interface `Storage`.
 */

import type { Storage } from './Storage';
import { IndexedDBStorage } from './IndexedDBStorage';
import { FileSystemStorage } from './FileSystemStorage';

/**
 * Detecta se estamos rodando dentro de Electron.
 *
 * Estratégia: o preload script do Electron expõe `window.electronAPI`.
 * Se ele existe, é Electron. Senão, é browser puro.
 */
function isElectron(): boolean {
  return typeof window !== 'undefined' && window.electronAPI != null;
}

function createStorage(): Storage {
  if (isElectron()) {
    console.info('[storage] Modo Electron (multiusuário Windows)');
    return new FileSystemStorage();
  }
  console.info('[storage] Modo PWA (IndexedDB + Cache Storage)');
  return new IndexedDBStorage();
}

/**
 * Instância singleton do storage.
 *
 * Importe assim:
 *   import { storage } from '@/storage';
 *   const sessao = await storage.getSessao();
 */
export const storage: Storage = createStorage();

// Re-exporta tipos pra facilitar imports
export type { Storage } from './Storage';
export { SESSAO_INICIAL, CONFIGS_INICIAL } from './Storage';
