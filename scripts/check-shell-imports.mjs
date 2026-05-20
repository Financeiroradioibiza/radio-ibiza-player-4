/**
 * Impede imports cruzados entre shells desktop/mobile (DEC-012).
 * Executar: node scripts/check-shell-imports.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src', 'shells');

function walkTsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) out.push(...walkTsFiles(p));
    else if (/\.(ts|tsx)$/.test(name.name)) out.push(p);
  }
  return out;
}

let bad = 0;
for (const file of walkTsFiles(SRC)) {
  const rel = file.replace(ROOT + '/', '');
  const text = readFileSync(file, 'utf8');
  if (rel.includes('/desktop/') && /from ['"]@\/shells\/mobile|from ['"].*shells\/mobile/.test(text)) {
    console.error(`[shell-import] ${rel}: não importar shell mobile aqui.`);
    bad++;
  }
  if (rel.includes('/mobile/') && /from ['"]@\/shells\/desktop|from ['"].*shells\/desktop/.test(text)) {
    console.error(`[shell-import] ${rel}: não importar shell desktop aqui.`);
    bad++;
  }
}

if (bad > 0) process.exit(1);
