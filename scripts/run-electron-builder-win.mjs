/**
 * electron-builder Windows — gera o Setup fora da pasta do projeto (evita
 * "Can't open output file" quando o Explorador/antivirus bloqueia dist-electron).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const metaPath = path.join(root, 'build', 'installer-version.meta.json');
const projectOut = path.join(root, 'dist-electron');

if (!fs.existsSync(metaPath)) {
  console.error(
    '[run-electron-builder-win] Falta build/installer-version.meta.json — rode generate-installer-version.mjs',
  );
  process.exit(1);
}

const { shortTag } = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

/** Sem espacos no caminho — NSIS/Defender bloqueiam menos que dist-electron aberto no Explorer. */
const stagingOut = path.join(
  process.env.LOCALAPPDATA || os.tmpdir(),
  'RadioIbiza',
  'electron-builder-out',
);

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

rmRf(stagingOut);
fs.mkdirSync(stagingOut, { recursive: true });

console.info('');
console.info('[run-electron-builder-win] IMPORTANTE:');
console.info('  1. Feche a janela do Explorador em dist-electron');
console.info('  2. Build temporario em:');
console.info(`     ${stagingOut}`);
console.info('');

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const r = spawnSync(
  npx,
  [
    'electron-builder',
    '--win',
    '--x64',
    '--publish',
    'never',
    `--config.directories.output=${stagingOut}`,
  ],
  {
    env: {
      ...process.env,
      IBIZA_TI_BUILD: shortTag,
      CSC_IDENTITY_AUTO_DISCOVERY: 'false',
    },
    stdio: 'inherit',
    cwd: root,
  },
);

if (r.status !== 0) {
  console.error(
    '\n[run-electron-builder-win] Build falhou. Se viu "Can\'t open output file":\n' +
      '  - Feche Explorador/antivirus na pasta do projeto\n' +
      '  - Ou copie manualmente o Setup de:\n' +
      `    ${stagingOut}\n`,
  );
  process.exit(r.status ?? 1);
}

const setups = fs.readdirSync(stagingOut).filter((n) => n.endsWith('-Setup.exe'));
if (setups.length === 0) {
  console.error('[run-electron-builder-win] Nenhum *-Setup.exe em', stagingOut);
  process.exit(1);
}

const setupPath = path.join(stagingOut, setups[0]);
console.info(`\n[run-electron-builder-win] Setup gerado: ${setupPath}`);

try {
  fs.mkdirSync(projectOut, { recursive: true });
  copyDirSync(stagingOut, projectOut);
  console.info(`[run-electron-builder-win] Copiado para: ${path.join(projectOut, setups[0])}`);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.warn(`[run-electron-builder-win] Nao copiou para dist-electron (${msg})`);
  console.info(`[run-electron-builder-win] Use o instalador em:\n  ${setupPath}`);
}

process.exit(0);
