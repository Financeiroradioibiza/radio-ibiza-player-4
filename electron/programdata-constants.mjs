/**
 * Dados partilhados modo TI Windows — UMA pasta em ProgramData para toda a máquina.
 * Não usar app.getPath('userData') (%APPDATA%) para token/sessão.
 *
 * Instalação: NSIS perMachine + customInstall (ver build/installer.nsh).
 * Sessão/login: `sessao.json` nesta pasta (IPC FileSystemStorage).
 * Perfil Chromium: subpastas `chromium-profile` / `chromium-cache` (não guardam token).
 */

import path from 'node:path';

/** Nome da pasta em `%ProgramData%` — equivalente a `MeuApp` no guia genérico. */
export const PROGRAMDATA_APP_DIR = 'RadioIbizaPlayer';

/** SID Built-in Users (BU) — grupo «Utilizadores» em PT / «Users» em EN. */
export const WIN_ACL_BUILTIN_USERS_SID = 'S-1-5-32-545';

/** Authenticated Users — reforço para contas já autenticadas. */
export const WIN_ACL_AUTHENTICATED_USERS_SID = 'S-1-5-11';

export function getProgramDataRoot() {
  const pd = process.env.ProgramData || process.env.PROGRAMDATA || 'C:\\ProgramData';
  return path.join(pd, PROGRAMDATA_APP_DIR);
}

export function getProgramDataSessaoPath() {
  return path.join(getProgramDataRoot(), 'sessao.json');
}
