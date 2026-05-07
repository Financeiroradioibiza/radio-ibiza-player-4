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
        <div className="rounded-2xl border border-ibiza-magenta/35 bg-gradient-to-br from-zinc-950/85 via-zinc-900/70 to-ibiza-purple/10 px-4 py-4 text-sm text-zinc-300 shadow-ibiza-pop backdrop-blur-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-base font-bold">
                <span className="bg-gradient-to-r from-ibiza-magenta to-ibiza-lemon bg-clip-text text-transparent">
                  Instalar no computador
                </span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                O browser pode criar um atalho com ícone no ambiente de trabalho ou no menu
                Iniciar — o player abre como aplicação.
              </p>
            </div>
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

      <div className="rounded-2xl border border-white/10 bg-zinc-950/55 px-4 py-4 text-xs text-zinc-400 shadow-panel backdrop-blur-sm">
        <p className="font-bold text-zinc-200">Como pôr o ícone no ambiente de trabalho</p>
        <p className="mt-1 text-zinc-500">
          Em <strong className="text-zinc-400">Chrome</strong> e{' '}
          <strong className="text-zinc-400">Edge</strong>, o comando de instalar raramente fica logo no primeiro nível do
          menu ⋮ — costuma estar num submenu. Também vale em <strong className="text-zinc-400">Windows</strong> e{' '}
          <strong className="text-zinc-400">Mac</strong> (menus em português podem mudar um pouco entre versões).
        </p>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          <li>
            Primeiro olhe pela <strong className="text-zinc-300">barra de endereço</strong>: à direita do URL aparece um
            ícone de <strong className="text-zinc-300">instalar</strong> (⊕ ou monitor/computador pequeno) quando o Chrome
            considera esta página instalável como aplicação. É o caminho mais direto quando existe.
          </li>
          <li>
            Se não há ícone na barra, abra os <strong className="text-zinc-300">três pontos</strong> (⋮) e entre em{' '}
            <strong className="text-zinc-300">Transmitir, salvar e compartilhar</strong>{' '}
            <span className="text-zinc-600">(em algumas versões pode surgir como «Armazenar e compartilhar»).</span>{' '}
            No submenu, escolha por exemplo{' '}
            <strong className="text-zinc-300">Instalar página como aplicação…</strong>,{' '}
            <strong className="text-zinc-300">Instalar página como aplicativo…</strong> ou{' '}
            <strong className="text-zinc-300">Instalar [nome deste site]…</strong> e confira a opção de{' '}
            <strong className="text-zinc-300">atalho na área de trabalho</strong>{' '}
            <span className="text-zinc-600">(no Mac: Dock ou pasta Aplicações, conforme a caixa do browser).</span>
          </li>
          <li>
            <strong className="text-zinc-300">Edge:</strong> menu ⋮ →{' '}
            <strong className="text-zinc-300">Aplicações</strong> ou <strong className="text-zinc-300">Apps</strong> →{' '}
            <strong className="text-zinc-300">Instalar este site como aplicação</strong>{' '}
            <span className="text-zinc-600">(se estiver dentro de um submenu «Salvar e compartilhar», abra-o).</span>
          </li>
          <li>
            Não há um «comando oculto» no Chrome só para criar o ícone: ou o browser mostra instalador (botão aqui em cima,
            ícone na barra ou entrada no submenu acima), ou não considera esta página instalável neste momento. Como
            recurso universal no computador pode criar um <strong className="text-zinc-300">atalho manual</strong> ao URL
            do player — abre sempre no Chrome/Edge ao duplo-clique (não fica igual a app própria separada).
          </li>
          <li>
            Use sempre o <strong className="text-zinc-300">ícone novo</strong> que o próprio instalador criou ou o atalho
            que você guardou, para não abrir por engano dentro de vários separadores.
          </li>
        </ol>
      </div>
    </div>
  );
}
