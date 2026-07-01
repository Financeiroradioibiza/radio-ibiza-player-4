/**
 * Diagnóstico no arranque — onde o login está a ser lido/gravado (Electron vs PWA).
 */

export function logStorageBootstrap(): void {
  if (typeof window === 'undefined') return;

  const api = (
    window as Window & {
      electronAPI?: {
        storage?: unknown;
        isWinTiMultiUser?: boolean;
        getStorageDiag?: () => {
          storageRoot: string;
          sessaoPath: string;
          sessaoExists: boolean;
          sessaoHasToken: boolean;
          chromiumUserData: string;
          appData: string;
          isPackaged: boolean;
        };
      };
    }
  ).electronAPI;

  if (!api) {
    console.info(
      '[storage] Sem electronAPI — browser/PWA. Login fica no IndexedDB do Chrome/Edge deste utilizador (NAO em ProgramData).',
    );
    return;
  }

  if (!api.storage) {
    console.warn(
      '[storage] electronAPI sem .storage — login pode ir para IndexedDB em:',
      'ver ficheiro onde-estao-os-dados.txt no perfil Electron (%APPDATA%\\Radio Ibiza)',
    );
    return;
  }

  try {
    const d = api.getStorageDiag?.();
    if (d) {
      console.info('[storage] Modo ficheiro (IPC). sessao.json =', d.sessaoPath);
      console.info('[storage] Existe?', d.sessaoExists, '| Com token?', d.sessaoHasToken);
      console.info('[storage] Perfil Chromium (userData) =', d.chromiumUserData);
      if (d.sessaoHasToken && !d.sessaoExists) {
        console.warn('[storage] INCONSISTENTE: token na memória mas sessao.json ausente.');
      }
      if (!d.sessaoExists && d.isPackaged) {
        console.warn(
          '[storage] ProgramData vazio — permissões? Corra corrigir-permissoes-multiusuario.bat como admin.',
        );
      }
    }
  } catch {
    //
  }
}
