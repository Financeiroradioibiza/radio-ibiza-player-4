/**
 * Build W (.exe): a sessão pode ter ficado no IndexedDB (local errado) antes dos fixes.
 * Copia para ProgramData/sessao.json uma vez.
 */

import type { Storage } from './Storage';
import { IndexedDBStorage } from './IndexedDBStorage';
import { isWinTiElectron } from '@/utils/isWinTiElectron';

export async function migrateLegacyIndexedDbSessaoToProgramData(
  target: Storage,
): Promise<boolean> {
  if (!isWinTiElectron()) return false;
  try {
    const legacy = new IndexedDBStorage();
    const fromIdb = await legacy.getSessao();
    if (!fromIdb.token?.token) return false;

    const cur = await target.getSessao();
    if (cur.token?.token) return false;

    await target.updateSessao(fromIdb);
    await legacy.limparSessao();
    console.info(
      '[storage] Login migrado: IndexedDB (perfil Electron) → ProgramData/sessao.json',
    );
    return true;
  } catch (e) {
    console.warn('[storage] Migração IndexedDB → ProgramData falhou:', e);
    return false;
  }
}
