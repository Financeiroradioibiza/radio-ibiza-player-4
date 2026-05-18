# 👋 Comece por aqui

Guia rápido pra continuar o desenvolvimento deste projeto, seja você humano ou IA.

## Se você for o desenvolvedor abrindo no Cursor

1. **Abra o projeto no Cursor** (`File → Open Folder → radio-ibiza-player-4`)

2. **Instale as dependências**:
   ```bash
   npm install
   ```
   (vai baixar uns 200MB, demora 1-3 minutos)

3. **Rode o dev server**:
   ```bash
   npm run dev
   ```
   Abre em `http://localhost:5173`. Você vai ver a tela de login.

4. **Verifique no console do navegador (F12)**:
   - Deve aparecer `[storage] Modo PWA (IndexedDB + Cache Storage)`
   - Sem erros vermelhos

5. **Teste o login**:
   - Com credenciais inválidas: deve mostrar "Login inválido"
   - Com credenciais válidas (do cliente fictício): deve avançar pra `SelecionarPdv`
     mostrando o JSON cru de PDVs
   - Se der erro de rede/CORS: ver "CORS em desenvolvimento" abaixo

6. **Pra gerar ZIP de documentação + cópia completa do projeto** (incl. `node_modules`/`dist` se existirem): `npm run backup:zip` — ver `docs/BACKUP-E-RESTAURACAO.md`. ZIP pequeno: `npm run backup:zip:leve`.

7. **Quando estiver pronto pra continuar**: abra `ROADMAP.md` e siga as tarefas em ordem.

## Se você for uma IA (Cursor Composer, ChatGPT, Claude, etc.)

Antes de fazer qualquer coisa, leia em ordem:

1. `CONTEXTO_PARA_IA.md` — visão geral em 3 minutos
2. `.cursorrules` — convenções de código
3. `PROTOCOLO_WEBSERVICE.md` — como o backend antigo funciona
4. `DECISIONS.md` — por quê as escolhas foram feitas
5. `ROADMAP.md` — próximas tarefas

Esses 5 arquivos têm tudo que você precisa pra continuar de onde parou sem
perder contexto. Quando precisar implementar algo novo, prefira:
- Criar arquivos pequenos e focados (SRP)
- Comentários em português
- TypeScript estrito (zero `any`)
- Imports com alias `@/`
- Seguir os padrões já estabelecidos nos arquivos existentes

## CORS em desenvolvimento

O Vite faz proxy: chamadas pra `/api/*` no dev são redirecionadas pro
servidor de produção. Se aparecer erro de CORS:

- Confirme em `vite.config.ts` que a `WEBSERVICE_URL` está correta
- Confirme que `src/api/config.ts` está usando `/api` em dev (deve estar automático)
- Reinicie o `npm run dev` (Vite cacheia a config)

## CORS em produção

Em produção o app não pode usar o proxy do Vite. Opções (a combinar com cliente):

- **A** Configurar headers CORS no Apache/Nginx do servidor
- **B** Cloudflare Worker como proxy (10 linhas)
- **C** Servir o PWA do mesmo domínio do webservice

A versão Electron **não tem CORS** — funciona direto.

## Fluxo recomendado de trabalho

1. Pegue uma tarefa do `ROADMAP.md` (em ordem, de cima pra baixo)
2. Crie um branch: `git checkout -b feature/<nome-curto>`
3. Implemente com testes manuais (não temos suite automatizada ainda)
4. Atualize o `ROADMAP.md` riscando a tarefa
5. Se tomou alguma decisão arquitetural nova, registre em `DECISIONS.md`
6. Commit em português: `git commit -m "feat: implementa seleção de PDV"`
7. Push e merge

## Em caso de dúvida

- **Sobre o webservice**: o projeto antigo tem o código fonte do servidor
  (CakePHP). Procure no controller `WebserviceController.php`
- **Sobre o player AS3 antigo**: arquivos relevantes são `Player.as`, `Login.as`,
  `Ping.as`, `WindowPDVs.as`, `VerificarProgramacao.as`. O comportamento do player
  novo deve **igualar** o antigo nesses pontos
- **Sobre arquitetura**: `DECISIONS.md` provavelmente já discute. Se não,
  registre uma nova decisão lá

## ⚠️ ATENÇÃO

- **NUNCA** copie credenciais que aparecerem em arquivos do projeto legado pra este
  projeto novo. Os arquivos antigos tinham várias credenciais hardcoded — nada disso
  vem pra cá. Se encontrar alguma, **avise pra remover do legado e trocar**
- **NUNCA** logue tokens completos, emails ou senhas no console em produção
- O backend antigo tem vulnerabilidades conhecidas (SQL injection, salt fraco) — isso
  é problema do backend, não do player. **Não** discuta isso publicamente
