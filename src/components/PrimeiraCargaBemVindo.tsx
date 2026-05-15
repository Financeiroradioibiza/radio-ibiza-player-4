/**
 * Conteúdo da etapa «Bem-vindo» — primeira descarga de programação (rota dedicada, sem o cartão do player).
 */

import { IBIZA_SHELL_VERSION, PACKAGE_VERSION, VERSAO_PLAYER } from '@/api/config';

const WHATSAPP_BOTOES_CONTATO: ReadonlyArray<{ label: string; waMe: string }> = [
  { label: 'Suporte', waMe: '5521997595141' },
  { label: 'Financeiro', waMe: '5521998314822' },
  { label: 'Atendimento', waMe: '5521997040227' },
];

export type PrimeiraCargaBemVindoProps = {
  midiaDownload: { done: number; total: number } | null;
  busy: boolean;
  erroSinc: string | null;
  onRefetch: () => void;
  onSair: () => void;
  /** Último instante antes de navegar para o player — utilizador vê que terminou. */
  prontoParaAbrirPlayer?: boolean;
};

export function PrimeiraCargaBemVindo({
  midiaDownload,
  busy,
  erroSinc,
  onRefetch,
  onSair,
  prontoParaAbrirPlayer = false,
}: PrimeiraCargaBemVindoProps) {
  return (
    <div
      className="w-full max-w-md overflow-y-auto rounded-2xl border border-ibiza-magenta/35 bg-zinc-950 px-5 py-8 shadow-[0_28px_70px_rgba(0,0,0,0.72)] ring-1 ring-white/10 sm:px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="primeira-carga-titulo"
      aria-busy={busy && erroSinc == null && !prontoParaAbrirPlayer ? 'true' : 'false'}
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
      ) : prontoParaAbrirPlayer ? (
        <div className="mt-6 flex flex-col items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-600/50 bg-emerald-900/30 text-2xl font-bold text-emerald-300"
            aria-hidden
          >
            ✓
          </div>
          <p className="text-center text-sm leading-relaxed text-zinc-300">
            Músicas e programação guardadas neste aparelho. O player abre em instantes.
          </p>
        </div>
      ) : midiaDownload ? (
        <>
          <p className="mt-3 text-center text-sm leading-relaxed text-zinc-400">
            Estamos baixando toda a programação para a memória deste aparelho. Quando a barra completar, abrimos o
            player nesta mesma janela (o sistema pode pedir um toque para liberar o som).
          </p>
          <div className="mt-8 w-full">
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
        </>
      ) : (
        <>
          <div className="mx-auto mt-6 flex justify-center">
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
      )}

      <p className="mt-6 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-center font-mono text-[10px] leading-relaxed text-zinc-500">
        Cópia instalada: shell {IBIZA_SHELL_VERSION} · app {PACKAGE_VERSION} · ping {VERSAO_PLAYER}
        <br />
        <span className="text-zinc-600">
          Confira se «shell» bate com o ficheiro <span className="text-zinc-500">/version.json</span> do site (PWA).
          Cache antiga: apague dados do site ou desinstale o PWA.
        </span>
      </p>
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
    </div>
  );
}
