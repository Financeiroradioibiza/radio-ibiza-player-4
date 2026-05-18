/**
 * Moderação leve para locução «vinheta por texto» (TTS) — ambiente com público.
 * **Manter alinhado com** `src/utils/locucaoTextoModeracao.ts` (listas FRASES + PALAVRAS).
 */

const MENSAGEM_PADRAO =
  'O texto contém termos não permitidos para locução em espaço público. Ajuste a mensagem e tente novamente.';

export function normalizarParaModeracaoVinheta(texto) {
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

const FRASES = [
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

const PALAVRAS = [
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

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @returns {{ ok: true } | { ok: false, mensagem: string }}
 */
export function moderaVinhetaLocucao(texto) {
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
