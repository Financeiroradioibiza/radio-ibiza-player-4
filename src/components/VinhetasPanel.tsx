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
import { PlayerSubpanelChrome, listaCardIbiza } from '@/components/PlayerSubpanelChrome';

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

  const programaNome = playlistData?.programa?.nome?.trim();

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

  return (
    <PlayerSubpanelChrome
      titulo="Vinhetas"
      accent="magenta"
      onClose={onClose}
      closeDisabled={busy !== 'idle'}
      subtitulo={
        programaNome
          ? `Programação vinhetas (VP / VA) no programa «${programaNome}». Elas surgem entre faixas de ambiente segundo a grade e o servidor.`
          : 'Vinhetas programadas ou agendadas entre as músicas de ambiente, segundo a grade e o servidor.'
      }
    >
      <div className="space-y-8">
        {resumo.length === 0 ? (
          <p className="rounded-2xl border border-white/[0.07] bg-zinc-950/40 px-4 py-8 text-center text-sm text-zinc-500">
            Nenhuma vinheta listada até o servidor associar agendas VP ou VA úteis a este ponto — só ambiente até
            lá.
          </p>
        ) : (
          <ul className="space-y-3">
            {resumo.map((item) => (
              <li key={item.key} className={listaCardIbiza(item.tipo === 'VP' ? 'magenta' : 'sky')}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                      {item.rotuloTipo}
                    </p>
                    <h3 className="mt-1 break-words text-base font-semibold leading-snug text-zinc-100">
                      {item.tituloExibicao}
                    </h3>
                    {item.nomePasta !== item.tituloExibicao ? (
                      <p className="mt-1 font-mono text-[10px] tracking-tight text-zinc-600">
                        {item.nomePasta}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      item.tipo === 'VP'
                        ? 'border-ibiza-magenta/45 bg-black/35 text-ibiza-magenta/95'
                        : 'border-ibiza-sky/45 bg-black/35 text-ibiza-sky/95'
                    }`}
                  >
                    {item.tipo === 'VP' ? 'VP' : 'VA'}
                  </span>
                </div>

                <p className="mt-4 text-sm leading-snug text-zinc-200">{item.horarioLinha}</p>
                {item.detalhe ? (
                  <p className="mt-2 border-l border-white/18 pl-3 text-sm leading-relaxed text-zinc-400">
                    {item.detalhe}
                  </p>
                ) : null}
                {item.avisoGradeOpcional ? (
                  <p className="mt-3 rounded-xl border border-amber-500/22 bg-amber-950/18 px-3 py-2 text-[11px] leading-snug text-amber-100/88">
                    {item.avisoGradeOpcional}
                  </p>
                ) : null}
                {item.faixaExemplos.length > 0 ? (
                  <p className="mt-3 text-[11px] text-zinc-600">
                    <span className="font-semibold text-zinc-500">Trechos: </span>
                    {item.faixaExemplos.join(' · ')}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <section className="border-t border-white/10 pt-6">
          <div className="mb-1 h-0.5 w-full max-w-[6rem] rounded-full bg-gradient-to-r from-ibiza-purple via-violet-500/75 to-fuchsia-700/60" />
          <h3 className="mt-2 text-[11px] font-bold uppercase tracking-wider text-ibiza-purple/90">
            Vinheta por texto (locução)
          </h3>
          <p className="mt-1 max-w-prose text-xs text-zinc-500">
            Gera voz sintética e toca sobre o silêncio — o transporte principal permanece pausado enquanto o áudio
            gerado toca.
          </p>

          <div className={`${listaCardIbiza('purple')} mt-4`}>
            {!podeLocucao && (
              <p className="rounded-xl border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-100/95">
                Disponível só quando «placa de carro» estiver <strong className="text-amber-200">ativada</strong> no cadastro deste PDV (mesma permissão dos avisos de veículo).
              </p>
            )}

            <form className="mt-3 space-y-3" onSubmit={(e) => void handleLocucaoSubmit(e)}>
              <label className="block text-left">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Texto para síntese
                </span>
                <textarea
                  rows={5}
                  value={textoVinheta}
                  disabled={disabledLoc}
                  maxLength={VINHETA_LOCUCAO_TEXTO_MAX}
                  onChange={(e) => setTextoVinheta(e.target.value)}
                  placeholder="Ex.: Promoção especial hoje na loja. Passe já e garanta seu desconto."
                  className="w-full resize-y rounded-xl border border-zinc-700/80 bg-black/45 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-ibiza-purple/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/25 disabled:opacity-50"
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
                    onChange={(e) =>
                      setRepeticoesLoc(clampAvisoVeiculoRepeticoes(Number(e.target.value)))
                    }
                    className="w-[5.5rem] rounded-xl border border-zinc-700/80 bg-black/45 px-3 py-2.5 text-sm text-zinc-100 focus:border-ibiza-purple/45 focus:outline-none disabled:opacity-50"
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
                className="w-full rounded-xl border border-ibiza-purple/35 bg-gradient-to-r from-purple-600/35 via-purple-500/22 to-fuchsia-600/30 py-3 text-sm font-bold text-purple-50 shadow-panel transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:min-w-[220px]"
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
      </div>
    </PlayerSubpanelChrome>
  );
}
