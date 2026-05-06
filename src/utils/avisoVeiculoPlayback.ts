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

/** Toca o mesmo Blob duas vezes em sequência (ex.: aviso de veículo). */
export async function playMp3BlobTwice(
  blob: Blob,
  registerActive: (audio: HTMLAudioElement | null) => void,
): Promise<void> {
  await playMp3BlobOnce(blob, registerActive);
  await playMp3BlobOnce(blob, registerActive);
}
