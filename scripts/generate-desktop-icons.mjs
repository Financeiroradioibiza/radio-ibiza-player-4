/**
 * Gera ícones para o build desktop a partir de `public/icon.svg`.
 *
 * Saídas em `build/`:
 *   - `icon.ico` (Windows): multi-resolução (16, 24, 32, 48, 64, 128, 256).
 *   - `icon.png` (Linux): 512×512, usado também como fallback maskable.
 *
 * Ícone `.icns` (Mac) será adicionado quando ativarmos build Mac.
 *
 * Rode após alterar o SVG: `npm run generate-icons:desktop`.
 */

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const root = dirname(fileURLToPath(import.meta.url));
const publicDir = join(root, '..', 'public');
const buildDir = join(root, '..', 'build');

mkdirSync(buildDir, { recursive: true });

const svgBuf = readFileSync(join(publicDir, 'icon.svg'));

// Tamanhos requisitados pelo .ico do Windows (a Microsoft recomenda esses 7).
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

const pngBuffers = await Promise.all(
  ICO_SIZES.map((size) =>
    sharp(svgBuf).resize(size, size).png({ compressionLevel: 9 }).toBuffer(),
  ),
);

const icoBuf = await pngToIco(pngBuffers);
writeFileSync(join(buildDir, 'icon.ico'), icoBuf);
console.log(`Wrote build/icon.ico (${ICO_SIZES.join(', ')} px)`);

// Linux usa um PNG plano — útil ainda que não empacotemos Linux por enquanto.
await sharp(svgBuf)
  .resize(512, 512)
  .png({ compressionLevel: 9 })
  .toFile(join(buildDir, 'icon.png'));
console.log('Wrote build/icon.png (512 px)');
