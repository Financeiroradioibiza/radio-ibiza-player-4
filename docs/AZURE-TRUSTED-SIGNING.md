# Guia — Ativar Azure Trusted Signing para assinar o `.exe` Windows

> Esta é a **única tarefa do usuário** (operacional, fora do código) para que
> o build Electron Windows passe a ser assinado digitalmente.
> Ver decisão em `DECISIONS.md` (DEC-010) e contexto em `ROADMAP.md` (3B.3).

Tempo total estimado: **30-60 minutos** de configuração + **2-5 dias úteis**
aguardando a Microsoft validar a identidade da empresa.

Custo: **US$ 9,99/mês** (~R$ 50/mês) cobrado no cartão da conta Azure.
Pode ser cancelado a qualquer mês, sem multa. Releases já assinadas continuam
funcionando depois do cancelamento (Windows não revoga retroativamente).

---

## Pré-requisitos

- [ ] CNPJ da Radio Ibiza ativo há **≥ 3 anos**. Se for CNPJ mais novo, a Microsoft
      não aceita pelo Trusted Signing — nesse caso, ver alternativas no final.
- [ ] Conta Microsoft administrativa **dedicada** (não use e-mail pessoal).
      Sugestão: `tech@radioibiza.com.br`. Senha forte + 2FA obrigatório (Microsoft obriga).
- [ ] Cartão de crédito com limite para a cobrança recorrente (~R$ 50/mês).
- [ ] Cópia digital do contrato social ou cartão CNPJ para anexar no processo
      de validação de identidade.

---

## Passo 1 — Criar conta Microsoft / Azure

1. Acesse <https://signup.live.com/> e crie a conta `tech@radioibiza.com.br`.
   Active 2FA via aplicativo autenticador (Authy, Microsoft Authenticator).
2. Acesse <https://azure.microsoft.com/free/> e logue com a conta criada.
3. Aceite os termos da conta Azure. Cadastre cartão de crédito (sem cobrança imediata).
4. Anote o **Tenant ID** (Azure → Microsoft Entra ID → Overview). Vai ser necessário.

---

## Passo 2 — Criar Trusted Signing Account

1. No portal Azure (<https://portal.azure.com>), clique em **Create a resource**.
2. Pesquise por **Trusted Signing Account** e selecione.
3. Configure:
   - **Subscription**: a default (a única disponível).
   - **Resource group**: criar novo `rg-radioibiza-signing`.
   - **Name**: `ts-radioibiza`.
   - **Region**: **East US** ou **West Europe** (Trusted Signing tem regiões limitadas).
   - **SKU**: **Basic** (US$ 9,99/mês, suficiente para nosso volume).
4. Clique em **Review + Create** → **Create**. Demora ~1 minuto.

---

## Passo 3 — Validação de identidade da empresa

1. Após criar o recurso, acesse-o e clique em **Identity Validation** no menu lateral.
2. Clique em **+ New Identity Validation**.
3. Preencha:
   - **Type**: **Public**.
   - **Identity name**: `Radio Ibiza`.
   - **Country**: **Brazil**.
   - **Region/State**: estado da sede.
   - **City**: cidade da sede.
   - **Street address**: endereço fiscal.
   - **Postal code**: CEP.
   - **Email**: e-mail comercial onde a Microsoft enviará atualizações.
4. Anexe **contrato social ou cartão CNPJ**.
5. Submeta.

**Aguarde 2-5 dias úteis.** A Microsoft analisa documentação, eventualmente faz
contato por e-mail pedindo esclarecimentos. Quando aprovado, status passa
para **Completed**.

---

## Passo 4 — Criar Certificate Profile

> Só depois da Identity Validation ficar **Completed**.

1. No recurso Trusted Signing, clique em **Certificate Profiles** → **+ Create**.
2. Configure:
   - **Profile name**: `radioibiza-public`.
   - **Identity Validation**: selecione `Radio Ibiza` (criado no passo 3).
   - **Certificate Profile Type**: **Public Trust**.
3. Salve.

Esse profile é o que vai aparecer no SmartScreen como "publisher" do `.exe`.

---

## Passo 5 — Criar Service Principal para o build

> O build local (e CI futuro) precisa autenticar no Azure via App Registration,
> não via login interativo. Isso isola a credencial e permite revogação fácil.

1. Azure → **Microsoft Entra ID** → **App registrations** → **+ New registration**.
2. Configure:
   - **Name**: `electron-builder-signing`.
   - **Supported account types**: **Single tenant**.
   - **Redirect URI**: deixar em branco.
3. Salve. Anote:
   - **Application (client) ID**
   - **Directory (tenant) ID**
4. Em **Certificates & secrets** → **+ New client secret**. Anote o **Value**
   (só aparece uma vez — guarde no cofre de senhas).
5. Volte ao Trusted Signing Account → **Access control (IAM)** → **+ Add role
   assignment** → role **Trusted Signing Certificate Profile Signer** → selecione
   a App `electron-builder-signing`.

---

## Passo 6 — Avise quando estiver pronto

Quando concluir os passos 1-5, me passa as seguintes informações **uma única vez**
(idealmente por mensagem segura, não em commit/git):

- `AZURE_TENANT_ID`
- `AZURE_CLIENT_ID` (Application ID do app registration)
- `AZURE_CLIENT_SECRET` (o Value que aparece uma vez)
- `AZURE_TRUSTED_SIGNING_ENDPOINT` (ex: `https://eus.codesigning.azure.net`,
   visível no Overview do Trusted Signing Account)
- `AZURE_TRUSTED_SIGNING_ACCOUNT` (`ts-radioibiza`)
- `AZURE_TRUSTED_SIGNING_PROFILE` (`radioibiza-public`)

Eu configuro o `electron-builder` para assinar automaticamente em
`npm run dist:win`. Você guarda essas credenciais no seu cofre — não vão
para o repositório.

---

## Como funciona depois de configurado

- A cada novo release Windows:
  ```bash
  npm run dist:win
  ```
- O `electron-builder` autentica no Azure, envia o `.exe` para assinatura, e
  baixa o binário assinado. Não há custo por assinatura (incluído no plano básico).
- Cliente baixa o `.exe`, executa: SmartScreen mostra "Radio Ibiza" como
  publisher verificado. Sem clique extra, sem aviso de antivírus.

---

## Cancelamento / situação se parar de pagar

1. Azure → Trusted Signing Account → **Delete** ou apenas remover o método de pagamento.
2. `.exe` já assinados continuam funcionando nos clientes (Windows não revoga
   retroativamente).
3. Novas releases voltam a sair sem signing (cliente vê SmartScreen "publisher
   desconhecido" como antes).
4. Sem multa, sem contrato anual.

---

## Alternativas caso CNPJ tenha < 3 anos

A Microsoft exige histórico de empresa estabelecida. Se o CNPJ for novo:

- **OV (Organization Validated)**: US$ 200-500/ano via SSL.com, Sectigo, Certum.
  Vem em token USB físico. SmartScreen leva semanas/meses pra construir reputação.
- **EV (Extended Validation)**: US$ 300-700/ano. Token USB. SmartScreen direto,
  mas validação de empresa mais rigorosa.
- **Sem signing**: cliente faz "Executar mesmo assim" na primeira instalação.

Recomendação se CNPJ < 3 anos: começar sem signing e migrar para Azure Trusted
Signing quando o CNPJ atingir 3 anos. Cliente final não nota diferença
estrutural — só perde o conforto do SmartScreen aceitar direto.
