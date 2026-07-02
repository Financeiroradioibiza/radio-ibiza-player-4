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

/** Subpasta segura por utilizador Windows — evita lock do Chromium entre sessões. */
export function sanitizeWindowsUserForPath(name) {
  const raw = (name || 'default').trim();
  const safe = raw.replace(/[^a-zA-Z0-9._ -]/g, '_').replace(/\s+/g, '_');
  return safe.slice(0, 64) || 'default';
}

/** Perfil Chromium isolado por utilizador; sessao.json continua na raiz de ProgramData. */
export function getWinChromiumProfileDir(root = getWinSharedRoot()) {
  const userSeg = sanitizeWindowsUserForPath(process.env.USERNAME);
  return path.join(root, 'chromium-profile', userSeg);
}

export function getWinChromiumCacheDir(root = getWinSharedRoot()) {
  const userSeg = sanitizeWindowsUserForPath(process.env.USERNAME);
  return path.join(root, 'chromium-cache', userSeg);
}

/**
 * ANTES de app.whenReady().
 * Partilhado: sessao.json, configs, machine_device_id, player-instance-lease.
 * Por utilizador Windows: perfil Chromium (dois .exe em sessões diferentes não bloqueiam).
 */
export function configureWindowsMultiUserPaths() {
  if (!isWinMultiUserPackaged()) return;

  const root = getWinSharedRoot();
  const profile = getWinChromiumProfileDir(root);
  const cache = getWinChromiumCacheDir(root);

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
