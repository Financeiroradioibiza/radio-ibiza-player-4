/**
 * Build W (.exe): a sessão pode ter ficado no IndexedDB (local errado) antes dos fixes.
 * Copia para ProgramData/sessao.json uma vez.
 */

import type { Storage } from './Storage';
import { IndexedDBStorage } from './IndexedDBStorage';
import { FileSystemStorage } from './FileSystemStorage';
import { isWinTiElectron } from '@/utils/isWinTiElectron';
import { isElectronShell } from '@/utils/isElectronShell';

function temSessaoUtil(s: Awaited<ReturnType<Storage['getSessao']>>): boolean {
  if (s.token?.token) return true;
  const cid = s.cliente_id != null ? Number(s.cliente_id) : NaN;
  return Number.isFinite(cid) && cid > 0;
}

export async function migrateLegacyIndexedDbSessaoToProgramData(
  target: Storage,
): Promise<boolean> {
  if (!(target instanceof FileSystemStorage)) return false;
  if (!isWinTiElectron() && !isElectronShell()) return false;
  try {
    const legacy = new IndexedDBStorage();
    const fromIdb = await legacy.getSessao();
    if (!temSessaoUtil(fromIdb)) return false;

    const cur = await target.getSessao();
    if (cur.token?.token) return false;
    if (temSessaoUtil(cur)) return false;

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
