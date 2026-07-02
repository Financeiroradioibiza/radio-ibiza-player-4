/**
 * electron-builder Windows com IBIZA_TI_BUILD no nome do Setup (lido de meta gerada).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const metaPath = path.join(root, 'build', 'installer-version.meta.json');
const outDir = path.join(root, 'dist-electron');

if (!fs.existsSync(metaPath)) {
  console.error(
    '[run-electron-builder-win] Falta build/installer-version.meta.json — rode generate-installer-version.mjs',
  );
  process.exit(1);
}

const { shortTag } = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

/** NSIS falha com "Can't open output file" se o Setup anterior estiver aberto/bloqueado. */
function cleanPreviousSetups() {
  if (!fs.existsSync(outDir)) return;
  const stale = fs
    .readdirSync(outDir)
    .filter(
      (name) =>
        name.endsWith('-Setup.exe') ||
        name.endsWith('-Setup.__uninstaller.exe') ||
        name.endsWith('-Setup.exe.blockmap'),
    );
  for (const name of stale) {
    const p = path.join(outDir, name);
    try {
      fs.unlinkSync(p);
      console.info(`[run-electron-builder-win] Apagado: ${name}`);
    } catch {
      console.error(
        `[run-electron-builder-win] BLOQUEADO: dist-electron\\${name}\n` +
          '  Feche o instalador Radio Ibiza se estiver aberto, desactive scan em tempo real\n' +
          '  na pasta do projeto e apague manualmente os ficheiros *-Setup.exe em dist-electron\\',
      );
      process.exit(1);
    }
  }
}

cleanPreviousSetups();

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const r = spawnSync(
  npx,
  ['electron-builder', '--win', '--x64', '--publish', 'never'],
  {
    env: { ...process.env, IBIZA_TI_BUILD: shortTag },
    stdio: 'inherit',
    cwd: root,
  },
);

process.exit(r.status ?? 1);
