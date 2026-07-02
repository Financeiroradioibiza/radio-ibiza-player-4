/**
 * Gera metadados de versão do instalador TI (NSIS + ficheiro na pasta instalada).
 * Fonte única: PROGRAMDATA_BUILD_ID em electron/programdata-constants.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const buildDir = path.join(root, 'build');

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const constantsSrc = fs.readFileSync(
  path.join(root, 'electron', 'programdata-constants.mjs'),
  'utf8',
);
const m = constantsSrc.match(
  /export const PROGRAMDATA_BUILD_ID = '([^']+)'/,
);
if (!m?.[1]) {
  console.error('[generate-installer-version] PROGRAMDATA_BUILD_ID não encontrado.');
  process.exit(1);
}

const buildId = m[1];
const shortTag = buildId.includes('programdata-')
  ? buildId.slice(buildId.indexOf('programdata-'))
  : buildId;
const appVersion = pkg.version ?? '0.0.0';

const txt = [
  'Radio Ibiza Player — instalador Windows (modo TI multiusuário)',
  '============================================================',
  '',
  `Versão do app: ${appVersion}`,
  `Build instalador (ProgramData): ${buildId}`,
  `Etiqueta curta: ${shortTag}`,
  '',
  'Após instalar, confirme também:',
  '  C:\\ProgramData\\RadioIbizaPlayer\\build-stamp.txt',
  '  C:\\ProgramData\\RadioIbizaPlayer\\versao-instalador.txt (cópia desta pasta)',
  '',
  `Gerado em: ${new Date().toISOString()}`,
  '',
].join('\n');

const nsh = [
  '; Gerado por scripts/generate-installer-version.mjs — não editar à mão.',
  `!define RADIO_IBIZA_BUILD_ID "${buildId}"`,
  `!define RADIO_IBIZA_BUILD_SHORT "${shortTag}"`,
  `!define RADIO_IBIZA_APP_VERSION "${appVersion}"`,
  '',
].join('\n');

fs.mkdirSync(buildDir, { recursive: true });
fs.writeFileSync(path.join(buildDir, 'installer-version.nsh'), nsh, 'utf8');
fs.writeFileSync(path.join(buildDir, 'installer-version.txt'), txt, 'utf8');
fs.writeFileSync(
  path.join(buildDir, 'installer-version.meta.json'),
  JSON.stringify({ appVersion, buildId, shortTag }, null, 2) + '\n',
  'utf8',
);

/** Mantém PS1 do instalador alinhado ao build_id do .exe */
const ps1Path = path.join(buildDir, 'setup-programdata-acl.ps1');
let ps1 = fs.readFileSync(ps1Path, 'utf8');
ps1 = ps1.replace(/\$buildId = '[^']*'/, `$buildId = '${buildId}'`);
fs.writeFileSync(ps1Path, ps1, 'utf8');

console.info(
  `[generate-installer-version] app=${appVersion} build=${buildId} (${shortTag})`,
);
