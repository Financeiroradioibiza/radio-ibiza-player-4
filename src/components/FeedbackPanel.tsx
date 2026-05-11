/**
 * Feedback do operador: envio via Netlify Forms → notificação por e-mail (configurar no painel Netlify).
 */

import { type FormEvent, useState } from 'react';

import { PlayerSubpanelChrome } from '@/components/PlayerSubpanelChrome';

/** Nome igual ao `<form name="...">` em index.html (precisa bater com o deploy). */
export const NETLIFY_FEEDBACK_FORM_NAME = 'player-feedback';

export const FEEDBACK_TEXTO_MAX = 1800;

type Props = {
  onClose: () => void;
  clienteNome?: string;
  clienteId?: number;
  pdvNome?: string;
  pdvId?: number;
  /** Substitui a área principal do player (altura total + rolagem interna). */
  layout?: 'inline' | 'overlay';
};

function montarCorpoParaCopiar(
  texto: string,
  ctx: Omit<Props, 'onClose'>,
): string {
  const meta: string[] = [];
  if (ctx.clienteNome?.trim() || ctx.clienteId != null) {
    meta.push(
      `Cliente: ${ctx.clienteNome?.trim() || '—'}${ctx.clienteId != null ? ` (id ${ctx.clienteId})` : ''}`,
    );
  }
  if (ctx.pdvNome?.trim() || ctx.pdvId != null) {
    meta.push(`PDV: ${ctx.pdvNome?.trim() || '—'}${ctx.pdvId != null ? ` (id ${ctx.pdvId})` : ''}`);
  }

  const bloco = ['*Feedback — Player Radio Ibiza*', '', ...meta, '---', texto.trim()].join('\n');
  return bloco.replace(/\n{3,}/g, '\n\n');
}

export function FeedbackPanel({
  onClose,
  clienteNome,
  clienteId,
  pdvNome,
  pdvId,
  layout = 'inline',
}: Props) {
  const [texto, setTexto] = useState('');
  const [busy, setBusy] = useState(false);
  const [enviadoOk, setEnviadoOk] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function copiarFallback(corpo: string) {
    try {
      await navigator.clipboard.writeText(corpo);
      setErro(null);
    } catch {
      setErro('Não foi possível copiar. Selecione o texto manualmente.');
    }
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviadoOk(false);

    const t = texto.trim();
    if (t.length < 5) {
      setErro('Escreva um feedback com pelo menos 5 caracteres.');
      return;
    }

    if (import.meta.env.DEV) {
      setErro(
        'O envio pelo Netlify só funciona no site publicado (não no servidor local do Vite). Use «Copiar mensagem» ou teste após o deploy.',
      );
      return;
    }

    setBusy(true);
    try {
      const nomeClienteEnvio = clienteNome?.trim() || '—';
      const nomePdvEnvio = pdvNome?.trim() || '—';

      const body = new URLSearchParams({
        'form-name': NETLIFY_FEEDBACK_FORM_NAME,
        nome_cliente: nomeClienteEnvio,
        nome_pdv: nomePdvEnvio,
        mensagem: t,
        'feedback-bot-field': '',
      });

      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!res.ok) {
        throw new Error('http');
      }

      setEnviadoOk(true);
      setTexto('');
    } catch {
      setErro(
        'Não foi possível enviar agora. Tente de novo em instantes ou use «Copiar mensagem» e envie pelo canal que preferir.',
      );
    } finally {
      setBusy(false);
    }
  }

  const corpoPreview =
    texto.trim().length >= 5 ? montarCorpoParaCopiar(texto, { clienteNome, clienteId, pdvNome, pdvId }) : '';

  const desabilitadoCampos = busy || enviadoOk;

  return (
    <PlayerSubpanelChrome
      titulo="Feedback"
      accent="sky"
      onClose={onClose}
      closeDisabled={busy}
      rootClassName={layout === 'overlay' ? 'flex h-full min-h-0 flex-col space-y-3' : undefined}
      bodyClassName={
        layout === 'overlay' ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5' : undefined
      }
    >
      <form className="space-y-3" onSubmit={(e) => void handleSubmit(e)}>
        <label className="block text-left">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-100">
            Mensagem
          </span>
          <textarea
            rows={4}
            value={texto}
            maxLength={FEEDBACK_TEXTO_MAX}
            disabled={desabilitadoCampos}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ex.: Sugestão de melhoria ou problema no tablet."
            className="w-full resize-y rounded-lg border border-zinc-700/80 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-400 focus:border-ibiza-sky/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-ibiza-sky/25 disabled:opacity-50"
          />
          <span className="mt-1 block text-[10px] leading-snug text-zinc-100">
            Até {FEEDBACK_TEXTO_MAX} caracteres · Cliente/PDV da sessão são enviados sem senha.
          </span>
        </label>

        {enviadoOk && (
          <p className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-3 py-2 text-[11px] text-emerald-100">
            Mensagem enviada. Obrigado ! Seu Feedback é muito importante para nós.
          </p>
        )}

        {erro && (
          <p className="rounded-lg border border-red-900/50 bg-red-950/25 px-3 py-2 text-[11px] text-red-100">
            {erro}
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="submit"
            disabled={texto.trim().length < 5 || desabilitadoCampos}
            className="flex min-h-[2.35rem] flex-1 items-center justify-center gap-2 rounded-lg border border-emerald-400/40 bg-gradient-to-r from-emerald-600/75 via-teal-600/65 to-emerald-700/58 px-3 py-2 text-[13px] font-bold text-white shadow-panel transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:min-w-[160px]"
          >
            {busy ? 'Enviando…' : 'Enviar'}
          </button>
          <button
            type="button"
            disabled={texto.trim().length < 5 || busy}
            onClick={() => void copiarFallback(corpoPreview)}
            className="rounded-lg border border-white/20 bg-gradient-to-r from-sky-600/55 via-cyan-600/45 to-teal-700/40 px-3 py-2 text-[13px] font-bold text-white shadow-ibiza-pop transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Copiar
          </button>
        </div>
      </form>
    </PlayerSubpanelChrome>
  );
}
