/**
 * JSON em ficheiros UTF-8 sem BOM.
 * PowerShell 5.x `Set-Content -Encoding UTF8` grava BOM — quebra `JSON.parse` no Node/Electron.
 */

/** @param {string} raw */
export function stripUtf8Bom(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return raw;
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
}

/** @param {string} raw */
export function parseJsonUtf8(raw) {
  return JSON.parse(stripUtf8Bom(raw));
}

/** @param {string} raw */
export function hadUtf8Bom(raw) {
  return typeof raw === 'string' && raw.length > 0 && raw.charCodeAt(0) === 0xfeff;
}
