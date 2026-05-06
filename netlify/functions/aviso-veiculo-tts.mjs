/**
 * Netlify Function: TTS para aviso de veículo (Azure Speech ou ElevenLabs).
 *
 * Variáveis no painel Netlify (Site → Environment):
 * - Padrão: se AZURE_SPEECH_KEY + AZURE_SPEECH_REGION existirem → Azure (produção «atrelada» ao Azure).
 *   Se Azure não estiver completo mas ElevenLabs sim → ElevenLabs.
 * - TTS_PROVIDER: `azure` | `elevenlabs` — força um motor (útil se tiveres as duas chaves e quiseres só uma).
 *
 * Azure Speech:
 * - AZURE_SPEECH_KEY
 * - AZURE_SPEECH_REGION (ex.: brazilsouth — tem de bater com a região do recurso no portal)
 * - AZURE_TTS_VOICE (opcional, padrão pt-BR-FranciscaNeural)
 *
 * ElevenLabs (fallback opcional):
 * - ELEVENLABS_API_KEY
 * - ELEVENLABS_VOICE_ID
 * - ELEVENLABS_MODEL_ID (opcional, padrão eleven_multilingual_v2)
 */

const LIMITS = { marca: 48, modelo: 72, placa: 16, cor: 40 };

/** Pausas no SSML (Azure) — milissegundos. */
const B = {
  aposIntro: 880,
  aposMarcaModelo: 780,
  aposCor: 680,
  aposPalavraPlaca: 580,
  /** Entre cada caractere da placa */
  soletrar: 500,
  antesFecho: 720,
};

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

function normalizedPlaca(p) {
  return String(p ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

/** Corpo sanitizado ou { ok: false, error }. */
function parseAviso(body) {
  const marca = sanitizeField(body.marca, LIMITS.marca);
  const modelo = sanitizeField(body.modelo, LIMITS.modelo);
  const placaRaw = sanitizeField(body.placa, LIMITS.placa);
  const cor = sanitizeField(body.cor, LIMITS.cor);
  if (!marca || !modelo || !placaRaw || !cor) {
    return { ok: false, error: 'Preencha marca, modelo, placa e cor do veículo.' };
  }
  const placa = normalizedPlaca(placaRaw);
  if (!placa.length) {
    return { ok: false, error: 'Placa inválida.' };
  }
  return { ok: true, marca, modelo, placa, cor };
}

/** Texto plano com pausas “por escrito” (ElevenLabs / motores sem SSML). */
function buildElevenLabsPlain(marca, modelo, placa, cor) {
  const chars = [...placa];
  const soletrado = chars.join(' .... ');
  return [
    'Atenção, proprietário do veículo.',
    '',
    '... ...',
    '',
    `${marca}, ${modelo}.`,
    '',
    '... ...',
    '',
    `Cor, ${cor}.`,
    '',
    '... ...',
    '',
    soletrado + '.',
    '',
    '... ...',
    '',
    'Favor compareça ao seu veículo.',
  ].join('\n');
}

/**
 * SSML com breaks + voz mais alta e ritmo um pouco mais calmo (Azure).
 * @see https://learn.microsoft.com/azure/ai-services/speech-service/speech-synthesis-markup
 */
function buildAzureSsml(voiceName, marca, modelo, placa, cor) {
  const spellSsml = [...placa].map((c) => `${escapeXml(c)}<break time="${B.soletrar}ms"/>`).join('');

  const inner = `
      Atenção, proprietário do veículo.<break time="${B.aposIntro}ms"/>
      ${escapeXml(marca)}, ${escapeXml(modelo)}.<break time="${B.aposMarcaModelo}ms"/>
      Cor, ${escapeXml(cor)}.<break time="${B.aposCor}ms"/>
      Placa.<break time="${B.aposPalavraPlaca}ms"/>
      ${spellSsml}
      <break time="${B.antesFecho}ms"/>
      Favor compareça ao seu veículo.`
    .replace(/\s+/g, ' ')
    .trim();

  return `<?xml version="1.0" encoding="UTF-8"?>
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="pt-BR">
  <voice name="${escapeXml(voiceName)}">
    <prosody volume="x-loud" rate="90%">
      ${inner}
    </prosody>
  </voice>
</speak>`;
}

async function ttsAzure(ssmlDoc, key, region) {
  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml; charset=utf-8',
      'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
      'User-Agent': 'RadioIbizaPlayer-NetlifyFn/4',
    },
    body: ssmlDoc,
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

  const aviso = parseAviso(body);
  if (!aviso.ok) {
    return json(400, { mensagem: aviso.error });
  }

  const { marca, modelo, placa, cor } = aviso;

  const explicit = (process.env.TTS_PROVIDER || '').trim().toLowerCase();
  const hasAzure =
    Boolean(process.env.AZURE_SPEECH_KEY?.trim()) &&
    Boolean(process.env.AZURE_SPEECH_REGION?.trim());
  const hasElevenLabs =
    Boolean(process.env.ELEVENLABS_API_KEY?.trim()) &&
    Boolean(process.env.ELEVENLABS_VOICE_ID?.trim());
  const provider =
    explicit === 'azure' || explicit === 'elevenlabs'
      ? explicit
      : hasAzure
        ? 'azure'
        : hasElevenLabs
          ? 'elevenlabs'
          : 'azure';

  try {
    let buffer;
    if (provider === 'elevenlabs') {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      const voiceId = process.env.ELEVENLABS_VOICE_ID;
      if (!apiKey || !voiceId) {
        return json(500, { mensagem: 'Serviço de voz não configurado (ElevenLabs).' });
      }
      buffer = await ttsElevenLabs(
        buildElevenLabsPlain(marca, modelo, placa, cor),
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
      const ssml = buildAzureSsml(voice, marca, modelo, placa, cor);
      buffer = await ttsAzure(ssml, key, region.trim());
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
