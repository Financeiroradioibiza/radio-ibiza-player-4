/**
 * Falha o build Windows se `dist/` não foi gerado com VITE_IBIZA_TARGET=W.
 * Evita empacotar bundle PWA (WEB) no instalador — login ia para IndexedDB.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const marker = path.join(root, 'dist', 'ibiza-build-target.txt');
const target = (process.env.VITE_IBIZA_TARGET ?? '').toUpperCase();

if (target !== 'W') {
  console.warn('[assert-win-build] VITE_IBIZA_TARGET não é W neste passo — OK se for só electron-builder.');
}

if (!fs.existsSync(marker)) {
  console.error(
    '[assert-win-build] FALTA dist/ibiza-build-target.txt — rode: cross-env VITE_IBIZA_TARGET=W npm run build',
  );
  process.exit(1);
}

const got = fs.readFileSync(marker, 'utf8').trim().toUpperCase();
if (got !== 'W') {
  console.error(`[assert-win-build] dist/ aponta para target "${got}", esperado W.`);
  process.exit(1);
}

console.info('[assert-win-build] dist/ OK — target W (modo TI / ProgramData).');
