/**
 * Modo TI Windows (.exe): perfil Chromium único em ProgramData para todos os utilizadores.
 * @see https://www.electronjs.org/docs/latest/api/app#appsetpathname-path
 */

export function isWinTiElectron(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as Window & {
    electronAPI?: { getMachineDeviceId?: () => string; isWinTiMultiUser?: boolean };
    ibizaLojaPack?: { videoBridgeEnabled?: boolean };
  };
  if (w.ibizaLojaPack?.videoBridgeEnabled) return false;
  return w.electronAPI?.isWinTiMultiUser === true;
}
