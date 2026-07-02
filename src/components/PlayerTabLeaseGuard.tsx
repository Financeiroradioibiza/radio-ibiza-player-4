import { type ReactNode, useEffect, useLayoutEffect, useMemo, useState } from 'react';

import { useAppStore } from '@/store/app';
import {
  PLAYER_LEASE_HEARTBEAT_MS,
  PLAYER_LEASE_STALE_MS,
  canClaimPlayerLease,
  clearPlayerLeaseIfHeldBy,
  describeLeaseHolder,
  leaseIsStale,
  makePlayerLeaseHolderId,
  readPlayerLease,
  usesMachinePlayerLease,
  writePlayerLease,
  type PlayerLeasePayload,
} from '@/utils/playerLease';
import { PLAYER_TAB_LEASE_STORAGE_KEY } from '@/utils/playerTabLease';

type Phase = 'owner' | 'blocked' | 'evicted';

/** Ecrã mínimo (tema Ibiza escuro); não depende dos painéis do player. */
function LeaseBackdrop({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-zinc-100 px-6 py-14 text-center text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="max-w-md space-y-3 rounded-3xl border border-zinc-200/90 bg-white/95 p-8 shadow-panel backdrop-blur-sm dark:border-white/10 dark:bg-black/55">
        {children}
      </div>
    </div>
  );
}

function pauseAndEvict(setPhase: (p: Phase) => void): void {
  useAppStore.setState({ status: 'pausado', conviteGesturaAudio: false });
  queueMicrotask(() => {
    setPhase('evicted');
  });
}

/**
 * Mantém apenas um «dono» do player por perfil (PWA) ou por máquina (.exe TI / ProgramData).
 * Outras instâncias ficam bloqueadas ou pausadas com opção explícita de assumir.
 */
