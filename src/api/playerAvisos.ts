import { resolvePlayerAvisosUrl } from '@/api/config';

const FETCH_MS = 6_000;

/**
 * Busca avisos operador publicados para o par cliente/PDV (Netlify Function).
 * Falha de rede, JSON inválido ou host indisponível → `[]` (sem throw para o player).
 */
export async function fetchAvisosOperadorParaPdv(
  clienteId: number | null | undefined,
  pdvId: number | null | undefined,
): Promise<string[]> {
  const c = typeof clienteId === 'number' && Number.isFinite(clienteId) && clienteId > 0 ? clienteId : null;
  const p = typeof pdvId === 'number' && Number.isFinite(pdvId) && pdvId > 0 ? pdvId : null;
  if (c == null || p == null) return [];

  const base = resolvePlayerAvisosUrl();
  if (!base) return [];

  try {
    const u = new URL(base);
    u.searchParams.set('cliente_id', String(c));
    u.searchParams.set('pdv_id', String(p));
    const ac = new AbortController();
    const t = window.setTimeout(() => ac.abort(), FETCH_MS);
    const r = await fetch(u.toString(), {
      signal: ac.signal,
      credentials: 'omit',
      cache: 'no-store',
    });
    window.clearTimeout(t);
    if (!r.ok) return [];
    const j: unknown = await r.json();
    if (!j || typeof j !== 'object' || !('mensagens' in j)) return [];
    const arr = (j as { mensagens: unknown }).mensagens;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x): x is string => typeof x === 'string')
      .map((x) => x.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}
