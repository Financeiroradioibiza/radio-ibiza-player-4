/**
 * Convite à instalação PWA quando há `beforeinstallprompt` (Chrome/Android/desktop).
 * No iOS não mostramos cartão antes do login — o guia fica em `/m/instalar.html` (link na página).
 * Textos após instalar/recusa mantêm ramificação Android vs iPhone/iPad.
 */

import { useCallback, useEffect, useState } from 'react';

import { shouldUseIbizaPwaTouchShellLayout } from '@/api/config';
import { isAndroidWeb, isIosWeb } from '@/utils/pwaInstallPlatform';

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
  const isMobileOrTabletShell = shouldUseIbizaPwaTouchShellLayout();
  const ios = isIosWeb();
  const android = isAndroidWeb();

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

  const showDeferredInvite = deferred !== null && !dismissPrompt && feedback === null;
  const showAndroidManualInvite =
    isMobileOrTabletShell &&
    android &&
    !ios &&
    !dismissPrompt &&
    feedback === null &&
    deferred === null;

  if (feedback === null && !showDeferredInvite && !showAndroidManualInvite) {
    return null;
  }

  if (feedback === 'accepted') {
    return (
      <div className="mb-4 shrink-0">
        <div className="rounded-2xl border border-emerald-300/80 bg-emerald-50/95 px-4 py-3 text-sm text-emerald-950 shadow-panel dark:border-emerald-800/50 dark:bg-emerald-950/35 dark:text-emerald-100/95">
          <p className="font-semibold text-emerald-900 dark:text-emerald-200">Instalação concluída</p>
          {isMobileOrTabletShell ? (
            ios ? (
              <p className="mt-1.5 text-xs leading-relaxed text-emerald-900/90 dark:text-emerald-100/80">
                No <strong className="text-emerald-950 dark:text-emerald-200">iPhone ou iPad</strong> o ícone do Radio Ibiza passa a ficar no{' '}
                <strong className="text-emerald-950 dark:text-emerald-200">ecrã inicial</strong> ou na{' '}
                <strong className="text-emerald-950 dark:text-emerald-200">Biblioteca de apps</strong> do iOS (atalho instalado pelo navegador).
                Pode fechar o navegador e abrir sempre por esse ícone — a reprodução continua na app instalada.
              </p>
            ) : android ? (
              <p className="mt-1.5 text-xs leading-relaxed text-emerald-900/90 dark:text-emerald-100/80">
                No <strong className="text-emerald-950 dark:text-emerald-200">Android</strong> o ícone costuma aparecer na{' '}
                <strong className="text-emerald-950 dark:text-emerald-200">área inicial</strong> ou na{' '}
                <strong className="text-emerald-950 dark:text-emerald-200">gaveta de apps</strong>, junto às outras aplicações. Se não vir de imediato, abra o menu do Chrome (
                <strong className="text-emerald-950 dark:text-emerald-200">⋮</strong>) →{' '}
                <strong className="text-emerald-950 dark:text-emerald-200">Instalar aplicação</strong> ou o ícone{' '}
                <strong className="text-emerald-950 dark:text-emerald-200">⊕</strong> na barra de endereços. Pode fechar esta aba e usar só o atalho.
              </p>
            ) : (
              <p className="mt-1.5 text-xs leading-relaxed text-emerald-900/90 dark:text-emerald-100/80">
                O atalho deve aparecer no ecrã inicial ou na lista de apps do sistema. Pode fechar esta aba e abrir sempre pelo ícone instalado.
              </p>
            )
          ) : isWindowsDesktop() ? (
            <p className="mt-1.5 text-xs leading-relaxed text-emerald-900/90 dark:text-emerald-100/80">
              No Windows o ícone <strong className="text-emerald-950 dark:text-emerald-200">nem sempre</strong> aparece na área de trabalho nem na barra de
              tarefas sozinho. Se não viu atalho novo, siga o bloco abaixo.
            </p>
          ) : (
            <p className="mt-1.5 text-xs leading-relaxed text-emerald-900/90 dark:text-emerald-100/80">
              Se abriu uma nova janela do app, pode fechar esta aba. Se não viu diferença, procure <strong className="text-emerald-950 dark:text-emerald-200">Radio Ibiza</strong> no dock ou em Aplicativos.
            </p>
          )}
          {!isMobileOrTabletShell && isWindowsDesktop() ? (
            <>
              <p className="mt-2 text-[11px] leading-relaxed text-emerald-900/95 dark:text-emerald-100/75">
                <span className="font-semibold text-emerald-950 dark:text-emerald-200">Área de trabalho e barra:</span> no mesmo navegador em que instalou, abra{' '}
                <kbd className="rounded border border-emerald-300/90 bg-emerald-100/90 px-1 font-mono text-[10px] text-emerald-950 dark:border-emerald-700/60 dark:bg-emerald-950/50 dark:text-emerald-100">
                  chrome://apps
                </kbd>{' '}
                (Chrome) ou{' '}
                <kbd className="rounded border border-emerald-300/90 bg-emerald-100/90 px-1 font-mono text-[10px] text-emerald-950 dark:border-emerald-700/60 dark:bg-emerald-950/50 dark:text-emerald-100">
                  edge://apps
                </kbd>{' '}
                (Edge). Clique direito em <strong className="text-emerald-950 dark:text-emerald-200">Radio Ibiza</strong> →{' '}
                <strong className="text-emerald-950 dark:text-emerald-200">Criar atalhos…</strong> (Chrome; marque Ambiente de trabalho) ou{' '}
                <strong className="text-emerald-950 dark:text-emerald-200">Criar atalho</strong> / <strong className="text-emerald-950 dark:text-emerald-200">Fixar na barra de tarefas</strong>{' '}
                (Edge). Tecla <kbd className="rounded border border-emerald-300/90 bg-emerald-100/90 px-1 font-mono text-[10px] text-emerald-950 dark:border-emerald-700/60 dark:bg-emerald-950/50 dark:text-emerald-100">Win</kbd> e
                procure <strong className="text-emerald-950 dark:text-emerald-200">Radio Ibiza</strong>: se não existir, a instalação não terminou — use o{' '}
                <strong className="text-emerald-950 dark:text-emerald-200">⊕</strong> de novo na aba do login.
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-emerald-900/95 dark:text-emerald-100/75">
                <span className="font-semibold text-emerald-950 dark:text-emerald-200">Abrir ao ligar o PC:</span> na mesma página{' '}
                <kbd className="rounded border border-emerald-300/90 bg-emerald-100/90 px-1 font-mono text-[10px] text-emerald-950 dark:border-emerald-700/60 dark:bg-emerald-950/50 dark:text-emerald-100">chrome://apps</kbd> /{' '}
                <kbd className="rounded border border-emerald-300/90 bg-emerald-100/90 px-1 font-mono text-[10px] text-emerald-950 dark:border-emerald-700/60 dark:bg-emerald-950/50 dark:text-emerald-100">edge://apps</kbd>, clique
                direito no app → opção de <strong className="text-emerald-950 dark:text-emerald-200">iniciar ao fazer login</strong>. Depois confira em
                Configurações → Aplicativos → Inicialização.
              </p>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  if (feedback === 'dismissed') {
    return (
      <div className="mb-4 shrink-0">
        <div className="rounded-2xl border border-amber-300/80 bg-amber-50/95 px-4 py-3 text-sm text-amber-950 shadow-panel dark:border-amber-800/45 dark:bg-amber-950/30 dark:text-amber-100/90">
          <p className="font-semibold text-amber-900 dark:text-amber-200">Instalação não confirmada</p>
          <p className="mt-1.5 text-xs leading-relaxed text-amber-900/90 dark:text-amber-100/75">
            {isMobileOrTabletShell ? (
              ios ? (
                <>
                  No <strong className="text-amber-950 dark:text-amber-200">iPhone/iPad</strong>, toque em{' '}
                  <strong className="text-amber-950 dark:text-amber-200">Partilhar</strong> (□↑) →{' '}
                  <strong className="text-amber-950 dark:text-amber-200">Adicionar ao ecrã inicial</strong> e confirme. O ícone ficará no ecrã inicial ou na Biblioteca de apps do iOS.
                  O player pode continuar nesta aba — instalar é só criar o atalho.
                </>
              ) : android ? (
                <>
                  No <strong className="text-amber-950 dark:text-amber-200">Android</strong>, tente de novo pelo ícone <strong className="text-amber-950 dark:text-amber-200">⊕</strong> ou pelo menu (
                  <strong className="text-amber-950 dark:text-amber-200">⋮</strong>) → <strong className="text-amber-950 dark:text-amber-200">Instalar aplicação</strong>.
                  Depois da confirmação, procure o ícone na área inicial ou na gaveta de apps.
                </>
              ) : (
                <>
                  Se fechou o aviso do navegador, procure <strong className="text-amber-950 dark:text-amber-200">Instalar app</strong> ou o ícone{' '}
                  <strong className="text-amber-950 dark:text-amber-200">⊕</strong> na barra de endereços e confirme de novo.
                </>
              )
            ) : (
              <>
                Se fechou o aviso do navegador, clique no ícone <strong className="text-amber-950 dark:text-amber-200">⊕</strong> ou em{' '}
                <strong className="text-amber-950 dark:text-amber-200">Instalar app</strong> à direita da barra de endereços e confirme de novo. O player
                pode continuar tocando na mesma aba enquanto isso — a instalação é independente da música.
                {isWindowsDesktop() ? (
                  <>
                    {' '}
                    Se mesmo assim <strong className="text-amber-950 dark:text-amber-200">não aparecer</strong> «Radio Ibiza» ao pressionar a tecla Win e
                    pesquisar, o app <strong className="text-amber-950 dark:text-amber-200">não foi instalado</strong> — repita o ⊕ na aba do login (Chrome ou
                    Edge).
                  </>
                ) : null}
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  if (showAndroidManualInvite) {
    return (
      <div className="mb-4 shrink-0">
        <div className="rounded-2xl border border-ibiza-magenta/35 bg-gradient-to-br from-white/95 via-zinc-50/95 to-ibiza-purple/8 px-4 py-3 text-sm text-zinc-700 shadow-ibiza-pop backdrop-blur-sm dark:from-zinc-950/85 dark:via-zinc-900/70 dark:to-ibiza-purple/10 dark:text-zinc-300">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">
                <span className="bg-gradient-to-r from-ibiza-magenta to-ibiza-lemon bg-clip-text text-transparent">
                  Instalar no Android
                </span>
                <span className="ml-2 font-normal text-zinc-500 dark:text-zinc-400">
                  — ícone na área inicial ou na gaveta de apps.
                </span>
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                Daqui a instantes pode aparecer o botão <strong className="text-zinc-800 dark:text-zinc-300">Instalar agora</strong> ou o ícone{' '}
                <strong className="text-zinc-800 dark:text-zinc-300">⊕</strong> na barra do Chrome — confirme lá. Também pode usar o menu{' '}
                <strong className="text-zinc-800 dark:text-zinc-300">⋮</strong> → <strong className="text-zinc-800 dark:text-zinc-300">Instalar aplicação</strong>.
                Isto <strong className="text-zinc-800 dark:text-zinc-300">não</strong> é o mesmo que fazer login.
              </p>
            </div>
            <button
              type="button"
              onClick={dismissInvitation}
              className="shrink-0 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm hover:border-ibiza-magenta/40 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950/70 dark:text-zinc-400 dark:hover:border-ibiza-magenta/30 dark:hover:bg-zinc-900"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Convite com assistente do navegador (`beforeinstallprompt`)
  const deferredTitle = !isMobileOrTabletShell
    ? 'Instalar no computador'
    : android
      ? 'Instalar no Android'
      : ios
        ? 'Instalar no iPhone ou iPad'
        : 'Adicionar à tela inicial';

  const deferredSubtitle = !isMobileOrTabletShell
    ? '— atalho e janela própria.'
    : android
      ? '— ícone na área inicial ou na gaveta de apps.'
      : ios
        ? '— ícone no ecrã inicial ou Biblioteca de apps (iOS).'
        : '— atalho como app, ecrã próprio.';

  return (
    <div className="mb-4 shrink-0">
      <div className="rounded-2xl border border-ibiza-magenta/35 bg-gradient-to-br from-white/95 via-zinc-50/95 to-ibiza-purple/8 px-4 py-3 text-sm text-zinc-700 shadow-ibiza-pop backdrop-blur-sm dark:from-zinc-950/85 dark:via-zinc-900/70 dark:to-ibiza-purple/10 dark:text-zinc-300">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold">
            <span className="bg-gradient-to-r from-ibiza-magenta to-ibiza-lemon bg-clip-text text-transparent">{deferredTitle}</span>
            <span className="ml-2 font-normal text-zinc-500 dark:text-zinc-400">{deferredSubtitle}</span>
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
              className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm hover:border-ibiza-magenta/40 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950/70 dark:text-zinc-400 dark:hover:border-ibiza-magenta/30 dark:hover:bg-zinc-900"
            >
              Agora não
            </button>
          </div>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          {isMobileOrTabletShell && android ? (
            <>
              Ao tocar em <strong className="text-zinc-800 dark:text-zinc-300">Instalar agora</strong>, o Android pede para confirmar — o ícone passa a ficar na{' '}
              <strong className="text-zinc-800 dark:text-zinc-300">área inicial ou na gaveta</strong>, como nas outras apps. Isto{' '}
              <strong className="text-zinc-800 dark:text-zinc-300">não</strong> é login.
            </>
          ) : isMobileOrTabletShell ? (
            <>
              Ao tocar em <strong className="text-zinc-800 dark:text-zinc-300">Instalar agora</strong>, confirme no assistente do navegador. Isto{' '}
              <strong className="text-zinc-800 dark:text-zinc-300">não</strong> é login.
            </>
          ) : (
            <>
              Ao clicar em <strong className="text-zinc-800 dark:text-zinc-300">Instalar agora</strong>, o navegador abre um diálogo por cima desta página —
              confirme lá. Isso não é o mesmo que fazer login.
              {isWindowsDesktop() ? (
                <>
                  {' '}
                  No Windows, marque também <strong className="text-zinc-800 dark:text-zinc-300">atalho na área de trabalho</strong> e{' '}
                  <strong className="text-zinc-800 dark:text-zinc-300">barra de tarefas</strong> se o assistente mostrar — senão o ícone pode ficar só no Menu
                  Iniciar.
                </>
              ) : null}
            </>
          )}
        </p>
      </div>
    </div>
  );
}
