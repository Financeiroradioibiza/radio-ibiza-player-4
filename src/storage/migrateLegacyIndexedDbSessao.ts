/**
 * Build W (.exe): a sessão pode ter ficado no IndexedDB (local errado) antes dos fixes.
 * Copia para ProgramData/sessao.json uma vez.
 */

import type { Storage } from './Storage';
import { IndexedDBStorage } from './IndexedDBStorage';
import { isWinTiElectron } from '@/utils/isWinTiElectron';

const MIGRATION_TIMEOUT_MS = 3000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), ms);
    }),
  ]);
}

export async function migrateLegacyIndexedDbSessaoToProgramData(
  target: Storage,
): Promise<boolean> {
  if (!isWinTiElectron()) return false;
  try {
    const cur = await target.getSessao();
    if (cur.token?.token) return false;

    const legacy = new IndexedDBStorage();
    const fromIdb = await withTimeout(legacy.getSessao(), MIGRATION_TIMEOUT_MS, null);
    if (!fromIdb?.token?.token) return false;

    await target.updateSessao(fromIdb);
    await withTimeout(legacy.limparSessao(), MIGRATION_TIMEOUT_MS, undefined);
    console.info(
      '[storage] Login migrado: IndexedDB (perfil Electron) → ProgramData/sessao.json',
    );
    return true;
  } catch (e) {
    console.warn('[storage] Migração IndexedDB → ProgramData falhou:', e);
    return false;
  }
}
