/**
 * Reprodução local de MP3 em Blob (avisos gerados por TTS).
 * Cada playback usa seu próprio object URL, revogado ao terminar.
 */

export function playMp3BlobOnce(
  blob: Blob,
  registerActive: (audio: HTMLAudioElement | null) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = 1;
    registerActive(audio);

    const finish = () => {
      audio.onended = null;
      audio.onerror = null;
      registerActive(null);
      try {
        URL.revokeObjectURL(url);
      } catch {
        //
      }
    };

    audio.onended = () => {
      finish();
      resolve();
    };
    audio.onerror = () => {
      finish();
      reject(new Error('Erro ao reproduzir o áudio.'));
    };
    void audio.play().catch((e) => {
      finish();
      reject(e instanceof Error ? e : new Error('Reprodução bloqueada pelo navegador.'));
    });
  });
}

/** Toca o mesmo Blob várias vezes em sequência (ex.: aviso de veículo). */
export async function playMp3BlobRepeated(
  blob: Blob,
  registerActive: (audio: HTMLAudioElement | null) => void,
  times: number,
): Promise<void> {
  const n = Math.max(1, Math.floor(times));
  for (let i = 0; i < n; i += 1) {
    await playMp3BlobOnce(blob, registerActive);
  }
}

export type MusicaFundoOpcional = {
  /** URL absoluta da faixa (ex.: `url_musica` da programação). */
  url: string;
  /** Volume da música de fundo (0–1). A voz permanece em volume cheio. */
  volume: number;
};

/**
 * Igual a `playMp3BlobRepeated`, mas com música de fundo em loop (opcional) durante todas as repetições.
 * A música fica mais baixa para não competir com a locução.
 */
export async function playMp3BlobRepeatedComFundo(
  blob: Blob,
  registerSpeech: (audio: HTMLAudioElement | null) => void,
  times: number,
  fundo: MusicaFundoOpcional | null,
): Promise<void> {
  let bed: HTMLAudioElement | null = null;

  const pararFundo = () => {
    if (!bed) return;
    bed.pause();
    bed.removeAttribute('src');
    bed.onerror = null;
    bed = null;
  };

  try {
    if (fundo?.url) {
      bed = new Audio(fundo.url);
      bed.loop = true;
      bed.volume = Math.max(0, Math.min(1, fundo.volume));
      try {
        await bed.play();
      } catch {
        // Sem gesto ou URL indisponível — continua só com a voz.
        pararFundo();
      }
    }

    const n = Math.max(1, Math.floor(times));
    for (let i = 0; i < n; i += 1) {
      await playMp3BlobOnce(blob, registerSpeech);
    }
  } finally {
    pararFundo();
  }
}
