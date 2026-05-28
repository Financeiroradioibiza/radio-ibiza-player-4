/**
 * Media Session + Screen Wake Lock — melhora reprodução em segundo plano no Android/TWA.
 *
 * - Media Session: o SO trata o PWA como player (controles na tela de bloqueio).
 * - Wake Lock: reduz suspensão agressiva da WebView enquanto toca (readquire ao voltar).
 */

import type { MusicaCompleta } from '@/types/webservice';

export type ModoReproducaoUi = 'ambient' | 'vinheta_vp' | 'vinheta_va';

export interface BackgroundPlaybackHandlers {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

let handlers: BackgroundPlaybackHandlers | null = null;
let shouldHoldWakeLock = false;
let wakeLockSentinel: WakeLockSentinel | null = null;
let mediaHandlersRegistered = false;
let visibilityListenerAttached = false;

function supportsMediaSession(): boolean {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator;
}

function supportsWakeLock(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

function appIconArtwork(): MediaImage[] {
  if (typeof window === 'undefined') return [];
  const origin = window.location.origin;
  return [
    { src: `${origin}/icon-192.png`, sizes: '192x192', type: 'image/png' },
    { src: `${origin}/icon-512.png`, sizes: '512x512', type: 'image/png' },
  ];
}

function albumLabel(modo: ModoReproducaoUi): string {
  if (modo === 'vinheta_vp') return 'Vinheta programada';
  if (modo === 'vinheta_va') return 'Vinheta agendada';
  return 'Radio Ibiza';
}

function ensureVisibilityListener(): void {
  if (visibilityListenerAttached || typeof document === 'undefined') return;
  visibilityListenerAttached = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && shouldHoldWakeLock) {
      void acquireScreenWakeLock();
    }
  });
}

function registerMediaSessionActionHandlers(): void {
  if (!supportsMediaSession() || mediaHandlersRegistered) return;
  const ms = navigator.mediaSession;
  mediaHandlersRegistered = true;

  ms.setActionHandler('play', () => {
    handlers?.onPlay();
  });
  ms.setActionHandler('pause', () => {
    handlers?.onPause();
  });
  ms.setActionHandler('nexttrack', () => {
    handlers?.onNext();
  });
  ms.setActionHandler('previoustrack', () => {
    handlers?.onPrevious();
  });
}

function clearMediaSessionActionHandlers(): void {
  if (!supportsMediaSession() || !mediaHandlersRegistered) return;
  const ms = navigator.mediaSession;
  for (const action of ['play', 'pause', 'nexttrack', 'previoustrack'] as const) {
    try {
      ms.setActionHandler(action, null);
    } catch {
      //
    }
  }
  mediaHandlersRegistered = false;
}

async function acquireScreenWakeLock(): Promise<void> {
  if (!supportsWakeLock() || !shouldHoldWakeLock) return;
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

  try {
    if (wakeLockSentinel && !wakeLockSentinel.released) return;
    wakeLockSentinel = await navigator.wakeLock.request('screen');
    wakeLockSentinel.addEventListener('release', () => {
      wakeLockSentinel = null;
      if (shouldHoldWakeLock && document.visibilityState === 'visible') {
        void acquireScreenWakeLock();
      }
    });
  } catch {
    wakeLockSentinel = null;
  }
}

function releaseScreenWakeLock(): void {
  shouldHoldWakeLock = false;
  if (wakeLockSentinel && !wakeLockSentinel.released) {
    void wakeLockSentinel.release().catch(() => {});
  }
  wakeLockSentinel = null;
}

function updateMediaSessionMetadata(
  faixa: MusicaCompleta | null,
  modo: ModoReproducaoUi,
): void {
  if (!supportsMediaSession()) return;
  const ms = navigator.mediaSession;

  if (!faixa) {
    ms.metadata = null;
    return;
  }

  const titulo = String(faixa.musica.titulo ?? '').trim() || 'Radio Ibiza';
  const artista = String(faixa.artista?.nome ?? '').trim() || 'Radio Ibiza';

  ms.metadata = new MediaMetadata({
    title: titulo,
    artist: artista,
    album: albumLabel(modo),
    artwork: appIconArtwork(),
  });
}

function updateMediaSessionPlaybackState(playing: boolean): void {
  if (!supportsMediaSession()) return;
  navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
}

/** Regista callbacks para botões do sistema (tela de bloqueio / auriculares). */
export function setBackgroundPlaybackHandlers(next: BackgroundPlaybackHandlers | null): void {
  handlers = next;
  if (next) {
    registerMediaSessionActionHandlers();
    ensureVisibilityListener();
  } else {
    clearMediaSessionActionHandlers();
  }
}

/** Sincroniza metadados, estado e Wake Lock com o transporte actual. */
export function syncBackgroundPlaybackState(opts: {
  playing: boolean;
  faixa: MusicaCompleta | null;
  modo: ModoReproducaoUi;
}): void {
  const { playing, faixa, modo } = opts;

  updateMediaSessionMetadata(faixa, modo);
  updateMediaSessionPlaybackState(playing);

  shouldHoldWakeLock = playing;
  if (playing) {
    ensureVisibilityListener();
    void acquireScreenWakeLock();
  } else {
    releaseScreenWakeLock();
  }
}

/** Logout / desmontagem do player. */
export function releaseBackgroundPlayback(): void {
  handlers = null;
  releaseScreenWakeLock();
  clearMediaSessionActionHandlers();
  if (supportsMediaSession()) {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
  }
}
