/**
 * BMPs para o assistente NSIS (electron-builder): sidebar 164×314 e header 150×57.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const buildDir = join(root, 'build');
const iconPath = join(root, 'public/icon-512.png');

const GOLD = '#d4af37';
const BG = '#08080a';

/**
 * @param {import('sharp').Sharp} pipeline
 * @param {string} outPath
 */
async function writeRgbBmp(pipeline, outPath) {
  const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const ch = info.channels;
  const rowPadded = Math.ceil((w * 3) / 4) * 4;
  const pixels = Buffer.alloc(rowPadded * h);
  for (let y = 0; y < h; y++) {
    const srcRow = h - 1 - y;
    for (let x = 0; x < w; x++) {
      const si = (srcRow * w + x) * ch;
      const r = data[si];
      const g = data[si + 1];
      const b = data[si + 2];
      const di = y * rowPadded + x * 3;
      pixels[di] = b;
      pixels[di + 1] = g;
      pixels[di + 2] = r;
    }
  }
  const hdrSize = 54;
  const imgSize = rowPadded * h;
  const fileSize = hdrSize + imgSize;
  const hdr = Buffer.alloc(hdrSize);
  hdr.write('BM', 0);
  hdr.writeUInt32LE(fileSize, 2);
  hdr.writeUInt32LE(0, 6);
  hdr.writeUInt32LE(hdrSize, 10);
  hdr.writeUInt32LE(40, 14);
  hdr.writeInt32LE(w, 18);
  hdr.writeInt32LE(h, 22);
  hdr.writeUInt16LE(1, 26);
  hdr.writeUInt16LE(24, 28);
  hdr.writeUInt32LE(0, 30);
  hdr.writeUInt32LE(imgSize, 34);
  hdr.writeInt32LE(0, 38);
  hdr.writeInt32LE(0, 42);
  hdr.writeUInt32LE(0, 46);
  hdr.writeUInt32LE(0, 50);
  await writeFile(outPath, Buffer.concat([hdr, pixels]));
}

async function main() {
  await mkdir(buildDir, { recursive: true });

  const sidebarW = 164;
  const sidebarH = 314;
  const sidebarSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${sidebarW}" height="${sidebarH}">
      <rect width="${sidebarW}" height="${sidebarH}" fill="${BG}"/>
      <rect x="0" y="0" width="4" height="${sidebarH}" fill="${GOLD}"/>
    </svg>`,
  );

  const iconMain = await sharp(iconPath).resize(108, 108, { fit: 'contain' }).toBuffer();

  const sidebarPipeline = sharp(sidebarSvg).composite([
    { input: iconMain, left: Math.floor((sidebarW - 108) / 2), top: 64 },
  ]);

  await writeRgbBmp(sidebarPipeline, join(buildDir, 'installerSidebar.bmp'));

  const headerW = 150;
  const headerH = 57;
  const headerSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${headerW}" height="${headerH}">
      <rect width="${headerW}" height="${headerH}" fill="${BG}"/>
      <rect x="0" y="0" width="3" height="${headerH}" fill="${GOLD}"/>
    </svg>`,
  );

  const iconSmall = await sharp(iconPath).resize(44, 44, { fit: 'contain' }).toBuffer();

  const headerPipeline = sharp(headerSvg).composite([
    { input: iconSmall, left: 14, top: Math.floor((headerH - 44) / 2) },
  ]);

  await writeRgbBmp(headerPipeline, join(buildDir, 'installerHeader.bmp'));

  console.info('[nsis-assets] installerSidebar.bmp, installerHeader.bmp → build/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
