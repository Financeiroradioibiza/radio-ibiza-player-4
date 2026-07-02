/**
 * Concede leitura/escrita em ProgramData a todos os utilizadores Windows (Built-in Users).
 * Chamado após criar/alterar ficheiros — o criador do ficheiro pode delegar sem ser admin.
 */

import fs from 'node:fs';
import { execSync } from 'node:child_process';

const USERS_SID = '*S-1-5-32-545';
const AUTH_USERS_SID = '*S-1-5-11';

function quoteIcaclsPath(p) {
  return `"${p.replace(/"/g, '""')}"`;
}

/**
 * @param {string} targetPath ficheiro ou pasta em ProgramData
 */
export function grantSharedUsersAccessSync(targetPath) {
  if (process.platform !== 'win32' || !targetPath) return;
  try {
    if (!fs.existsSync(targetPath)) return;
    const q = quoteIcaclsPath(targetPath);
    const isDir = fs.statSync(targetPath).isDirectory();
    if (isDir) {
      execSync(
        `icacls ${q} /grant ${USERS_SID}:(OI)(CI)F ${AUTH_USERS_SID}:(OI)(CI)M /C`,
        { stdio: 'ignore', windowsHide: true, timeout: 30_000 },
      );
    } else {
      execSync(
        `icacls ${q} /grant ${USERS_SID}:F ${AUTH_USERS_SID}:M /C`,
        { stdio: 'ignore', windowsHide: true, timeout: 30_000 },
      );
    }
  } catch {
    //
  }
}
