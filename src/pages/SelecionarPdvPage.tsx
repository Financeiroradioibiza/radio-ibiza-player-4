/**
 * Seleção de PDV.
 *
 * Equivale ao WindowPDVs.as do player AS3.
 * Depois do login com email/senha, o usuário vê a lista de PDVs do seu cliente
 * e escolhe um. O token desse PDV é salvo e usado em todas as chamadas seguintes.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/app';
import * as ws from '../api/webservice';
import { LoadingScreen } from '../components/LoadingScreen';
import type { PdvListItem } from '../types/webservice';
import { clsx } from 'clsx';

function labelStatus(status: PdvListItem['status']): string {
  return status === 'A' ? 'Ativo' : 'Inativo';
}

export function SelecionarPdvPage() {
  const cliente_id = useAppStore((s) => s.cliente_id);
  const navigate = useNavigate();

  const [items, setItems] = useState<PdvListItem[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [escolhendoToken, setEscolhendoToken] = useState<string | null>(null);

  useEffect(() => {
    if (!cliente_id) {
      navigate('/login', { replace: true });
      return;
    }

    void (async () => {
      try {
        const resp = await ws.getPdvs({ cliente_id });
        if (!resp.ok) {
          setErro(
            typeof resp.error === 'string' && resp.error.length < 120
              ? resp.error
              : 'Não foi possível carregar a lista de PDVs.',
          );
          setItems([]);
        } else {
          setItems(resp.items);
        }
      } catch (err) {
        console.error(err);
        setErro('Não foi possível carregar a lista de PDVs.');
      } finally {
        setCarregando(false);
      }
    })();
  }, [cliente_id, navigate]);

  async function handleEscolherPdv(item: PdvListItem) {
    if (item.status !== 'A') return;

    setErro(null);
    setEscolhendoToken(item.token);
    try {
      const resp = await ws.loginByToken(item.token);
      const extracted = ws.extractFromLoginByToken(resp);
      if (extracted.error) {
        setErro('Não foi possível validar este PDV. Tente outro ou entre novamente.');
        return;
      }
      const merged = extracted.data;
      if (!merged) {
        setErro('Resposta inválida do servidor.');
        return;
      }
      const sessao = ws.sessionFromLoginByTokenMerge(merged);
      await useAppStore.getState().salvarSessao(sessao);
      navigate('/player', { replace: true });
    } catch (err) {
      console.error(err);
      setErro('Falha ao conectar. Verifique a rede e tente de novo.');
    } finally {
      setEscolhendoToken(null);
    }
  }

  if (carregando) return <LoadingScreen mensagem="Carregando PDVs..." />;

  return (
    <div className="flex h-full flex-col bg-zinc-950 p-6">
      <h1 className="mb-2 text-xl font-light text-ibiza-gold">Selecione um PDV</h1>
      <p className="mb-4 text-sm text-zinc-500">
        Escolha o ponto de venda onde este player vai tocar.
      </p>

      {erro && (
        <div className="mb-4 rounded border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
          {erro}
        </div>
      )}

      {items.length === 0 && !erro ? (
        <p className="text-sm text-zinc-400">Nenhum PDV disponível para este cliente.</p>
      ) : (
        <ul className="grid flex-1 gap-3 overflow-auto sm:grid-cols-2">
          {items.map((item) => {
            const desabilitado = item.status !== 'A';
            const ocupado = escolhendoToken === item.token;
            return (
              <li key={item.token}>
                <button
                  type="button"
                  disabled={desabilitado || escolhendoToken !== null}
                  onClick={() => void handleEscolherPdv(item)}
                  className={clsx(
                    'w-full rounded-lg border p-4 text-left transition',
                    desabilitado
                      ? 'cursor-not-allowed border-zinc-800 bg-zinc-900/30 opacity-60'
                      : 'border-zinc-700 bg-zinc-900/50 hover:border-ibiza-gold/60 hover:bg-zinc-900',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-zinc-100">{item.nome}</span>
                    <span
                      className={clsx(
                        'shrink-0 rounded px-2 py-0.5 text-xs',
                        item.status === 'A'
                          ? 'bg-emerald-950 text-emerald-300'
                          : 'bg-zinc-800 text-zinc-400',
                      )}
                    >
                      {labelStatus(item.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">
                    {item.cidade}
                    {item.uf ? ` · ${item.uf}` : ''}
                  </p>
                  {item.atualizacao_pendente === 'S' && !desabilitado && (
                    <p className="mt-2 text-xs text-amber-600/90">Atualização de conteúdo pendente</p>
                  )}
                  {ocupado && (
                    <p className="mt-2 text-xs text-ibiza-gold">Conectando…</p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        onClick={() => useAppStore.getState().logout()}
        className="mt-6 self-start text-sm text-zinc-500 hover:text-zinc-300"
      >
        ← Sair
      </button>
    </div>
  );
}
