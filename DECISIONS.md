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
**Status**: aceito

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
