# Backup em ZIP e restauração num projeto novo (Cursor)

## O que é gerado

Na pasta `backups/` (na raiz do repositório) existem dois ficheiros, com data no nome:

1. **`radio-ibiza-player-4-DOCUMENTACAO-AAAA-MM-DD.zip`**  
   Documentação: Markdown principal, pasta `docs/`, `.cursorrules`, `netlify.toml` (referência de deploy).

2. **`radio-ibiza-player-4-PROJETO-COMPLETO-AAAA-MM-DD.zip`**  
   **Cópia o mais integral possível** da pasta do projeto: código, **`.git`**, **`node_modules`** (se existir), **`dist`** / **`dist-electron`** (se existirem), **`.env` / `.env.local`** etc.  
   **Só não entra** a própria pasta `backups/` (para não meter ZIP dentro de ZIP) e ficheiros `.DS_Store`.

### Segurança no Drive

O ZIP completo pode conter **credenciais locais** (`.env*`) e **tokens em cache** dentro de `node_modules` não — mas `.env` sim. Trata o ficheiro como **confidencial**: pasta privada no Google Drive, encriptação opcional do Google, **não partilhes** o link publicamente.

## Como gerar de novo

Cópia completa (recomendado para arquivo «tenho tudo»):

```bash
npm run backup:zip
```

Só se quiseres ZIP **pequeno** de novo (~10–20 MB + `.git`), sem `node_modules` nem `dist`:

```bash
npm run backup:zip:leve
```

Ou diretamente:

```bash
./scripts/criar-backups-zip.sh
BACKUP_LEVE=1 ./scripts/criar-backups-zip.sh
```

## Restaurar no Cursor

1. Descompacte o ZIP **`…-PROJETO-COMPLETO-…`** numa pasta (ex.: `~/projetos/radio-ibiza-player-4`).
2. No Cursor: **File → Open Folder** nessa pasta.
3. Se **já vier** `node_modules` no ZIP: podes tentar logo `npm run dev` (em geral funciona na mesma família de SO).
4. Se mudares de máquina ou der erro em dependências nativas: apaga `node_modules` e corre `npm install` outra vez.
5. Sem `dist` no ZIP ou após mudanças: `npm run build` gera de novo.

## Guardar no Google Drive

Envia **os dois** ZIPs (documentação + projeto completo). O de documentação é pequeno; o de projeto reflete o estado da tua cópia local **incluindo dependências instaladas**, se existirem.

## Histórico Git

O ZIP completo inclui `.git` se existir na origem.
