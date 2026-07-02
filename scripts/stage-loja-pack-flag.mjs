/**
 * Pacote loja: copia build/loja-pack.flag → electron/loja-pack.flag antes do electron-builder.
 * Build TI: `off` remove o ficheiro de electron/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'build', 'loja-pack.flag');
const dest = path.join(root, 'electron', 'loja-pack.flag');
const mode = (process.argv[2] ?? 'off').toLowerCase();

if (mode === 'on') {
  if (!fs.existsSync(src)) {
    console.error('[stage-loja-pack-flag] Falta build/loja-pack.flag');
    process.exit(1);
  }
  fs.copyFileSync(src, dest);
  console.info('[stage-loja-pack-flag] loja-pack.flag activado em electron/');
} else {
  if (fs.existsSync(dest)) {
    fs.unlinkSync(dest);
    console.info('[stage-loja-pack-flag] loja-pack.flag removido de electron/');
  }
}
