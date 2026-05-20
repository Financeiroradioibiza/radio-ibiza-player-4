/**
 * Convite à instalação PWA quando o browser dispara `beforeinstallprompt` (Chrome/Edge).
 * Sem instruções estáticas de menu — mudam por versão/OS e geram confusão.
 * Texto e dicas: desktop (Windows/Mac) vs telemóvel/tablet (Android/iOS) — alinhado a `isIbizaPwaTouchOsClient`.
 */

import { useCallback, useEffect, useState } from 'react';
import { isIbizaPwaTouchOsClient } from '@/api/config';

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
  const isMobileOrTabletShell = isIbizaPwaTouchOsClient();
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
        <div className="rounded-2xl border border-emerald-300/80 bg-emerald-50/95 px-4 py-3 text-sm text-emerald-950 shadow-panel dark:border-emerald-800/50 dark:bg-emerald-950/35 dark:text-emerald-100/95">
          <p className="font-semibold text-emerald-900 dark:text-emerald-200">Instalação concluída</p>
          {isMobileOrTabletShell ? (
            <p className="mt-1.5 text-xs leading-relaxed text-emerald-900/90 dark:text-emerald-100/80">
              O atalho deve aparecer no ecrã inicial ou na lista de apps. Se não vir, abra o menu do Chrome (<strong className="text-emerald-950 dark:text-emerald-200">⋮</strong>)
              e confira <strong className="text-emerald-950 dark:text-emerald-200">Instalar aplicação</strong> ou o ícone{' '}
              <strong className="text-emerald-950 dark:text-emerald-200">⊕</strong> na barra de endereços. Pode fechar esta aba e usar só o atalho — a
              reprodução continua na app instalada.
            </p>
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
                (Edge). Tecla <kbd className="rounded border border-emerald-300/90 bg-emerald-100/90 px-1 font-mono text-[10px] text-emerald-950 dark:border-emerald-700/60 dark:text-emerald-100">Win</kbd> e
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
            Se fechou o aviso do navegador, clique no ícone <strong className="text-amber-950 dark:text-amber-200">⊕</strong> ou em{' '}
            <strong className="text-amber-950 dark:text-amber-200">Instalar app</strong> à direita da barra de endereços e confirme de novo. O player
            pode continuar tocando na mesma aba enquanto isso — a instalação é independente da música.
            {isMobileOrTabletShell ? (
              <>
                {' '}
                No Android, tente de novo pelo menu do Chrome (<strong className="text-amber-950 dark:text-amber-200">⋮</strong>) →{' '}
                <strong className="text-amber-950 dark:text-amber-200">Instalar aplicação</strong> ou pelo ícone{' '}
                <strong className="text-amber-950 dark:text-amber-200">⊕</strong> na barra de endereços.
              </>
            ) : isWindowsDesktop() ? (
              <>
                {' '}
                Se mesmo assim <strong className="text-amber-950 dark:text-amber-200">não aparecer</strong> «Radio Ibiza» ao pressionar a tecla Win e
                pesquisar, o app <strong className="text-amber-950 dark:text-amber-200">não foi instalado</strong> — repita o ⊕ na aba do login (Chrome ou
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
      <div className="rounded-2xl border border-ibiza-magenta/35 bg-gradient-to-br from-white/95 via-zinc-50/95 to-ibiza-purple/8 px-4 py-3 text-sm text-zinc-700 shadow-ibiza-pop backdrop-blur-sm dark:from-zinc-950/85 dark:via-zinc-900/70 dark:to-ibiza-purple/10 dark:text-zinc-300">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold">
            <span className="bg-gradient-to-r from-ibiza-magenta to-ibiza-lemon bg-clip-text text-transparent">
              {isMobileOrTabletShell ? 'Adicionar à tela inicial' : 'Instalar no computador'}
            </span>
            <span className="ml-2 font-normal text-zinc-500">
              {isMobileOrTabletShell ? '— atalho como app, ecrã próprio.' : '— atalho e janela própria.'}
            </span>
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
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
          {isMobileOrTabletShell ? (
            <>
              Ao clicar em <strong className="text-zinc-800 dark:text-zinc-400">Instalar agora</strong>, o Chrome mostra o convite para adicionar o atalho —
              confirme lá. Isto <strong className="text-zinc-800 dark:text-zinc-400">não</strong> é o mesmo que fazer login. Depois pode abrir sempre pelo
              ícone no telemóvel (ou use a app da loja, se já a tiver).
            </>
          ) : (
            <>
              Ao clicar em <strong className="text-zinc-800 dark:text-zinc-400">Instalar agora</strong>, o navegador abre um diálogo por cima desta página —
              confirme lá. Isso não é o mesmo que fazer login.
              {isWindowsDesktop() ? (
                <>
                  {' '}
                  No Windows, marque também <strong className="text-zinc-800 dark:text-zinc-400">atalho na área de trabalho</strong> e{' '}
                  <strong className="text-zinc-800 dark:text-zinc-400">barra de tarefas</strong> se o assistente mostrar — senão o ícone pode ficar só no Menu
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
