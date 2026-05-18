# Backup em ZIP e restauração num projeto novo (Cursor)

## O que é gerado

Na pasta `backups/` (na raiz do repositório) existem dois arquivos, com data no nome:

1. **`radio-ibiza-player-4-DOCUMENTACAO-AAAA-MM-DD.zip`**  
   Documentação: Markdown principal, pasta `docs/`, `.cursorrules`, `netlify.toml` (referência de deploy).

2. **`radio-ibiza-player-4-PROJETO-PARA-CURSOR-AAAA-MM-DD.zip`**  
   Código e configuração **completa** para continuar o desenvolvimento: inclui `.git` (histórico), **exclui** `node_modules`, `dist`, `dist-electron`, `backups` e ficheiros `.env*` (não empacotar segredos por defeito).

## Como gerar de novo

```bash
npm run backup:zip
```

Ou diretamente:

```bash
./scripts/criar-backups-zip.sh
```

## Restaurar no Cursor

1. Descompacte o ZIP **`…-PROJETO-PARA-CURSOR-…`** numa pasta (ex.: `~/projetos/radio-ibiza-player-4`).
2. No Cursor: **File → Open Folder** nessa pasta.
3. No terminal integrado:
   ```bash
   npm install
   cp .env.example .env.local   # opcional: preencher variáveis conforme a tua máquina
   npm run dev
   ```
4. Se precisares de variáveis que existiam na máquina antiga, **recria-as** à mão (não vêm no ZIP por segurança).

## Guardar no Google Drive

Envia **os dois** ZIPs (documentação + projeto). O de documentação é pequeno e legível em qualquer lado; o de projeto permite rebuild completo.

## Histórico Git

O ZIP do projeto inclui `.git` **se existir** na pasta na hora do `rsync`. Para um arquivo apenas do estado atual sem histórico, podes apagar `.git` após descompactar (não recomendado se quiseres ramos/tags intactos).
