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

export type VinhetaLocucaoOpcoes = {
  /** Traduz o texto do português para inglês no servidor e sintetiza com voz em inglês (Azure Translator + voz EN). */
  falarEmIngles?: boolean;
};

/** Retorna blob MP3; locução livre pausando como o aviso de veículos. */
export async function fetchVinhetaLocucaoMp3(texto: string, opcoes?: VinhetaLocucaoOpcoes): Promise<Blob> {
  const trimmed = texto.trim().slice(0, TEXTO_MAX);
  const res = await fetch(functionsUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: 'vinheta_texto',
      texto: trimmed,
      falar_em_ingles: Boolean(opcoes?.falarEmIngles),
    }),
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

/**
 * Apenas tradução PT→EN via mesma function (sem gerar MP3).
 * Útil para o operador ver o texto que a locutora vai falar em inglês.
 */
export async function fetchVinhetaTraducaoPreviewIngles(texto: string): Promise<string> {
  const trimmed = texto.trim().slice(0, TEXTO_MAX);
  const res = await fetch(functionsUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: 'vinheta_texto',
      texto: trimmed,
      apenas_preview_traducao_ingles: true,
    }),
  });

  if (!res.ok) {
    let msg = 'Não foi possível obter a tradução.';
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

  const j = (await res.json()) as { texto_ingles?: unknown };
  const out =
    typeof j.texto_ingles === 'string' ? j.texto_ingles.trim() : '';
  if (!out) {
    throw new TtsAvisoVeiculoError('Resposta de tradução inválida.', res.status);
  }
  return out;
}

export { TEXTO_MAX as VINHETA_LOCUCAO_TEXTO_MAX };
