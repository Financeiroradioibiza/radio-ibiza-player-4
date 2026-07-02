/**
 * Build W (.exe): migração one-shot IndexedDB → ProgramData (legado).
 * Desactivada: modo TI usa só sessao.json; perfil Chromium é por utilizador Windows.
 */

import type { Storage } from './Storage';

export async function migrateLegacyIndexedDbSessaoToProgramData(
  _target: Storage,
): Promise<boolean> {
  return false;
}
