export interface AudioEngineCallbacks {
  onEnded?: () => void;
  onError?: (e: Event) => void;
}

export interface PlaybackStats {
  currentTime: number;
  /** Pode ser 0 se o browser ainda não expôs metadados. */
  duration: number;
  remaining: number;
}

export interface AudioEngine {
  play(url: string): Promise<void>;
  /** Entra com a próxima URL fazendo overlap + fade linear (uso em mixagem tipo AS3). */
  crossfadeTo(url: string, fadeSec: number): Promise<void>;
  /** Posição só do elemento “de saída” (útil pra decidir início da mixagem). */
  getPlaybackStats(): PlaybackStats | null;
  pause(): void;
  resume(): Promise<void>;
  setVolume(v: number): void;
  destroy(): void;
}

export function createAudioEngine(callbacks: AudioEngineCallbacks = {}): AudioEngine {
  const audioA = new Audio();
  const audioB = new Audio();
  audioA.preload = audioB.preload = 'auto';

  /** Qual elemento está em reprodução “principal” (UI + `ended`). */
  let outEl: HTMLAudioElement = audioA;
  /** Buffer para overlap / crossfade. */
  let inEl: HTMLAudioElement = audioB;

  let destroyed = false;
  let playGeneration = 0;
  /** Enquanto `true`, `ended` da saída antiga não dispara ciclo (evita avanço duplo na mixagem). */
  let crossfadeActive = false;

  let pipe: Promise<void> = Promise.resolve();

  const enqueue = (step: () => Promise<void>): Promise<void> => {
    pipe = pipe.then(step, step).catch(() => {});
    return pipe;
  };

  const handleEnded = (ev: Event) => {
    if (destroyed || crossfadeActive) return;
    if (ev.target !== outEl) return;
    callbacks.onEnded?.();
  };

  const handleError = (e: Event) => {
    if (!destroyed) callbacks.onError?.(e);
  };

  outEl.addEventListener('ended', handleEnded);
  inEl.addEventListener('ended', handleEnded);
  outEl.addEventListener('error', handleError);
  inEl.addEventListener('error', handleError);

  return {
    getPlaybackStats(): PlaybackStats | null {
      if (destroyed || !String(outEl.src || '').trim()) return null;
      const t = outEl.currentTime;
      const d = outEl.duration;
      const durOk = Number.isFinite(d) && d > 0 && d !== Number.POSITIVE_INFINITY;
      const duration = durOk ? d : 0;
      const remaining = durOk ? Math.max(0, d - t) : 0;
      return { currentTime: t, duration, remaining };
    },

    async play(url: string) {
      await enqueue(async () => {
        crossfadeActive = false;
        if (destroyed) return;

        const mine = ++playGeneration;

        inEl.pause();
        inEl.removeAttribute('src');
        try {
          inEl.load();
        } catch {
          //
        }
        inEl.volume = 0;

        outEl.pause();
        outEl.removeAttribute('src');
        try {
          outEl.load();
        } catch {
          //
        }

        outEl.volume = 1;
        outEl.src = url;
        try {
          outEl.currentTime = 0;
        } catch {
          //
        }

        if (destroyed || mine !== playGeneration) return;

        try {
          await outEl.play();
        } catch (e) {
          if (!destroyed && mine === playGeneration) throw e;
          return;
        }

        if (destroyed || mine !== playGeneration) {
          outEl.pause();
        }
      });
    },

    async crossfadeTo(url: string, fadeSec: number) {
      await enqueue(async () => {
        if (destroyed) return;

        const mine = ++playGeneration;
        crossfadeActive = true;

        try {
          inEl.pause();
          inEl.removeAttribute('src');
          try {
            inEl.load();
          } catch {
            //
          }
          inEl.volume = 0;
          inEl.src = url;
          try {
            inEl.currentTime = 0;
          } catch {
            //
          }

          if (destroyed || mine !== playGeneration) return;

          await inEl.play();
          if (destroyed || mine !== playGeneration) return;

          const steps = Math.max(16, Math.ceil(fadeSec * 20));
          const stepMs = (fadeSec * 1000) / steps;
          for (let i = 1; i <= steps; i++) {
            if (destroyed || mine !== playGeneration) break;
            const p = i / steps;
            outEl.volume = Math.max(0, 1 - p);
            inEl.volume = Math.min(1, p);
            await new Promise<void>((resolve) => {
              window.setTimeout(resolve, stepMs);
            });
          }

          if (destroyed || mine !== playGeneration) {
            inEl.pause();
            inEl.removeAttribute('src');
            try {
              inEl.load();
            } catch {
              //
            }
            return;
          }

          outEl.pause();
          outEl.removeAttribute('src');
          try {
            outEl.load();
          } catch {
            //
          }

          ;[outEl, inEl] = [inEl, outEl];
          outEl.volume = 1;
          inEl.volume = 0;
        } finally {
          crossfadeActive = false;
        }
      });
    },

    pause() {
      if (destroyed) return;
      outEl.pause();
      inEl.pause();
    },

    async resume() {
      await enqueue(async () => {
        if (destroyed) return;
        crossfadeActive = false;
        if (!String(outEl.src || '').trim()) return;
        if (!outEl.paused) return;
        try {
          await outEl.play();
        } catch {
          //
        }
      });
    },

    setVolume(v: number) {
      if (destroyed) return;
      const vv = Math.min(1, Math.max(0, v));
      outEl.volume = vv;
    },

    destroy() {
      destroyed = true;
      playGeneration += 1;
      crossfadeActive = false;
      outEl.removeEventListener('ended', handleEnded);
      inEl.removeEventListener('ended', handleEnded);
      outEl.removeEventListener('error', handleError);
      inEl.removeEventListener('error', handleError);
      outEl.pause();
      inEl.pause();
      outEl.removeAttribute('src');
      inEl.removeAttribute('src');
      try {
        outEl.load();
      } catch {
        //
      }
      try {
        inEl.load();
      } catch {
        //
      }
      pipe = Promise.resolve();
    },
  };
}
