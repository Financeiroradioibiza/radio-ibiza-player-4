/**
 * Falha o build modo TI se `electron/loja-pack.flag` existir — esse ficheiro
 * desliga ProgramData multiusuário e carrega o PWA remoto (player4).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const flag = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'electron', 'loja-pack.flag');

if (fs.existsSync(flag)) {
  console.error(
    '[ensure-ti-win-build] FALHA: electron/loja-pack.flag existe.\n' +
      '  Apague-o ou rode: node scripts/stage-loja-pack-flag.mjs off\n' +
      '  O instalador TI NÃO pode incluir este ficheiro.',
  );
  process.exit(1);
}

console.info('[ensure-ti-win-build] OK — sem loja-pack.flag (modo TI).');
