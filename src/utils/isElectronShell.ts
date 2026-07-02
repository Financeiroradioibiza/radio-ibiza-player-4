/** Renderer dentro da casca Electron (`.exe`), mesmo antes do preload expor IPC. */
export function isElectronShell(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /\bElectron\b/i.test(navigator.userAgent);
}
