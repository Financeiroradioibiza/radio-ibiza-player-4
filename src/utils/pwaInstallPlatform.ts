/**
 * Heurísticas para texto de instalação PWA em telemóvel/tablet.
 * Chrome no iOS usa motor WebKit — conta como iOS (normalmente sem `beforeinstallprompt`).
 */

export function isIosWeb(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  // iPadOS 13+ pode reportar como Mac com toque
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
  return false;
}

export function isAndroidWeb(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
}

/** Rótulo do link para `/m/instalar.html` (só faz sentido no cliente; SSR usa texto neutro). */
export function getMobileInstallGuideLinkLabel(): string {
  if (typeof window === 'undefined') {
    return 'Guia: instalar no celular ou tablet';
  }
  if (isIosWeb()) {
    return 'Guia: iPhone/iPad — ícone no ecrã inicial ou Biblioteca de apps';
  }
  if (isAndroidWeb()) {
    return 'Guia: Android — ícone na área inicial ou gaveta de apps';
  }
  return 'Guia: instalar no celular ou tablet';
}
