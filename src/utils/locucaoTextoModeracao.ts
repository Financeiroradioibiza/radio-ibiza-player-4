/**
 * Moderação **leve** para «vinheta por texto» (TTS) — espaço com público (mall).
 * Não substitui revisão humana nem serviço comercial de moderação; reduz abuso óbvio.
 *
 * Lista alinhada com `netlify/functions/_locucaoModeracao.mjs` (manter as duas sincronizadas).
 */

const MENSAGEM_PADRAO =
  'O texto contém termos não permitidos para locução em espaço público. Ajuste a mensagem e tente novamente.';

/** Normaliza para comparação: sem acentos, minúsculas, leetspeak grosseiro, separadores → espaço. */
export function normalizarParaModeracaoVinheta(texto: string): string {
  let s = String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
  s = s
    .replace(/[@4]/g, 'a')
    .replace(/3/g, 'e')
    .replace(/[!1|]/g, 'i')
    .replace(/0/g, 'o')
    .replace(/\$/g, 's')
    .replace(/5/g, 's')
    .replace(/7/g, 't');
  s = s.replace(/[_\-+/.,;:!?*]+/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

const FRASES: readonly string[] = [
  'filho da puta',
  'filha da puta',
  'vai se foder',
  'vai tomar no cu',
  'va tomar no cu',
  'va se foder',
  'pau no cu',
  'tomar no cu',
  'te foder',
  'te fodas',
  'se foder',
  'vai ca pro inferno',
  'foda se',
];

/** Uma palavra ou token curto; match com limite «não alfanumérico» para evitar substring em marcas comuns. */
const PALAVRAS: readonly string[] = [
  'buceta',
  'cacete',
  'caralho',
  'caralhao',
  'cuzao',
  'cusao',
  'desgraca',
  'escroto',
  'fdp',
  'foda',
  'foder',
  'fodasse',
  'imbecil',
  'merda',
  'paneleiro',
  'pentelho',
  'porra',
  'pqp',
  'puta',
  'putas',
  'puto',
  'putaria',
  'punheta',
  'rola',
  'siririca',
  'tesao',
  'trepar',
  'transar',
  'vadia',
  'vadio',
  'vagabunda',
  'vagabundo',
  'viado',
  'vsf',
  'vtnc',
  'bicha',
  'bixa',
  'cretino',
  'safada',
  'safado',
  'asshole',
  'bastard',
  'bitch',
  'blowjob',
  'bullshit',
  'cock',
  'crap',
  'cunt',
  'dick',
  'dyke',
  'faggot',
  'fuck',
  'motherfucker',
  'nazi',
  'nigga',
  'nigger',
  'piss',
  'porn',
  'rape',
  'retard',
  'shit',
  'slut',
  'whore',
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Retorna bloqueio se o texto contém frase ou palavra da lista (após normalização).
 */
export function moderarTextoLocucaoVinheta(texto: string): { ok: true } | { ok: false; mensagem: string } {
  const n = normalizarParaModeracaoVinheta(texto);
  if (!n.length) return { ok: true };

  const padded = ` ${n} `;
  for (const frase of FRASES) {
    if (padded.includes(` ${frase} `)) {
      return { ok: false, mensagem: MENSAGEM_PADRAO };
    }
  }

  for (const p of PALAVRAS) {
    const reAscii = new RegExp(`(^|[^a-z0-9])${escapeRe(p)}($|[^a-z0-9])`, 'i');
    if (reAscii.test(n)) {
      return { ok: false, mensagem: MENSAGEM_PADRAO };
    }
  }

  return { ok: true };
}
