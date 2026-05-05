/**
 * Botão fixo só com `VITE_DEBUG_REDE` no build (teste Netlify).
 */

import { useState } from 'react';
import { DEBUG_REDE } from '@/api/config';
import { copiarDiagnostico } from '@/debug/redeDiag';

export function DebugDiagFloating() {
  const [toast, setToast] = useState<string | null>(null);

  if (!DEBUG_REDE) return null;

  async function handleCopy() {
    const ok = await copiarDiagnostico();
    setToast(ok ? 'Diagnóstico copiado (ctrl+V no chat).' : 'Clipboard bloqueado; use permissão ou HTTPS.');
    window.setTimeout(() => setToast(null), 6500);
  }

  return (
    <div className="fixed bottom-3 left-3 z-[9999] max-w-[min(100vw-1.5rem,20rem)]">
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="rounded border border-amber-600/70 bg-zinc-900/95 px-2.5 py-1.5 text-left text-[11px] font-medium text-amber-100 shadow-lg backdrop-blur-sm hover:bg-zinc-800/95"
      >
        Copiar diagnóstico (modo teste)
      </button>
      {toast && (
        <p className="mt-1.5 rounded border border-zinc-700 bg-zinc-950/95 px-2 py-1 text-[10px] leading-snug text-zinc-400">
          {toast}
        </p>
      )}
    </div>
  );
}
