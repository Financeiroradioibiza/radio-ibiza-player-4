/**
 * Painel opcional na primeira carga — só aparece quando o modo rede diagnóstico está activo:
 * URL `?debug_rede=1`, `radio_ibiza_debug_rede` em session/localStorage ou `VITE_DEBUG_REDE=1` na build.
 * Mostra flags de prefetch/CORS compiladas e últimas tentativas de `fetch`
 * (`token` omitido por defeito). Com **`?debug_prefetch_token=1`** (+ rede debug activo): query completa.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { isDebugRedeEnabled } from '@/api/config';
import {
  prefetchCorsDiagMostrarTokenCompleto,
  prefetchCorsDiagSubscribe,
  prefetchCorsDiagTextoCabecalhoELog,
  prefetchCorsDiagUltimasLinhas,
} from '@/debug/prefetchCorsDiag';
import { musicaPrefetchDiagDoBuild } from '@/utils/audioUrl';

export function PrimeiraCargaPrefetchCorsDebugPanel() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!isDebugRedeEnabled()) return;
    const onTokenMode = () => setTick((n) => n + 1);
    window.addEventListener('radio-ibiza-diag-prefetch-token', onTokenMode);
    const unsub = prefetchCorsDiagSubscribe(() => setTick((n) => n + 1));
    return () => {
      window.removeEventListener('radio-ibiza-diag-prefetch-token', onTokenMode);
      unsub();
    };
  }, []);

  const flags = useMemo(() => musicaPrefetchDiagDoBuild(), [tick]);

  const linhasUi = prefetchCorsDiagUltimasLinhas();

  const copiar = useCallback(async () => {
    const texto = prefetchCorsDiagTextoCabecalhoELog({
      shell: flags.ibizaShellVersion,
      log_token_completo: prefetchCorsDiagMostrarTokenCompleto() ? '1' : '0',
      vite_dev_compilacao: flags.viteDevCompilacao ? '1' : '0',
      force_proxy_musica: flags.forceIbizaMusicaProxy ? '1' : '0',
      prefetch_cloud_direct_first: flags.cloudDirectFirst ? '1' : '0',
      skip_fallback_netlify: flags.skipNetlifyPrefetchFallbackEfectivo ? '1' : '0',
      path: typeof window !== 'undefined' ? window.location.pathname : '',
    });
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      /* Fallback */
      try {
        const ta = document.createElement('textarea');
        ta.value = texto;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        //
      }
    }
  }, [flags]);

  if (!isDebugRedeEnabled()) return null;

  return (
    <section
      className="mt-4 rounded-xl border border-amber-700/55 bg-amber-950/[0.2] px-3 py-2.5 ring-1 ring-amber-500/30"
      aria-label="Diagnóstico de prefetch música (somente modo debug)"
    >
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
        Debug prefetch MP3 · CORS
      </p>
      <p className="mt-1 text-[10px] leading-relaxed text-amber-900/95 dark:text-amber-100/88">
        Rede debug:{' '}
        <code className="rounded bg-black/15 px-0.5 text-[10px]">?debug_rede=1</code> ou{' '}
        <code className="rounded bg-black/15 px-0.5 text-[10px]">radio_ibiza_debug_rede=1</code>. Para colar URLs com{' '}
        <strong className="font-semibold">token completo</strong> nos testes entre equipa, acrescente também{' '}
        <code className="rounded bg-black/15 px-0.5 text-[10px]">&amp;debug_prefetch_token=1</code>.
      </p>
      {prefetchCorsDiagMostrarTokenCompleto() ? (
        <p className="mt-2 rounded-lg border border-red-500/60 bg-red-950/30 px-2 py-1 text-[10px] font-semibold leading-relaxed text-red-100">
          Token completo visível nos logs copiados — não partilhe fora da equipa.
        </p>
      ) : null}
      <dl className="mt-2 grid grid-cols-1 gap-0.5 text-[10px] text-zinc-800 dark:text-zinc-200 sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-zinc-500 dark:text-zinc-400">Shell</dt>
          <dd className="font-mono tabular-nums">{flags.ibizaShellVersion}</dd>
        </div>
        <div>
          <dt className="font-semibold text-zinc-500 dark:text-zinc-400">DIRECT_FIRST</dt>
          <dd className="font-mono">{flags.cloudDirectFirst ? '1' : '0'}</dd>
        </div>
        <div>
          <dt className="font-semibold text-zinc-500 dark:text-zinc-400">SKIP_NETLIFY_FB</dt>
          <dd className="font-mono">{flags.skipNetlifyPrefetchFallbackEfectivo ? '1' : '0'}</dd>
        </div>
        <div>
          <dt className="font-semibold text-zinc-500 dark:text-zinc-400">FORCE_PROXY</dt>
          <dd className="font-mono">{flags.forceIbizaMusicaProxy ? '1' : '0'}</dd>
        </div>
      </dl>
      <button
        type="button"
        className="mt-2 rounded-lg border border-amber-800/70 bg-amber-200/95 px-2 py-1 text-[11px] font-bold text-amber-950 hover:bg-amber-100 dark:border-amber-500/50 dark:bg-amber-950/55 dark:text-amber-100 dark:hover:bg-amber-900/65"
        onClick={() => void copiar()}
      >
        Copiar log prefetch + flags
      </button>
      <pre
        className="mt-2 max-h-40 overflow-auto rounded-lg border border-amber-900/40 bg-black/80 px-2 py-1.5 text-[9px] leading-snug text-amber-100/95"
        key={tick}
      >
        {linhasUi.map((x, i) => (
          <div key={`${x.iso}_${i}_${x.msg.length}`} className="whitespace-pre-wrap break-all">
            {x.iso.slice(11, 23)} {x.msg}
          </div>
        ))}
      </pre>
    </section>
  );
}
