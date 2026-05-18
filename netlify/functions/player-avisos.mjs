/**
 * GET: mensagens de aviso para um par cliente + PDV (público, fail-open).
 * Query: ?cliente_id=&pdv_id=
 */

import { loadAvisosDocumento } from './_avisosOperadorStore.mjs';

const HEADERS_JSON = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'private, no-store',
};

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

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { ...HEADERS_JSON, 'Access-Control-Allow-Methods': 'GET, OPTIONS' } };
  }
  if (event.httpMethod !== 'GET') {
    return json(405, { mensagens: [] });
  }

  const qs = event.queryStringParameters || {};
  const c = normalizarId(qs.cliente_id);
  const p = normalizarId(qs.pdv_id);
  if (c == null || p == null) {
    return json(200, { mensagens: [] });
  }

  try {
    const { rows } = await loadAvisosDocumento(event);
    const mensagens = [];
    for (const r of rows) {
      if (!r || typeof r !== 'object') continue;
      const rc = normalizarId(/** @type {Record<string, unknown>} */ (r).cliente_id);
      const rp = normalizarId(/** @type {Record<string, unknown>} */ (r).pdv_id);
      if (rc !== c || rp !== p) continue;
      const mOrig = /** @type {Record<string, unknown>} - (r) */ (r).mensagem;
      const m = typeof mOrig === 'string' ? mOrig.trim() : '';
      if (m.length > 0) mensagens.push(m);
    }
    return json(200, { mensagens });
  } catch {
    return json(200, { mensagens: [] });
  }
};
