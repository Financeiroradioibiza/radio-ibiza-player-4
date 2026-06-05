export interface AudioEngineCallbacks {
  onEnded?: () => void;
  onError?: (e: Event) => void;
  /** Chrome/Android pausou o `<audio>` sem passar pelo nosso `pause()` (economia / background). */
  onUnexpectedPause?: () => void;
}

export interface PlaybackStats {
  currentTime: number;
  /** Pode ser 0 se o browser ainda não expôs metadados. */
  duration: number;
  remaining: number;
}

export interface AudioEngine {
  play(url: string): Promise<void>;
  /** Entra com a próxima URL fazendo overlap + fade. `true` só se a troca terminou; `false` se cancelou ou falhou. */
  crossfadeTo(url: string, fadeSec: number): Promise<boolean>;
  /** Posição só do elemento “de saída” (útil pra decidir início da mixagem). */
  getPlaybackStats(): PlaybackStats | null;
  /** `true` se o elemento de saída está pausado ou sem src. */
  isOutputPaused(): boolean;
  /** Volta o início da faixa atual (elemento principal). */
  seekToStart(): void;
  /** Fade linear até silêncio e pausa (ponte vídeo loja). */
  fadeOut(fadeSec: number): Promise<void>;
  pause(): void;
  resume(): Promise<void>;
  setVolume(v: number): void;
  destroy(): void;
}

export function createAudioEngine(callbacks: AudioEngineCallbacks = {}): AudioEngine {
  const audioA = new Audio();
  const audioB = new Audio();
  audioA.preload = audioB.preload = 'auto';
  audioA.muted = audioB.muted = false;

  /** Qual elemento está em reprodução “principal” (UI + `ended`). */
  let outEl: HTMLAudioElement = audioA;
  /** Buffer para overlap / crossfade. */
  let inEl: HTMLAudioElement = audioB;

  let destroyed = false;
  let playGeneration = 0;
  /** Enquanto `true`, `ended` da saída antiga não dispara ciclo (evita avanço duplo na mixagem). */
  let crossfadeActive = false;
  /** Enquanto `true`, eventos `pause` do browser são intencionais (nosso `pause()` / crossfade). */
  let pauseIntencional = false;

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
    if (destroyed) return;
    // Só o elemento de saída representa a faixa “oficial”; o outro pode estar
    // a carregar o próximo MP3 no crossfade — erro aí não deve derrubar a UI.
    if (e.target !== outEl) return;
    callbacks.onError?.(e);
  };

  const handleUnexpectedPause = (ev: Event) => {
    if (destroyed || pauseIntencional || crossfadeActive) return;
    if (ev.target !== outEl) return;
    if (!String(outEl.src || '').trim()) return;
    callbacks.onUnexpectedPause?.();
  };

  outEl.addEventListener('ended', handleEnded);
  inEl.addEventListener('ended', handleEnded);
  outEl.addEventListener('error', handleError);
  inEl.addEventListener('error', handleError);
  outEl.addEventListener('pause', handleUnexpectedPause);

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

    isOutputPaused(): boolean {
      if (destroyed || !String(outEl.src || '').trim()) return true;
      return outEl.paused;
    },

    seekToStart(): void {
      if (destroyed) return;
      try {
        outEl.currentTime = 0;
      } catch {
        //
      }
    },

    async fadeOut(fadeSec: number): Promise<void> {
      await enqueue(async () => {
        if (destroyed || !String(outEl.src || '').trim()) return;

        pauseIntencional = true;
        const steps = Math.max(8, Math.ceil(Math.max(0.3, fadeSec) * 20));
        const stepMs = (Math.max(0.3, fadeSec) * 1000) / steps;
        const startVol = outEl.volume;

        for (let i = 1; i <= steps; i++) {
          if (destroyed) break;
          const p = i / steps;
          outEl.volume = Math.max(0, startVol * (1 - p));
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, stepMs);
          });
        }

        outEl.pause();
        inEl.pause();
        inEl.volume = 0;

        window.setTimeout(() => {
          pauseIntencional = false;
        }, 80);
      });
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

    async crossfadeTo(url: string, fadeSec: number): Promise<boolean> {
      let crossed = false;
      await enqueue(async () => {
        if (destroyed) return;

        const mine = ++playGeneration;
        crossfadeActive = true;

        const limparIncoming = (): void => {
          inEl.pause();
          inEl.removeAttribute('src');
          try {
            inEl.load();
          } catch {
            //
          }
          inEl.volume = 0;
        };

        const restaurarSaidaSomenteOutgoing = (): void => {
          outEl.volume = 1;
          inEl.volume = 0;
        };

        try {
          limparIncoming();
          inEl.src = url;
          try {
            inEl.currentTime = 0;
          } catch {
            //
          }

          if (destroyed || mine !== playGeneration) {
            limparIncoming();
            return;
          }

          try {
            await inEl.play();
          } catch {
            limparIncoming();
            restaurarSaidaSomenteOutgoing();
            return;
          }

          if (destroyed || mine !== playGeneration) {
            limparIncoming();
            restaurarSaidaSomenteOutgoing();
            return;
          }

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
            limparIncoming();
            restaurarSaidaSomenteOutgoing();
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
          crossed = true;
        } finally {
          crossfadeActive = false;
        }
      });
      return crossed;
    },

    pause() {
      if (destroyed) return;
      pauseIntencional = true;
      outEl.pause();
      inEl.pause();
      window.setTimeout(() => {
        pauseIntencional = false;
      }, 80);
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
      outEl.removeEventListener('pause', handleUnexpectedPause);
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
