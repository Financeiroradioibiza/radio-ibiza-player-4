import { type ReactNode, useEffect, useLayoutEffect, useMemo, useState } from 'react';

import { useAppStore } from '@/store/app';
import {
  PLAYER_TAB_HEARTBEAT_MS,
  PLAYER_TAB_LEASE_STALE_MS,
  PLAYER_TAB_LEASE_STORAGE_KEY,
  canClaimPlayerTabLease,
  clearPlayerTabLeaseIfHeldBy,
  leaseIsStale,
  makePlayerTabLeaseId,
  readPlayerTabLease,
  writePlayerTabLease,
  type PlayerTabLeasePayload,
} from '@/utils/playerTabLease';

type Phase = 'owner' | 'blocked' | 'evicted';

/** Ecrã mínimo (tema Ibiza escuro); não depende dos painéis do player. */
function LeaseBackdrop({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-zinc-950 px-6 py-14 text-center text-zinc-100">
      <div className="max-w-md space-y-3 rounded-3xl border border-white/10 bg-black/55 p-8 shadow-panel backdrop-blur-sm">
        {children}
      </div>
    </div>
  );
}

/**
 * Mantém apenas um separador com /player autorizado ao transporte ao mesmo tempo.
 * Outras abas fica pausadas com opção explícita de assumir este separador.
 */
export function PlayerTabLeaseGuard({ children }: { children: ReactNode }) {
  const tabId = useMemo(() => makePlayerTabLeaseId(), []);

  const [phase, setPhase] = useState<Phase>(() =>
    canClaimPlayerTabLease(tabId) ? 'owner' : 'blocked',
  );

  useLayoutEffect(() => {
    if (phase !== 'owner') return;
    writePlayerTabLease(tabId);
    /** Duas abas no mesmo instante podem ler «sem lease»; quem ficou em segundo corrige já no microtask. */
    queueMicrotask(() => {
      const cur = readPlayerTabLease();
      if (!cur?.holderId) return;
      if (cur.holderId !== tabId && !leaseIsStale(cur)) {
        setPhase('blocked');
      }
    });
  }, [phase, tabId]);

  useEffect(() => {
    function releaseHeldLease() {
      clearPlayerTabLeaseIfHeldBy(tabId);
    }
    window.addEventListener('pagehide', releaseHeldLease);
    window.addEventListener('beforeunload', releaseHeldLease);
    return () => {
      window.removeEventListener('pagehide', releaseHeldLease);
      window.removeEventListener('beforeunload', releaseHeldLease);
      /** Só libertar ao desmontar se ainda somos os donos (evita apagar takeover alheio). */
      const cur = readPlayerTabLease();
      if (cur?.holderId === tabId) {
        releaseHeldLease();
      }
    };
  }, [tabId]);

  useEffect(() => {
    if (phase !== 'owner') return;
    const id = window.setInterval(() => {
      const cur = readPlayerTabLease();
      if (!cur || cur.holderId !== tabId) {
        return;
      }
      writePlayerTabLease(tabId, Date.now());
    }, PLAYER_TAB_HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [phase, tabId]);

  /** Outro separador tomou controlo ou heartbeat mostrou novo dono (defensivo). */
  useEffect(() => {
    if (phase !== 'owner') return;

    function handleStorage(ev: StorageEvent) {
      if (ev.storageArea !== localStorage || ev.key !== PLAYER_TAB_LEASE_STORAGE_KEY || !ev.newValue) return;
      let next: PlayerTabLeasePayload;
      try {
        next = JSON.parse(ev.newValue) as PlayerTabLeasePayload;
        if (!next?.holderId || !Number.isFinite(next.beat)) return;
      } catch {
        return;
      }
      if (next.holderId === tabId) return;

      /** Dono válido novo — este separador deixa de tocar controlado. */
      useAppStore.setState({ status: 'pausado' });
      queueMicrotask(() => {
        setPhase('evicted');
      });
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [phase, tabId]);

  /** Separador «bloqueado»: se o dono morrer ou soltar lease, ficamos donos automaticamente. */
  useEffect(() => {
    if (phase !== 'blocked') return undefined;
    const tick = (): void => {
      if (!canClaimPlayerTabLease(tabId)) return;
      writePlayerTabLease(tabId);
      setPhase('owner');
    };

    tick();
    const iv = window.setInterval(tick, Math.min(2000, PLAYER_TAB_LEASE_STALE_MS / 2));
    return () => clearInterval(iv);
  }, [phase, tabId]);

  function handleTakeover(): void {
    /** Escreve lease — as outras abas recebem `storage` e fazem pause. */
    writePlayerTabLease(tabId);
    setPhase('owner');
  }

  if (phase === 'blocked') {
    return (
      <LeaseBackdrop>
        <p className="text-lg font-semibold text-amber-200/95">Player já aberto neste navegador</p>
        <p className="text-sm leading-relaxed text-white">
          Só deve usar <strong className="text-white">uma</strong> página do player por cada vez aqui neste equipamento —
          dois separadores fazem dois áudio, confundem comandos de play e podem registar dados em duplicado.
        </p>
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            className="rounded-xl border border-amber-400/55 bg-gradient-to-r from-amber-600/60 via-orange-600/52 to-orange-700/52 px-5 py-3 text-sm font-bold text-white shadow-ibiza-pop transition hover:brightness-110"
            onClick={handleTakeover}
          >
            Usar neste separador
          </button>
          <button
            type="button"
            className="rounded-xl border border-zinc-600/65 bg-black/35 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-black/45"
            onClick={() => {
              window.close();
            }}
          >
            Fechar esta aba
          </button>
        </div>
        <p className="text-[11px] text-zinc-400">
          Se o botão de fechar não funcionar (o navegador bloqueia), feche este separador manualmente.
        </p>
      </LeaseBackdrop>
    );
  }

  if (phase === 'evicted') {
    return (
      <LeaseBackdrop>
        <p className="text-lg font-semibold text-fuchsia-200/95">Este separador deixou de ser o único</p>
        <p className="text-sm leading-relaxed text-white">
          Outro separador assumiu o player. Colocámos reprodução em <strong>pausa</strong> aqui para não ficar dois
          transportes ligados ao mesmo tempo.
        </p>
        <p className="text-sm text-white/90">Continue só num único separador com o Radio Ibiza aberto.</p>
        <div className="pt-2">
          <button
            type="button"
            className="rounded-xl border border-zinc-600/65 bg-black/35 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-black/45"
            onClick={() => {
              window.close();
            }}
          >
            Fechar esta aba
          </button>
        </div>
        <button
          type="button"
          className="text-xs font-medium text-fuchsia-300/95 underline underline-offset-2 hover:text-fuchsia-200"
          onClick={() => window.location.reload()}
        >
          Recarregar e tentar ser o único separador novamente
        </button>
      </LeaseBackdrop>
    );
  }

  return <>{children}</>;
}
