/**
 * Modo TI: confirma que o login chegou a ProgramData/sessao.json.
 */

import type { Storage } from './Storage';
import { isWinTiElectron } from '@/utils/isWinTiElectron';
import { isElectronShell } from '@/utils/isElectronShell';

export type WinTiSessaoExpect = 'cliente_id' | 'token';

function deveVerificarProgramData(): boolean {
  return (
    isWinTiElectron() ||
    import.meta.env.VITE_IBIZA_TARGET === 'W' ||
    isElectronShell()
  );
}

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
): Promise<void> {
  if (!deveVerificarProgramData()) return;

  const cur = await storage.getSessao();
  if (sessaoOk(cur, expect)) return;

  const diag = (
    window as Window & {
      electronAPI?: { getStorageDiag?: () => { sessaoPath?: string; sessaoHasToken?: boolean } };
    }
  ).electronAPI?.getStorageDiag?.();

  console.error(
    `[storage] FALHA: ${expect} não persistiu em ProgramData/sessao.json.`,
    diag?.sessaoPath ?? '',
    'diag_token=',
    diag?.sessaoHasToken,
  );
  throw new Error(
    expect === 'token'
      ? 'Não foi possível gravar o login em C:\\ProgramData\\RadioIbizaPlayer\\sessao.json. Feche todas as janelas do player, abra de novo e entre outra vez.'
      : 'Não foi possível gravar o cliente em ProgramData. Tente entrar de novo.',
  );
}
