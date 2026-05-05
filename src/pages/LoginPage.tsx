/**
 * Tela de login.
 *
 * Equivale a Login.as no player AS3 antigo.
 * Fluxo: email + senha → POST /login/ → recebe cliente_id → vai pra seleção de PDV.
 */

import { useState, type FormEvent } from 'react';
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
  const setClienteId = useAppStore((s) => s.setClienteId);
  const setStatus = useAppStore((s) => s.setStatus);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    setLoading(true);

    try {
      const resp = await ws.login(email, senha);

      // O webservice retorna mensagem como ["valido", cliente_id] ou string de erro
      if (Array.isArray(resp.mensagem) && resp.mensagem[0] === 'valido') {
        const cliente_id = Number(resp.mensagem[1]);

        // Salva cliente_id no store e segue pra seleção de PDV
        setClienteId(cliente_id);
        setStatus('selecionar_pdv');
        navigate('/selecionar-pdv');
      } else {
        setErro('Login inválido. Verifique e-mail e senha.');
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
    <div className="flex h-full items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-light text-ibiza-gold">Radio Ibiza</h1>
          <p className="mt-1 text-sm text-zinc-500">Player 4.0</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-400">
              Login
            </label>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={enviando}
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-ibiza-gold disabled:opacity-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-400">
              Senha
            </label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              disabled={enviando}
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-ibiza-gold disabled:opacity-50"
            />
          </div>

          {erro && (
            <div className="rounded border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={enviando || !email || !senha}
            className="w-full rounded bg-ibiza-gold py-2 font-medium text-zinc-950 transition hover:bg-yellow-500 disabled:opacity-50"
          >
            {enviando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
