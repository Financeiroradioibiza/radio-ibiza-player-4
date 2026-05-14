# Registro de Decisões — Radio Ibiza Player 4.0

Decisões arquiteturais importantes e por quê foram tomadas.
Quando precisar mudar uma decisão, **adicione uma nova entrada** com a data e o
motivo — não apague o histórico. Isso evita repetir as mesmas conversas.

---

## DEC-001: Não modificar o backend PHP

**Data**: início do projeto
**Status**: aceito

**Decisão**: o webservice CakePHP existente fica como está. O player novo apenas
consome os endpoints atuais.

**Motivo**: 
- O backend tem clientes legados (players AS3 ainda em produção) usando os mesmos
  endpoints. Mudanças quebrariam compatibilidade
- Equipe pequena, risco alto de regressão num código complexo de 10 anos
- Estratégia de "estrangular o velho" (Strangler Pattern): substitui o cliente
  primeiro, backend pode evoluir depois

**Implicações**:
- CORS tem que ser resolvido fora do PHP (Apache/Nginx config, ou proxy reverso)
- Token continua sendo enviado por query string (não dá pra mudar pra header sem mexer no PHP)
- Todas as inconsistências do JSON do backend são absorvidas pelo cliente novo
  (campos string "S"/"N" em vez de boolean, IDs ora number ora string, etc.)

---

## DEC-002: Dois targets — PWA padrão + Electron multiusuário

**Data**: início do projeto
**Status**: superseded por DEC-009 (2026-05-14)

**Decisão**: o mesmo código gera duas versões: uma PWA (padrão) e uma Electron
(específica para 2 clientes que precisam multiusuário Windows).

**Motivo**:
- Maioria dos clientes têm 1 PDV = 1 perfil de Windows. PWA é mais simples e elegante
  pra eles (sem instalação, atualiza sozinho)
- Mas 2 clientes específicos têm múltiplos usuários Windows no mesmo PC e precisam
  que o player funcione pra todos sem cada um ter que logar
- PWA armazena dados no perfil do navegador (por usuário Windows), o que **não funciona**
  para esse caso. Electron acessa filesystem real e pode usar `C:\ProgramData\` (compartilhado)

**Implicações**:
- Camada `src/storage/` é abstrata. Toda a engine do player não sabe se está rodando
  em PWA ou Electron
- Custo extra mínimo: ~95% do código é compartilhado
- Manutenção: precisamos testar features em ambos os builds antes de release

**Alternativas consideradas**:
- ❌ PWA puro com truques (Chrome managed policies, `--user-data-dir`): frágil, foge
  do "instalar e esquecer"
- ❌ Electron pra todo mundo: overkill pra 90% dos clientes; instalador é mais atrito
- ✅ Atual: PWA simples + Electron quando necessário

---

## DEC-003: Stack — React + Vite + TS + Tailwind + Zustand + Dexie

**Data**: início do projeto
**Status**: aceito

**Decisão**: stack mainstream, sem "lib do mês".

**Motivo**:
- React + TS: padrão de mercado, fácil contratar, longa expectativa de vida
- Vite: builds rápidos, dev experience excelente, sem configuração mágica
- Tailwind: UI rápida, sem bagunça de CSS, paleta consistente
- Zustand (em vez de Redux): 10x menos código, mesma capacidade pra projeto deste tamanho
- Dexie (em vez de IndexedDB cru): API muito mais amigável

**O que NÃO usar**:
- Next.js: overkill pra SPA simples, complica empacotamento Electron
- shadcn/ui, MUI, Chakra: pesados, prendem em decisões de design
- Redux Toolkit: boilerplate desnecessário pra este escopo
- TanStack Query: o webservice é pequeno e tem peculiaridades que ficam mais claras
  com fetch direto

---

## DEC-004: Token persiste em texto puro no MVP

**Data**: início do projeto
**Status**: aceito (provisório — revisar pós-MVP)

**Decisão**: o token do PDV fica em texto puro no IndexedDB (PWA) ou em
`sessao.json` em texto puro (Electron). Sem criptografia.

**Motivo**:
- O player AS3 antigo guardava em SQLite local também sem criptografia (vimos no código)
- Em PWA, IndexedDB já é isolado por origem do navegador (outros sites não acessam)
- Em Electron, `C:\ProgramData\` precisa ter permissões corretas (combinar com instalador)
- Adicionar criptografia exige uma chave de criptografia, que precisaria estar em algum
  lugar acessível pro app — sem hardware key, é segurança ilusória

**Quando revisar**: se o cliente tiver requisito de compliance específico (LGPD além
do básico, certificação ISO, etc.)

---

## DEC-005: Alias `@/` para imports

**Data**: setup inicial
**Status**: aceito

**Decisão**: imports usam `@/` em vez de `../../../` ou paths relativos longos.

```ts
// ❌ Evitar
import { storage } from '../../../storage';

