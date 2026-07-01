/**
 * Handlers IPC para `FileSystemStorage` (mesma árvore que ROADMAP 3B).
 * Diretório base: Windows `%ProgramData%\RadioIbizaPlayer\`; em dev no macOS/Linux
 * usa `app.getPath('userData')/RadioIbizaPlayer`.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { ipcMain, app } from 'electron';

import { getWinSharedRoot } from './win-shared-storage.mjs';

const ALLOWED_JSON = new Set(['sessao.json', 'configs.json']);

let baseDirCache = '';
let dirsReady = Promise.resolve();
let registered = false;

function computeBaseDir() {
  if (process.platform === 'win32') {
    return getWinSharedRoot();
  }
  return path.join(app.getPath('userData'), 'RadioIbizaPlayer');
}

function baseDir() {
  if (!baseDirCache) baseDirCache = computeBaseDir();
  return baseDirCache;
}

const MACHINE_DEVICE_ID_FILE = 'machine_device_id.txt';

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

async function ensureTree() {
  const root = baseDir();
  await ensureDir(root);
  await ensureDir(path.join(root, 'pending-executions'));
  await ensureDir(path.join(root, 'audio'));
}

function storageInit() {
  dirsReady = ensureTree();
}

async function ready() {
  await dirsReady;
}

/**
 * UUID estável **por máquina** (ProgramData), partilhado entre todos os perfis Windows.
 * O PWA usa `localStorage` por perfil de browser — incompatível com multiusuário.
 */
function getMachineDeviceIdSync() {
  const root = baseDir();
  try {
    fs.mkdirSync(root, { recursive: true });
  } catch {
    //
  }
  const p = path.join(root, MACHINE_DEVICE_ID_FILE);
  try {
    const id = fs.readFileSync(p, 'utf8').trim();
    if (id.length >= 8) return id;
  } catch {
    //
  }
  const id = crypto.randomUUID();
  try {
    fs.writeFileSync(p, id, 'utf8');
  } catch {
    //
  }
  return id;
}

/** Alinha `sessao.json` ao ID da máquina (modo TI multiusuário). */
export function prepareMultiUserSessionSync() {
  const root = baseDir();
  const machineId = getMachineDeviceIdSync();
  const sessaoPath = path.join(root, 'sessao.json');
  try {
    const raw = fs.readFileSync(sessaoPath, 'utf8');
    const sessao = JSON.parse(raw);
    if (sessao?.token?.token && sessao.install_device_id !== machineId) {
      sessao.install_device_id = machineId;
      fs.writeFileSync(sessaoPath, JSON.stringify(sessao, null, 2), 'utf8');
    }
  } catch {
    //
  }
  return machineId;
}

/**
 * Regista todos os `ipcMain.handle` do storage. Idempotente (dev).
 */
