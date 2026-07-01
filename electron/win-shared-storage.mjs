/**
 * Modo TI Windows — perfil Chromium + dados em ProgramData (todos os utilizadores).
 * https://www.electronjs.org/docs/latest/api/app#appsetpathname-path
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { app } from 'electron';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { getProgramDataRoot, PROGRAMDATA_APP_DIR } from './programdata-constants.mjs';
import { ensureProgramDataStorageSync } from './storage-handlers.mjs';

export function getWinSharedRoot() {
  return getProgramDataRoot();
}

export { PROGRAMDATA_APP_DIR };

function isLojaPack() {
  return fs.existsSync(path.join(__dirname, 'loja-pack.flag'));
}

export function isWinMultiUserPackaged() {
  return process.platform === 'win32' && app.isPackaged && !isLojaPack();
}

/** ANTES de app.whenReady() — um perfil Chromium para toda a máquina. */
export function configureWindowsMultiUserPaths() {
  if (!isWinMultiUserPackaged()) return;

  const root = getWinSharedRoot();
  const profile = path.join(root, 'chromium-profile');
  const cache = path.join(root, 'chromium-cache');

  for (const dir of [
    root,
    profile,
    cache,
    path.join(root, 'pending-executions'),
    path.join(root, 'audio'),
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  /** sessao.json + configs.json — antes de app.ready (main process, não depende do renderer). */
  ensureProgramDataStorageSync();

  app.setPath('userData', profile);
  app.setPath('cache', cache);

  /** Chromium: força o mesmo perfil para todos os utilizadores Windows (antes de app.ready). */
  app.commandLine.appendSwitch('user-data-dir', profile);
  app.commandLine.appendSwitch('disk-cache-dir', cache);
}

function resolveAclScriptPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'setup-programdata-acl.ps1');
  }
  return path.join(__dirname, '..', 'build', 'setup-programdata-acl.ps1');
}

/** PowerShell Set-Acl (mais fiável que icacls manual). */
export function ensureWinSharedAclSync() {
  if (!isWinMultiUserPackaged()) return;
  const ps1 = resolveAclScriptPath();
  if (!fs.existsSync(ps1)) return;
  try {
    execSync(
      `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${ps1}"`,
      { stdio: 'ignore', windowsHide: true, timeout: 120_000 },
    );
  } catch {
    //
  }
}
