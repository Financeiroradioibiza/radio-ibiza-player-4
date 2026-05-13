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
 *
 * Tradução PT→EN — **usa só AZURE_TRANSLATOR_KEY** (recurso «Translator» no Azure).
 *   **Nunca** usar AZURE_SPEECH_KEY aqui — a Azure recusa sempre (401).
 * - AZURE_TRANSLATOR_KEY — obrigatório para inglês no player
 * - AZURE_TRANSLATOR_REGION — região do recurso Tradutor; se omitires, só se tenta sem cabeçalho de região.
 *   Podes repetir AZURE_SPEECH_REGION como último recurso se for a mesma região onde criaste o Tradutor.
 * Voz inglesa (só Azure; ElevenLabs multilingual usa o texto já traduzido):
 * - AZURE_TTS_VOICE_EN (opcional, padrão en-US-JennyNeural)
 * - Recurso Speech **separado** só para inglês (locutora noutra subscrição/chave — opcional):
 *   AZURE_SPEECH_KEY_EN + AZURE_SPEECH_REGION_EN — se definidos *os dois*, só a síntese de
 *   «vinheta por texto» em inglês usa estes valores; PT, aviso de veículo e modo sem inglês ficam nas chaves AZURE_SPEECH_* normais.
 *
 * Pré-visualização só da tradução (JSON, sem TTS) — mesmo body `vinheta_texto` com
 * `apenas_preview_traducao_ingles: true` → resposta `{ texto_ingles: "..." }`.
 */

const LIMITS = { marca: 48, modelo: 72, placa: 16, cor: 40 };

