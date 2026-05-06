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

/** Bordas “Spotify grid” — rotação de cor como capas de playlists */
const PDV_CARD_ACCENT = [
  'hover:border-ibiza-magenta/55 hover:shadow-[0_0_40px_-12px_rgba(225,29,140,0.45)]',
  'hover:border-ibiza-purple/55 hover:shadow-[0_0_40px_-12px_rgba(139,92,246,0.4)]',
  'hover:border-ibiza-lemon/45 hover:shadow-[0_0_40px_-12px_rgba(250,204,21,0.22)]',
  'hover:border-ibiza-forest/55 hover:shadow-[0_0_40px_-12px_rgba(34,197,94,0.35)]',
  'hover:border-ibiza-sky/55 hover:shadow-[0_0_40px_-12px_rgba(56,189,248,0.35)]',
] as const;

export function SelecionarPdvPage() {
  const cliente_id = useAppStore((s) => s.cliente_id);
  const navigate = useNavigate();

  const [items, setItems] = useState<PdvListItem[]>([]);
  const [pdvsInativosOcultos, setPdvsInativosOcultos] = useState(0);
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
          setPdvsInativosOcultos(0);
        } else {
          setItems(resp.items);
          setPdvsInativosOcultos(resp.ocultadosInativos);
        }
      } catch (err) {
        console.error(err);
        setErro('Não foi possível carregar a lista de PDVs.');
        setPdvsInativosOcultos(0);
      } finally {
        setCarregando(false);
      }
    })();
  }, [cliente_id, navigate]);

  async function handleEscolherPdv(item: PdvListItem) {
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
    <div className="flex min-h-full flex-col px-4 py-6 sm:px-6 lg:px-10">
      <header className="mb-6 border-b border-white/10 pb-5">
        <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
          <span className="bg-gradient-to-r from-ibiza-magenta via-ibiza-lemon to-ibiza-sky bg-clip-text text-transparent">
            Selecione um PDV
          </span>
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Escolha o ponto de venda onde este player vai tocar.
        </p>
      </header>

      {erro && (
        <div className="mb-4 rounded-xl border border-red-900/70 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {erro}
        </div>
      )}

      {items.length === 0 && !erro ? (
        <div className="rounded-xl border border-white/5 bg-zinc-900/40 px-4 py-6 text-sm text-zinc-400 space-y-2">
          <p>
            {pdvsInativosOcultos > 0
              ? 'Não há PDVs ativos disponíveis neste momento. Os cadastrados como inativos não aparecem nesta lista.'
              : 'Nenhum PDV disponível para este cliente.'}
          </p>
          {pdvsInativosOcultos > 0 && (
            <p className="text-xs text-zinc-500">
              PDVs com status inativo no cadastro: {pdvsInativosOcultos}
            </p>
          )}
        </div>
      ) : (
        <ul className="grid flex-1 gap-3 overflow-auto sm:grid-cols-2 lg:gap-4">
          {items.map((item, index) => {
            const ocupado = escolhendoToken === item.token;
            const accent = PDV_CARD_ACCENT[index % PDV_CARD_ACCENT.length];
            return (
              <li key={item.token}>
                <button
                  type="button"
                  disabled={escolhendoToken !== null}
                  onClick={() => void handleEscolherPdv(item)}
                  className={clsx(
                    'w-full rounded-2xl border p-5 text-left shadow-panel transition',
                    'border-white/10 bg-zinc-950/50 backdrop-blur-sm hover:bg-zinc-900/65',
                    accent,
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-zinc-100">{item.nome}</span>
                    <span className="shrink-0 rounded bg-emerald-950 px-2 py-0.5 text-xs text-emerald-300">
                      {labelStatus(item.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">
                    {item.cidade}
                    {item.uf ? ` · ${item.uf}` : ''}
                  </p>
                  {item.atualizacao_pendente === 'S' && (
                    <p className="mt-2 text-xs text-amber-600/90">Atualização de conteúdo pendente</p>
                  )}
                  {ocupado && (
                    <p className="mt-2 text-xs font-semibold text-ibiza-magenta">Conectando…</p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={() => useAppStore.getState().logout()}
        className="mt-8 self-start rounded-full border border-zinc-600/80 bg-zinc-950/50 px-5 py-2.5 text-sm font-semibold text-zinc-400 transition hover:border-ibiza-magenta/35 hover:text-zinc-200"
      >
        ← Voltar ao login
      </button>
    </div>
  );
}
