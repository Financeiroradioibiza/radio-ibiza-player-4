/**
 * Central de avisos operador (mensagens vermelhas no player).
 * Autenticação validada no servidor (variáveis IBIZA_AVISOS_* no Netlify).
 */

import { FormEvent, useCallback, useState } from 'react';

import { resolvePlayerAvisosAdminUrl } from '@/api/config';

type Row = { cliente_id: number; pdv_id: number; mensagem: string; atualizado_em: string };

function parseId(raw: string): number | null {
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function msgErroServidor(j: unknown): string {
  if (!j || typeof j !== 'object') return 'Resposta inválida.';
  const e = (j as { error?: unknown }).error;
  if (e === 'credenciais') return 'E-mail ou senha incorretos.';
  if (e === 'admin_not_configured') return 'Servidor sem credenciais configuradas (IBIZA_AVISOS_* no Netlify).';
  if (e === 'storage_falhou') return 'Armazenamento indisponível. Verifique Blobs no site Netlify.';
  if (typeof e === 'string') return e;
  return 'Operação falhou.';
}

export function AvisosOperadorAdminPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [logadoUi, setLogadoUi] = useState(false);
  const [clienteId, setClienteId] = useState('');
  const [pdvId, setPdvId] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const post = useCallback(async (body: Record<string, unknown>) => {
    const url = resolvePlayerAvisosAdminUrl();
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let j: unknown = null;
    try {
      j = await r.json();
    } catch {
      j = null;
    }
    return { r, j };
  }, []);

  const aplicarRows = (j: unknown) => {
    if (!j || typeof j !== 'object' || !('rows' in j)) {
      setRows([]);
      return;
    }
    const raw = (j as { rows: unknown }).rows;
    if (!Array.isArray(raw)) {
      setRows([]);
      return;
    }
    const out: Row[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const c = typeof o.cliente_id === 'number' ? o.cliente_id : Number(o.cliente_id);
      const p = typeof o.pdv_id === 'number' ? o.pdv_id : Number(o.pdv_id);
      const m = typeof o.mensagem === 'string' ? o.mensagem : '';
      const t = typeof o.atualizado_em === 'string' ? o.atualizado_em : '';
      if (!Number.isFinite(c) || !Number.isFinite(p) || !m.trim()) continue;
      out.push({ cliente_id: c, pdv_id: p, mensagem: m, atualizado_em: t });
    }
    setRows(out);
  };

  async function handleEntrar(ev: FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setFlash(null);
    try {
      const { r, j } = await post({ email, password, action: 'listar' });
      if (!r.ok || !j || typeof j !== 'object' || !(j as { ok?: boolean }).ok) {
        setFlash({ kind: 'err', text: msgErroServidor(j) });
        setLogadoUi(false);
        return;
      }
      aplicarRows(j);
      setLogadoUi(true);
      setFlash({ kind: 'ok', text: 'Sessão iniciada.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleAtivar(ev: FormEvent) {
    ev.preventDefault();
    const c = parseId(clienteId);
    const p = parseId(pdvId);
    const msg = mensagem.trim();
    if (c == null || p == null) {
      setFlash({ kind: 'err', text: 'Informe ID cliente e ID PDV válidos.' });
      return;
    }
    if (!msg) {
      setFlash({ kind: 'err', text: 'Escreva a mensagem antes de ativar.' });
      return;
    }
    setBusy(true);
    setFlash(null);
    try {
      const { r, j } = await post({
        email,
        password,
        action: 'ativar',
        cliente_id: c,
        pdv_id: p,
        mensagem: msg,
      });
      if (!r.ok || !j || typeof j !== 'object' || !(j as { ok?: boolean }).ok) {
        setFlash({ kind: 'err', text: msgErroServidor(j) });
        return;
      }
      aplicarRows(j);
      setMensagem('');
      setFlash({ kind: 'ok', text: 'Mensagem publicada.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleApagar() {
    const c = parseId(clienteId);
    const p = parseId(pdvId);
    if (c == null || p == null) {
      setFlash({ kind: 'err', text: 'Informe ID cliente e ID PDV para apagar.' });
      return;
    }
    setBusy(true);
    setFlash(null);
    try {
      const { r, j } = await post({
        email,
        password,
        action: 'apagar',
        cliente_id: c,
        pdv_id: p,
      });
      if (!r.ok || !j || typeof j !== 'object' || !(j as { ok?: boolean }).ok) {
        setFlash({ kind: 'err', text: msgErroServidor(j) });
        return;
      }
      aplicarRows(j);
      setFlash({ kind: 'ok', text: 'Mensagens desse cliente/PDV removidas.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-zinc-950 px-4 py-8 text-zinc-100">
      <div className="mx-auto w-full max-w-lg space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Central de avisos — player</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Publica mensagens vermelhas no player (após o ping ao servidor). Use os IDs numéricos de cliente e PDV
            iguais aos do painel.
          </p>
        </div>

        {flash ? (
          <div
            className={
              flash.kind === 'ok'
                ? 'rounded-xl border border-emerald-800/60 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-100'
                : 'rounded-xl border border-red-800/60 bg-red-950/40 px-3 py-2 text-sm text-red-100'
            }
            role="status"
          >
            {flash.text}
          </div>
        ) : null}

        <form onSubmit={handleEntrar} className="space-y-3 rounded-2xl border border-white/10 bg-zinc-900/50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Acesso</p>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="E-mail"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
          />
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Senha"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-ibiza-magenta px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? '…' : 'Entrar e listar'}
          </button>
        </form>

        <form onSubmit={handleAtivar} className="space-y-3 rounded-2xl border border-white/10 bg-zinc-900/50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Nova mensagem</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              inputMode="numeric"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              placeholder="ID cliente"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
            />
            <input
              inputMode="numeric"
              value={pdvId}
              onChange={(e) => setPdvId(e.target.value)}
              placeholder="ID PDV"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
            />
          </div>
          <textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Texto exibido em vermelho no player"
            rows={4}
            maxLength={2000}
            className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy || !logadoUi}
              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Ativar
            </button>
            <button
              type="button"
              disabled={busy || !logadoUi}
              onClick={() => void handleApagar()}
              className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Apagar mensagens deste par
            </button>
          </div>
          {!logadoUi ? (
            <p className="text-xs text-amber-200/90">Entre acima para publicar ou apagar.</p>
          ) : null}
        </form>

        {logadoUi && rows.length > 0 ? (
          <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Ativas ({rows.length})</p>
            <ul className="mt-3 max-h-[min(50vh,420px)] space-y-2 overflow-y-auto text-sm">
              {rows.map((row, i) => (
                <li key={`${row.cliente_id}-${row.pdv_id}-${row.atualizado_em}-${i}`} className="rounded-lg bg-black/25 px-3 py-2">
                  <span className="font-mono text-xs text-zinc-500">
                    c{row.cliente_id} · pdv{row.pdv_id}
                  </span>
                  <p className="mt-1 text-zinc-200">{row.mensagem}</p>
                  <p className="mt-1 text-[10px] text-zinc-600">{row.atualizado_em}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="text-center text-[11px] text-zinc-600">
          <a href="/" className="text-sky-400 underline-offset-2 hover:underline">
            Voltar ao player
          </a>
        </p>
      </div>
    </div>
  );
}
