/**
 * Conteúdo da etapa «Bem-vindo» — primeira descarga de programação (rota dedicada, sem o cartão do player).
 */

import { useEffect, useRef, useState } from 'react';

const WHATSAPP_BOTOES_CONTATO: ReadonlyArray<{ label: string; waMe: string }> = [
  { label: 'Suporte', waMe: '5521997595141' },
  { label: 'Financeiro', waMe: '5521998314822' },
  { label: 'Atendimento', waMe: '5521997040227' },
];

/** Telefone só dígitos, mín. 10 (ex.: DDD+número ou DDI+DDD+número). */
export function cadastroLojaTelefoneValido(raw: string): boolean {
  const d = raw.replace(/\D/g, '');
  return d.length >= 10;
}

/** E-mail simples — alinha com HTML5 sem ser pedante. */
export function cadastroLojaEmailValido(raw: string): boolean {
  const t = raw.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

export type PrimeiraCargaBemVindoProps = {
  midiaDownload: { done: number; total: number } | null;
  busy: boolean;
  erroSinc: string | null;
  onRefetch: () => void;
  onSair: () => void;
  pdvNome?: string | null;
  /** Programação já gravada localmente; falta o operador confirmar o formulário. */
  downloadConcluido: boolean;
  /** Operador confirmou dados — breve ecrã antes de `navigate('/player')`. */
  cadastroConfirmado: boolean;
  onCadastroLojaConfirmado: () => void;
};

type CadastroLojaFormProps = {
  pdvNome: string | null | undefined;
  downloadConcluido: boolean;
  onConfirmar: () => void;
};

function CadastroLojaPrimeiraCargaForm({ pdvNome, downloadConcluido, onConfirmar }: CadastroLojaFormProps) {
  const [whatsappLoja, setWhatsappLoja] = useState('');
  const [emailLoja, setEmailLoja] = useState('');
  const [emailCobranca, setEmailCobranca] = useState('');
  const [tentouEnviar, setTentouEnviar] = useState(false);
  const blocoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!downloadConcluido || !blocoRef.current) return;
    blocoRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [downloadConcluido]);

  const nomePdv = pdvNome?.trim() || '';

  const waOk = cadastroLojaTelefoneValido(whatsappLoja);
  const emLojaOk = cadastroLojaEmailValido(emailLoja);
  const emCobOk = cadastroLojaEmailValido(emailCobranca);
  const formOk = waOk && emLojaOk && emCobOk;

  return (
    <div
      ref={blocoRef}
      id="primeira-carga-cadastro-loja"
      className="mt-6 rounded-xl border border-ibiza-lemon/30 bg-gradient-to-b from-ibiza-lemon/[0.06] to-transparent px-3.5 py-4 ring-1 ring-white/5"
    >
      <p className="text-center text-[10px] font-extrabold uppercase tracking-[0.2em] text-ibiza-lemon/90">
        Atualizar dados da loja
      </p>
      <p className="mt-1.5 text-center text-[11px] leading-relaxed text-zinc-400">
        {downloadConcluido
          ? 'Programação já está neste aparelho. Confirme os contatos para abrir o player.'
          : 'Para prosseguir, favor insira seus dados enquanto baixamos a programação musical.'}
      </p>

      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setTentouEnviar(true);
          if (!downloadConcluido) return;
          if (!formOk) return;
          onConfirmar();
        }}
      >
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">PDV</label>
          <div
            className="min-h-[2.5rem] rounded-lg border border-white/12 bg-black/35 px-3 py-2 text-sm font-semibold text-zinc-100"
            title="Nome vindo do cadastro / painel"
          >
            {nomePdv || '—'}
          </div>
        </div>

        <div>
          <label htmlFor="primeira-carga-whatsapp" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            <span className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded bg-ibiza-magenta/35 text-[10px] font-extrabold text-pink-200">
              1
            </span>
            Telefone WhatsApp da loja
          </label>
          <input
            id="primeira-carga-whatsapp"
            name="whatsapp_loja"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="Ex.: 5521999998888"
            value={whatsappLoja}
            onChange={(e) => setWhatsappLoja(e.target.value)}
            className="w-full rounded-lg border border-white/12 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-ibiza-lemon/45 focus:outline-none focus:ring-1 focus:ring-ibiza-lemon/30"
          />
          {tentouEnviar && !waOk ? (
            <p className="mt-0.5 text-[10px] text-red-400">Informe um telefone válido (mínimo 10 dígitos).</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="primeira-carga-email-loja" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            <span className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded bg-ibiza-magenta/35 text-[10px] font-extrabold text-pink-200">
              2
            </span>
            E-mail da loja
          </label>
          <input
            id="primeira-carga-email-loja"
            name="email_loja"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="contato@sualoja.com.br"
            value={emailLoja}
            onChange={(e) => setEmailLoja(e.target.value)}
            className="w-full rounded-lg border border-white/12 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-ibiza-lemon/45 focus:outline-none focus:ring-1 focus:ring-ibiza-lemon/30"
          />
          {tentouEnviar && !emLojaOk ? (
            <p className="mt-0.5 text-[10px] text-red-400">E-mail da loja inválido.</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="primeira-carga-email-cobranca" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            <span className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded bg-ibiza-magenta/35 text-[10px] font-extrabold text-pink-200">
              3
            </span>
            E-mail para envio de cobrança
          </label>
          <input
            id="primeira-carga-email-cobranca"
            name="email_cobranca"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="financeiro@sualoja.com.br"
            value={emailCobranca}
            onChange={(e) => setEmailCobranca(e.target.value)}
            className="w-full rounded-lg border border-white/12 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-ibiza-lemon/45 focus:outline-none focus:ring-1 focus:ring-ibiza-lemon/30"
          />
          {tentouEnviar && !emCobOk ? (
            <p className="mt-0.5 text-[10px] text-red-400">E-mail de cobrança inválido.</p>
          ) : null}
        </div>

        {!downloadConcluido ? (
          <p className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-center text-[11px] leading-relaxed text-amber-100/90">
            O botão só fica disponível quando o <strong className="font-semibold text-amber-50">download das músicas</strong> terminar.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!downloadConcluido}
          className={
            downloadConcluido
              ? 'mt-1 w-full rounded-xl bg-gradient-to-r from-ibiza-magenta via-ibiza-purple to-fuchsia-600 px-4 py-2.5 text-sm font-bold text-white shadow-ibiza-pop transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50'
              : 'mt-1 w-full cursor-not-allowed rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-zinc-500 opacity-70'
          }
        >
          Confirmar e abrir o player
        </button>
        <p className="text-center text-[10px] leading-relaxed text-zinc-600">
          Em breve os dados também serão enviados por e-mail (<span className="text-zinc-500">Netlify Forms</span>).
        </p>
      </form>
    </div>
  );
}

export function PrimeiraCargaBemVindo({
  midiaDownload,
  busy,
  erroSinc,
  onRefetch,
  onSair,
  pdvNome = null,
  downloadConcluido,
  cadastroConfirmado,
  onCadastroLojaConfirmado,
}: PrimeiraCargaBemVindoProps) {
  const aCarregarConteudo = !downloadConcluido && erroSinc == null;

  return (
    <div
      className="w-full max-w-md rounded-2xl border border-ibiza-magenta/35 bg-zinc-950 px-5 py-8 shadow-[0_28px_70px_rgba(0,0,0,0.72)] ring-1 ring-white/10 sm:px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="primeira-carga-titulo"
      aria-busy={cadastroConfirmado ? 'false' : aCarregarConteudo && busy ? 'true' : 'false'}
    >
      <p className="text-center text-xs font-bold uppercase tracking-[0.28em] text-ibiza-magenta/90">Rádio Ibiza</p>
      <h1
        id="primeira-carga-titulo"
        className="mt-2 text-center text-2xl font-extrabold tracking-tight text-zinc-50 sm:text-3xl"
      >
        Bem-vindo
      </h1>

      {erroSinc ? (
        <>
          <p className="mt-4 rounded-xl border border-red-900/60 bg-red-950/35 px-4 py-3 text-center text-sm text-red-200">
            {erroSinc}
          </p>
          <button
            type="button"
            onClick={() => onRefetch()}
            className="mt-5 w-full rounded-xl bg-gradient-to-r from-ibiza-magenta via-ibiza-purple to-fuchsia-600 px-4 py-2.5 text-sm font-bold text-white shadow-ibiza-pop transition hover:brightness-110"
          >
            Tentar novamente
          </button>
          <button
            type="button"
            onClick={() => onSair()}
            className="mt-3 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
          >
            Sair e entrar de novo
          </button>
        </>
      ) : cadastroConfirmado ? (
        <div className="mt-8 flex flex-col items-center gap-4">
          <div className="h-11 w-11 animate-spin rounded-full border-2 border-zinc-800 border-t-ibiza-lemon border-r-ibiza-magenta border-b-ibiza-purple" />
          <p className="text-center text-sm leading-relaxed text-zinc-300">A abrir o player…</p>
        </div>
      ) : (
        <>
          {!downloadConcluido && midiaDownload ? (
            <div className="mt-4 w-full">
              <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                <span>Baixando faixas</span>
                <span className="tabular-nums text-ibiza-lemon/90">
                  {midiaDownload.done} / {midiaDownload.total}
                </span>
              </div>
              <div className="mt-2 h-4 w-full overflow-hidden rounded-full border border-white/15 bg-black/50 shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-ibiza-magenta via-ibiza-purple to-ibiza-lemon transition-[width] duration-300 ease-out"
                  style={{
                    width:
                      midiaDownload.total > 0
                        ? `${Math.min(100, Math.round((midiaDownload.done / midiaDownload.total) * 100))}%`
                        : '0%',
                  }}
                />
              </div>
            </div>
          ) : !downloadConcluido ? (
            <>
              <div className="mx-auto mt-4 flex justify-center">
                <div className="h-11 w-11 animate-spin rounded-full border-2 border-zinc-800 border-t-ibiza-magenta border-r-ibiza-lemon border-b-ibiza-purple" />
              </div>
              <p className="mt-5 text-center text-sm text-zinc-300">Baixando programação e agendas…</p>
              <p className="mt-2 text-center text-xs text-zinc-600">Na primeira vez isto pode levar alguns instantes.</p>
              {busy ? (
                <p className="mt-4 text-center text-[11px] leading-relaxed text-zinc-500">
                  Mantenha esta aba em primeiro plano até concluir. Se instalou o aplicativo noutra janela, volte aqui — o
                  download corre só nesta etapa.
                </p>
              ) : null}
            </>
          ) : (
            <div className="mt-4 flex flex-col items-center gap-3">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-600/50 bg-emerald-900/30 text-2xl font-bold text-emerald-300"
                aria-hidden
              >
                ✓
              </div>
              <p className="text-center text-sm leading-relaxed text-zinc-300">
                Download concluído. Toque em <strong className="font-semibold text-zinc-100">Confirmar e abrir o player</strong>{' '}
                abaixo se ainda não confirmou os dados.
              </p>
            </div>
          )}

          <CadastroLojaPrimeiraCargaForm
            pdvNome={pdvNome}
            downloadConcluido={downloadConcluido}
            onConfirmar={onCadastroLojaConfirmado}
          />
        </>
      )}

      {!cadastroConfirmado && erroSinc == null ? (
        <>
          <p className="mt-8 text-center text-xs text-zinc-500">Dúvidas ou suporte — fale com a gente no WhatsApp.</p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {WHATSAPP_BOTOES_CONTATO.map((w) => (
              <a
                key={w.waMe}
                href={`https://wa.me/${w.waMe}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center rounded-xl border border-emerald-600/60 bg-emerald-700/25 px-2 py-2.5 text-center text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-600/35"
              >
                {w.label}
              </a>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
