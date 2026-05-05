/**
 * Histórico em memória dos logs `[ibiza-rede]` só quando `DEBUG_REDE` está ligado.
 * Botão «Copiar diagnóstico» cola texto seguro pra suporte — sem corpo POST.
 */

import { DEBUG_REDE, VERSAO_PLAYER } from '../api/config';

const MAX_LINES = 400;
/** Última linhas (formato já seguro antes de entrar aqui). */
const lines: string[] = [];

function push(line: string) {
  lines.push(line);
  if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
}

function formatoPart(p: unknown): string {
  if (p instanceof Error) return p.message.slice(0, 500);
  if (typeof p === 'string') return p;
  try {
    const s = JSON.stringify(p);
    return s.length > 400 ? `${s.slice(0, 397)}…` : s;
  } catch {
    return String(p);
  }
}

/**
 * Echo no console + grava uma linha com timestamp ISO (só em modo teste).
 */
export function redeTrace(
  tag: string,
  level: 'info' | 'warn' | 'error',
  ...parts: unknown[]
): void {
  if (!DEBUG_REDE) return;
  const tail = parts.map(formatoPart).join(' ');
  const line = `[${new Date().toISOString()}] [${tag}] ${tail}`;
  push(line);

  const fn =
    level === 'info'
      ? console.info.bind(console)
      : level === 'warn'
        ? console.warn.bind(console)
        : console.error.bind(console);
  fn(`[${tag}]`, ...parts);
}

export function textoDiagnosticoParaClipboard(): string {
  const head = [
    '=== Radio Ibiza Player 4 · diagnóstico de TESTE ===',
    `versao_player_webservice: ${VERSAO_PLAYER}`,
    `url: ${typeof window !== 'undefined' ? window.location.href : ''}`,
    `onLine: ${typeof navigator !== 'undefined' ? navigator.onLine : '?'}`,
    '--- registros abaixo (truncado por tempo; não publicar texto completo na internet) ---',
    '',
  ].join('\n');
  const body = lines.length ? lines.join('\n') : '(ainda não há registros esta sessão)';
  const foot =
    '\n\n--- fim ---\nPara suporte técnico: cole este texto no chat mantendo só o necessário.';
  return head + body + foot;
}

export async function copiarDiagnostico(): Promise<boolean> {
  const t = textoDiagnosticoParaClipboard();
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    return false;
  }
}
