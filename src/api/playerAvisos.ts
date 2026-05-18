import { resolvePlayerAvisosUrl, VERSAO_PLAYER, getDeviceId } from '@/api/config';

const FETCH_MS = 6_000;

/**
 * Busca avisos operador publicados para o par cliente/PDV (Netlify Function).
 * POST com token — só o servidor valida no `/ping/` antes de filtrar mensagens.
 * Falha de credenciais, rede, JSON inválido ou host indisponível → `[]` (sem throw).
 */
export async function fetchAvisosOperadorParaPdv(
  clienteId: number | null | undefined,
  pdvId: number | null | undefined,
  token: string | null | undefined,
): Promise<string[]> {
  const c = typeof clienteId === 'number' && Number.isFinite(clienteId) && clienteId > 0 ? clienteId : null;
  const p = typeof pdvId === 'number' && Number.isFinite(pdvId) && pdvId > 0 ? pdvId : null;
  const t = typeof token === 'string' && token.trim().length > 0 ? token.trim() : null;
  if (c == null || p == null || t == null) return [];

  const url = resolvePlayerAvisosUrl();
  if (!url) return [];

  try {
    const ac = new AbortController();
    const tm = window.setTimeout(() => ac.abort(), FETCH_MS);
    const r = await fetch(url, {
      method: 'POST',
      signal: ac.signal,
      credentials: 'omit',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json' },
      body: JSON.stringify({
        token: t,
        cliente_id: c,
        pdv_id: p,
        ma: getDeviceId(),
        versao_player: VERSAO_PLAYER,
      }),
    });
    window.clearTimeout(tm);
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
