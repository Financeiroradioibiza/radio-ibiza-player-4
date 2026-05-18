/**
 * Persistência dos avisos operador (Netlify Blobs).
 * Requer Blobs ligado no site; se `event.blobs` não vier, `getStore` pode falhar (tratar no handler).
 */

import { connectLambda, getStore } from '@netlify/blobs';

export const AVISOS_BLOB_STORE = 'ibiza-avisos-operador';
export const AVISOS_BLOB_KEY = 'avisos-v1';

/** @param {Record<string, unknown>} event */
export function wireNetlifyBlobsFromEvent(event) {
  if (
    event &&
    typeof event.blobs === 'string' &&
    event.headers &&
    typeof event.headers['x-nf-site-id'] === 'string'
  ) {
    connectLambda(event);
  }
}

/**
 * @param {Record<string, unknown>} event
 * @returns {Promise<{ rows: unknown[] }>}
 */
export async function loadAvisosDocumento(event) {
  wireNetlifyBlobsFromEvent(event);
  const store = getStore(AVISOS_BLOB_STORE);
  const data = await store.get(AVISOS_BLOB_KEY, { type: 'json' });
  if (!data || typeof data !== 'object') return { rows: [] };
  const d = /** @type {{ rows?: unknown }} */ (data);
  const rows = d.rows;
  return { rows: Array.isArray(rows) ? rows : [] };
}

/**
 * @param {Record<string, unknown>} event
 * @param {unknown[]} rows
 */
export async function saveAvisosRows(event, rows) {
  wireNetlifyBlobsFromEvent(event);
  const store = getStore(AVISOS_BLOB_STORE);
  await store.setJSON(AVISOS_BLOB_KEY, { v: 1, rows });
}
