/**
 * Convite à instalação PWA (atalho + ícone no ecrã / ambiente de trabalho).
 * Usa `beforeinstallprompt` quando o Chrome/Edge oferece; o passo a passo manual fica sempre disponível.
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

  return (
    <div className="mb-4 shrink-0 space-y-3">
      {showAutoInvite && (
        <div className="rounded-lg border border-ibiza-gold/35 bg-zinc-900/80 px-4 py-3 text-sm text-zinc-300">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium text-ibiza-gold">Instalar no computador</p>
              <p className="mt-1 text-xs text-zinc-400">
                O browser pode criar um atalho com ícone no ambiente de trabalho ou no menu
                Iniciar — o player abre como aplicação.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={installing}
                onClick={() => void onInstallClick()}
                className="rounded-md bg-ibiza-gold/90 px-3 py-1.5 text-xs font-medium text-zinc-950 hover:bg-ibiza-gold disabled:opacity-60"
              >
                {installing ? 'A instalar…' : 'Instalar agora'}
              </button>
              <button
                type="button"
                onClick={dismissInvitation}
                className="rounded-md border border-zinc-600 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
              >
                Agora não
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 px-4 py-3 text-xs text-zinc-400">
        <p className="font-medium text-zinc-300">Como pôr o ícone no ambiente de trabalho</p>
        <p className="mt-1 text-zinc-500">
          Se não apareceu o botão acima, ou prefere fazer manualmente, siga estes passos no{' '}
          <strong className="text-zinc-400">Chrome</strong> ou <strong className="text-zinc-400">Edge</strong>{' '}
          (Windows):
        </p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5">
          <li>
            Com o player aberto neste separador, clique nos <strong className="text-zinc-300">três pontos</strong> (⋮)
            no canto superior direito.
          </li>
          <li>
            <strong className="text-zinc-300">Chrome:</strong> procure «Instalar…», «Instalar página como
            aplicação» ou semelhante e confirme; se aparecer, assinale atalho no{' '}
            <strong className="text-zinc-300">ambiente de trabalho</strong>.
          </li>
          <li>
            <strong className="text-zinc-300">Edge:</strong> menu ⋮ → <strong className="text-zinc-300">Aplicações</strong> →{' '}
            <strong className="text-zinc-300">Instalar este site como aplicação</strong>.
          </li>
          <li>Use sempre o <strong className="text-zinc-300">novo ícone</strong> para abrir o player.</li>
        </ol>
      </div>
    </div>
  );
}
