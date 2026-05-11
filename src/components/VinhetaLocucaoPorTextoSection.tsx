/**
 * Locução TTS a partir de texto livre (vinheta por texto) — mesma permissão «placa de carro» dos avisos de veículo.
 */

import { type FormEvent, useEffect, useRef, useState } from 'react';

import { useAppStore } from '@/store/app';
import {
  fetchVinhetaLocucaoMp3,
  fetchVinhetaTraducaoPreviewIngles,
  VINHETA_LOCUCAO_TEXTO_MAX,
} from '@/api/ttsVinhetaLocucao';
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
import {
  passthroughWheelToScrollChainRoot,
  propagateNativeWheelToScrollChainRoot,
} from '@/utils/wheelPassthroughScrollChain';

type Props = {
  /** true enquanto gera ou toca áudio da locução */
  onBusyChange?: (busy: boolean) => void;
  /** Shopping overlay: cartão inicia minimizado até o operador expandir. */
  modoAccordion?: boolean;
  /** Notifica apenas em modo accordion (aberto/fechado). */
  onSecaoAccordionChange?: (aberta: boolean) => void;
};

function IconAccordionChevron({ aberta, className }: { aberta: boolean; className?: string }) {
  return (
    <svg
      aria-hidden
      className={`h-5 w-5 shrink-0 transition-transform duration-200 ${aberta ? 'rotate-180' : ''} ${className ?? ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function VinhetaLocucaoPorTextoSection({
  onBusyChange,
  modoAccordion = false,
  onSecaoAccordionChange,
}: Props) {
  const podeLocucao = useAppStore(
    (s) =>
      s.status !== 'desativado' && isCtrlPlayerEnabled(s.pdv) && isCtrlPlacaCarroEnabled(s.pdv),
  );

  const [textoVinheta, setTextoVinheta] = useState('');
  const [locucaoEmIngles, setLocucaoEmIngles] = useState(false);
  const [previewIngles, setPreviewIngles] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [repeticoesLoc, setRepeticoesLoc] = useState(AVISO_VEICULO_REPETICOES_PADRAO);
  const [busy, setBusy] = useState<'idle' | 'gerando' | 'tocando'>('idle');
  const [erro, setErro] = useState<string | null>(null);
  const audioLocRef = useRef<HTMLAudioElement | null>(null);
  const cartaoRef = useRef<HTMLElement | null>(null);
  const [accordionAberto, setAccordionAberto] = useState(false);

  useEffect(() => {
    const el = cartaoRef.current;
    if (!el) return;
    const handler = (ev: WheelEvent) => propagateNativeWheelToScrollChainRoot(ev);
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

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

  useEffect(() => {
    if (modoAccordion && (busy !== 'idle' || previewBusy)) {
      setAccordionAberto(true);
    }
  }, [modoAccordion, busy, previewBusy]);

  useEffect(() => {
    if (!modoAccordion) return;
    onSecaoAccordionChange?.(accordionAberto);
  }, [modoAccordion, accordionAberto, onSecaoAccordionChange]);

  const bloqueioUiPlayback = busy !== 'idle' || !podeLocucao;
  /** Evita gerar voz em inglês em paralelo com pedido de pré-visualização (pedidos HTTP separados). */
  const desabilitarGerar = bloqueioUiPlayback || previewBusy;

  useEffect(() => {
    setPreviewIngles(null);
  }, [textoVinheta, locucaoEmIngles]);

  const bloquearToggleAccordion = busy !== 'idle' || previewBusy;

  function alternarAccordion() {
    if (!modoAccordion || bloquearToggleAccordion) return;
    setAccordionAberto((v) => !v);
  }

  async function handlePreviewTraducao() {
    setErro(null);
    const t = textoVinheta.trim();
    if (t.length < 3) {
      setErro('Escreva um texto com pelo menos 3 caracteres para pré-visualizar.');
      return;
    }
    setPreviewBusy(true);
    try {
      const en = await fetchVinhetaTraducaoPreviewIngles(t);
      setPreviewIngles(en);
    } catch (err) {
      if (err instanceof TtsAvisoVeiculoError) {
        setErro(err.message);
      } else {
        console.error(err);
        setErro('Não foi possível obter a tradução.');
      }
      setPreviewIngles(null);
    } finally {
      setPreviewBusy(false);
    }
  }

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
      blob = await fetchVinhetaLocucaoMp3(t, { falarEmIngles: locucaoEmIngles });
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

  const descricaoLonga = (
    <p className="mt-1 max-w-prose text-xs leading-snug text-white">
      Voz sintética; o transporte fica pausado durante o áudio gerado. Opcionalmente a locutora fala em inglês
      (tradução automática a partir do que escreves em português).
    </p>
  );

  const formulario = (
    <div className="mt-3 border-t border-white/[0.07] pt-3">
      {!podeLocucao && (
        <p className="rounded-xl border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-100/95">
          Disponível só quando «placa de carro» estiver <strong className="text-amber-200">ativada</strong> no
          cadastro deste PDV (mesma permissão dos avisos de veículo).
        </p>
      )}

      <form className="space-y-3" onSubmit={(e) => void handleLocucaoSubmit(e)}>
        <label className="block text-left">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-white">
            Texto para síntese
          </span>
          <textarea
            rows={4}
            value={textoVinheta}
            disabled={bloqueioUiPlayback}
            maxLength={VINHETA_LOCUCAO_TEXTO_MAX}
            onWheel={passthroughWheelToScrollChainRoot}
            onChange={(e) => setTextoVinheta(e.target.value)}
            placeholder="Ex.: Promoção especial hoje na loja. Passe já e garanta seu desconto."
            className="w-full resize-y rounded-lg border border-zinc-700/80 bg-black/45 px-3 py-2 text-sm text-white placeholder:text-white/50 focus:border-ibiza-purple/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/25 disabled:opacity-50"
          />
          <span className="mt-1 block text-[11px] text-white">
            Até {VINHETA_LOCUCAO_TEXTO_MAX} caracteres.
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-zinc-700/50 bg-black/25 px-3 py-2.5 text-left">
          <input
            type="checkbox"
            checked={locucaoEmIngles}
            disabled={bloqueioUiPlayback}
            onChange={(e) => setLocucaoEmIngles(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-600 text-ibiza-purple focus:ring-ibiza-purple/40 disabled:opacity-50"
          />
          <span>
            <span className="block text-sm font-semibold text-white">Locutora em inglês</span>
            <span className="mt-0.5 block text-[11px] leading-snug text-white">
              O texto continua em português aqui; a nuvem traduz para inglês e sintetiza com voz em inglês.
            </span>
          </span>
        </label>

        {locucaoEmIngles && podeLocucao && (
          <div className="space-y-2 rounded-lg border border-emerald-900/35 bg-emerald-950/15 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={bloqueioUiPlayback || previewBusy || textoVinheta.trim().length < 3}
                onClick={() => void handlePreviewTraducao()}
                className="rounded-lg border border-white/20 bg-gradient-to-r from-emerald-600/55 via-teal-600/42 to-teal-800/40 px-3 py-1.5 text-xs font-bold text-white shadow-panel transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {previewBusy ? 'A traduzir…' : 'Pré-visualizar a tradução'}
              </button>
              <span className="text-[11px] font-medium text-white">Só texto — não gera áudio.</span>
            </div>
            {previewIngles != null && (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-500/90">
                  Texto que será falado (inglês)
                </p>
                <p className="whitespace-pre-wrap rounded-md border border-white/10 bg-black/35 px-3 py-2 text-sm leading-snug text-white">
                  {previewIngles}
                </p>
              </div>
            )}
          </div>
        )}

        <label className="block text-left">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-white">
            Repetições
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              disabled={bloqueioUiPlayback}
              value={repeticoesLoc}
              onChange={(e) => setRepeticoesLoc(clampAvisoVeiculoRepeticoes(Number(e.target.value)))}
              aria-label={`Número de vezes (${AVISO_VEICULO_REPETICOES_MIN} a ${AVISO_VEICULO_REPETICOES_MAX})`}
              className="w-[5.5rem] rounded-lg border border-zinc-700/80 bg-black/45 px-3 py-2 text-sm text-white focus:border-ibiza-purple/45 focus:outline-none disabled:opacity-50"
            />
            <span className="text-xs text-white">
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
          disabled={desabilitarGerar || textoVinheta.trim().length < 3}
          className="w-full rounded-lg border border-white/20 bg-gradient-to-r from-purple-600/65 via-fuchsia-600/48 to-pink-700/45 px-4 py-2 text-sm font-bold text-white shadow-ibiza-pop transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:min-w-[180px]"
        >
          {busy === 'idle'
            ? `Gerar e tocar (${repeticoesLoc}×)`
            : busy === 'gerando'
              ? 'Gerando voz…'
              : 'Tocando locução…'}
        </button>
      </form>
    </div>
  );

  const barraTituloVinheta = (
    <>
      <div className="mb-2 h-0.5 w-full max-w-[6rem] rounded-full bg-gradient-to-r from-ibiza-purple via-violet-500/75 to-fuchsia-700/65" />
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-ibiza-purple/90">
        Vinheta por texto (locução)
      </h3>
    </>
  );

  if (!modoAccordion) {
    return (
      <section ref={cartaoRef} className={listaCardIbiza('purple')}>
        {barraTituloVinheta}
        {descricaoLonga}
        {formulario}
      </section>
    );
  }

  return (
    <section ref={cartaoRef} className={listaCardIbiza('purple')}>
      <button
        type="button"
        onClick={alternarAccordion}
        disabled={bloquearToggleAccordion}
        aria-expanded={accordionAberto}
        className="flex w-full items-start justify-between gap-3 rounded-lg px-0 py-1 text-left transition hover:bg-white/[0.03] disabled:cursor-default disabled:hover:bg-transparent"
        title={
          bloquearToggleAccordion
            ? 'Aguarde a operação da locução terminar antes de minimizar.'
            : accordionAberto
              ? 'Minimizar secção'
              : 'Expandir para editar texto e gerar áudio'
        }
      >
        <div className="min-w-0 pt-0.5">
          {barraTituloVinheta}
          {!accordionAberto ? (
            <p className="mt-2 text-[10px] leading-snug text-white">
              Voz sintética · tradução / inglês opcional
            </p>
          ) : null}
        </div>
        {accordionAberto ? (
          <IconAccordionChevron
            aberta={accordionAberto}
            className={`mt-1 ${bloquearToggleAccordion ? 'text-white/45' : 'text-ibiza-purple/90'}`}
          />
        ) : null}
      </button>

      {!accordionAberto ? null : (
        <>
          {descricaoLonga}
          {formulario}
        </>
      )}
    </section>
  );
}
