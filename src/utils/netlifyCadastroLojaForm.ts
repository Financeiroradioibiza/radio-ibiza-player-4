/**
 * Netlify Forms — dados da loja na primeira instalação (`PrimeiraCargaPage`).
 * O `<form name="...">` correspondente tem de existir em `index.html` para o Netlify registar o formulário no deploy.
 */

export const NETLIFY_CADASTRO_LOJA_FORM_NAME = 'radio-ibiza-cadastro-loja';

export type CadastroLojaNetlifyPayload = {
  nomePdv: string;
  whatsappLoja: string;
  emailLoja: string;
  emailCobranca: string;
  clienteId?: number | null;
  pdvId?: number | null;
};

/**
 * Envio em segundo plano para o endpoint do site (Netlify Forms). Falhas só em `console.error` —
 * não bloqueia o fluxo do operador.
 */
export async function enviarCadastroLojaNetlify(payload: CadastroLojaNetlifyPayload): Promise<void> {
  if (import.meta.env.DEV) return;

  try {
    const body = new URLSearchParams({
      'form-name': NETLIFY_CADASTRO_LOJA_FORM_NAME,
      nome_pdv: payload.nomePdv.trim() || '—',
      whatsapp_loja: payload.whatsappLoja.trim(),
      email_loja: payload.emailLoja.trim(),
      email_cobranca: payload.emailCobranca.trim(),
      cliente_id: payload.clienteId != null && Number.isFinite(payload.clienteId) ? String(payload.clienteId) : '',
      pdv_id: payload.pdvId != null && Number.isFinite(payload.pdvId) ? String(payload.pdvId) : '',
      'cadastro-bot-field': '',
    });

    const res = await fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      console.error('[cadastro-loja] Netlify Forms respondeu', res.status);
    }
  } catch (e) {
    console.error('[cadastro-loja] falha ao enviar Netlify Forms', e);
  }
}
