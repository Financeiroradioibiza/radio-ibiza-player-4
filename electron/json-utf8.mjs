/**
 * JSON em ficheiros UTF-8 sem BOM.
 * PowerShell 5.x `Set-Content -Encoding UTF8` grava BOM — quebra `JSON.parse` no Node/Electron.
 */

/** @param {string} raw */
export function stripUtf8Bom(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return raw;
  if (raw.charCodeAt(0) === 0xfeff) return raw.slice(1);
  // UTF-8 BOM (EF BB BF) por vezes aparece como 3 code units em vez de U+FEFF
  if (raw.length >= 3 && raw.charCodeAt(0) === 0xef && raw.charCodeAt(1) === 0xbb && raw.charCodeAt(2) === 0xbf) {
    return raw.slice(3);
  }
  return raw;
}

/** @param {string} raw */
export function needsBomRepair(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return false;
  if (raw.charCodeAt(0) === 0xfeff) return true;
  if (raw.length >= 3 && raw.charCodeAt(0) === 0xef && raw.charCodeAt(1) === 0xbb && raw.charCodeAt(2) === 0xbf) {
    return true;
  }
  return false;
}

/** @param {string} raw */
export function parseJsonUtf8(raw) {
  return JSON.parse(stripUtf8Bom(raw));
}