/** Pausas entre blocos falados (SSML); soletrar = entre caracteres da placa. */
const B = {
  aposIntro: 920,
  /** Depois de marca + modelo (sem pausa entre os dois). */
  aposMarcaModelo: 880,
  aposCor: 880,
  /** Depois da palavra «Placa», antes de soletrar */
  aposPalavraPlaca: 750,
  soletrar: 620,
  antesFecho: 920,
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

/**
 * Pronúncias customizadas pedidas pelo operador (locução PT-BR).
 * Chave: marca **normalizada** (minúsculas, sem acentos, espaços simples).
 * Valor: como o painel quer que a locutora pronuncie (texto vai direto ao SSML).
 *
 * Mantém o nome original escrito no painel; substitui só na hora de falar.
 * Para adicionar uma marca nova, basta acrescentar uma linha aqui.
 */
const PRONUNCIAS_MARCA_MODELO_PT_BR = {
  abarth: 'Abárti',
  'aston martin': 'astôn mártin',
  cadillac: 'cadiláque',
  cherry: 'Chérri',
  genesis: 'gênesis',
  infiniti: 'Infíniti',
  triumph: 'traiunf',
  volkswagen: 'Volksvaguen',
};

/** Remove acentos e normaliza espaços/case — só para *comparar* contra a tabela. */
function normalizarParaComparar(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Substitui ocorrências (case+acento-insensível, palavra inteira) das marcas
 * da tabela pela versão fonética. Aceita variações de espaço entre tokens
 * (ex.: «Aston   Martin» → casa igual).
 *
 * Chaves multi-palavra primeiro, para «aston martin» não ser quebrado por
 * eventual entrada futura de «aston» sozinha.
 */
function aplicarPronunciasMarcaModelo(texto) {
  const original = String(texto ?? '');
  if (!original.trim()) return original;

  /** Atalho: se o campo inteiro é exatamente uma marca conhecida, usa a forma da tabela tal e qual. */
  const chaveDireta = normalizarParaComparar(original);
  if (PRONUNCIAS_MARCA_MODELO_PT_BR[chaveDireta]) {
    return PRONUNCIAS_MARCA_MODELO_PT_BR[chaveDireta];
  }

  const chaves = Object.keys(PRONUNCIAS_MARCA_MODELO_PT_BR).sort((a, b) => b.length - a.length);
  let resultado = original;
  for (const chave of chaves) {
    const alvo = PRONUNCIAS_MARCA_MODELO_PT_BR[chave];
    const escaped = chave
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/ /g, '\\s+');
    /** Marcas/modelos costumam ser sequências alfabéticas: \b funciona com ASCII. */
    const re = new RegExp(`\\b${escaped}\\b`, 'gi');
    resultado = resultado.replace(re, alvo);
  }
  return resultado;
}

/**
 * Credenciais Azure Speech para sintetizar «vinheta por texto».
 * Com KEY_EN + REGION_EN preenchidos, só a vinheta em inglês usa o segundo recurso.
 */
function azureSpeechCredenciaisVinheta(ttsEmIngles) {
  const padraoKey = process.env.AZURE_SPEECH_KEY?.trim();
  const padraoRegion = process.env.AZURE_SPEECH_REGION?.trim();

  if (ttsEmIngles) {
    const keyEn = process.env.AZURE_SPEECH_KEY_EN?.trim();
    const regionEn = process.env.AZURE_SPEECH_REGION_EN?.trim();
    if (keyEn && regionEn) {
      return { key: keyEn, region: regionEn };
    }
  }
  return { key: padraoKey ?? '', region: padraoRegion ?? '' };
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

/** Locução livre (vinheta por texto no player). */
function parseVinhetaTexto(body) {
  const texto = sanitizeField(body.texto, 560);
  if (!texto.length) {
    return { ok: false, error: 'Digite o texto para a locutora.' };
  }
  const falarEmIngles =
    body.falar_em_ingles === true ||
    body.falar_em_ingles === 1 ||
    String(body.falar_em_ingles || '').toLowerCase() === 'true';
  return { ok: true, texto, falarEmIngles };
}

function buildSimpleAzureSsml(voiceName, texto, xmlLang) {
  const lang = xmlLang || 'pt-BR';
  return `<?xml version="1.0" encoding="UTF-8"?>
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${escapeXml(lang)}">
  <voice name="${escapeXml(voiceName)}">
    <prosody volume="loud">
      ${escapeXml(texto)}
    </prosody>
  </voice>
</speak>`;
}

/**
 * Azure Cognitive Services Translator (text API v3).
 * @see https://learn.microsoft.com/azure/ai-services/translator/
 */
function respostaErroTradutor(trErr) {
  const code = trErr && typeof trErr === 'object' && 'message' in trErr ? String(trErr.message) : '';
  if (code === 'TRADUTOR_NAO_CONFIGURADO') {
    return {
      status: 500,
      mensagem:
        'Tradutor não configurado neste deploy Netlify: a variável AZURE_TRANSLATOR_KEY está **vazia**. No Netlify → Site → Environment variables, adiciona AZURE_TRANSLATOR_KEY (Key 1 do recurso «Translator» no portal Azure — **não** é a mesma da Speech) e AZURE_TRANSLATOR_REGION (ex. eastus). Guarda e faz **Deploys → Trigger deploy**.',
    };
  }
  if (code.includes('401') || code.includes('403') || /Tradutor HTTP (401|403)/.test(code)) {
    return {
      status: 502,
      mensagem:
        'Tradutor Azure recusou autorização (401/403). Confirma AZURE_TRANSLATOR_KEY e que AZURE_TRANSLATOR_REGION é igual à região no portal. Se for recurso «Global», experimenta no Netlify: AZURE_TRANSLATOR_OMITE_REGIAO=1.',
    };
  }
  console.error('[tradutor]', trErr);
  return {
    status: 502,
    mensagem:
      'Não foi possível traduzir para inglês. Revisa recurso Translator no Azure, quotas e logs da function Netlify — ou usa modo português.',
  };
}

/**
 * Azure Translator — só chave do recurso «Translator». Speech key não é usada aqui.
 */
async function traduzirPtParaEn(texto) {
  const key = process.env.AZURE_TRANSLATOR_KEY?.trim();
  if (!key) {
    console.error('[tradutor] AZURE_TRANSLATOR_KEY ausente ou vazio nas Environment variables deploy Netlify.');
    throw new Error('TRADUTOR_NAO_CONFIGURADO');
  }

  const regionTranslator = process.env.AZURE_TRANSLATOR_REGION?.trim();
  const regionSpeech = process.env.AZURE_SPEECH_REGION?.trim();
  const regionPreferida = regionTranslator || regionSpeech || '';

  const omitirRegiao = ['1', 'true', 'yes'].includes(
    String(process.env.AZURE_TRANSLATOR_OMITE_REGIAO || '').trim().toLowerCase(),
  );

  const endpoint =
    'https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=pt&to=en';
  const payload = JSON.stringify([{ Text: texto }]);

  const baseHeaders = {
    'Ocp-Apim-Subscription-Key': key,
    'Content-Type': 'application/json',
    'User-Agent': 'RadioIbizaPlayer-NetlifyFn/4',
  };

  const tentativas = [];
  if (omitirRegiao) {
    tentativas.push({ headers: baseHeaders });
  } else if (regionPreferida) {
    tentativas.push({
      headers: { ...baseHeaders, 'Ocp-Apim-Subscription-Region': regionPreferida },
    });
    tentativas.push({ headers: baseHeaders });
  } else {
    tentativas.push({ headers: baseHeaders });
  }

  let lastStatus = 0;
  let lastText = '';
  for (const { headers } of tentativas) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: payload,
    });
    lastStatus = res.status;
    if (res.ok) {
      const jsonResult = await res.json();
      const out = jsonResult?.[0]?.translations?.[0]?.text;
      if (typeof out !== 'string' || !out.trim()) {
        throw new Error('Tradutor retornou texto vazio.');
      }
      return out.trim();
    }
    lastText = await res.text();
  }

  throw new Error(`Tradutor HTTP ${lastStatus}: ${lastText.slice(0, 400)}`);
}

