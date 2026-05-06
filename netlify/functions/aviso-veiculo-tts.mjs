/**
 * Netlify Function: TTS para aviso de veículo (Azure Speech ou ElevenLabs).
 *
 * Variáveis no painel Netlify (Site → Environment):
 * - TTS_PROVIDER: `azure` (padrão) | `elevenlabs`
 *
 * Azure (recomendado custo / cota gratuita):
 * - AZURE_SPEECH_KEY
 * - AZURE_SPEECH_REGION (ex.: brazilsouth)
 * - AZURE_TTS_VOICE (opcional, padrão pt-BR-FranciscaNeural)
 *
 * ElevenLabs:
 * - ELEVENLABS_API_KEY
 * - ELEVENLABS_VOICE_ID
 * - ELEVENLABS_MODEL_ID (opcional, padrão eleven_multilingual_v2)
 */

const LIMITS = { marca: 48, modelo: 72, placa: 16, cor: 40 };

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  };
}

function audioOk(buffer) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
    body: buffer.toString('base64'),
    isBase64Encoded: true,
  };
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitizeField(val, max) {
  return String(val ?? '')
    .trim()
    .slice(0, max);
}

function buildSpeech(body) {
  const marca = sanitizeField(body.marca, LIMITS.marca);
  const modelo = sanitizeField(body.modelo, LIMITS.modelo);
  const placa = sanitizeField(body.placa, LIMITS.placa);
  const cor = sanitizeField(body.cor, LIMITS.cor);
  if (!marca || !modelo || !placa || !cor) {
    return { ok: false, error: 'Preencha marca, modelo, placa e cor do veículo.' };
  }
  const text = `Atenção, proprietário do veículo ${marca}, ${modelo}, placa ${placa}, cor ${cor}, favor compareça ao seu veículo.`;
  return { ok: true, text };
}

async function ttsAzure(text, key, region, voiceName) {
  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const ssml = `<?xml version="1.0" encoding="UTF-8"?>
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="pt-BR">
  <voice name="${escapeXml(voiceName)}">${escapeXml(text)}</voice>
</speak>`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml; charset=utf-8',
      'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
      'User-Agent': 'RadioIbizaPlayer-NetlifyFn/4',
    },
    body: ssml,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Azure TTS HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function ttsElevenLabs(text, apiKey, voiceId, modelId) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
      'User-Agent': 'RadioIbizaPlayer-NetlifyFn/4',
    },
    body: JSON.stringify({
      text,
      model_id: modelId || 'eleven_multilingual_v2',
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs TTS HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: {}, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { mensagem: 'Método não permitido.' });
  }

  let body;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : event.body || {};
  } catch {
    return json(400, { mensagem: 'JSON inválido.' });
  }

  const speech = buildSpeech(body);
  if (!speech.ok) {
    return json(400, { mensagem: speech.error });
  }

  const provider = (process.env.TTS_PROVIDER || 'azure').toLowerCase();

  try {
    let buffer;
    if (provider === 'elevenlabs') {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      const voiceId = process.env.ELEVENLABS_VOICE_ID;
      if (!apiKey || !voiceId) {
        return json(500, { mensagem: 'Serviço de voz não configurado (ElevenLabs).' });
      }
      buffer = await ttsElevenLabs(
        speech.text,
        apiKey,
        voiceId,
        process.env.ELEVENLABS_MODEL_ID,
      );
    } else {
      const key = process.env.AZURE_SPEECH_KEY;
      const region = process.env.AZURE_SPEECH_REGION;
      if (!key || !region) {
        return json(500, { mensagem: 'Serviço de voz não configurado (Azure Speech).' });
      }
      const voice = process.env.AZURE_TTS_VOICE?.trim() || 'pt-BR-FranciscaNeural';
      buffer = await ttsAzure(speech.text, key, region.trim(), voice);
    }

    if (!buffer?.length) {
      return json(502, { mensagem: 'Resposta de voz vazia.' });
    }
    return audioOk(buffer);
  } catch (e) {
    console.error('[aviso-veiculo-tts]', e);
    return json(502, { mensagem: 'Falha ao sintetizar voz. Tente novamente.' });
  }
};
