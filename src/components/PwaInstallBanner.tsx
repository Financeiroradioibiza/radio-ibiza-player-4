/**
 * Convite à instalação PWA quando o browser dispara `beforeinstallprompt` (Chrome/Edge).
 * Sem instruções estáticas de menu — mudam por versão/OS e geram confusão.
 */

import { useCallback, useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window.navigator as any).standalone === true) return true;
  return false;
}

export function PwaInstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissPrompt, setDismissPrompt] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isStandalonePwa()) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDismissPrompt(false);
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismissInvitation = useCallback(() => {
    setDismissPrompt(true);
  }, []);

  const onInstallClick = useCallback(async () => {
    if (!deferred) return;
    setInstalling(true);
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      //
    } finally {
      setInstalling(false);
      setDeferred(null);
    }
  }, [deferred]);

  if (isStandalonePwa()) return null;

  const showAutoInvite = Boolean(deferred) && !dismissPrompt;
  if (!showAutoInvite) return null;

  return (
    <div className="mb-4 shrink-0">
      <div className="rounded-2xl border border-ibiza-magenta/35 bg-gradient-to-br from-zinc-950/85 via-zinc-900/70 to-ibiza-purple/10 px-4 py-3 text-sm text-zinc-300 shadow-ibiza-pop backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold">
            <span className="bg-gradient-to-r from-ibiza-magenta to-ibiza-lemon bg-clip-text text-transparent">
              Instalar no computador
            </span>
            <span className="ml-2 font-normal text-zinc-500">— atalho e janela própria.</span>
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              disabled={installing}
              onClick={() => void onInstallClick()}
              className="rounded-xl bg-gradient-to-r from-ibiza-magenta via-ibiza-purple to-fuchsia-600 px-3 py-2 text-xs font-bold text-white shadow-ibiza-pop hover:brightness-110 disabled:opacity-60"
            >
              {installing ? 'A instalar…' : 'Instalar agora'}
            </button>
            <button
              type="button"
              onClick={dismissInvitation}
              className="rounded-xl border border-zinc-600 bg-zinc-950/70 px-3 py-2 text-xs font-semibold text-zinc-400 hover:border-ibiza-magenta/30 hover:bg-zinc-900"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
