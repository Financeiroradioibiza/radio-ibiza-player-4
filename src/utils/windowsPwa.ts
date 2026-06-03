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

/** PWA Chrome instalado — costuma não aparecer na lista «Inicialização» do Windows. */
export function isChromeStandalonePwa(): boolean {
  if (!isStandalonePwa() || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent ?? '';
  return /Chrome/i.test(ua) && !/Edg/i.test(ua);
}

/** Abre Configurações → Apps → Inicialização (Win 10 e 11). */
export function abrirConfiguracaoInicializacaoWindows(): void {
  // `appsstartup` só Win 11; no Win 10 cai na home genérica de Configurações.
  const url = 'ms-settings:startupapps';
  try {
    const link = document.createElement('a');
    link.href = url;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch {
    try {
      window.location.href = url;
    } catch {
      //
    }
  }
}

/** Copia o atalho PWA para a pasta Inicializar (Chrome — não lista o app em ms-settings). */
export function baixarAtivadorInicializacaoWindows(): void {
  const link = document.createElement('a');
  link.href = '/install/iniciar-com-windows.bat';
  link.download = 'Ativar-Radio-com-Windows-Aqui.bat';
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Chrome PWA: activador .bat (1 clique no ficheiro baixado).
 * Edge / outros: lista nativa do Windows.
 */
export function iniciarComWindows(): 'bat' | 'settings' {
  if (isChromeStandalonePwa()) {
    baixarAtivadorInicializacaoWindows();
    return 'bat';
  }
  abrirConfiguracaoInicializacaoWindows();
  return 'settings';
}
