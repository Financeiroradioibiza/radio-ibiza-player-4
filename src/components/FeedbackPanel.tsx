/**
 * Feedback do operador: envio via Netlify Forms → notificação por e-mail (configurar no painel Netlify).
 */

import { type FormEvent, useState } from 'react';

/** Nome igual ao `<form name="...">` em index.html (precisa bater com o deploy). */
export const NETLIFY_FEEDBACK_FORM_NAME = 'player-feedback';

export const FEEDBACK_TEXTO_MAX = 1800;

type Props = {
  onClose: () => void;
  clienteNome?: string;
  clienteId?: number;
  pdvNome?: string;
  pdvId?: number;
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

export function FeedbackPanel({ onClose, clienteNome, clienteId, pdvNome, pdvId }: Props) {
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-4">
        <div>
          <h2 className="text-base font-semibold text-ibiza-sky/95">Feedback</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Os envios são processados pela Netlify. Configure o alerta por e‑mail para{' '}
            <span className="font-mono text-zinc-400">feedback@radioibiza.com.br</span> no painel do site
            (Forms → notificações). Campos: nome do cliente, nome do PDV e mensagem — sem dados de login.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Voltar ao player"
          className="rounded-xl border border-zinc-600/70 bg-zinc-950/80 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Voltar ao player
        </button>
      </div>

      <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
        <label className="block text-left">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Sua mensagem
          </span>
          <textarea
            rows={8}
            value={texto}
            maxLength={FEEDBACK_TEXTO_MAX}
            disabled={desabilitadoCampos}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ex.: O botão pausar demorou a responder no tablet ou gostaria de filtrar vinhetas por horário."
            className="w-full resize-y rounded-xl border border-zinc-700/80 bg-black/40 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-ibiza-sky/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-ibiza-sky/25 disabled:opacity-50"
          />
          <span className="mt-1 block text-[11px] text-zinc-600">
            Até {FEEDBACK_TEXTO_MAX} caracteres · Cliente e PDV da sessão são enviados junto (sem senha nem token).
          </span>
        </label>

        {enviadoOk && (
          <p className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-100">
            Obrigado — recebemos sua mensagem. Em breve alguém da equipe pode responder pelo e‑mail cadastrado
            nas notificações do formulário (ex.: feedback@radioibiza.com.br).
          </p>
        )}

        {erro && (
          <p className="rounded-xl border border-red-900/50 bg-red-950/25 px-3 py-2 text-xs text-red-100">
            {erro}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={texto.trim().length < 5 || desabilitadoCampos}
            className="flex min-h-[2.75rem] flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-600/70 bg-emerald-600/95 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:min-w-[200px]"
          >
            {busy ? 'Enviando…' : 'Enviar feedback'}
          </button>
          <button
            type="button"
            disabled={texto.trim().length < 5 || busy}
            onClick={() => void copiarFallback(corpoPreview)}
            className="rounded-xl border border-zinc-600/70 bg-zinc-950/80 px-4 py-2.5 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Copiar mensagem
          </button>
        </div>
      </form>
    </div>
  );
}
