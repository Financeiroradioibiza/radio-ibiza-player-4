# Workflows de segurança — templates para ativação manual

Estes dois YAMLs deveriam morar em `.github/workflows/` mas precisam do **escopo
`workflow`** no Personal Access Token usado para push (token usado pelo agente
não tem). Para ativá-los basta um upload manual via interface web do GitHub,
~2 minutos:

## Passo a passo

1. Abrir o repositório no navegador:
   <https://github.com/Financeiroradioibiza/radio-ibiza-player-4>
2. Clicar em **Add file → Create new file**.
3. No campo de nome, digitar `.github/workflows/codeql.yml` (o GitHub cria as
   pastas automaticamente).
4. Copiar todo o conteúdo de [`codeql.yml`](./codeql.yml) deste diretório e
   colar no editor.
5. Descer até o fim, marcar **Commit directly to the `main` branch**, clicar
   **Commit new file**.
6. Repetir para `.github/workflows/npm-audit.yml` com o conteúdo de
   [`npm-audit.yml`](./npm-audit.yml).

Depois disso:

- O **CodeQL** roda na primeira segunda-feira seguinte (e em todo push/PR para
  `main`). Achados aparecem na aba **Security → Code scanning alerts**.
- O **npm audit** roda já no próximo push para `main` ou em qualquer PR.
  Bloqueia merge se entrar dep com CVE high/critical em produção.

## Ativações manuais complementares (≈ 30 segundos)

Estas ficam só na configuração do GitHub, não exigem arquivo no repo:

- **Settings → Code security and analysis**:
  - Marcar **Dependabot alerts** → recebe e-mail quando aparece CVE em alguma
    dep do projeto.
  - Marcar **Dependabot security updates** → quando o alerta acima dispara,
    o Dependabot já abre PR com o fix.
  - Marcar **Code scanning** se ainda não estiver ativo (geralmente fica ativo
    sozinho depois do primeiro run do CodeQL).

## Por que esses arquivos não foram comitados em `.github/workflows/`?

O GitHub bloqueia a criação ou modificação de arquivos em `.github/workflows/`
quando o PAT usado para `git push` não inclui o escopo `workflow`. Como o token
do agente não tem esse escopo, o push é rejeitado:

> remote: refusing to allow a Personal Access Token to create or update workflow
> `.github/workflows/codeql.yml` without `workflow` scope

A solução foi guardar os dois YAMLs aqui em `docs/seguranca-workflows-templates/`
como referência versionada — eles continuam no repositório, revisáveis em PR
futuro, e o operador só precisa fazer o upload manual uma vez.

Já o `.github/dependabot.yml` foi comitado normalmente, pois esse arquivo de
configuração não vive dentro de `.github/workflows/` e não exige o escopo
especial. **Dependabot já está ativo** assim que o operador habilitar
*Dependabot alerts* nas Settings.
