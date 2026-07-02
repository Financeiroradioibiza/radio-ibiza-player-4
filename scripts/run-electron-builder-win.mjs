/**
 * electron-builder Windows com IBIZA_TI_BUILD no nome do Setup (lido de meta gerada).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const metaPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'build',
  'installer-version.meta.json',
);

if (!fs.existsSync(metaPath)) {
  console.error('[run-electron-builder-win] Falta build/installer-version.meta.json — rode generate-installer-version.mjs');
  process.exit(1);
}

const { shortTag } = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

const r = spawnSync(
  'npx',
  ['electron-builder', '--win', '--x64', '--publish', 'never'],
  {
    env: { ...process.env, IBIZA_TI_BUILD: shortTag },
    stdio: 'inherit',
    shell: true,
  },
);

process.exit(r.status ?? 1);
