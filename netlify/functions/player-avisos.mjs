/**
 * POST JSON { token, cliente_id, pdv_id, ma?, versao_player? } — mensagens só depois de validar token no `/ping/` (CakePHP).
 * GET público sem token → sempre { mensagens: [] } (evita enumeração).
 */

import { loadAvisosDocumento } from './_avisosOperadorStore.mjs';
import { checarRateLimitPorIp } from './_rateLimitIp.mjs';

const BUCKET = 'player-avisos-read';

const HEADERS_JSON = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'private, no-store',
};

const DEFAULT_WS = 'https://cloud.radioibiza.com.br/services/webservice';

function webserviceBase() {
  return String(process.env.IBIZA_WEBSERVICE_URL || DEFAULT_WS).replace(/\/$/, '');
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: HEADERS_JSON,
    body: JSON.stringify(body),
  };
}

function normalizarId(v) {
  const n = Number.parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** @param {unknown} raw */
function extrairPdvEClienteDoPing(raw) {
  let merged;
  if (Array.isArray(raw)) {
    merged = raw.reduce(
      (acc, item) => (item && typeof item === 'object' ? { ...acc, ...item } : acc),
      {},
    );
  } else if (raw && typeof raw === 'object') {
    merged = raw;
  } else return null;

  if (merged.mensagem === 'token_invalido') return null;

  const pd = merged.pdv;
  if (!pd || typeof pd !== 'object') return null;
  const pdvId = Number(pd.id);
  if (!Number.isFinite(pdvId) || pdvId <= 0) return null;

  let clienteId = null;
  const cl = merged.cliente;
  if (cl && typeof cl === 'object' && cl.id != null) {
    const c = Number(cl.id);
    if (Number.isFinite(c) && c > 0) clienteId = c;
  }
  return { pdvId, clienteId };
}

async function validarTokenParaPdvECliente(token, clienteId, pdvId, ma, versaoPlayer) {
  const t = String(token ?? '').trim();
  if (!t || t.length < 8) return false;

  const maSafe = String(ma ?? 'netlify-player-avisos').trim().slice(0, 64) || 'netlify-player-avisos';
  const vpSafe = String(versaoPlayer ?? '4.0w').trim().slice(0, 32) || '4.0w';

  const q = new URLSearchParams({
    token: t,
    ma: maSafe,
    ip: '0.0.0.0',
    pdv_atualizado: '0',
    versao_player: vpSafe,
  });
  const url = `${webserviceBase()}/ping/?${q.toString()}`;

  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 12_000);
  let res;
  try {
    res = await fetch(url, { signal: ac.signal, redirect: 'manual' });
  } catch {
    clearTimeout(to);
    return false;
  }
  clearTimeout(to);

  if (!res.ok || res.status >= 400) return false;

  let raw;
  try {
    raw = await res.json();
  } catch {
    return false;
  }

  const ids = extrairPdvEClienteDoPing(raw);
  if (!ids) return false;
  if (ids.pdvId !== pdvId) return false;
  if (ids.clienteId != null && ids.clienteId !== clienteId) return false;

  return true;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: { ...HEADERS_JSON, 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' },
    };
  }

  /** GET legacy / curiosos — sem token não há dados (anti-enumeração). */
  if (event.httpMethod === 'GET') {
    return json(200, { mensagens: [] });
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { mensagens: [] });
  }

  const rl = checarRateLimitPorIp(BUCKET, event, {
    janelaCurtaMs: 60_000,
    limiteCurto: 45,
    janelaLongaMs: 60 * 60_000,
    limiteLongo: 400,
    msgCurta: 'Muitas consultas de avisos. Aguarde um minuto.',
    msgLonga: 'Limite de consultas de avisos por hora. Tente mais tarde.',
  });
  if (!rl.ok) {
    return json(rl.statusCode, { mensagens: [] });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(200, { mensagens: [] });
  }

  const token = typeof body.token === 'string' ? body.token : '';
  const c = normalizarId(body.cliente_id);
  const p = normalizarId(body.pdv_id);
  const ma = typeof body.ma === 'string' ? body.ma : undefined;
  const versaoPlayer = typeof body.versao_player === 'string' ? body.versao_player : undefined;
  if (c == null || p == null) {
    return json(200, { mensagens: [] });
  }

  try {
    const ok = await validarTokenParaPdvECliente(token, c, p, ma, versaoPlayer);
    if (!ok) {
      return json(200, { mensagens: [] });
    }

    const { rows } = await loadAvisosDocumento(event);
    const mensagens = [];
    for (const r of rows) {
      if (!r || typeof r !== 'object') continue;
      const rc = normalizarId(/** @type {Record<string, unknown>} */ (r).cliente_id);
      const rp = normalizarId(/** @type {Record<string, unknown>} */ (r).pdv_id);
      if (rc !== c || rp !== p) continue;
      const mOrig = /** @type {Record<string, unknown>} */ (r).mensagem;
      const m = typeof mOrig === 'string' ? mOrig.trim() : '';
      if (m.length > 0) mensagens.push(m);
    }
    return json(200, { mensagens });
  } catch {
    return json(200, { mensagens: [] });
  }
};
