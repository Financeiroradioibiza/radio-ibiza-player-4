/**
 * Modo TI: confirma que o login chegou a ProgramData/sessao.json.
 * Se falhou, tenta migrar do IndexedDB (login no sítio errado) e regista erro.
 */

import type { Storage } from './Storage';
import { migrateLegacyIndexedDbSessaoToProgramData } from './migrateLegacyIndexedDbSessao';
import { isWinTiElectron } from '@/utils/isWinTiElectron';

export type WinTiSessaoExpect = 'cliente_id' | 'token';

function sessaoOk(
  s: Awaited<ReturnType<Storage['getSessao']>>,
  expect: WinTiSessaoExpect,
): boolean {
  if (expect === 'token') return Boolean(s.token?.token);
  const cid = s.cliente_id != null ? Number(s.cliente_id) : NaN;
  return Number.isFinite(cid) && cid > 0;
}

export async function ensureWinTiSessaoGravada(
  storage: Storage,
  expect: WinTiSessaoExpect,
): Promise<boolean> {
  if (!isWinTiElectron()) return true;

  let cur = await storage.getSessao();
  if (sessaoOk(cur, expect)) return true;

  await migrateLegacyIndexedDbSessaoToProgramData(storage);
  cur = await storage.getSessao();
  if (sessaoOk(cur, expect)) {
    console.info('[storage] Login recuperado: IndexedDB → ProgramData/sessao.json');
    return true;
  }

  console.error(
    `[storage] FALHA: ${expect} não persistiu em ProgramData/sessao.json. ` +
      'Veja storage-erro.txt e storage-audit.log em C:\\ProgramData\\RadioIbizaPlayer',
  );
  return false;
}
