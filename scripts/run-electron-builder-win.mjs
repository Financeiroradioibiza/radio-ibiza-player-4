/**
 * electron-builder Windows — Setup fora da pasta do projeto.
 * Usa caminho SEM espacos (C:\RadioIbizaBuild) e node cli directo (sem npx).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const metaPath = path.join(root, 'build', 'installer-version.meta.json');
const projectOut = path.join(root, 'dist-electron');
const ebCli = path.join(root, 'node_modules', 'electron-builder', 'cli.js');

if (!fs.existsSync(metaPath)) {
  console.error('[run-electron-builder-win] Falta build/installer-version.meta.json');
  process.exit(1);
}
if (!fs.existsSync(ebCli)) {
  console.error('[run-electron-builder-win] Falta node_modules/electron-builder — rode npm install');
  process.exit(1);
}

const { shortTag } = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

/** Caminhos sem espaco — NSIS falha "Can't open output file" com perfil "Rafael PCmac". */
const STAGING_CANDIDATES = [
  'C:\\RadioIbizaBuild\\electron-builder-out',
  path.join('C:\\Temp', 'RadioIbiza', 'electron-builder-out'),
  path.join(process.env.LOCALAPPDATA || '', 'RadioIbiza', 'electron-builder-out'),
];

function pickStagingOut() {
  for (const dir of STAGING_CANDIDATES) {
    if (!dir || dir.includes(' ')) continue;
    try {
      fs.mkdirSync(dir, { recursive: true });
      const probe = path.join(dir, '.write-test');
      fs.writeFileSync(probe, 'ok');
      fs.unlinkSync(probe);
      return dir;
    } catch {
      //
    }
  }
  const fallback = path.join(os.tmpdir(), 'RadioIbiza-eb-out');
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

function rmRf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);
    if (ent.isDirectory()) copyDirSync(s, d);
    else fs.copyFileSync(s, d);
  }
}

function listDir(label, dir) {
  console.info(`\n[run-electron-builder-win] ${label}: ${dir}`);
  if (!fs.existsSync(dir)) {
    console.info('  (pasta nao existe)');
    return;
  }
  for (const name of fs.readdirSync(dir)) {
    console.info(`  - ${name}`);
  }
}

function printBuilderDebug(outDir) {
  const dbg = path.join(outDir, 'builder-debug.yml');
  if (!fs.existsSync(dbg)) return;
  const tail = fs.readFileSync(dbg, 'utf8').split('\n').slice(-40).join('\n');
  console.info('\n[run-electron-builder-win] builder-debug.yml (final):\n' + tail);
}

const stagingOut = pickStagingOut();
rmRf(stagingOut);
fs.mkdirSync(stagingOut, { recursive: true });

/** electron-builder aceita barras / no Windows. */
const stagingForConfig = stagingOut.replace(/\\/g, '/');

console.info('');
console.info('[run-electron-builder-win] Feche o Explorador em dist-electron.');
console.info(`[run-electron-builder-win] Pasta de build: ${stagingOut}`);
console.info('');

const r = spawnSync(
  process.execPath,
  [
    ebCli,
    '--win',
    '--x64',
    '--publish',
    'never',
    `-c.directories.output=${stagingForConfig}`,
  ],
  {
    env: {
      ...process.env,
      IBIZA_TI_BUILD: shortTag,
      CSC_IDENTITY_AUTO_DISCOVERY: 'false',
      WIN_CSC_LINK: '',
      CSC_LINK: '',
    },
    stdio: 'inherit',
    cwd: root,
  },
);

listDir('Conteudo apos build', stagingOut);
printBuilderDebug(stagingOut);

const setups = fs.existsSync(stagingOut)
  ? fs.readdirSync(stagingOut).filter((n) => n.endsWith('-Setup.exe'))
  : [];

if (r.status !== 0 || setups.length === 0) {
  console.error(
    '\n[run-electron-builder-win] FALHOU — Setup.exe nao gerado.',
  );
  if (r.status !== 0) {
    console.error(`  exit code: ${r.status}`);
  }
  console.error(
    '  Se viu "Can\'t open output file": antivirus ou caminho bloqueado.\n' +
      '  Tente CMD como Administrador e exclusao Defender em C:\\RadioIbizaBuild\n' +
      '  Se win-unpacked existe mas Setup nao, copie builder-debug.yml acima para suporte.',
  );
  process.exit(r.status && r.status !== 0 ? r.status : 1);
}

const setupPath = path.join(stagingOut, setups[0]);
console.info(`\n[run-electron-builder-win] OK — Setup: ${setupPath}`);

try {
  fs.mkdirSync(projectOut, { recursive: true });
  copyDirSync(stagingOut, projectOut);
  console.info(`[run-electron-builder-win] Copiado: ${path.join(projectOut, setups[0])}`);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.warn(`[run-electron-builder-win] Nao copiou para dist-electron (${msg})`);
  console.info(`[run-electron-builder-win] Instale a partir de:\n  ${setupPath}`);
}

process.exit(0);
