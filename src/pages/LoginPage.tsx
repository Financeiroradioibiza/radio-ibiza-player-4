/**
 * Tela de login.
 *
 * Equivale a Login.as no player AS3 antigo.
 * Fluxo: email + senha → POST /login/ → recebe cliente_id → vai pra seleção de PDV.
 */

import { useState, type FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as ws from '../api/webservice';
import { useAppStore } from '../store/app';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const navigate = useNavigate();
  const setLoading = useAppStore((s) => s.setLoading);
  const setError = useAppStore((s) => s.setError);
  const clienteIdStore = useAppStore((s) => s.cliente_id);
  const tokenStore = useAppStore((s) => s.token);

  /** Sessão a meio (e-mail ok, falta PDV): não deixar preso na tela de login. */
  useEffect(() => {
    if (clienteIdStore != null && clienteIdStore > 0 && !tokenStore?.token) {
      navigate('/selecionar-pdv', { replace: true });
    }
  }, [clienteIdStore, tokenStore, navigate]);

  useEffect(() => {
    const m = useAppStore.getState().errorMessage;
    if (m) {
      setErro(m);
      setError(null);
    }
  }, [setError]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    setLoading(true);

    try {
      const resp = await ws.login(email.trim(), senha);
      const parsed = ws.parseLoginResponse(resp);

      if (parsed.ok) {
        await useAppStore.getState().persistirClienteAposLoginEmail(parsed.clienteId);
        navigate('/selecionar-pdv');
        return;
      }

      if (parsed.codigo === 'usuario_invalido') {
        setErro('E-mail ou senha incorretos.');
      } else if (parsed.codigo === 'metodo_invalido') {
        setErro('O servidor recusou o pedido. Recarregue a página e tente de novo.');
      } else if (parsed.codigo === 'resposta_desconhecida') {
        setErro(
          'Resposta inesperada do servidor ao entrar. Se já confirmou e-mail e senha, tente ?debug_rede=1 na URL e contacte o suporte.',
        );
      } else {
        setErro(`Não foi possível entrar (${parsed.codigo}). Contacte o suporte se o problema continuar.`);
      }
    } catch (err) {
      console.error('Erro no login:', err);
      setErro('Não foi possível conectar ao servidor. Tente novamente.');
    } finally {
      setEnviando(false);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-4 pb-10">
      <div className="w-full max-w-md">
        <div className="rounded-[1.35rem] bg-gradient-to-br from-ibiza-magenta/55 via-ibiza-purple/35 to-ibiza-lemon/25 p-px shadow-ibiza-pop">
          <div className="rounded-[1.3rem] border border-white/10 bg-zinc-950/75 p-8 shadow-panel backdrop-blur-md">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-ibiza-magenta/25 via-ibiza-purple/20 to-ibiza-sky/15 shadow-ibiza-pop">
              <img src="/icon.svg" alt="" className="h-10 w-10" width={40} height={40} />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-ibiza-magenta via-ibiza-lemon to-ibiza-sky bg-clip-text text-transparent">
                Radio Ibiza
              </span>
            </h1>
            <p className="mt-1.5 text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">Player 4.0</p>
          </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Login
            </label>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={enviando}
              className="w-full rounded-xl border border-zinc-700/80 bg-black/30 px-4 py-2.5 text-zinc-100 outline-none ring-0 transition placeholder:text-zinc-600 focus:border-ibiza-magenta/55 focus:ring-2 focus:ring-ibiza-purple/25 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Senha
            </label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              disabled={enviando}
              className="w-full rounded-xl border border-zinc-700/80 bg-black/30 px-4 py-2.5 text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-ibiza-magenta/55 focus:ring-2 focus:ring-ibiza-purple/25 disabled:opacity-50"
            />
          </div>

          {erro && (
            <div className="rounded-xl border border-red-900/80 bg-red-950/40 px-4 py-2.5 text-sm text-red-200">
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={enviando || !email || !senha}
            className="w-full rounded-xl bg-gradient-to-r from-ibiza-magenta via-ibiza-purple to-fuchsia-600 py-3.5 text-sm font-bold text-white shadow-ibiza-pop transition hover:brightness-110 disabled:opacity-50"
          >
            {enviando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
          </div>
        </div>
      </div>
    </div>
  );
}
