/**
 * Lease do player — PWA: localStorage entre separadores; .exe TI: ficheiro em ProgramData.
 * Ver `PlayerTabLeaseGuard`.
 */

import { isWinTiElectron } from '@/utils/isWinTiElectron';
import {
  PLAYER_TAB_HEARTBEAT_MS,
  PLAYER_TAB_LEASE_STALE_MS,
  canClaimPlayerTabLease,
  clearPlayerTabLeaseIfHeldBy,
  leaseIsStale as tabLeaseIsStale,
  makePlayerTabLeaseId,
  readPlayerTabLease,
  writePlayerTabLease,
  type PlayerTabLeasePayload,
} from '@/utils/playerTabLease';

export type PlayerLeasePayload = PlayerTabLeasePayload & {
  windowsUser?: string;
};

export const PLAYER_LEASE_HEARTBEAT_MS = PLAYER_TAB_HEARTBEAT_MS;
export const PLAYER_LEASE_STALE_MS = PLAYER_TAB_LEASE_STALE_MS;

type PlayerLeaseElectronApi = {
  read: () => PlayerLeasePayload | null;
  write: (holderId: string, beat?: number) => boolean;
  clearIfHeldBy: (holderId: string) => void;
  getMeta: () => { instanceId: string; windowsUser: string };
};

function machineLeaseApi(): PlayerLeaseElectronApi | null {
  if (typeof window === 'undefined') return null;
  const api = (
    window as Window & { electronAPI?: { playerLease?: PlayerLeaseElectronApi } }
  ).electronAPI?.playerLease;
  return api ?? null;
}

export function usesMachinePlayerLease(): boolean {
  return isWinTiElectron() && machineLeaseApi() != null;
}

/** ID estável por processo (.exe) ou por separador (PWA). */
export function makePlayerLeaseHolderId(): string {
  const ml = machineLeaseApi();
  if (ml) return ml.getMeta().instanceId;
  return makePlayerTabLeaseId();
}

export function readPlayerLease(): PlayerLeasePayload | null {
  const ml = machineLeaseApi();
  if (ml) return ml.read();
  return readPlayerTabLease();
}

export function writePlayerLease(holderId: string, beat = Date.now()): void {
  const ml = machineLeaseApi();
  if (ml) {
    ml.write(holderId, beat);
    return;
  }
  writePlayerTabLease(holderId, beat);
}

export function clearPlayerLeaseIfHeldBy(holderId: string): void {
  const ml = machineLeaseApi();
  if (ml) {
    ml.clearIfHeldBy(holderId);
    return;
  }
  clearPlayerTabLeaseIfHeldBy(holderId);
}

export function leaseIsStale(lease: PlayerLeasePayload, now = Date.now()): boolean {
  return tabLeaseIsStale(lease, now);
}

export function canClaimPlayerLease(holderId: string, now = Date.now()): boolean {
  const ml = machineLeaseApi();
  if (ml) {
    const cur = ml.read();
    if (!cur || cur.holderId === holderId) return true;
    return leaseIsStale(cur, now);
  }
  return canClaimPlayerTabLease(holderId, now);
}

export function describeLeaseHolder(lease: PlayerLeasePayload | null): string {
  if (!lease) return 'outra sessão';
  if (usesMachinePlayerLease() && lease.windowsUser?.trim()) {
    return `sessão Windows «${lease.windowsUser.trim()}»`;
  }
  return 'outro separador';
}
