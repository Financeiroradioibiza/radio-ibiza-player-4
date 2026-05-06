/**
 * Gera PNGs de instalação PWA a partir de public/icon.svg.
 * Rode após alterar o SVG: `npm run generate-icons`.
 *
 * - 192 / 512: ícones «any»
 * - maskable 512: arte ~78% no centro (zona segura para ícones adaptativos Android)
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
  await sharp(svgBuf)
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(join(publicDir, name));
  console.log(`Wrote ${name}`);
}

/** Mesma cor de fundo do SVG (#09090b) — canvas maior para purpose maskable */
const MASK = 512;
const INNER = Math.round(MASK * 0.78);
const innerPng = await sharp(svgBuf).resize(INNER, INNER).png().toBuffer();

await sharp({
  create: {
    width: MASK,
    height: MASK,
    channels: 4,
    background: { r: 9, g: 9, b: 11, alpha: 1 },
  },
})
  .composite([{ input: innerPng, gravity: 'center' }])
  .png({ compressionLevel: 9 })
  .toFile(join(publicDir, 'icon-512-maskable.png'));

console.log('Wrote icon-512-maskable.png');
