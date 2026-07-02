/**
 * Dados partilhados modo TI Windows — UMA pasta em ProgramData para toda a máquina.
 * Não usar app.getPath('userData') (%APPDATA%) para token/sessão.
 *
 * Instalação: NSIS perMachine + customInstall (ver build/installer.nsh).
 * Sessão/login: `sessao.json` nesta pasta (IPC FileSystemStorage).
 * Perfil Chromium: subpastas `chromium-profile` / `chromium-cache` (não guardam token).
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Marcador de build — MUDA a cada correção relevante. Serve para confirmar,
 * no PC do cliente, que o `.exe` instalado contém o código novo (ficheiro
 * `build-stamp.txt` em ProgramData). Se este número não aparecer lá, o `.exe`
 * é antigo (build em cache / instalador errado).
 */
export const PROGRAMDATA_BUILD_ID = '2026-07-02-programdata-v7';

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

/**
 * Escreve `build-stamp.txt` em ProgramData no arranque (síncrono, sem depender
 * do Electron). Só win32. É a prova de qual build está a correr.
 */
export function writeBuildStampSync(extra = {}) {
  if (process.platform !== 'win32') return;
  try {
    const root = getProgramDataRoot();
    fs.mkdirSync(root, { recursive: true });
    const linhas = [
      `build_id=${PROGRAMDATA_BUILD_ID}`,
      `arranque=${new Date().toISOString()}`,
      `usuario_windows=${process.env.USERNAME || ''}`,
      `root=${root}`,
    ];
    for (const [k, v] of Object.entries(extra)) {
      linhas.push(`${k}=${v}`);
    }
    fs.writeFileSync(path.join(root, 'build-stamp.txt'), `${linhas.join('\n')}\n`, 'utf8');
  } catch {
    //
  }
}
