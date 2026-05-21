/**
 * Shell mobile (`/m/selecionar-pdv`) — edite só aqui o layout/UX touch.
 *
 * Seleção de PDV.
 *
 * Equivale ao WindowPDVs.as do player AS3.
 * Depois do login com email/senha, o usuário vê a lista de PDVs do seu cliente
 * e escolhe um. O token desse PDV é salvo e usado em todas as chamadas seguintes.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/app';
import * as ws from '@/api/webservice';
import { LoadingScreen } from '@/components/LoadingScreen';
import { PwaInstallBanner } from '@/components/PwaInstallBanner';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getInstalarGuiaUrl } from '@/utils/instalarGuiaUrl';
import { getMobileInstallGuideLinkLabel } from '@/utils/pwaInstallPlatform';
import type { PdvListItem } from '@/types/webservice';
import { clsx } from 'clsx';
import { useShell } from '@/shells/ShellContext';

function labelStatus(status: PdvListItem['status']): string {
  return status === 'A' ? 'Ativo' : 'Inativo';
}

function normalizeBusca(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
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
  const { shell, path } = useShell();

  const [items, setItems] = useState<PdvListItem[]>([]);
  const [pdvsInativosOcultos, setPdvsInativosOcultos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [escolhendoToken, setEscolhendoToken] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  const itensFiltrados = useMemo(() => {
    const q = normalizeBusca(busca);
    if (!q) return items;
    return items.filter((item) => {
      const haystack = normalizeBusca(
        [item.nome, item.cidade, item.uf, item.token].filter(Boolean).join(' '),
      );
      return haystack.includes(q);
    });
  }, [items, busca]);

  useEffect(() => {
    if (!cliente_id) {
      navigate(path('/login'), { replace: true });
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
  }, [cliente_id, navigate, path]);

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
      navigate(path('/primeira-carga'), { replace: true });
    } catch (err) {
      console.error(err);
      setErro('Falha ao conectar. Verifique a rede e tente de novo.');
    } finally {
      setEscolhendoToken(null);
    }
  }

  if (carregando) return <LoadingScreen mensagem="Carregando PDVs..." />;

  return (
    <div className="relative flex min-h-full flex-col px-4 py-6 sm:px-6 lg:px-10">
      <div className="absolute right-2 top-4 z-10 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <header className="mb-6 border-b border-zinc-200 pb-5 dark:border-white/10">
        <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
          <span className="bg-gradient-to-r from-ibiza-magenta via-ibiza-lemon to-ibiza-sky bg-clip-text text-transparent">
            Selecione um PDV
          </span>
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Escolha o ponto de venda onde este player vai tocar.
        </p>
        <p className="mt-3 text-xs">
          <a
            href={getInstalarGuiaUrl({ mobile: shell === 'mobile' })}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-ibiza-magenta/90 underline decoration-ibiza-magenta/35 underline-offset-2 transition hover:text-ibiza-magenta cursor-pointer dark:text-ibiza-lemon/85 dark:decoration-ibiza-lemon/30 dark:hover:text-ibiza-lemon"
          >
            {getMobileInstallGuideLinkLabel()}
          </a>
        </p>

        <PwaInstallBanner />

        <div className="mt-5">
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Buscar PDV
          </label>
          <input
            type="search"
            name="busca-pdv"
            autoComplete="off"
            placeholder="Nome, cidade, UF ou trecho do token…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            disabled={items.length === 0}
            className="w-full max-w-xl rounded-xl border border-zinc-300/90 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-ibiza-magenta/55 focus:ring-2 focus:ring-ibiza-purple/25 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700/80 dark:bg-black/30 dark:text-zinc-100 dark:placeholder:text-zinc-600"
          />
          {items.length > 0 ? (
            <p className="mt-1.5 text-xs text-zinc-500">
              Mostrando{' '}
              <span className="font-medium text-zinc-700 dark:text-zinc-400">{itensFiltrados.length}</span>
              {busca.trim() ? (
                <>
                  {' '}
                  de <span className="font-medium text-zinc-700 dark:text-zinc-400">{items.length}</span>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      </header>

      {erro && (
        <div className="mb-4 rounded-xl border border-red-300/90 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
          {erro}
        </div>
      )}

      {items.length === 0 && !erro ? (
        <div className="rounded-xl border border-zinc-200/90 bg-zinc-100/80 px-4 py-6 text-sm text-zinc-700 space-y-2 dark:border-white/5 dark:bg-zinc-900/40 dark:text-zinc-400">
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
      ) : itensFiltrados.length === 0 ? (
        <div className="rounded-xl border border-zinc-200/90 bg-zinc-100/80 px-4 py-6 text-sm text-zinc-700 dark:border-white/5 dark:bg-zinc-900/40 dark:text-zinc-400">
          Nenhum PDV corresponde à busca. Limpe o campo ou tente outro termo (nome, cidade, UF).
        </div>
      ) : (
        <ul className="grid flex-1 gap-3 overflow-auto sm:grid-cols-2 lg:gap-4">
          {itensFiltrados.map((item, index) => {
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
                    'border-zinc-200/90 bg-white/90 backdrop-blur-sm hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-950/50 dark:hover:bg-zinc-900/65',
                    accent,
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{item.nome}</span>
                    <span className="shrink-0 rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
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
        className="mt-8 self-start rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-ibiza-magenta/35 hover:text-zinc-900 dark:border-zinc-600/80 dark:bg-zinc-950/50 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        ← Voltar ao login
      </button>
    </div>
  );
}