export function PlayerTabLeaseGuard({ children }: { children: ReactNode }) {
  const machineLease = usesMachinePlayerLease();
  const holderId = useMemo(() => makePlayerLeaseHolderId(), []);

  const [phase, setPhase] = useState<Phase>(() =>
    canClaimPlayerLease(holderId) ? 'owner' : 'blocked',
  );
  const [blockedLease, setBlockedLease] = useState<PlayerLeasePayload | null>(() =>
    phase === 'blocked' ? readPlayerLease() : null,
  );

  useLayoutEffect(() => {
    if (phase !== 'owner') return;
    writePlayerLease(holderId);
    queueMicrotask(() => {
      const cur = readPlayerLease();
      if (!cur?.holderId) return;
      if (cur.holderId !== holderId && !leaseIsStale(cur)) {
        setPhase('blocked');
        setBlockedLease(cur);
      }
    });
  }, [phase, holderId]);

  useEffect(() => {
    function releaseHeldLease() {
      clearPlayerLeaseIfHeldBy(holderId);
    }
    window.addEventListener('pagehide', releaseHeldLease);
    window.addEventListener('beforeunload', releaseHeldLease);
    return () => {
      window.removeEventListener('pagehide', releaseHeldLease);
      window.removeEventListener('beforeunload', releaseHeldLease);
      const cur = readPlayerLease();
      if (cur?.holderId === holderId) {
        releaseHeldLease();
      }
    };
  }, [holderId]);

  useEffect(() => {
    if (phase !== 'owner') return;

    const tick = (): void => {
      const cur = readPlayerLease();
      if (cur && cur.holderId !== holderId && !leaseIsStale(cur)) {
        pauseAndEvict(setPhase);
        return;
      }
      if (!cur || cur.holderId === holderId) {
        writePlayerLease(holderId, Date.now());
      }
    };

    tick();
    const iv = window.setInterval(tick, PLAYER_LEASE_HEARTBEAT_MS);
    return () => clearInterval(iv);
  }, [phase, holderId]);

  /** PWA: outro separador tomou controlo via `storage` event. */
  useEffect(() => {
    if (phase !== 'owner' || machineLease) return;

    function handleStorage(ev: StorageEvent) {
      if (ev.storageArea !== localStorage || ev.key !== PLAYER_TAB_LEASE_STORAGE_KEY || !ev.newValue) return;
      let next: PlayerLeasePayload;
      try {
        next = JSON.parse(ev.newValue) as PlayerLeasePayload;
        if (!next?.holderId || !Number.isFinite(next.beat)) return;
      } catch {
        return;
      }
      if (next.holderId === holderId) return;
      pauseAndEvict(setPhase);
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [phase, holderId, machineLease]);

  useEffect(() => {
    if (phase !== 'blocked') return undefined;
    const tick = (): void => {
      if (!canClaimPlayerLease(holderId)) {
        setBlockedLease(readPlayerLease());
        return;
      }
      writePlayerLease(holderId);
      setPhase('owner');
    };

    tick();
    const iv = window.setInterval(tick, Math.min(2000, PLAYER_LEASE_STALE_MS / 2));
    return () => clearInterval(iv);
  }, [phase, holderId]);

  function handleTakeover(): void {
    writePlayerLease(holderId);
    setPhase('owner');
  }

  const blockedLabel = describeLeaseHolder(blockedLease ?? readPlayerLease());

  if (phase === 'blocked') {
    return (
      <LeaseBackdrop>
        <p className="text-lg font-semibold text-amber-800 dark:text-amber-200/95">
          {machineLease ? 'Player já activo neste PC' : 'Player já aberto neste navegador'}
        </p>
        <p className="text-sm leading-relaxed text-zinc-700 dark:text-white">
          {machineLease ? (
            <>
              O player está a tocar na <strong className="text-zinc-900 dark:text-white">{blockedLabel}</strong>.
              Só deve haver <strong className="text-zinc-900 dark:text-white">uma</strong> instância a controlar
              áudio neste equipamento — duas sessões Windows podem duplicar som e confundir comandos.
            </>
          ) : (
            <>
              Só deve usar <strong className="text-zinc-900 dark:text-white">uma</strong> página do player por cada
              vez aqui neste equipamento — dois separadores fazem dois áudio, confundem comandos de play e podem
              registar dados em duplicado.
            </>
          )}
        </p>
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            className="rounded-xl border border-amber-400/55 bg-gradient-to-r from-amber-600/60 via-orange-600/52 to-orange-700/52 px-5 py-3 text-sm font-bold text-white shadow-ibiza-pop transition hover:brightness-110"
            onClick={handleTakeover}
          >
            {machineLease ? 'Usar nesta sessão Windows' : 'Usar neste separador'}
          </button>
          <button
            type="button"
            className="rounded-xl border border-zinc-300/80 bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400 hover:bg-zinc-200/90 dark:border-zinc-600/65 dark:bg-black/35 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-black/45"
            onClick={() => {
              window.close();
            }}
          >
            Fechar
          </button>
        </div>
        {machineLease ? (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            A outra sessão ficará em pausa automaticamente se assumir aqui.
          </p>
        ) : (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Se o botão de fechar não funcionar (o navegador bloqueia), feche este separador manualmente.
          </p>
        )}
      </LeaseBackdrop>
    );
  }

  if (phase === 'evicted') {
    return (
      <LeaseBackdrop>
        <p className="text-lg font-semibold text-fuchsia-800 dark:text-fuchsia-200/95">
          {machineLease ? 'Outra sessão Windows assumiu o player' : 'Este separador deixou de ser o único'}
        </p>
        <p className="text-sm leading-relaxed text-zinc-700 dark:text-white">
          {machineLease ? (
            <>
              Outra sessão Windows tomou controlo do player neste PC. Colocámos reprodução em{' '}
              <strong>pausa</strong> aqui para não ficar dois transportes ligados ao mesmo tempo.
            </>
          ) : (
            <>
              Outro separador assumiu o player. Colocámos reprodução em <strong>pausa</strong> aqui para não ficar
              dois transportes ligados ao mesmo tempo.
            </>
          )}
        </p>
        <p className="text-sm text-zinc-600 dark:text-white/90">
          {machineLease
            ? 'Continue o áudio só numa sessão Windows de cada vez.'
            : 'Continue só num único separador com o Radio Ibiza aberto.'}
        </p>
        <div className="pt-2">
          <button
            type="button"
            className="rounded-xl border border-zinc-300/80 bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400 hover:bg-zinc-200/90 dark:border-zinc-600/65 dark:bg-black/35 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-black/45"
            onClick={() => {
              window.close();
            }}
          >
            Fechar
          </button>
        </div>
        <button
          type="button"
          className="text-xs font-medium text-fuchsia-300/95 underline underline-offset-2 hover:text-fuchsia-200"
          onClick={() => window.location.reload()}
        >
          Recarregar e tentar ser o único novamente
        </button>
      </LeaseBackdrop>
    );
  }

  return <>{children}</>;
}
