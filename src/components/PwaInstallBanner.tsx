/**
 * Convite à instalação PWA (atalho + ícone no ecrã / ambiente de trabalho).
 * Usa `beforeinstallprompt` quando o Chrome/Edge oferece; dicas curtas para favorito e instalação manual.
 *
 * Nota: não existe API no browser para o site adicionar favoritos por si — só o utilizador (ex.: Ctrl+D / ⌘D).
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

/** Estilo discreto para atalhos de teclado no texto */
function Teclas({ win, mac }: { win: string; mac: string }) {
  return (
    <span className="font-mono text-[11px] text-zinc-300">
      Win: <kbd className="rounded border border-white/15 bg-black/35 px-1 py-px">{win}</kbd>
      {' · '}
      Mac: <kbd className="rounded border border-white/15 bg-black/35 px-1 py-px">{mac}</kbd>
    </span>
  );
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
    <div className="mb-4 shrink-0 space-y-2">
      {showAutoInvite && (
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
      )}

      <div className="rounded-xl border border-white/10 bg-zinc-950/55 px-3 py-2.5 text-[11px] leading-snug text-zinc-500 shadow-panel">
        <p className="font-semibold text-zinc-400">Acesso rápido</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-4 marker:text-zinc-600">
          <li>
            <strong className="font-medium text-zinc-400">Favorito:</strong> com esta página aberta,{' '}
            <Teclas win="Ctrl+D" mac="⌘D" /> — o site{' '}
            <span className="text-zinc-600">não pode</span> gravar favoritos sozinho; só o browser, por segurança.
            Depois pode arrastar o favorito para a barra.
          </li>
          <li>
            <strong className="font-medium text-zinc-400">Como app:</strong> ícone de instalar junto ao endereço (se
            aparecer) ou menu ⋮ → <strong className="text-zinc-300">Transmitir, salvar e compartilhar</strong> → instalar
            página como aplicação. No Edge: ⋮ → Aplicações → instalar site.
          </li>
        </ul>
      </div>
    </div>
  );
}
