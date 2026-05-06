/**
 * Feedback do operador: texto livre enviado via WhatsApp (mesmo número de atendimento do player).
 */

import { type FormEvent, useState } from 'react';

/** Limite razoável para URL do wa.me (~4k caracteres codificados; margem por UTF-8). */
export const FEEDBACK_TEXTO_MAX = 1800;

type Props = {
  onClose: () => void;
  /** Somente dígitos E.164 sem + (ex.: 5521997595141). */
  whatsappWaMeDigits: string;
  clienteNome?: string;
  clienteId?: number;
  pdvNome?: string;
  pdvId?: number;
};

function montarCorpoFeedback(
  texto: string,
  ctx: Omit<Props, 'onClose' | 'whatsappWaMeDigits'>,
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
  whatsappWaMeDigits,
  clienteNome,
  clienteId,
  pdvNome,
  pdvId,
}: Props) {
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  async function copiarFallback(corpo: string) {
    try {
      await navigator.clipboard.writeText(corpo);
      setErro(null);
      onClose();
    } catch {
      setErro('Não foi possível copiar. Selecione o texto manualmente.');
    }
  }

  function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const t = texto.trim();
    if (t.length < 5) {
      setErro('Escreva um feedback com pelo menos 5 caracteres.');
      return;
    }

    const corpo = montarCorpoFeedback(t, {
      clienteNome,
      clienteId,
      pdvNome,
      pdvId,
    });
    const qs = encodeURIComponent(corpo).length;
    if (qs > 7500) {
      setErro('Texto longo demais para abrir automaticamente — use «Copiar mensagem».');
      return;
    }

    const wa = `https://wa.me/${whatsappWaMeDigits}?text=${encodeURIComponent(corpo)}`;
    window.open(wa, '_blank', 'noopener,noreferrer');
    onClose();
  }

  const corpoPreview = texto.trim().length >= 5
    ? montarCorpoFeedback(texto, { clienteNome, clienteId, pdvNome, pdvId })
    : '';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-4">
        <div>
          <h2 className="text-base font-semibold text-ibiza-sky/95">Feedback</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Descreva sugestões, bugs ou dúvidas. Ao enviar, abrimos o WhatsApp com o texto pronto —
            só confirme o envio no aplicativo ou na web.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Voltar ao player"
          className="rounded-xl border border-zinc-600/70 bg-zinc-950/80 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
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
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ex.: O botão pausar demorou a responder no tablet ou gostaria de filtrar vinhetas por horário."
            className="w-full resize-y rounded-xl border border-zinc-700/80 bg-black/40 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-ibiza-sky/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-ibiza-sky/25"
          />
          <span className="mt-1 block text-[11px] text-zinc-600">
            Até {FEEDBACK_TEXTO_MAX} caracteres · incluímos cliente/PDV da sessão no texto para agilizar o atendimento.
          </span>
        </label>

        {erro && (
          <p className="rounded-xl border border-red-900/50 bg-red-950/25 px-3 py-2 text-xs text-red-100">
            {erro}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={texto.trim().length < 5}
            className="flex min-h-[2.75rem] flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-600/70 bg-emerald-600/95 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:min-w-[200px]"
          >
            Abrir WhatsApp e enviar
          </button>
          <button
            type="button"
            disabled={texto.trim().length < 5}
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
