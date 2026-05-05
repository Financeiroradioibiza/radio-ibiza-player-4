/**
 * Gera PNGs de instalação PWA a partir de public/icon.svg.
 * Rode após alterar o SVG: `npm run generate-icons`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = dirname(fileURLToPath(import.meta.url));
const publicDir = join(root, '..', 'public');
const svgBuf = readFileSync(join(publicDir, 'icon.svg'));

const out = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
];

for (const [name, size] of out) {
  await sharp(svgBuf).resize(size, size).png({ compressionLevel: 9 }).toFile(join(publicDir, name));
  console.log(`Wrote ${name}`);
}
