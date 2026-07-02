/**
 * Lease «único player activo por máquina» — ficheiro em ProgramData.
 * Partilhado entre utilizadores Windows (modo TI). Não usa localStorage/Chromium.
 *
 * Sem alterações ao instalador NSIS — só I/O em runtime no .exe.
 */

import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

import { ipcMain } from 'electron';

import { getProgramDataRoot } from './programdata-constants.mjs';
import { grantSharedUsersAccessSync } from './win-acl.mjs';
import { needsBomRepair, parseJsonUtf8 } from './json-utf8.mjs';
import { isWinMultiUserPackaged } from './win-shared-storage.mjs';

const LEASE_BASENAME = 'player-instance-lease.json';

/** Igual ao PWA (`playerTabLease.ts`) — heartbeat ~1,5s, morto após ~5s. */
export const PLAYER_INSTANCE_LEASE_STALE_MS = 5000;

let processInstanceId = '';
let registered = false;

function leasePath() {
  return path.join(getProgramDataRoot(), LEASE_BASENAME);
}

export function getProcessInstanceId() {
  if (!processInstanceId) {
    processInstanceId = crypto.randomUUID();
  }
  return processInstanceId;
}

function writeLeaseFile(payload) {
  const filePath = leasePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  const body = `${JSON.stringify(payload, null, 2)}\n`;
  fs.writeFileSync(tmp, body, { encoding: 'utf8', mode: 0o666 });
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    fs.renameSync(tmp, filePath);
  } catch {
    fs.copyFileSync(tmp, filePath);
    try {
      fs.unlinkSync(tmp);
    } catch {
      //
    }
  }
  try {
    fs.chmodSync(filePath, 0o666);
  } catch {
    //
  }
  grantSharedUsersAccessSync(filePath);
}

function readLeaseFileRaw() {
  const filePath = leasePath();
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = parseJsonUtf8(raw);
  if (needsBomRepair(raw)) {
    writeLeaseFile(data);
  }
  return data;
}

function normalizeLease(data) {
  if (!data || typeof data !== 'object') return null;
  const holderId = String(data.holderId ?? '').trim();
  const beat = Number(data.beat);
  if (!holderId || !Number.isFinite(beat)) return null;
  return {
    holderId,
    beat,
    windowsUser: typeof data.windowsUser === 'string' ? data.windowsUser : '',
  };
}

export function readPlayerInstanceLeaseSync() {
  try {
    return normalizeLease(readLeaseFileRaw());
  } catch {
    return null;
  }
}

export function writePlayerInstanceLeaseSync(holderId, beat = Date.now()) {
  if (typeof holderId !== 'string' || !holderId.trim()) return false;
  /** Só a instância local pode publicar o seu holderId (takeover = user confirma na UI). */
  if (holderId !== getProcessInstanceId()) return false;
  writeLeaseFile({
    holderId,
    beat,
    windowsUser: process.env.USERNAME || '',
    pid: process.pid,
  });
  return true;
}

export function clearPlayerInstanceLeaseIfHeldBySync(holderId) {
  const cur = readPlayerInstanceLeaseSync();
  if (!cur || cur.holderId !== holderId) return;
  try {
    fs.unlinkSync(leasePath());
  } catch {
    //
  }
}

export function getPlayerInstanceMetaSync() {
  return {
    instanceId: getProcessInstanceId(),
    windowsUser: process.env.USERNAME || '',
  };
}

export function registerPlayerInstanceLeaseIpc() {
  if (registered || !isWinMultiUserPackaged()) return;
  registered = true;

  ipcMain.on('playerLease:readSync', (event) => {
    event.returnValue = readPlayerInstanceLeaseSync();
  });

  ipcMain.on('playerLease:writeSync', (event, holderId, beat) => {
    event.returnValue = writePlayerInstanceLeaseSync(holderId, beat);
  });

  ipcMain.on('playerLease:clearSync', (event, holderId) => {
    clearPlayerInstanceLeaseIfHeldBySync(holderId);
    event.returnValue = true;
  });

  ipcMain.on('playerLease:getMetaSync', (event) => {
    event.returnValue = getPlayerInstanceMetaSync();
  });
}

export function clearLocalPlayerInstanceLeaseOnQuit() {
  if (!isWinMultiUserPackaged()) return;
  clearPlayerInstanceLeaseIfHeldBySync(getProcessInstanceId());
}