// ✅ Preferir
import { storage } from '@/storage';
```

**Motivo**: refatoração de pastas não quebra nada. Mais legível.

**Configurado em**: `tsconfig.json` (paths) e `vite.config.ts` (resolve.alias).

---

## DEC-006: Inglês no código, português na UI e comentários

**Data**: setup inicial
**Status**: aceito

**Decisão**:
- Variáveis e funções: inglês (`getMusica` é exceção porque mapeia endpoint)
- Texto visível ao usuário: português brasileiro
- Comentários e documentação: português
- Mensagens de commit: português

**Motivo**:
- Equipe é BR, projeto vai ser mantido por brasileiros
- Ainda assim, usar inglês em variáveis facilita pra ferramentas (LSP, IA assistente,
  Stack Overflow, etc.)
- Comentários em PT são mais ricos pra contexto cultural específico (PDV, vinheta, etc.)

---

## DEC-007: Erros do webservice não lançam exceção

**Data**: design da API client
**Status**: aceito

**Decisão**: erros "lógicos" do webservice (`mensagem: "token_invalido"`,
`mensagem: "usuario_invalido"`) **não** viram exceção. Voltam no body normal e
quem chama decide o que fazer.

**Motivo**:
- Bate com o comportamento do AS3 original (mais previsível pra quem migra mental)
- Esses erros são parte do fluxo normal (usuário digita senha errada não é "exceção")
- Evita try/catch verboso em todos os call sites
- Erros REAIS (rede, timeout, 5xx, JSON inválido) lançam `WebserviceError` normalmente

---

## DEC-008: Cliente fictício para testes em produção

**Data**: planejamento de testes
**Status**: aceito

**Decisão**: o desenvolvedor cria um usuário e PDV fictícios no painel admin para
testar o player novo contra o webservice real, sem afetar clientes reais.

**Motivo**:
- Não temos ambiente de homologação separado
- Testar contra dados reais é mais valioso que mocks
- PDV fictício pode ficar com `status: 'I'` quando não estiver em uso pra não poluir
  estatísticas do painel

---

## DEC-009: Nomenclatura de versões por target (WEB / W / M / A / I) e build único Electron

**Data**: 2026-05-14
**Status**: aceito (substitui DEC-002 sobre o "fork" multiusuário)

**Decisão**:
- Cada target tem um **identificador curto** usado em tags git e na string
  `versao_player` enviada ao webservice antigo no `/ping/`:
  - `WEB` — PWA hospedado (Netlify, hoje em `player4.radioibiza.com.br`)
  - `W` — Electron Windows
  - `M` — Electron Mac (futuro; por enquanto Mac usa PWA-instalado)
  - `A` — Android (PWA-instalado por enquanto; Capacitor opcional no futuro)
  - `I` — iOS (idem)
- Releases marcam tag git no padrão `vX.Y.Z-<id>` (ex: `v4.0.0-W`).
- **Um único build por OS desktop**: o Electron Windows é instalado em modo
  `perMachine` (admin uma vez no instalador, depois roda sem admin para todos
  os usuários Windows daquela máquina). Mesma cascarinha atende PDV single-user
  e os 1-2 PDVs multi-usuário — sem fork de manutenção, sem dois binários
  diferentes para suportar.

**Motivo**:
- Strings de versão padronizadas permitem **filtrar no painel admin antigo**
  quantos PDVs estão em cada target — necessário para decidir quando aposentar
  versões legadas (AIR 4.0W antigo, mobile antigo etc.).
- Manter dois builds Windows (per-user e per-machine) custaria mais em manutenção
  e suporte do que o atrito de pedir admin uma vez na instalação — atrito que
  já existia no AIR antigo e que os clientes já conhecem.
- Cascarinha Electron carrega a UI direto do site (`player4.radioibiza.com.br`),
  então **updates de UI/lógica não exigem reinstalar `.exe`** — só o deploy do
  Netlify. Isso compensa o atrito da instalação inicial.

**Implicações**:
- `electron/storage-handlers.mjs` mantém `C:\ProgramData\RadioIbizaPlayer\` como
  diretório de dados (compartilhado entre usuários Windows).
- `src/api/config.ts` passa a montar `versao_player` de acordo com o target em
  build-time (env `IBIZA_TARGET`).
- Catálogo dos binários e changelog vão em `docs/VERSOES.md`.

**Alternativas consideradas**:
- ❌ Dois builds (`perMachine` + `perUser`): 0,04% dos clientes precisariam do
  multi-usuário. Não compensa.
- ❌ `perUser` único: os 1-2 PDVs multi-usuário teriam que reinstalar por login.

---

## DEC-010: Code signing Windows via Azure Trusted Signing

**Data**: 2026-05-14
**Status**: aceito (pendente CNPJ ≥ 3 anos confirmado e conta Azure criada)

**Decisão**: assinar o `.exe` do Electron Windows usando **Azure Trusted Signing**
(US$ 9,99/mês). Mac e mobile seguem sem signing por enquanto (Mac via PWA-instalado,
mobile via PWA-instalado).

**Motivo**:
- Histórico de problemas com **antivírus de terceiros** bloqueando o `.exe`
  do player AIR — esse é o problema que code signing resolve diretamente.
- SmartScreen do Windows reconhece direto certificados Microsoft Authenticode
  (zero "publisher desconhecido"), sem período de reputação como em OV tradicional.
- Mais barato que EV (~US$ 120/ano vs US$ 300-700/ano) e sem token físico USB.
- Cancelável a qualquer mês (sem contrato anual), sem multa.

**Implicações**:
- Cliente final não vê nada do Azure (cert é nosso, no nosso build).
- Setup inicial demanda validação de empresa pela Microsoft (2-5 dias úteis).
- Conta Microsoft dedicada (tipo `tech@radioibiza.com.br`) — não usar e-mail pessoal.
- Releases assinadas continuam funcionando mesmo se cancelarmos o plano no futuro
  (Windows não revoga retroativamente).
- Procedimento operacional documentado em `docs/AZURE-TRUSTED-SIGNING.md`.

**Alternativas consideradas**:
- ❌ Sem signing: AVs continuariam bloqueando (histórico já comprovou o problema).
- ❌ OV tradicional (US$ 200-500/ano + token USB físico): mais caro, com reputação
  só amadurece após semanas/meses, e token físico vira ponto de falha.
- ❌ EV tradicional (US$ 300-700/ano + token USB): mesmo zero-fricção do Azure
  Trusted, mas pelo dobro/triplo do preço.

---

## DEC-011: Windows para a maioria (99%) = Chrome/PWA; Electron só em release dedicada (ex.: `4.0.1_W`)

**Data**: 2026-05-15
**Status**: aceito

**Decisão**:
- **Prioridade comercial imediata**: os ~99% dos PDVs Windows **sem** exigências de GPO
  multiusuário/`ProgramData` usam o **mesmo mecanismo do Chrome** que o PWA: motor
  e atualização vêm do site (`player4.radioibiza.com.br`). A “instalação” típica é
  **Instalar PWA** / atalho que abre o navegador em modo app — **não** distribuir
  o `.exe` Electron pesado como caminho padrão.
- **Depois**, para o **único (ou raro) cliente** com GPO rígida, multiusuário na
  mesma máquina e dados em `ProgramData`, lançamos uma **versão Windows
  separada** no **patch/ minor seguinte** (combinado: **`4.0.1-W`** em tags git /
  `4.0.1_W` no `/ping/`, ou rótulo comercial tipo “W4.01”). O código Electron +
  `electron-builder` que já existe no repo **fica reservado a essa linha**, não ao
  rollout da maioria.

**Motivo**:
- Menos atrito de download/tamanho, menos suporte (“é o mesmo link de sempre”).
- Alinha com o produto desejado: **toda a lógica continua no cliente web**; o
  pacote grande só se justifica onde o perfil do navegador **não** resolve.

**Implicações**:
- Release **4.0.0**: foco em tag `v4.0.0-WEB` + materiais de instalação PWA
  (`public/instalar.html`, etc.). Opcional depois: instalador **só atalhos**
  (NSIS leve) apontando para Chrome/Edge em `--app=…`.
- **Rotina de PDV (Windows 11 ou posterior, PWA):** orientar o cliente a **ativar o
  player na inicialização** usando **Configurações → Aplicativos → Inicialização**
  ou o atalho `ms-settings:appsstartup` (comportamento e rótulos validados para
  Windows 11+; Windows 10 costuma ser análogo). **Ao desligar ou reiniciar**, o app
  **encerra com a sessão** — não há serviço oculto em segundo plano; documentado em
  `instalar.html` e no material de implantação.
- Release **4.0.1-W** (ou nome comercial acordado): build Electron + signing
  (DEC-010) + NSIS `perMachine` para esse público restrito.
- `docs/VERSOES.md` separa as duas linhas; **não** misturar “Windows padrão” com
  “Windows enterprise” na mesma tag de marketing.

**Alternativas consideradas**:
- ❌ Um único `.exe` Electron para todos: desperdício de banda e confusão pra 99%.
- ❌ Só PWA e abandonar Electron: perderia o caso multiusuário/`ProgramData`.

---

## Template para novas decisões

```markdown
## DEC-NNN: <título>

**Data**: <quando>
**Status**: <proposto / aceito / superseded por DEC-XXX>

**Decisão**: <o que foi decidido, em 1-2 frases>

**Motivo**: 
- <ponto 1>
- <ponto 2>

**Implicações**:
- <ponto 1>
- <ponto 2>

**Alternativas consideradas**:
- <opção rejeitada e por quê>
```
