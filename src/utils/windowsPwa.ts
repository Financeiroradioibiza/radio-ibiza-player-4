/** Utilitários PWA no Windows (atalho, inicialização automática) — não usado no modo TI (.exe). */

import { shouldUseIbizaPwaTouchShellLayout } from '@/api/config';

export function isWindowsDesktop(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Windows/i.test(navigator.userAgent ?? '');
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if (window.matchMedia('(display-mode: window-controls-overlay)').matches) return true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window.navigator as any).standalone === true) return true;
  return false;
}

export function isElectronShell(): boolean {
  return typeof window !== 'undefined' && window.electronAPI != null;
}

function isMobileOsUserAgent(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent ?? '');
}

/**
 * Menu engrenagem: só PWA instalado no **PC Windows** (shell desktop).
 * Nunca mobile (`/m`, touch shell, telemóvel/tablet).
 */
export function shouldShowPlayerSettingsMenu(): boolean {
  if (!isWindowsDesktop() || !isStandalonePwa() || isElectronShell()) return false;
  if (shouldUseIbizaPwaTouchShellLayout() || isMobileOsUserAgent()) return false;
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/m')) return false;
  return true;
}

/** Abre Configurações → Inicialização de apps (Win 10/11). */
export function abrirConfiguracaoInicializacaoWindows(): void {
  const url = 'ms-settings:appsstartup';
  try {
    window.location.href = url;
  } catch {
    try {
      window.open(url, '_blank');
    } catch {
      //
    }
  }
}
