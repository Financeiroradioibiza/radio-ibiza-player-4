/**
 * Geração de áudio para «Aviso veículos» via Netlify Function (chaves ficam no servidor).
 * O motor no Netlify é ElevenLabs se ELEVENLABS_* estiver configurado, ou Azure; veja
 * `netlify/functions/aviso-veiculo-tts.mjs`.
 *
 * Desenvolvimento: use `netlify dev` ou aponte `VITE_TTS_FUNCTIONS_ORIGIN` para um deploy
 * que já tenha a function e as variáveis configuradas.
 */

import type { AvisoVeiculoFields } from '@/utils/avisoVeiculoText';

const PATH = '/.netlify/functions/aviso-veiculo-tts';

function functionsUrl(): string {
  const origin = (import.meta.env.VITE_TTS_FUNCTIONS_ORIGIN as string | undefined)?.replace(/\/$/, '') ?? '';
  return `${origin}${PATH}`;
}

export class TtsAvisoVeiculoError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'TtsAvisoVeiculoError';
  }
}

/** Retorna blob MP3. */
export async function fetchAvisoVeiculoMp3(fields: AvisoVeiculoFields): Promise<Blob> {
  const res = await fetch(functionsUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });

  if (!res.ok) {
    let msg = 'Não foi possível gerar o áudio do aviso.';
    try {
      const j = (await res.json()) as { mensagem?: string };
      if (typeof j.mensagem === 'string' && j.mensagem.trim()) msg = j.mensagem.trim();
    } catch {
      if (res.status === 404) {
        msg =
          'Serviço de voz não encontrado. Em desenvolvimento use «netlify dev» ou defina VITE_TTS_FUNCTIONS_ORIGIN.';
      }
    }
    throw new TtsAvisoVeiculoError(msg, res.status);
  }

  return res.blob();
}
