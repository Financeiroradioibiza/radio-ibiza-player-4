import { IBIZA_TARGET } from '@/api/config';

/** Cache populado pelo player para MP3 — não apagar ao renovar o shell. */
const AUDIO_CACHE_NAME = 'radio-ibiza-audio-v1';

const LS_LAST_SHELL_DAY = 'radio_ibiza_shell_check_day';

let updateEmAndamento = false;
let ultimaVerificacaoMs = 0;

/** Evita dois GET em sequência (abertura + ping imediato). */
const INTERVALO_MIN_ENTRE_CHECKS_MS = 45_000;

/**
 * Compara versões tipo `4.0.0000` (três segmentos numéricos, micro no terceiro).
 * Qualquer formato inválido devolve `NaN`.
 */
export function compararVersaoShell(minha: string, outra: string): number {
  const a = minha.trim().split('.');
  const b = outra.trim().split('.');
  if (a.length !== 3 || b.length !== 3) return NaN;
  for (let i = 0; i < 3; i++) {
    const na = parseInt(a[i]!, 10);
    const nb = parseInt(b[i]!, 10);
    if (Number.isNaN(na) || Number.isNaN(nb)) return NaN;
    if (na !== nb) return na - nb;
  }
  return 0;
}

export function shellRemotoMaisNovo(remoto: string, local: string): boolean {
  const c = compararVersaoShell(remoto, local);
  if (!Number.isNaN(c)) return c > 0;
  return remoto.trim() !== local.trim();
}

async function obterVersaoRemota(): Promise<string | null> {
  try {
    const res = await fetch('/version.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const body = (await res.json()) as { version?: unknown };
    return typeof body.version === 'string' ? body.version.trim() : null;
  } catch {
    return null;
  }
}

async function aplicarAtualizacaoShell(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== AUDIO_CACHE_NAME).map((k) => caches.delete(k)));
    }
  } catch {
    //
  }
  window.location.reload();
}

function hojeChaveLocal(): string {
  return new Date().toLocaleDateString('en-CA');
}

/**
 * Se o site tiver `version.json` com número maior que o do bundle, limpa SW caches
 * (exceto áudio) e recarrega. IndexedDB / músicas baixadas não são tocados.
 *
 * - `daily`: no máximo uma tentativa por dia civil (abrir de manhã).
 * - `ping`: junto ao ping bem-sucedido no player (no máximo a cada ~45s).
 */
export async function verificarAtualizacaoShell(opc: {
  versaoLocal: string;
  motivo: 'daily' | 'ping';
}): Promise<void> {
  if (import.meta.env.DEV) return;
  if (IBIZA_TARGET !== 'WEB') return;
  if (!('serviceWorker' in navigator)) return;
  if (updateEmAndamento) return;

  if (opc.motivo === 'daily') {
    try {
      if (localStorage.getItem(LS_LAST_SHELL_DAY) === hojeChaveLocal()) return;
    } catch {
      //
    }
  } else {
    const agora = Date.now();
    if (agora - ultimaVerificacaoMs < INTERVALO_MIN_ENTRE_CHECKS_MS) return;
  }

  ultimaVerificacaoMs = Date.now();

  const remoto = await obterVersaoRemota();
  if (!remoto) return;

  if (!shellRemotoMaisNovo(remoto, opc.versaoLocal)) {
    if (opc.motivo === 'daily') {
      try {
        localStorage.setItem(LS_LAST_SHELL_DAY, hojeChaveLocal());
      } catch {
        //
      }
    }
    return;
  }

  updateEmAndamento = true;
  await aplicarAtualizacaoShell();
}
