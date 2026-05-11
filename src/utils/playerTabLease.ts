/**
 * Garante um único «dono» do player por perfil do navegador (localStorage compartilhado entre separadores).
 * Ver `PlayerTabLeaseGuard` — mesmo domínio, uma aba com /player tocando/controlando de cada vez.
 */

export const PLAYER_TAB_LEASE_STORAGE_KEY = 'radio-ibiza-player-tab-lease-v1';

export type PlayerTabLeasePayload = {
  holderId: string;
  beat: number;
};

export const PLAYER_TAB_HEARTBEAT_MS = 1500;
/** Se o batimento ficar mais antigo que isto, o lease considera-se morto (crash / fecho sem pagehide). */
export const PLAYER_TAB_LEASE_STALE_MS = 5000;

export function makePlayerTabLeaseId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    //
  }
  return `rb-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function readPlayerTabLease(): PlayerTabLeasePayload | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PLAYER_TAB_LEASE_STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== 'object') return null;
    const holderId = String((o as { holderId?: unknown }).holderId ?? '');
    const beat = Number((o as { beat?: unknown }).beat);
    if (!holderId || !Number.isFinite(beat)) return null;
    return { holderId, beat };
  } catch {
    return null;
  }
}

export function writePlayerTabLease(holderId: string, beat = Date.now()): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const payload: PlayerTabLeasePayload = { holderId, beat };
    localStorage.setItem(PLAYER_TAB_LEASE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    //
  }
}

export function clearPlayerTabLeaseIfHeldBy(holderId: string): void {
  if (typeof localStorage === 'undefined') return;
  const cur = readPlayerTabLease();
  if (!cur || cur.holderId !== holderId) return;
  try {
    localStorage.removeItem(PLAYER_TAB_LEASE_STORAGE_KEY);
  } catch {
    //
  }
}

export function leaseIsStale(lease: PlayerTabLeasePayload, now = Date.now()): boolean {
  return now - lease.beat > PLAYER_TAB_LEASE_STALE_MS;
}

/** true se esta aba pode tomar controlo só com base na idade do lease atual. */
export function canClaimPlayerTabLease(holderId: string, now = Date.now()): boolean {
  const cur = readPlayerTabLease();
  if (!cur || cur.holderId === holderId) return true;
  return leaseIsStale(cur, now);
}
