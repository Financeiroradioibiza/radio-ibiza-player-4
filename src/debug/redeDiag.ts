/**
 * Histórico em memória dos logs `[ibiza-rede]` quando isDebugRedeEnabled().
 * Botão «Copiar diagnóstico» cola texto seguro pra suporte — sem corpo POST.
 */

import {
  IBIZA_SHELL_VERSION,
  isDebugRedeEnabled,
  redactUrlForLog,
  VERSAO_PLAYER,
} from '../api/config';

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
  if (!isDebugRedeEnabled()) return;
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

/**
 * URL da página corrente para o diagnóstico, com token (se algum dia aparecer no
 * query string) mascarado via `redactUrlForLog`. Hoje o token só vive em
 * IndexedDB / proxy server-side e a URL do browser não carrega segredos, mas
 * isto é defesa preventiva caso uma rota futura adicione `?token=...`
 * — auditoria externa 2026-05-13 (§11.4).
 */
function urlSeguraParaDiagnostico(): string {
  if (typeof window === 'undefined') return '';
  try {
    const u = new URL(window.location.href);
    return `${u.origin}${redactUrlForLog(u)}`;
  } catch {
    return '';
  }
}

export function textoDiagnosticoParaClipboard(): string {
  const head = [
    '=== Radio Ibiza Player 4 · diagnóstico de TESTE ===',
    `versao_player_webservice: ${VERSAO_PLAYER}`,
    `versao_shell_netlify: ${IBIZA_SHELL_VERSION}`,
    `url: ${urlSeguraParaDiagnostico()}`,
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
