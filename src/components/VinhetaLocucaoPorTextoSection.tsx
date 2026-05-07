/**
 * Locução TTS a partir de texto livre (vinheta por texto) — mesma permissão «placa de carro» dos avisos de veículo.
 */

import { type FormEvent, useEffect, useRef, useState } from 'react';

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
import { listaCardIbiza } from '@/components/PlayerSubpanelChrome';

type Props = {
  /** true enquanto gera ou toca áudio da locução */
  onBusyChange?: (busy: boolean) => void;
};

export function VinhetaLocucaoPorTextoSection({ onBusyChange }: Props) {
  const podeLocucao = useAppStore(
    (s) =>
      s.status !== 'desativado' && isCtrlPlayerEnabled(s.pdv) && isCtrlPlacaCarroEnabled(s.pdv),
  );

  const [textoVinheta, setTextoVinheta] = useState('');
  const [repeticoesLoc, setRepeticoesLoc] = useState(AVISO_VEICULO_REPETICOES_PADRAO);
  const [busy, setBusy] = useState<'idle' | 'gerando' | 'tocando'>('idle');
  const [erro, setErro] = useState<string | null>(null);
  const audioLocRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    onBusyChange?.(busy !== 'idle');
  }, [busy, onBusyChange]);

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

  return (
    <section className={listaCardIbiza('purple')}>
      <div className="mb-2 h-0.5 w-full max-w-[6rem] rounded-full bg-gradient-to-r from-ibiza-purple via-violet-500/75 to-fuchsia-700/65" />
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-ibiza-purple/90">
        Vinheta por texto (locução)
      </h3>
      <p className="mt-1 max-w-prose text-xs leading-snug text-zinc-500">
        Voz sintética; o transporte fica pausado durante o áudio gerado.
      </p>

      <div className="mt-3 border-t border-white/[0.07] pt-3">
        {!podeLocucao && (
          <p className="rounded-xl border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-100/95">
            Disponível só quando «placa de carro» estiver <strong className="text-amber-200">ativada</strong> no
            cadastro deste PDV (mesma permissão dos avisos de veículo).
          </p>
        )}

        <form className="space-y-3" onSubmit={(e) => void handleLocucaoSubmit(e)}>
          <label className="block text-left">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Texto para síntese
            </span>
            <textarea
              rows={4}
              value={textoVinheta}
              disabled={disabledLoc}
              maxLength={VINHETA_LOCUCAO_TEXTO_MAX}
              onChange={(e) => setTextoVinheta(e.target.value)}
              placeholder="Ex.: Promoção especial hoje na loja. Passe já e garanta seu desconto."
              className="w-full resize-y rounded-lg border border-zinc-700/80 bg-black/45 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-ibiza-purple/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/25 disabled:opacity-50"
            />
            <span className="mt-1 block text-[11px] text-zinc-600">
              Até {VINHETA_LOCUCAO_TEXTO_MAX} caracteres.
            </span>
          </label>

          <label className="block text-left">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Repetições
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
                className="w-[5.5rem] rounded-lg border border-zinc-700/80 bg-black/45 px-3 py-2 text-sm text-zinc-100 focus:border-ibiza-purple/45 focus:outline-none disabled:opacity-50"
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
            className="w-full rounded-lg border border-ibiza-purple/35 bg-gradient-to-r from-purple-600/35 via-purple-500/22 to-fuchsia-600/30 px-4 py-2 text-sm font-bold text-purple-50 shadow-panel transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:min-w-[180px]"
          >
            {busy === 'idle'
              ? `Gerar e tocar (${repeticoesLoc}×)`
              : busy === 'gerando'
                ? 'Gerando voz…'
                : 'Tocando locução…'}
          </button>
        </form>
      </div>
    </section>
  );
}
