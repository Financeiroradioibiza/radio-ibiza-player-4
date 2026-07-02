/**
 * Handlers IPC para `FileSystemStorage` (mesma árvore que ROADMAP 3B).
 * Diretório base: Windows `%ProgramData%\RadioIbizaPlayer\`; em dev no macOS/Linux
 * usa `app.getPath('userData')/RadioIbizaPlayer`.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ipcMain, app } from 'electron';

import { getProgramDataRoot, getProgramDataSessaoPath } from './programdata-constants.mjs';
import { grantSharedUsersAccessSync } from './win-acl.mjs';
import { needsBomRepair, parseJsonUtf8 } from './json-utf8.mjs';

export { getProgramDataRoot, getProgramDataSessaoPath };

const ALLOWED_JSON = new Set(['sessao.json', 'configs.json']);

let baseDirCache = '';
let dirsReady = Promise.resolve();
let registered = false;

function computeBaseDir() {
  if (process.platform === 'win32') {
    return getProgramDataRoot();
  }
  return path.join(app.getPath('userData'), 'RadioIbizaPlayer');
}

function baseDir() {
  if (!baseDirCache) baseDirCache = computeBaseDir();
  return baseDirCache;
}

const MACHINE_DEVICE_ID_FILE = 'machine_device_id.txt';

const SESSAO_INICIAL_FALLBACK = {
  id: 1,
  token: null,
  cliente_id: null,
  cliente: null,
  pdv: null,
  playlists_data: null,
  agendas_data: null,
  ping_times: 0,
  last_update: null,
  primeiro_acesso: true,
  install_device_id: null,
  install_serial: null,
  programacao_pendente_playlist: null,
  programacao_pendente_agendas: null,
};

const CONFIGS_INICIAL_FALLBACK = {
  id: 1,
  restart_player: false,
  time_restart_player: '',
};

function resolveProgramDataTemplate(name) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, name);
  }
  return path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'build', name);
}

function readJsonTemplate(name, fallback) {
  try {
    const p = resolveProgramDataTemplate(name);
    return parseJsonUtf8(fs.readFileSync(p, 'utf8'));
  } catch {
    return { ...fallback };
  }
}

/** Lê JSON; remove BOM ou repõe fallback se o ficheiro estiver corrompido. */
function readJsonFileWithRepair(filePath, fallback) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    const err = /** @type {{ code?: string }} */ (e);
    if (err.code === 'ENOENT') return null;
    throw e;
  }

  try {
    const data = parseJsonUtf8(raw);
    if (needsBomRepair(raw)) {
      writeJsonSyncAtomic(filePath, data);
    }
    return data;
  } catch (parseErr) {
    const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
    const backup = `${filePath}.corrupt-${Date.now()}.bak`;
    try {
      fs.copyFileSync(filePath, backup);
    } catch {
      //
    }
    const reset = fallback ? { ...fallback } : null;
    if (reset) {
      writeJsonSyncAtomic(filePath, reset);
    }
    appendStorageErroSync(
      path.dirname(filePath),
      `JSON invalido ${path.basename(filePath)}: ${msg} -> reposto inicial backup=${path.basename(backup)} user=${process.env.USERNAME || ''}`,
    );
    return reset;
  }
}

function fallbackForAllowedJson(file) {
  if (file === 'sessao.json') {
    return readJsonTemplate('programdata-sessao-inicial.json', SESSAO_INICIAL_FALLBACK);
  }
  if (file === 'configs.json') {
    return readJsonTemplate('programdata-configs-inicial.json', CONFIGS_INICIAL_FALLBACK);
  }
  return null;
}

function readAllowedJsonWithRetry(filePath, fallback) {
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(filePath)) {
      return readJsonFileWithRepair(filePath, fallback);
    }
    if (i < 7) {
      const waitUntil = Date.now() + 35 * (i + 1);
      while (Date.now() < waitUntil) {
        //
      }
    }
  }
  return null;
}

function appendStorageAuditSync(root, line) {
  try {
    fs.appendFileSync(path.join(root, 'storage-audit.log'), `${line}\n`, 'utf8');
    grantSharedUsersAccessSync(path.join(root, 'storage-audit.log'));
  } catch {
    //
  }
}

/** Lê + funde + grava atómico no main — evita race e IndexedDB no renderer. */
function patchAllowedJsonSync(file, patch) {
  if (typeof file !== 'string' || !ALLOWED_JSON.has(file)) {
    throw new Error(`patchJson: ficheiro não permitido: ${file}`);
  }
  const p = path.join(baseDir(), file);
  const fallback = fallbackForAllowedJson(file);
  const cur = readAllowedJsonWithRetry(p, fallback) ?? { ...(fallback ?? {}), id: 1 };
  const next = { ...cur, ...patch, id: 1 };
  writeJsonSyncAtomic(p, next);
  const hasToken = Boolean(file === 'sessao.json' && next.token?.token);
  appendStorageAuditSync(
    baseDir(),
    `${new Date().toISOString()} patch ${file} user=${process.env.USERNAME || ''} token=${hasToken ? 'sim' : 'nao'}`,
  );
  return next;
}

function writeJsonSyncAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  const body = `${JSON.stringify(data, null, 2)}\n`;
  fs.writeFileSync(tmp, body, { encoding: 'utf8', mode: 0o666 });
  /**
   * NUNCA unlink + rename no Windows com duas instâncias (.exe TI):
   * entre unlink e rename o ficheiro não existe → 2.º processo lê null e
   * gravava SESSAO_INICIAL por cima do token do 1.º utilizador.
   */
  try {
    fs.copyFileSync(tmp, filePath);
  } finally {
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

/**
 * Garante árvore ProgramData + sessao.json + configs.json (modo TI).
 * Chamado no instalador, no arranque do .exe e antes de qualquer IPC de storage.
 */
export function ensureProgramDataStorageSync() {
  if (process.platform !== 'win32') {
    return { ok: false, reason: 'not-win32' };
  }

  const root = getProgramDataRoot();
  const result = {
    ok: true,
    root,
    sessao_json: false,
    configs_json: false,
    machine_device_id: false,
    error: null,
  };

  try {
    fs.mkdirSync(root, { recursive: true });
    fs.mkdirSync(path.join(root, 'pending-executions'), { recursive: true });
    fs.mkdirSync(path.join(root, 'audio'), { recursive: true });
    fs.mkdirSync(path.join(root, 'chromium-profile'), { recursive: true });
    fs.mkdirSync(path.join(root, 'chromium-cache'), { recursive: true });

    let machineId = '';
    try {
      machineId = getMachineDeviceIdSync();
      result.machine_device_id = Boolean(machineId);
    } catch (e) {
      result.error = `machine_device_id: ${e instanceof Error ? e.message : String(e)}`;
    }

    const sessaoPath = path.join(root, 'sessao.json');
    try {
      if (!fs.existsSync(sessaoPath)) {
        const sessao = readJsonTemplate('programdata-sessao-inicial.json', SESSAO_INICIAL_FALLBACK);
        if (machineId) sessao.install_device_id = machineId;
        writeJsonSyncAtomic(sessaoPath, sessao);
        result.sessao_json = true;
      } else {
        readJsonFileWithRepair(sessaoPath, SESSAO_INICIAL_FALLBACK);
      }
    } catch (e) {
      result.ok = false;
      result.error = `sessao.json: ${e instanceof Error ? e.message : String(e)}`;
    }

    const configsPath = path.join(root, 'configs.json');
    try {
      if (!fs.existsSync(configsPath)) {
        const configs = readJsonTemplate('programdata-configs-inicial.json', CONFIGS_INICIAL_FALLBACK);
        writeJsonSyncAtomic(configsPath, configs);
        result.configs_json = true;
      } else {
        readJsonFileWithRepair(configsPath, CONFIGS_INICIAL_FALLBACK);
      }
    } catch (e) {
      if (!result.error) {
        result.error = `configs.json: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    try {
      fs.writeFileSync(
        path.join(root, 'storage-backend.txt'),
        `backend=programdata-file\nsessao=${sessaoPath}\nupdated=${new Date().toISOString()}\n`,
        'utf8',
      );
    } catch {
      //
    }
  } catch (e) {
    result.ok = false;
    result.error = e instanceof Error ? e.message : String(e);
    try {
      const logPath = path.join(root, 'storage-erro.txt');
      fs.writeFileSync(
        logPath,
        `${new Date().toISOString()} ensureProgramDataStorageSync: ${result.error}\n`,
        { encoding: 'utf8', flag: 'a' },
      );
    } catch {
      //
    }
  }

  return result;
}

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
    grantSharedUsersAccessSync(p);
  } catch {
    //
  }
  return id;
}

function appendStorageErroSync(root, msg) {
  try {
    fs.appendFileSync(
      path.join(root, 'storage-erro.txt'),
      `${new Date().toISOString()} ${msg}\n`,
      'utf8',
    );
  } catch {
    //
  }
}

/** Alinha `sessao.json` ao ID da máquina (modo TI multiusuário). */
export function prepareMultiUserSessionSync() {
  ensureProgramDataStorageSync();
  const root = baseDir();
  const machineId = getMachineDeviceIdSync();
  const sessaoPath = path.join(root, 'sessao.json');

  if (!fs.existsSync(sessaoPath)) {
    try {
      const sessao = readJsonTemplate('programdata-sessao-inicial.json', SESSAO_INICIAL_FALLBACK);
      sessao.install_device_id = machineId;
      writeJsonSyncAtomic(sessaoPath, sessao);
    } catch (e) {
      appendStorageErroSync(
        root,
        `prepareMultiUserSessionSync criar sessao: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    return machineId;
  }

  try {
    const sessao = readJsonFileWithRepair(sessaoPath, SESSAO_INICIAL_FALLBACK);
    if (!sessao) return machineId;
    let changed = false;
    if (!sessao.install_device_id) {
      sessao.install_device_id = machineId;
      changed = true;
    }
    if (sessao?.token?.token && sessao.install_device_id !== machineId) {
      sessao.install_device_id = machineId;
      changed = true;
    }
    if (changed) {
      writeJsonSyncAtomic(sessaoPath, sessao);
    }
  } catch (e) {
    /** Nunca sobrescrever sessao existente — apagava o login do 1.º utilizador para os restantes. */
    const code = /** @type {{ code?: string }} */ (e).code || '';
    appendStorageErroSync(
      root,
      `prepareMultiUserSessionSync ler sessao (${code || 'erro'}): ${e instanceof Error ? e.message : String(e)} user=${process.env.USERNAME || ''}`,
    );
  }
  return machineId;
}

/** Diagnóstico — caminhos reais no disco (modo TI). */
export function getStorageDiagSync() {
  const root = baseDir();
  const sessaoPath = path.join(root, 'sessao.json');
  let sessaoHasToken = false;
  try {
    if (fs.existsSync(sessaoPath)) {
      const s = readJsonFileWithRepair(sessaoPath, SESSAO_INICIAL_FALLBACK);
      sessaoHasToken = Boolean(s?.token?.token);
    }
  } catch {
    //
  }
  return {
    storageRoot: root,
    sessaoPath,
    sessaoExists: fs.existsSync(sessaoPath),
    sessaoHasToken,
    chromiumUserData: app.getPath('userData'),
    appData: app.getPath('appData'),
    isPackaged: app.isPackaged,
    pageUrl: '',
  };
}

/** Audit: preload expôs electronAPI.storage no renderer? */
export function auditRendererBridgeSync(probe, preloadPath = '') {
  if (process.platform !== 'win32') return;
  const p = probe && typeof probe === 'object' ? probe : {};
  const hasApi = p.hasApi === true;
  const hasStorage = p.hasStorage === true;
  const ti = p.ti === true;
  const err = typeof p.err === 'string' ? p.err : '';
  appendStorageAuditSync(
    baseDir(),
    `${new Date().toISOString()} renderer-bridge api=${hasApi ? 'sim' : 'nao'} storage=${hasStorage ? 'sim' : 'nao'} ti=${ti ? 'sim' : 'nao'} preload=${preloadPath || '?'} user=${process.env.USERNAME || ''}${err ? ` err=${err}` : ''}`,
  );
}

/** Ficheiro texto para o operador TI localizar onde o .exe grava dados. */
export function writeOndeEstaoOsDadosSync(pageUrl = '') {
  if (process.platform !== 'win32') return;

  const diag = getStorageDiagSync();
  diag.pageUrl = pageUrl;

  const indexedDbHint = path.join(diag.chromiumUserData, 'IndexedDB');
  const lines = [
    `data=${new Date().toISOString()}`,
    `usuario_windows=${process.env.USERNAME || ''}`,
    '',
    '=== ONDE O LOGIN DEVERIA ESTAR (.exe modo TI) ===',
    `sessao.json (CORRETO) = ${diag.sessaoPath}`,
    `existe=${diag.sessaoExists}`,
    `tem_token=${diag.sessaoHasToken}`,
    '',
    '=== SE ProgramData ESTIVER VAZIO, O LOGIN PODE ESTAR AQUI ===',
    `perfil_chromium_userData = ${diag.chromiumUserData}`,
    `indexeddb_neste_perfil = ${indexedDbHint}`,
    `appdata_radio_ibiza = ${path.join(diag.appData, 'Radio Ibiza')}`,
    '',
    '=== OUTROS (NAO usar para modo TI) ===',
    'browser_pwa = IndexedDB do Chrome/Edge por utilizador (player4.radioibiza.com.br)',
    '',
    `url_carregada=${pageUrl || '(ainda nao)'}`,
    `empacotado=${diag.isPackaged}`,
    '',
    'F12 deve mostrar: [storage] Modo TI — sessao.json em ProgramData',
    'Se mostrar Modo PWA, o atalho NAO e o Radio Ibiza.exe ou o .exe esta antigo.',
  ];

  const body = `${lines.join('\n')}\n`;
  const targets = [
    path.join(getProgramDataRoot(), 'onde-estao-os-dados.txt'),
    path.join(diag.chromiumUserData, 'onde-estao-os-dados.txt'),
    path.join(diag.appData, 'Radio Ibiza', 'onde-estao-os-dados.txt'),
  ];

  for (const t of targets) {
    try {
      fs.mkdirSync(path.dirname(t), { recursive: true });
      fs.writeFileSync(t, body, 'utf8');
    } catch {
      //
    }
  }
}

/**
 * Regista todos os `ipcMain.handle` do storage. Idempotente (dev).
 */
export function registerStorageIpc() {
  if (registered) return;
  registered = true;
  if (process.platform === 'win32') {
    ensureProgramDataStorageSync();
  }
  storageInit();
  if (process.platform === 'win32') {
    appendStorageAuditSync(baseDir(), `${new Date().toISOString()} ipc storage registado pid=${process.pid}`);
  }

  ipcMain.on('storage:getMachineDeviceIdSync', (event) => {
    event.returnValue = getMachineDeviceIdSync();
  });

  ipcMain.on('storage:prepareMultiUserSessionSync', (event) => {
    event.returnValue = prepareMultiUserSessionSync();
  });

  ipcMain.on('storage:getDiagSync', (event) => {
    event.returnValue = getStorageDiagSync();
  });

  ipcMain.on('storage:patchJsonSync', (event, file, patch) => {
    try {
      event.returnValue = { ok: true, data: patchAllowedJsonSync(file, patch) };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      appendStorageErroSync(baseDir(), `patchJsonSync ${file}: ${msg} user=${process.env.USERNAME || ''}`);
      event.returnValue = { ok: false, error: msg };
    }
  });

  ipcMain.handle('storage:patchJson', async (_e, file, patch) => {
    try {
      return { ok: true, data: patchAllowedJsonSync(file, patch) };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      appendStorageErroSync(baseDir(), `patchJson ${file}: ${msg} user=${process.env.USERNAME || ''}`);
      return { ok: false, error: msg };
    }
  });

  ipcMain.on('storage:logEventSync', (_event, msg) => {
    appendStorageAuditSync(
      baseDir(),
      `${new Date().toISOString()} renderer ${String(msg ?? '')} user=${process.env.USERNAME || ''}`,
    );
  });

  ipcMain.handle('storage:logEvent', async (_e, msg) => {
    appendStorageAuditSync(
      baseDir(),
      `${new Date().toISOString()} renderer ${String(msg ?? '')} user=${process.env.USERNAME || ''}`,
    );
  });

  ipcMain.handle('storage:readJson', async (_e, file) => {
    await ready();
    if (typeof file !== 'string' || !ALLOWED_JSON.has(file)) {
      throw new Error(`readJson: ficheiro não permitido: ${file}`);
    }
    const p = path.join(baseDir(), file);
    const fallback = fallbackForAllowedJson(file);
    try {
      for (let i = 0; i < 8; i++) {
        if (fs.existsSync(p)) {
          return readJsonFileWithRepair(p, fallback);
        }
        if (i < 7) {
          await new Promise((resolve) => {
            setTimeout(resolve, 35 * (i + 1));
          });
        }
      }
      return null;
    } catch (e) {
      const err = /** @type {{ code?: string }} */ (e);
      if (err.code === 'ENOENT') return null;
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        appendStorageErroSync(
          baseDir(),
          `readJson ${file} sem permissao (${err.code}) user=${process.env.USERNAME || ''} path=${p}`,
        );
      }
      throw e;
    }
  });

  ipcMain.handle('storage:writeJson', async (_e, file, data) => {
    await ready();
    if (typeof file !== 'string' || !ALLOWED_JSON.has(file)) {
      throw new Error(`writeJson: ficheiro não permitido: ${file}`);
    }
    const p = path.join(baseDir(), file);
    try {
      writeJsonSyncAtomic(p, data);
      try {
        const auditPath = path.join(baseDir(), 'storage-audit.log');
        const hasToken = Boolean(
          file === 'sessao.json' && data && typeof data === 'object' && data.token?.token,
        );
        await fsp.appendFile(
          auditPath,
          `${new Date().toISOString()} write ${file} -> ${p} user=${process.env.USERNAME || ''} token=${hasToken ? 'sim' : 'nao'}\n`,
          'utf8',
        );
      } catch {
        //
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      try {
        const logPath = path.join(baseDir(), 'storage-erro.txt');
        await fsp.appendFile(
          logPath,
          `${new Date().toISOString()} writeJson ${file}: ${msg}\n`,
          'utf8',
        );
      } catch {
        //
      }
      throw e;
    }
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
