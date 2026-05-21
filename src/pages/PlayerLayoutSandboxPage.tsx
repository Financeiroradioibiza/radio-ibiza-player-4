/**
 * Protótipos só para discussão visual — tema Ibiza escuro.
 * Dev: abra /sandbox/player-layouts Em build de produção a rota redireciona.
 */

import { useState } from 'react';

function FakeTransport({ compact }: { compact?: boolean }) {
  const circle = compact ? 'h-9 w-9' : 'h-11 w-11';
  return (
    <div className="flex items-center justify-center gap-3 sm:gap-4">
      <div className={`${circle} rounded-full border border-zinc-600/70 bg-black/35`} title="Retroceder (mock)" />
      <div
        className={
          compact
            ? 'flex h-12 w-12 items-center justify-center rounded-full border-2 border-ibiza-magenta/50 bg-black/45'
            : 'flex h-14 w-14 items-center justify-center rounded-full border-2 border-ibiza-magenta/50 bg-black/45'
        }
      >
        <span className="text-ibiza-magenta">▶</span>
      </div>
      <div className={`${circle} rounded-full border border-zinc-600/70 bg-black/35`} />
    </div>
  );
}

function OptionBadge({ label, tone }: { label: string; tone: 'gold' | 'magenta' | 'sky' }) {
  const c =
    tone === 'gold'
      ? 'border-amber-400/35 text-amber-200/95'
      : tone === 'magenta'
        ? 'border-ibiza-magenta/35 text-pink-200/95'
        : 'border-ibiza-sky/35 text-sky-200/95';
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${c}`}>{label}</span>
  );
}

/** A · Transporte sempre visível como barra inferior; arte “TOCANDO AGORA” em lista deslizante ou sheet (não no mock). */
function OptionDock() {
  return (
    <section className="flex flex-col rounded-2xl border border-white/10 bg-black/35 p-4 shadow-panel backdrop-blur-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <OptionBadge label="Opção A" tone="gold" />
          <h2 className="mt-1 text-sm font-bold text-white">Barra inferior (dock)</h2>
          <p className="mt-1 text-[11px] leading-snug text-zinc-400">
            Só uma faixa baixa fixa com play/pausa; faixa atual em linha curta ou um toque para abrir “detalhes”.
          </p>
        </div>
      </div>

      {/* Simula ecrã: conteúdo curto */}
      <div className="flex min-h-[180px] flex-1 flex-col rounded-xl border border-zinc-800/70 bg-zinc-950/65 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Área livre · loja / marca</p>
        <div className="flex flex-1 items-center justify-center text-xs text-zinc-600">…</div>
      </div>

      <div className="sticky bottom-0 -mx-1 -mb-1 mt-auto border-t border-white/10 bg-zinc-950/90 px-2 py-3">
        <div className="mb-2 flex justify-between gap-2 text-[10px] text-zinc-500">
          <span className="truncate">TOCANDO</span>
          <span className="shrink-0 tabular-nums">00:41</span>
        </div>
        <FakeTransport compact />
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <span className="rounded-md border border-ibiza-purple/25 px-2 py-1 text-[10px] text-purple-100/85">Playlists</span>
          <span className="rounded-md border border-amber-500/25 px-2 py-1 text-[10px] text-amber-100/85">Avisos</span>
          <span className="rounded-md border border-ibiza-sky/25 px-2 py-1 text-[10px] text-sky-100/85">Feedback</span>
        </div>
      </div>
    </section>
  );
}

/** B · Tudo dentro de uma “caixa” com altura máxima ~ metade da janela; interior rola. Tipografia clamp. */
function OptionCappedViewport() {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/35 p-4 shadow-panel backdrop-blur-sm">
      <div className="mb-3">
        <OptionBadge label="Opção B" tone="magenta" />
        <h2 className="mt-1 text-sm font-bold text-white">Cartão contenção + rolagem interna</h2>
        <p className="mt-1 text-[11px] leading-snug text-zinc-400">
          O player inteiro ganha{' '}
          <code className="rounded bg-zinc-800/80 px-1 text-[10px] text-zinc-300">max-h-[min(50dvh,…)]</code> e texto com{' '}
          <code className="rounded bg-zinc-800/80 px-1 text-[10px] text-zinc-300">clamp()</code>; com texto grande, rola lá
          dentro.
        </p>
      </div>

      <div className="mx-auto max-h-[min(280px,50dvh)] w-full overflow-y-auto overflow-x-hidden rounded-xl border border-zinc-800/70 bg-zinc-950/80 p-4">
        <p className="text-[clamp(0.625rem,0.85vw+0.45rem,0.875rem)] font-bold uppercase tracking-wider text-ibiza-magenta">
          Tocando agora
        </p>
        <p className="text-[clamp(0.8125rem,1.1vw+0.55rem,1.125rem)] font-semibold leading-snug text-zinc-100">
          Título da música ambiente bem longo para stressar texto grande
        </p>
        <p className="text-[clamp(0.6875rem,0.65vw+0.5rem,0.875rem)] text-zinc-400">Nome do artista</p>

        <div className="mt-4 rounded-lg border border-zinc-800/70 bg-black/35 p-4">
          <div className="mb-4 flex justify-center">
            <FakeTransport />
          </div>
          <div className="grid grid-cols-2 gap-2 text-[clamp(0.625rem,0.7vw+0.48rem,0.75rem)]">
            <div className="rounded-lg border border-white/10 bg-black/28 px-2 py-2 text-center font-medium text-zinc-200">
              Playlists
            </div>
            <div className="rounded-lg border border-white/10 bg-black/28 px-2 py-2 text-center font-medium text-zinc-200">
              Avisos
            </div>
            <div className="rounded-lg border border-white/10 bg-black/28 px-2 py-2 text-center font-medium text-zinc-200">
              Vinhetas
            </div>
            <div className="rounded-lg border border-white/10 bg-black/28 px-2 py-2 text-center font-medium text-zinc-200">
              Feedback
            </div>
          </div>
        </div>
        <p className="mt-4 text-[10px] text-zinc-600">Rodapé de sessão / avisos (continua a rolar dentro desta caixa).</p>
      </div>
    </section>
  );
}

/** C · Faixa lateral estreita (transport + atalhos) + subáreas tipo “painel atual” ocupando o resto (ou segunda aba). */
function OptionSplitThin() {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/35 p-4 shadow-panel backdrop-blur-sm">
      <div className="mb-3">
        <OptionBadge label="Opção C" tone="sky" />
        <h2 className="mt-1 text-sm font-bold text-white">Faixa lateral + conteúdo</h2>
        <p className="mt-1 text-[11px] leading-snug text-zinc-400">
          Coluna estreita com transporte + ícones/atalhos; painéis grandes (avisos) podem ocupar o restante ou mesmo
          outra aba.
        </p>
      </div>

      <div className="flex h-[260px] gap-2 rounded-xl border border-zinc-800/70 bg-zinc-950/70 p-2">
        <div className="flex w-[4.75rem] shrink-0 flex-col items-center gap-3 border-r border-white/5 py-3 pr-2">
          <div className="h-10 w-10 rounded-xl border border-ibiza-magenta/35 bg-black/35" />
          <FakeTransport compact />
          <div className="flex flex-col gap-1.5 pt-2">
            <div className="h-9 w-full rounded-lg border border-amber-400/35 bg-black/35" />
            <div className="h-9 w-full rounded-lg border border-purple-400/35 bg-black/35" />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col rounded-lg border border-white/5 bg-black/28 p-3">
          <p className="truncate text-[10px] uppercase tracking-wide text-zinc-500">Área atual</p>
          <p className="mt-1 text-xs font-semibold text-zinc-100">TOCANDO AGORA</p>
          <p className="mt-auto text-[10px] leading-snug text-zinc-600">
            Aqui ficaria só o essencial até abrir submenu (mesma página ou novo separador mesmo site).
          </p>
        </div>
      </div>
    </section>
  );
}

export default function PlayerLayoutSandboxPage() {
  const [textBoost, setTextBoost] = useState(false);

  return (
    <div className="min-h-full min-h-dvh overflow-y-auto bg-ibiza-shell text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
        <header className="mb-8 max-w-2xl border-b border-white/10 pb-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            Sandbox — não é o player real
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Três abordagens de player mais enxuto</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Isto só mostra proporções visuais. O player em produção não foi alterado. URLs:{' '}
            <code className="rounded bg-zinc-800/80 px-1.5 text-xs">/sandbox/player-layouts</code> ou{' '}
            <code className="rounded bg-zinc-800/80 px-1.5 text-xs">/dev/layouts</code>. Use o botão abaixo para simular
            texto do sistema maior (tipo acessibilidade).
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setTextBoost((v) => !v)}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ibiza-magenta/50 ${
                textBoost
                  ? 'border-ibiza-magenta/50 bg-ibiza-magenta/20 text-white'
                  : 'border-white/15 bg-black/35 text-zinc-200 hover:border-white/25'
              }`}
            >
              {textBoost ? 'Texto: simular 145% (ligado)' : 'Texto: simular 145% (desligado)'}
            </button>
            <a
              href="/player"
              className="rounded-xl border border-zinc-600/50 bg-black/25 px-4 py-2 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white"
            >
              Voltar ao fluxo · /player
            </a>
          </div>
        </header>

        <div
          className="grid gap-8 lg:grid-cols-3"
          style={textBoost ? { fontSize: '145%', lineHeight: 1.45 } : undefined}
        >
          <OptionDock />
          <OptionCappedViewport />
          <OptionSplitThin />
        </div>

        <p className="mt-10 max-w-prose rounded-xl border border-white/10 bg-black/35 p-4 text-xs leading-relaxed text-zinc-500">
          <strong className="text-zinc-400">Nota:</strong> PWA instalada em iPhone em geral não oferece janelas
          redimensionáveis como popup de desktop — abrir submenus como novas rotas/abas só no mesmo Chrome costuma funcionar,
          mas o tamanho da janela é do sistema.
        </p>
      </div>
    </div>
  );
}