/** Um bloco por linha + pausas (ElevenLabs). Marca/modelo já passam pela tabela fonética. */
function buildElevenLabsPlain(marca, modelo, placa, cor) {
  const sep = '\n\n......\n\n';
  const soletrado = [...placa].join(' ...... ');
  const marcaFalada = aplicarPronunciasMarcaModelo(marca);
  const modeloFalado = aplicarPronunciasMarcaModelo(modelo);
  return (
    `Atenção, proprietário do veículo.${sep}` +
    `${marcaFalada}, ${modeloFalado}.${sep}` +
    `Cor, ${cor}.${sep}` +
    `Placa.${sep}` +
    `${soletrado}${sep}` +
    `Favor compareça ao seu veículo.`
  );
}

/**
 * Modo bilingue **opcional**: marca + modelo lidos em voz inglesa. Hoje fica desligado
 * por padrão (o operador prefere PT-BR com pronúncia fonética via tabela). Pode-se
 * religar com `AZURE_AVISO_MARCA_MODELO_EM_INGLES=1`.
 *
 * Tudo num único pedido a um único endpoint Azure Speech (mesma região/chave): basta
 * trocar a `<voice>` no SSML — todas as vozes neurais (`*Neural`) estão disponíveis
 * em qualquer região, então a credencial principal (`AZURE_SPEECH_KEY`) já basta.
 */
function buildAzureSsml(voicePt, voiceEnMarcaModelo, marca, modelo, placa, cor) {
  const spellSsml = [...placa].map((c) => `${escapeXml(c)}<break time="${B.soletrar}ms"/>`).join('');

  const blocoPtAbertura =
    `Atenção, proprietário do veículo.<break time="${B.aposIntro}ms"/>`;
  const blocoMarcaModelo = `${escapeXml(marca)}, ${escapeXml(modelo)}.`;
  const blocoPtFecho =
    `<break time="${B.aposMarcaModelo}ms"/>` +
    `Cor, ${escapeXml(cor)}.<break time="${B.aposCor}ms"/>` +
    `Placa.<break time="${B.aposPalavraPlaca}ms"/>` +
    `${spellSsml}<break time="${B.antesFecho}ms"/>` +
    `Favor compareça ao seu veículo.`;

  const ptVoiceTag = escapeXml(voicePt);
  const enVoiceTag = escapeXml(voiceEnMarcaModelo);

  return `<?xml version="1.0" encoding="UTF-8"?>
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="pt-BR">
  <voice name="${ptVoiceTag}"><prosody volume="loud">${blocoPtAbertura}</prosody></voice>
  <voice name="${enVoiceTag}" xml:lang="en-US"><prosody volume="loud">${blocoMarcaModelo}</prosody></voice>
  <voice name="${ptVoiceTag}"><prosody volume="loud">${blocoPtFecho}</prosody></voice>
</speak>`;
}

/**
 * Modo padrão: tudo em PT-BR. Marca e modelo passam por `aplicarPronunciasMarcaModelo`
 * para que palavras como «Volkswagen», «Cadillac», «Aston Martin» soem como o cliente quer
 * (a tabela `PRONUNCIAS_MARCA_MODELO_PT_BR` mapeia entrada do painel → forma falada).
 */
