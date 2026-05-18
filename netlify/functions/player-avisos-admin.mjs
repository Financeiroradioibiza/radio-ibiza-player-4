/**
 * POST JSON: gestão dos avisos (autenticação por env no Netlify).
 *
 * Env (Netlify → Site → Environment variables):
 * - IBIZA_AVISOS_ADMIN_EMAIL
 * - IBIZA_AVISOS_ADMIN_PASSWORD
 */

import { timingSafeEqual } from 'node:crypto';

import { loadAvisosDocumento, saveAvisosRows } from './_avisosOperadorStore.mjs';
import { checarRateLimitPorIp } from './_rateLimitIp.mjs';

const BUCKET_ADMIN = 'player-avisos-admin';

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

function safeEqualStr(a, b) {
  try {
    const ba = Buffer.from(String(a), 'utf8');
    const bb = Buffer.from(String(b), 'utf8');
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function authConfigured() {
  const e = String(process.env.IBIZA_AVISOS_ADMIN_EMAIL ?? '').trim();
  const p = String(process.env.IBIZA_AVISOS_ADMIN_PASSWORD ?? '');
  return e.length > 0 && p.length > 0;
}

function authOk(email, password) {
  const e = String(process.env.IBIZA_AVISOS_ADMIN_EMAIL ?? '').trim();
  const p = String(process.env.IBIZA_AVISOS_ADMIN_PASSWORD ?? '');
  if (!e || !p) return false;
  return safeEqualStr(email.trim(), e) && safeEqualStr(password, p);
}

function normalizarId(v) {
  const n = Number.parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const MAX_MSG = 2000;
const MAX_ROWS = 800;

/** @param {unknown[]} rows */
function sanitizarRows(rows) {
  const out = [];
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const o = /** @type {Record<string, unknown>} */ (r);
    const c = normalizarId(o.cliente_id);
    const p = normalizarId(o.pdv_id);
    if (c == null || p == null) continue;
    const m =
      typeof o.mensagem === 'string' ? o.mensagem.trim().slice(0, MAX_MSG) : '';
    if (!m) continue;
    const t = typeof o.atualizado_em === 'string' ? o.atualizado_em : new Date().toISOString();
    out.push({ cliente_id: c, pdv_id: p, mensagem: m, atualizado_em: t });
  }
  return out.slice(0, MAX_ROWS);
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: { ...HEADERS_JSON, 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
    };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'method_not_allowed' });
  }

  const rl = checarRateLimitPorIp(BUCKET_ADMIN, event, {
    janelaCurtaMs: 60_000,
    limiteCurto: 15,
    janelaLongaMs: 60 * 60_000,
    limiteLongo: 200,
    msgCurta: 'Muitas tentativas neste minuto. Aguarde.',
    msgLonga: 'Limite de pedidos por hora. Tente mais tarde.',
  });
  if (!rl.ok) {
    return json(rl.statusCode, { ok: false, error: 'rate_limited' });
  }

  if (!authConfigured()) {
    return json(503, { ok: false, error: 'admin_not_configured' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { ok: false, error: 'json_invalido' });
  }

  const email = typeof body.email === 'string' ? body.email : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!authOk(email, password)) {
    return json(401, { ok: false, error: 'credenciais' });
  }

  const action = typeof body.action === 'string' ? body.action : '';

  try {
    const { rows: rawRows } = await loadAvisosDocumento(event);
    let rows = sanitizarRows(rawRows);

    if (action === 'listar') {
      const sorted = [...rows].sort((a, b) =>
        String(b.atualizado_em).localeCompare(String(a.atualizado_em)),
      );
      return json(200, { ok: true, rows: sorted });
    }

    const c = normalizarId(body.cliente_id);
    const p = normalizarId(body.pdv_id);
    if (c == null || p == null) {
      return json(400, { ok: false, error: 'cliente_pdv_invalido' });
    }

    if (action === 'ativar') {
      const msg =
        typeof body.mensagem === 'string' ? body.mensagem.trim().slice(0, MAX_MSG) : '';
      if (!msg) {
        return json(400, { ok: false, error: 'mensagem_vazia' });
      }
      rows.push({
        cliente_id: c,
        pdv_id: p,
        mensagem: msg,
        atualizado_em: new Date().toISOString(),
      });
      rows = sanitizarRows(rows);
      await saveAvisosRows(event, rows);
      return json(200, { ok: true, rows });
    }

    if (action === 'apagar') {
      rows = rows.filter((r) => !(Number(r.cliente_id) === c && Number(r.pdv_id) === p));
      await saveAvisosRows(event, rows);
      return json(200, { ok: true, rows });
    }

    return json(400, { ok: false, error: 'acao_desconhecida' });
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    console.error('[player-avisos-admin]', why);
    return json(500, { ok: false, error: 'storage_falhou' });
  }
};
