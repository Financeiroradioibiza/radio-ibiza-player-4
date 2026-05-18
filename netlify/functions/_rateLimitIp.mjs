/**
 * Rate limit por IP e por «bucket» (função), para quotas não se misturarem.
 */

/** @type {Map<string, Map<string, number[]>>} */
const BUCKET_HITS = new Map();

function getIpHitsMap(bucket) {
  if (!BUCKET_HITS.has(bucket)) BUCKET_HITS.set(bucket, new Map());
  return BUCKET_HITS.get(bucket);
}

export function getClientIpFromEvent(event) {
  const h = event.headers || {};
  const realIp = (h['x-nf-client-connection-ip'] || h['X-Nf-Client-Connection-Ip'] || '').trim();
  if (realIp) return realIp;
  const xf = (h['x-forwarded-for'] || h['X-Forwarded-For'] || '').split(',')[0]?.trim();
  if (xf) return xf;
  return 'desconhecido';
}

/**
 * @param {string} bucket
 * @param {*} event
 * @param {{
 *   janelaCurtaMs: number;
 *   limiteCurto: number;
 *   janelaLongaMs: number;
 *   limiteLongo: number;
 *   statusCurta?: number;
 *   statusLongo?: number;
 *   msgCurta?: string;
 *   msgLonga?: string;
 * }} opts
 */
export function checarRateLimitPorIp(bucket, event, opts) {
  const ip = getClientIpFromEvent(event);
  const agora = Date.now();
  const IP_HITS = getIpHitsMap(bucket);
  const hits = IP_HITS.get(ip) || [];
  const recentes = hits.filter((t) => agora - t < opts.janelaLongaMs);
  const noCurto = recentes.filter((t) => agora - t < opts.janelaCurtaMs).length;

  if (noCurto >= opts.limiteCurto) {
    return {
      ok: false,
      statusCode: opts.statusCurta ?? 429,
      mensagem: opts.msgCurta ?? 'Muitos pedidos. Aguarde e tente de novo.',
    };
  }
  if (recentes.length >= opts.limiteLongo) {
    return {
      ok: false,
      statusCode: opts.statusLongo ?? 429,
      mensagem: opts.msgLonga ?? 'Limite de pedidos atingido. Tente mais tarde.',
    };
  }

  recentes.push(agora);
  IP_HITS.set(ip, recentes);

  if (IP_HITS.size > 5_000) {
    for (const [k, v] of IP_HITS) {
      if (!v.length || agora - v[v.length - 1] > opts.janelaLongaMs) IP_HITS.delete(k);
    }
  }

  return { ok: true };
}