function buildAzureSsmlSomentePt(voicePt, marca, modelo, placa, cor) {
  const marcaFalada = aplicarPronunciasMarcaModelo(marca);
  const modeloFalado = aplicarPronunciasMarcaModelo(modelo);
  const spellSsml = [...placa].map((c) => `${escapeXml(c)}<break time="${B.soletrar}ms"/>`).join('');
  const inner =
    `Atenção, proprietário do veículo.<break time="${B.aposIntro}ms"/>` +
    `${escapeXml(marcaFalada)}, ${escapeXml(modeloFalado)}.<break time="${B.aposMarcaModelo}ms"/>` +
    `Cor, ${escapeXml(cor)}.<break time="${B.aposCor}ms"/>` +
    `Placa.<break time="${B.aposPalavraPlaca}ms"/>` +
    `${spellSsml}<break time="${B.antesFecho}ms"/>` +
    `Favor compareça ao seu veículo.`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="pt-BR">
  <voice name="${escapeXml(voicePt)}">
    <prosody volume="loud">
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

  const isVinhetaTexto = String(body.kind) === 'vinheta_texto';
  const vinheta = isVinhetaTexto ? parseVinhetaTexto(body) : null;
  const aviso = isVinhetaTexto ? null : parseAviso(body);

  if (isVinhetaTexto && vinheta && !vinheta.ok) {
    return json(400, { mensagem: vinheta.error });
  }
  if (!isVinhetaTexto && aviso && !aviso.ok) {
    return json(400, { mensagem: aviso.error });
  }

  /** Só tradução PT→EN para pré-visualização no player (sem áudio; só custo do Translator). */
  const soPreviewTraducao =
    isVinhetaTexto &&
    vinheta?.ok &&
    (body.apenas_preview_traducao_ingles === true ||
      body.apenas_preview_traducao_ingles === 1 ||
      String(body.apenas_preview_traducao_ingles || '').toLowerCase() === 'true');

  if (soPreviewTraducao) {
    try {
      const textoEn = await traduzirPtParaEn(vinheta.texto);
      return json(200, { texto_ingles: textoEn.slice(0, 900) });
    } catch (trErr) {
      const r = respostaErroTradutor(trErr);
      return json(r.status, { mensagem: r.mensagem });
    }
  }

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
    if (isVinhetaTexto && vinheta?.ok) {
      let textoFalar = vinheta.texto;
      let voiceAzure = process.env.AZURE_TTS_VOICE?.trim() || 'pt-BR-FranciscaNeural';
      let xmlLang = 'pt-BR';

      if (vinheta.falarEmIngles) {
        try {
          textoFalar = await traduzirPtParaEn(vinheta.texto);
        } catch (trErr) {
          const r = respostaErroTradutor(trErr);
          return json(r.status, { mensagem: r.mensagem });
        }
        textoFalar = textoFalar.slice(0, 800);
        voiceAzure = process.env.AZURE_TTS_VOICE_EN?.trim() || 'en-US-JennyNeural';
        xmlLang = 'en-US';
      }

      if (provider === 'elevenlabs') {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        const voiceId = process.env.ELEVENLABS_VOICE_ID;
        if (!apiKey || !voiceId) {
          return json(500, { mensagem: 'Serviço de voz não configurado (ElevenLabs).' });
        }
        buffer = await ttsElevenLabs(textoFalar, apiKey, voiceId, process.env.ELEVENLABS_MODEL_ID);
      } else {
        const { key, region } = azureSpeechCredenciaisVinheta(Boolean(vinheta.falarEmIngles));
        if (!key || !region) {
          const faltaCredenciaisEn =
            vinheta.falarEmIngles &&
            Boolean(process.env.AZURE_SPEECH_KEY_EN?.trim()) &&
            !process.env.AZURE_SPEECH_REGION_EN?.trim();
          return json(500, {
            mensagem: faltaCredenciaisEn
              ? 'Defina AZURE_SPEECH_REGION_EN (região do recurso da locutora em inglês — tem de aparecer igual no portal Azure).'
              : 'Serviço de voz não configurado (Azure Speech).',
          });
        }
        const ssml = buildSimpleAzureSsml(voiceAzure, textoFalar, xmlLang);
        buffer = await ttsAzure(ssml, key, region.trim());
      }
    } else if (aviso?.ok) {
      const { marca, modelo, placa, cor } = aviso;
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
        const voicePt = process.env.AZURE_TTS_VOICE?.trim() || 'pt-BR-FranciscaNeural';
        /**
         * Default: tudo em PT-BR (com tabela de pronúncia fonética para marcas estrangeiras).
         * Para reativar o modo bilingue (marca + modelo em inglês), defina no Netlify
         * `AZURE_AVISO_MARCA_MODELO_EM_INGLES=1` (ou `true`).
         */
        const usarIngles = ['1', 'true', 'yes', 'on'].includes(
          String(process.env.AZURE_AVISO_MARCA_MODELO_EM_INGLES ?? '0')
            .trim()
            .toLowerCase(),
        );
        let ssml;
        if (usarIngles) {
          const voiceEn =
            process.env.AZURE_TTS_VOICE_MARCA_MODELO_EN?.trim() ||
            process.env.AZURE_TTS_VOICE_EN?.trim() ||
            'en-US-JennyNeural';
          ssml = buildAzureSsml(voicePt, voiceEn, marca, modelo, placa, cor);
        } else {
          ssml = buildAzureSsmlSomentePt(voicePt, marca, modelo, placa, cor);
        }
        buffer = await ttsAzure(ssml, key, region.trim());
      }
    } else {
      return json(400, { mensagem: 'Pedido inválido.' });
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
