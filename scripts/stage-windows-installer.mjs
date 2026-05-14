/**
 * Copia o artefato mais recente `dist-electron/RadioIbiza-*-W-Setup.exe` para
 * `public/install/RadioIbiza-Setup.exe` (nome fixo para a página /instalar.html).
 *
 * Uso: após `npm run dist:win` → `npm run stage:win-installer` → `npm run build:web`
 * (ou deploy) para o .exe ir no mesmo host que o player.
 */

import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');
const distElectron = join(root, 'dist-electron');
const outDir = join(root, 'public', 'install');
const outFile = join(outDir, 'RadioIbiza-Setup.exe');

const re = /^RadioIbiza-.+-W-Setup\.exe$/i;

let names;
try {
  names = readdirSync(distElectron).filter((f) => re.test(f));
} catch {
  console.error(
    'Pasta dist-electron não encontrada. Rode no Windows ou CI: npm run dist:win',
  );
  process.exit(1);
}

if (names.length === 0) {
  console.error(
    'Nenhum RadioIbiza-*-W-Setup.exe em dist-electron. Rode primeiro: npm run dist:win',
  );
  process.exit(1);
}

names.sort(
  (a, b) =>
    statSync(join(distElectron, b)).mtimeMs - statSync(join(distElectron, a)).mtimeMs,
);

const newest = join(distElectron, names[0]);
mkdirSync(outDir, { recursive: true });
copyFileSync(newest, outFile);
console.log(`Copiado: ${names[0]} → public/install/RadioIbiza-Setup.exe`);
