/**
 * afterPack — aplica `build/icon.ico` no .exe Windows sem assinatura digital.
 *
 * Com `signAndEditExecutable: false` (evita winCodeSign no build TI local), o
 * electron-builder não chama rcedit. Este hook repõe só o ícone da marca.
 */

import { accessSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import rcedit from 'rcedit';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const productFilename = context.packager.appInfo.productFilename;
  const exePath = join(context.appOutDir, `${productFilename}.exe`);
  const iconPath = join(root, 'build', 'icon.ico');

  try {
    accessSync(iconPath);
    accessSync(exePath);
  } catch {
    console.warn('[after-pack-win-icon] icon.ico ou .exe ausente; ícone não aplicado.');
    return;
  }

  const info = context.packager.appInfo;
  await rcedit(exePath, {
    icon: iconPath,
    'version-string': {
      FileDescription: info.productName,
      ProductName: info.productName,
      LegalCopyright: info.copyright,
    },
    'product-version': info.shortVersion ?? info.version,
    'file-version': info.shortVersion ?? info.version,
  });

  console.info(`[after-pack-win-icon] Ícone aplicado: ${exePath}`);
}
