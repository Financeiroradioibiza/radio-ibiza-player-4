/**
 * TTS para «vinheta por texto» — mesma Netlify Function do aviso veículo, modo `vinheta_texto`.
 */

import { TtsAvisoVeiculoError } from '@/api/ttsAvisoVeiculo';

const PATH = '/.netlify/functions/aviso-veiculo-tts';

function functionsUrl(): string {
  const origin = (import.meta.env.VITE_TTS_FUNCTIONS_ORIGIN as string | undefined)?.replace(/\/$/, '') ?? '';
  return `${origin}${PATH}`;
}

const TEXTO_MAX = 560;

/** Retorna blob MP3; locução livre pausando como o aviso de veículos. */
export async function fetchVinhetaLocucaoMp3(texto: string): Promise<Blob> {
  const trimmed = texto.trim().slice(0, TEXTO_MAX);
  const res = await fetch(functionsUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'vinheta_texto', texto: trimmed }),
  });

  if (!res.ok) {
    let msg = 'Não foi possível gerar a locução.';
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

export { TEXTO_MAX as VINHETA_LOCUCAO_TEXTO_MAX };