export function registerStorageIpc() {
  if (registered) return;
  registered = true;
  storageInit();

  ipcMain.on('storage:getMachineDeviceIdSync', (event) => {
    event.returnValue = getMachineDeviceIdSync();
  });

  ipcMain.on('storage:prepareMultiUserSessionSync', (event) => {
    event.returnValue = prepareMultiUserSessionSync();
  });

  ipcMain.handle('storage:readJson', async (_e, file) => {
    await ready();
    if (typeof file !== 'string' || !ALLOWED_JSON.has(file)) {
      throw new Error(`readJson: ficheiro não permitido: ${file}`);
    }
    const p = path.join(baseDir(), file);
    try {
      const raw = await fsp.readFile(p, 'utf8');
      return JSON.parse(raw);
    } catch (e) {
      const err = /** @type {{ code?: string }} */ (e);
      if (err.code === 'ENOENT') return null;
      throw e;
    }
  });

  ipcMain.handle('storage:writeJson', async (_e, file, data) => {
    await ready();
    if (typeof file !== 'string' || !ALLOWED_JSON.has(file)) {
      throw new Error(`writeJson: ficheiro não permitido: ${file}`);
    }
    const p = path.join(baseDir(), file);
    await fsp.writeFile(p, JSON.stringify(data, null, 2), 'utf8');
  });

  const pendingDir = () => path.join(baseDir(), 'pending-executions');

  ipcMain.handle('storage:listExecucoes', async () => {
    await ready();
    const dir = pendingDir();
    let names = [];
    try {
      names = await fsp.readdir(dir);
    } catch (e) {
      const err = /** @type {{ code?: string }} */ (e);
      if (err.code === 'ENOENT') return [];
      throw e;
    }
    const jsonFiles = names.filter((n) => n.endsWith('.json'));
    const out = [];
    for (const n of jsonFiles) {
      try {
        const raw = await fsp.readFile(path.join(dir, n), 'utf8');
        out.push(JSON.parse(raw));
      } catch {
        //
      }
    }
    out.sort((a, b) => Number(a.id) - Number(b.id));
    return out;
  });

  ipcMain.handle('storage:addExecucao', async (_e, exec) => {
    await ready();
    const dir = pendingDir();
    let existing = [];
    try {
      existing = await fsp.readdir(dir);
    } catch {
      existing = [];
    }
    let maxId = 0;
    for (const n of existing) {
      const m = /^(\d+)\.json$/.exec(n);
      if (m) maxId = Math.max(maxId, Number(m[1]));
    }
    const id = maxId + 1;
    const full = { ...exec, id, tentativas: exec.tentativas ?? 0 };
    const fp = path.join(dir, `${id}.json`);
    await fsp.writeFile(fp, JSON.stringify(full, null, 2), 'utf8');
    return id;
  });

  ipcMain.handle('storage:updateExecucao', async (_e, id, patch) => {
    await ready();
    const p = path.join(pendingDir(), `${id}.json`);
    const raw = await fsp.readFile(p, 'utf8');
    const cur = JSON.parse(raw);
    await fsp.writeFile(p, JSON.stringify({ ...cur, ...patch }, null, 2), 'utf8');
  });

  ipcMain.handle('storage:removeExecucao', async (_e, id) => {
    await ready();
    try {
      await fsp.unlink(path.join(pendingDir(), `${id}.json`));
    } catch (e) {
      const err = /** @type {{ code?: string }} */ (e);
      if (err.code !== 'ENOENT') throw e;
    }
  });

  ipcMain.handle('storage:clearExecucoes', async () => {
    await ready();
    const dir = pendingDir();
    let names = [];
    try {
      names = await fsp.readdir(dir);
    } catch (e) {
      const err = /** @type {{ code?: string }} */ (e);
      if (err.code === 'ENOENT') return;
      throw e;
    }
    await Promise.all(
      names.filter((n) => n.endsWith('.json')).map((n) => fsp.unlink(path.join(dir, n))),
    );
  });

  const musicasIndexPath = () => path.join(baseDir(), 'musicas-index.json');

  async function readMusicasIndex() {
    try {
      const raw = await fsp.readFile(musicasIndexPath(), 'utf8');
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      const err = /** @type {{ code?: string }} */ (e);
      if (err.code === 'ENOENT') return [];
      throw e;
    }
  }

  async function writeMusicasIndex(items) {
    const p = musicasIndexPath();
    await fsp.writeFile(p, JSON.stringify(items, null, 2), 'utf8');
  }

  ipcMain.handle('storage:listMusicas', async () => {
    await ready();
    return readMusicasIndex();
  });

  ipcMain.handle('storage:upsertMusica', async (_e, m) => {
    await ready();
    const items = await readMusicasIndex();
    const i = items.findIndex((x) => x.musica_id === m.musica_id);
    if (i >= 0) items[i] = m;
    else items.push(m);
    await writeMusicasIndex(items);
  });

  ipcMain.handle('storage:removeMusicaIndex', async (_e, musica_id) => {
    await ready();
    const items = (await readMusicasIndex()).filter((x) => x.musica_id !== musica_id);
    await writeMusicasIndex(items);
  });

  ipcMain.handle('storage:clearMusicasIndex', async () => {
    await ready();
    await writeMusicasIndex([]);
  });

  const audioPath = (musica_id) => path.join(baseDir(), 'audio', `${musica_id}.mp3`);

  ipcMain.handle('storage:saveAudio', async (_e, musica_id, buffer) => {
    await ready();
    const id = Number(musica_id);
    if (!Number.isFinite(id) || id <= 0) throw new Error('saveAudio: musica_id inválido');
    let buf;
    if (Buffer.isBuffer(buffer)) buf = buffer;
    else buf = Buffer.from(new Uint8Array(buffer));
    await fsp.writeFile(audioPath(id), buf);
  });

  ipcMain.handle('storage:audioExists', async (_e, musica_id) => {
    await ready();
    try {
      await fsp.access(audioPath(musica_id));
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('storage:getAudioPath', async (_e, musica_id) => {
    await ready();
    const p = audioPath(musica_id);
    try {
      await fsp.access(p);
      return p;
    } catch {
      return null;
    }
  });

  ipcMain.handle('storage:removeAudio', async (_e, musica_id) => {
    await ready();
    try {
      await fsp.unlink(audioPath(musica_id));
    } catch (e) {
      const err = /** @type {{ code?: string }} */ (e);
      if (err.code !== 'ENOENT') throw e;
    }
  });

  ipcMain.handle('storage:clearAllAudio', async () => {
    await ready();
    const dir = path.join(baseDir(), 'audio');
    let names = [];
    try {
      names = await fsp.readdir(dir);
    } catch (e) {
      const err = /** @type {{ code?: string }} */ (e);
      if (err.code === 'ENOENT') return;
      throw e;
    }
    await Promise.all(names.map((n) => fsp.unlink(path.join(dir, n))));
  });
}
