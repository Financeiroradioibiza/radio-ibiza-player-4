/**
 * Convite à instalação PWA quando o browser dispara `beforeinstallprompt` (Chrome/Edge).
 * Sem instruções estáticas de menu — mudam por versão/OS e geram confusão.
 */

import { useCallback, useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type InstallFeedback = 'accepted' | 'dismissed' | null;

function isWindowsDesktop(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Windows/i.test(navigator.userAgent ?? '');
}

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
  const [feedback, setFeedback] = useState<InstallFeedback>(null);

  useEffect(() => {
    if (isStandalonePwa()) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDismissPrompt(false);
      setFeedback(null);
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setFeedback('accepted');
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
    setFeedback(null);
  }, []);

  const onInstallClick = useCallback(async () => {
    if (!deferred) return;
    setInstalling(true);
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      setFeedback(outcome === 'accepted' ? 'accepted' : 'dismissed');
    } catch {
      setFeedback('dismissed');
    } finally {
      setInstalling(false);
      setDeferred(null);
    }
  }, [deferred]);

  if (isStandalonePwa()) return null;

  const visible = !dismissPrompt && (deferred !== null || feedback !== null);
  if (!visible) return null;

  if (feedback === 'accepted') {
    return (
      <div className="mb-4 shrink-0">
        <div className="rounded-2xl border border-emerald-800/50 bg-emerald-950/35 px-4 py-3 text-sm text-emerald-100/95 shadow-panel">
          <p className="font-semibold text-emerald-200">Instalação concluída</p>
          <p className="mt-1.5 text-xs leading-relaxed text-emerald-100/80">
            No Windows o ícone <strong className="text-emerald-200">nem sempre</strong> aparece na área de trabalho nem na barra de tarefas sozinho. Se não viu atalho novo, siga o bloco abaixo.
          </p>
          {isWindowsDesktop() ? (
            <>
              <p className="mt-2 text-[11px] leading-relaxed text-emerald-100/75">
                <span className="font-semibold text-emerald-200">Área de trabalho e barra:</span> no mesmo navegador em que instalou, abra{' '}
                <kbd className="rounded border border-emerald-700/60 bg-emerald-950/50 px-1 font-mono text-[10px]">
                  chrome://apps
                </kbd>{' '}
                (Chrome) ou{' '}
                <kbd className="rounded border border-emerald-700/60 bg-emerald-950/50 px-1 font-mono text-[10px]">
                  edge://apps
                </kbd>{' '}
                (Edge). Clique direito em <strong className="text-emerald-200">Radio Ibiza</strong> →{' '}
                <strong className="text-emerald-200">Criar atalhos…</strong> (Chrome; marque Ambiente de trabalho) ou{' '}
                <strong className="text-emerald-200">Criar atalho</strong> / <strong className="text-emerald-200">Fixar na barra de tarefas</strong>{' '}
                (Edge). Tecla <kbd className="rounded border border-emerald-700/60 px-1 font-mono text-[10px]">Win</kbd> e
                procure <strong className="text-emerald-200">Radio Ibiza</strong>: se não existir, a instalação não terminou — use o{' '}
                <strong className="text-emerald-200">⊕</strong> de novo na aba do login.
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-emerald-100/75">
                <span className="font-semibold text-emerald-200">Abrir ao ligar o PC:</span> na mesma página{' '}
                <kbd className="rounded border border-emerald-700/60 bg-emerald-950/50 px-1 font-mono text-[10px]">chrome://apps</kbd> /{' '}
                <kbd className="rounded border border-emerald-700/60 bg-emerald-950/50 px-1 font-mono text-[10px]">edge://apps</kbd>, clique
                direito no app → opção de <strong className="text-emerald-200">iniciar ao fazer login</strong>. Depois confira em
                Configurações → Aplicativos → Inicialização.
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-xs leading-relaxed text-emerald-100/80">
              Procure o ícone no dock ou na pasta Aplicativos. Se uma nova janela abriu, pode fechar esta aba do navegador e usar só o app.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (feedback === 'dismissed') {
    return (
      <div className="mb-4 shrink-0">
        <div className="rounded-2xl border border-amber-800/45 bg-amber-950/30 px-4 py-3 text-sm text-amber-100/90 shadow-panel">
          <p className="font-semibold text-amber-200">Instalação não confirmada</p>
          <p className="mt-1.5 text-xs leading-relaxed text-amber-100/75">
            Se fechou o aviso do navegador, clique no ícone <strong className="text-amber-200">⊕</strong> ou em{' '}
            <strong className="text-amber-200">Instalar app</strong> à direita da barra de endereços e confirme de novo. O player
            pode continuar tocando na mesma aba enquanto isso — a instalação é independente da música.
            {isWindowsDesktop() ? (
              <>
                {' '}
                Se mesmo assim <strong className="text-amber-200">não aparecer</strong> «Radio Ibiza» ao pressionar a tecla Win e
                pesquisar, o app <strong className="text-amber-200">não foi instalado</strong> — repita o ⊕ na aba do login (Chrome ou
                Edge).
              </>
            ) : null}
          </p>
        </div>
      </div>
    );
  }

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
              {installing ? 'Aguardando…' : 'Instalar agora'}
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
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
          Ao clicar em <strong className="text-zinc-400">Instalar agora</strong>, o navegador abre um diálogo por cima desta página —
          confirme lá. Isso não é o mesmo que fazer login.
          {isWindowsDesktop() ? (
            <>
              {' '}
              No Windows, marque também <strong className="text-zinc-400">atalho na área de trabalho</strong> e{' '}
              <strong className="text-zinc-400">barra de tarefas</strong> se o assistente mostrar — senão o ícone pode ficar só no Menu
              Iniciar.
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}
