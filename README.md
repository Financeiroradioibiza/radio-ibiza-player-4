# Radio Ibiza Player 4.0

> **👋 Continuando o desenvolvimento?** Comece pelo arquivo [`START_HERE.md`](./START_HERE.md).

Player moderno que se comunica com o webservice legado do Radio Ibiza,
sem precisar mexer no backend PHP.

## Dois targets, mesmo código

Este projeto gera **duas versões** a partir do mesmo código fonte:

### 🌐 PWA (versão padrão)

Para a maioria dos clientes. Roda no navegador, instalável como aplicativo
("Adicionar à tela inicial"). Storage no perfil do navegador.

**Use quando:** o cliente tem 1 PDV = 1 perfil de Windows. Sem necessidade
de instalação. Atualiza sozinho via Service Worker.

### 🖥️ Electron (versão multiusuário Windows)

Para os 2 clientes específicos que demandam multiusuário Windows.
Instalador `.exe` que vira aplicativo nativo. Storage em
`C:\ProgramData\RadioIbizaPlayer\` — compartilhado entre todos os usuários
Windows do PC. Token amarrado à máquina.

**Use quando:** o PDV tem múltiplos usuários Windows (gerente, caixa, etc.)
e o player precisa funcionar pra todos sem cada um ter que logar.

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                   UI (React + Tailwind)                     │
│         LoginPage  SelecionarPdvPage  PlayerPage            │
├─────────────────────────────────────────────────────────────┤
│            store (Zustand)  ←  hooks reagem aqui            │
├─────────────────────────────────────────────────────────────┤
│   api/webservice.ts          storage/Storage (interface)    │
│   ↓                          ↓                              │
│   fetch() pro                ┌─ IndexedDBStorage  (PWA)     │
│   webservice CakePHP         └─ FileSystemStorage (Electron)│
└─────────────────────────────────────────────────────────────┘
```

A camada `storage` é uma **interface única** com duas implementações.
O resto do app não sabe se está rodando em PWA ou Electron — chama
sempre o mesmo `storage.getSessao()`, `storage.salvarAudio()`, etc.

## Stack

- **Vite** + **React 18** + **TypeScript** — base sólida
- **TailwindCSS** — UI rápida e consistente
- **Zustand** — gerenciamento de estado simples
- **Dexie.js** — wrapper amigável pra IndexedDB (versão PWA)
- **React Router** — navegação entre telas
- **Electron** (a vir) — empacotamento desktop

## Como rodar localmente (modo PWA — desenvolvimento)

```bash
npm install
npm run dev
```

Sobe em `http://localhost:5173`. O Vite faz **proxy** das chamadas
`/api/*` → webservice de produção, contornando CORS em dev.

## Estrutura de pastas

```
radio-ibiza-player-4/
├── src/
│   ├── api/                # Cliente HTTP do webservice
│   │   ├── config.ts       # URLs, limites, deviceId
│   │   └── webservice.ts   # Todos os endpoints mapeados
│   ├── storage/            # Camada de persistência (abstrata)
│   │   ├── Storage.ts             # Interface única
│   │   ├── IndexedDBStorage.ts    # Implementação PWA
│   │   ├── FileSystemStorage.ts   # Implementação Electron
│   │   └── index.ts               # Fábrica que escolhe na hora
│   ├── store/              # Estado global (Zustand)
│   │   └── app.ts
│   ├── types/              # Definições TS dos JSONs do webservice
│   │   └── webservice.ts
│   ├── components/         # Componentes UI reutilizáveis
│   ├── pages/              # Telas
│   │   ├── LoginPage.tsx
│   │   ├── SelecionarPdvPage.tsx
│   │   └── PlayerPage.tsx
│   ├── player/             # (a vir) Engine de áudio/agendas/programação
│   ├── hooks/              # (a vir) Custom hooks
│   ├── utils/              # (a vir) Helpers diversos
│   ├── main.tsx            # Entrypoint React
│   ├── App.tsx             # Router
│   └── index.css           # Tailwind
├── electron/               # (a vir na Etapa 3B)
│   ├── main.ts             # Processo principal Electron
│   ├── preload.ts          # Ponte segura UI ↔ Node
│   └── storage-handler.ts  # I/O em C:\ProgramData\
├── public/                 # Ícones e assets estáticos
├── PROTOCOLO_WEBSERVICE.md # Bíblia da comunicação com o backend
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## Status do desenvolvimento

### ✅ Completo
- Login (email/senha)
- Roteamento por status
- Camada Storage abstrata (PWA e Electron)
- Persistência local (IndexedDB)
- Cliente HTTP com todos os endpoints do webservice
- Types TypeScript dos JSONs do backend
- Estrutura de fila offline (analytics)

### 🚧 Em andamento
- Implementação real da seleção de PDV (depende de ver dados reais)

### 📋 Próximas etapas
- **Etapa 2B**: Engine do player (áudio, agendas, programação, ping)
- **Etapa 3A**: Empacotamento PWA (Service Worker, manifest, ícones)
- **Etapa 3B**: Empacotamento Electron (main process, autoinit, bandeja, instalador)

## Documentação adicional

- `PROTOCOLO_WEBSERVICE.md` — referência completa de todos os endpoints
  do webservice CakePHP, com exemplos de request/response.
