/**
 * Vinhetas da programação (webservice) + locução por texto opcional (TTS na nuvem).
 * Locução por texto só quando ctrl_placa_carro permite (mesma opção «placa de carro» do painel).
 */

import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import { useAppStore } from '@/store/app';
import { fetchVinhetaLocucaoMp3, VINHETA_LOCUCAO_TEXTO_MAX } from '@/api/ttsVinhetaLocucao';
import { TtsAvisoVeiculoError } from '@/api/ttsAvisoVeiculo';
import { isCtrlPlayerEnabled, isCtrlPlacaCarroEnabled } from '@/utils/pdvPermissions';
import { playMp3BlobRepeated } from '@/utils/avisoVeiculoPlayback';
import {
  AVISO_VEICULO_REPETICOES_MAX,
  AVISO_VEICULO_REPETICOES_MIN,
  AVISO_VEICULO_REPETICOES_PADRAO,
  clampAvisoVeiculoRepeticoes,
} from '@/utils/avisoVeiculoText';
import { resumoVinhetasProgramacao } from '@/player/vinhetas';

type Props = {
  onClose: () => void;
};

export function VinhetasPanel({ onClose }: Props) {
  const playlistData = useAppStore((s) => s.playlistData);
  const agendas = useAppStore((s) => s.agendas);

  const podeLocucao = useAppStore(
    (s) =>
      s.status !== 'desativado' && isCtrlPlayerEnabled(s.pdv) && isCtrlPlacaCarroEnabled(s.pdv),
  );

  const [textoVinheta, setTextoVinheta] = useState('');
  const [repeticoesLoc, setRepeticoesLoc] = useState(AVISO_VEICULO_REPETICOES_PADRAO);
  const [busy, setBusy] = useState<'idle' | 'gerando' | 'tocando'>('idle');
  const [erro, setErro] = useState<string | null>(null);
  const audioLocRef = useRef<HTMLAudioElement | null>(null);

  const resumo = useMemo(
    () =>
      resumoVinhetasProgramacao(
        playlistData?.playlists ?? [],
        agendas ?? [],
        playlistData?.programa?.id ?? 0,
      ),
    [playlistData?.playlists, agendas, playlistData?.programa?.id],
  );

  useEffect(() => {
    return () => {
      const a = audioLocRef.current;
      if (a) {
        a.pause();
        a.removeAttribute('src');
        audioLocRef.current = null;
      }
    };
  }, []);

  const disabledLoc = busy !== 'idle' || !podeLocucao;

  async function handleLocucaoSubmit(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const t = textoVinheta.trim();
    if (t.length < 3) {
      setErro('Escreva um texto com pelo menos 3 caracteres.');
      return;
    }

    const estavaTocando = useAppStore.getState().status === 'tocando';
    useAppStore.setState({ status: 'pausado' });
    setBusy('gerando');

    let blob: Blob;
    try {
      blob = await fetchVinhetaLocucaoMp3(t);
    } catch (err) {
      if (estavaTocando) {
        useAppStore.setState({ status: 'tocando' });
      }
      if (err instanceof TtsAvisoVeiculoError) {
        setErro(err.message);
      } else {
        console.error(err);
        setErro('Não foi possível gerar a locução.');
      }
      setBusy('idle');
      return;
    }

    setBusy('tocando');
    const vezes = clampAvisoVeiculoRepeticoes(repeticoesLoc);

    try {
      await playMp3BlobRepeated(blob, (audio) => {
        audioLocRef.current = audio;
      }, vezes);
    } catch (err) {
      console.error(err);
      setErro(err instanceof Error && err.message ? err.message : 'Erro ao reproduzir a locução.');
    } finally {
      if (estavaTocando) {
        useAppStore.setState({ status: 'tocando' });
      }
      setBusy('idle');
    }
  }

  const programaNome = playlistData?.programa?.nome?.trim();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-4">
        <div>
          <h2 className="text-base font-semibold text-ibiza-magenta/95">Vinhetas</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Vinhetas programadas e agendadas vêm do webservice (/playlist/ + /agendas/). São inseridas
            entre as músicas de ambiente. A locução por texto abaixo pausa o player principal e reproduz só
            a voz (sem música de fundo).
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy !== 'idle'}
          aria-label="Voltar ao player"
          className="rounded-xl border border-zinc-600/70 bg-zinc-950/80 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Voltar ao player
        </button>
      </div>

      <section className="rounded-2xl border border-ibiza-magenta/20 bg-black/25 px-4 py-4 sm:px-5">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-ibiza-magenta/85">
          Programação do servidor {programaNome ? <>· «{programaNome}»</> : null}
        </h3>
        {resumo.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            Não há agendas de vinhetas (VP ou VA) associadas aos IDs deste programa —
            apenas ambiente será reproduzido até o servidor enviar agendas.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {resumo.map((item) => (
              <li
                key={item.key}
                className="rounded-xl border border-white/8 bg-zinc-950/40 px-4 py-3 text-left"
              >
                <p className="text-sm font-semibold text-zinc-100">
                  {item.tipo === 'VP' ? 'VP ·' : 'VA ·'} {item.playlistNome}
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-zinc-400">
                  {item.bullets.slice(1).map((line, i) => (
                    <li key={`${item.key}-${i}`} className="marker:text-zinc-600">
                      {line}
                    </li>
                  ))}
                </ul>
                {item.faixaExemplos.length > 0 && (
                  <p className="mt-3 text-[11px] text-zinc-500">
                    Exemplos de faixas: {item.faixaExemplos.join(' · ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-purple-500/25 bg-black/25 px-4 py-4 sm:px-5">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-ibiza-purple/90">
          Vinheta por texto (locução)
        </h3>

        {!podeLocucao && (
          <p className="mt-3 rounded-xl border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-100/95">
            Disponível só quando «placa de carro» estiver <strong className="text-amber-200">ativada</strong> no cadastro deste PDV (mesma permissão dos avisos de veículo).
          </p>
        )}

        <form className="mt-4 space-y-3" onSubmit={(e) => void handleLocucaoSubmit(e)}>
          <label className="block text-left">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Texto pago pela locutora (síntese de voz)
            </span>
            <textarea
              rows={5}
              value={textoVinheta}
              disabled={disabledLoc}
              maxLength={VINHETA_LOCUCAO_TEXTO_MAX}
              onChange={(e) => setTextoVinheta(e.target.value)}
              placeholder="Ex.: Promoção especial hoje na loja. Passe já e garanta seu desconto."
              className="w-full resize-y rounded-xl border border-zinc-700/80 bg-black/40 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-purple-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/25 disabled:opacity-50"
            />
            <span className="mt-1 block text-[11px] text-zinc-600">
              Até {VINHETA_LOCUCAO_TEXTO_MAX} caracteres.
            </span>
          </label>

          <label className="block text-left">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Repetições da locução
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="number"
                disabled={disabledLoc}
                min={AVISO_VEICULO_REPETICOES_MIN}
                max={AVISO_VEICULO_REPETICOES_MAX}
                step={1}
                value={repeticoesLoc}
                onChange={(e) => setRepeticoesLoc(clampAvisoVeiculoRepeticoes(Number(e.target.value)))}
                className="w-[5.5rem] rounded-xl border border-zinc-700/80 bg-black/40 px-3 py-2.5 text-sm text-zinc-100 focus:border-purple-500/40 focus:outline-none disabled:opacity-50"
              />
              <span className="text-xs text-zinc-500">
                {AVISO_VEICULO_REPETICOES_MIN}–{AVISO_VEICULO_REPETICOES_MAX} vezes seguidas
              </span>
            </div>
          </label>

          {erro && (
            <p className="rounded-xl border border-red-900/50 bg-red-950/25 px-3 py-2 text-xs text-red-100">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={disabledLoc || textoVinheta.trim().length < 3}
            className="w-full rounded-xl border border-purple-500/35 bg-gradient-to-r from-purple-600/25 via-purple-500/15 to-fuchsia-600/25 py-3 text-sm font-bold text-purple-50 shadow-panel transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:min-w-[220px]"
          >
            {busy === 'idle'
              ? `Gerar e tocar (${repeticoesLoc}×)`
              : busy === 'gerando'
                ? 'Gerando voz…'
                : 'Tocando locução…'}
          </button>
        </form>
      </section>
    </div>
  );
}
