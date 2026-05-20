/**
 * Tela de login.
 *
 * Equivale a Login.as no player AS3 antigo.
 * Fluxo: email + senha → POST /login/ → recebe cliente_id → vai pra seleção de PDV.
 */

import { useState, type FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as ws from '../api/webservice';
import { isIbizaPwaTouchOsClient } from '../api/config';
import { useAppStore } from '../store/app';
import { PwaInstallBanner } from '../components/PwaInstallBanner';
import { ThemeToggle } from '../components/ThemeToggle';
import { getInstalarGuiaUrl } from '../utils/instalarGuiaUrl';

export function LoginPage() {
  const isMobileOrTabletShell = isIbizaPwaTouchOsClient();
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
    <div className="relative flex min-h-full items-center justify-center p-4 pb-10">
      <div className="absolute right-3 top-3 z-10 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="rounded-[1.35rem] bg-gradient-to-br from-ibiza-magenta/55 via-ibiza-purple/35 to-ibiza-lemon/25 p-px shadow-ibiza-pop">
          <div className="rounded-[1.3rem] border border-zinc-200/90 bg-white/92 p-8 shadow-panel backdrop-blur-md dark:border-white/10 dark:bg-zinc-950/75">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-200/80 bg-gradient-to-br from-ibiza-magenta/15 via-ibiza-purple/12 to-ibiza-sky/10 shadow-ibiza-pop dark:border-white/10 dark:from-ibiza-magenta/25 dark:via-ibiza-purple/20 dark:to-ibiza-sky/15">
              <img src="/icon.svg" alt="" className="h-10 w-10" width={40} height={40} />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-ibiza-magenta via-ibiza-lemon to-ibiza-sky bg-clip-text text-transparent">
                Radio Ibiza
              </span>
            </h1>
            <p className="mt-1.5 text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">Player 4.0</p>
          </div>

        <PwaInstallBanner />

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
              className="w-full rounded-xl border border-zinc-300/90 bg-white px-4 py-2.5 text-zinc-900 outline-none ring-0 transition placeholder:text-zinc-400 focus:border-ibiza-magenta/55 focus:ring-2 focus:ring-ibiza-purple/25 disabled:opacity-50 dark:border-zinc-700/80 dark:bg-black/30 dark:text-zinc-100 dark:placeholder:text-zinc-600"
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
              className="w-full rounded-xl border border-zinc-300/90 bg-white px-4 py-2.5 text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-ibiza-magenta/55 focus:ring-2 focus:ring-ibiza-purple/25 disabled:opacity-50 dark:border-zinc-700/80 dark:bg-black/30 dark:text-zinc-100 dark:placeholder:text-zinc-600"
            />
          </div>

          {erro && (
            <div className="rounded-xl border border-red-300/90 bg-red-50 px-4 py-2.5 text-sm text-red-800 dark:border-red-900/80 dark:bg-red-950/40 dark:text-red-200">
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

        <p className="mt-6 text-center text-xs leading-relaxed text-zinc-500">
          <a
            href={getInstalarGuiaUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-ibiza-magenta/90 underline decoration-ibiza-magenta/35 underline-offset-2 transition hover:text-ibiza-magenta hover:decoration-ibiza-magenta/60 cursor-pointer dark:text-ibiza-lemon/90 dark:decoration-ibiza-lemon/35 dark:hover:text-ibiza-lemon dark:hover:decoration-ibiza-lemon/60"
          >
            {isMobileOrTabletShell
              ? 'Como instalar no telemóvel, tablet ou computador'
              : 'Como instalar no Windows, Mac ou celular'}
          </a>
          <span className="text-zinc-400 dark:text-zinc-600"> · abre numa nova aba</span>
        </p>
          </div>
        </div>
      </div>
    </div>
  );
}
