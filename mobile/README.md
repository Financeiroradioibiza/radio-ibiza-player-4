# Mobile — lojas (Android / iOS)

Esta pasta concentra **tudo que é específico de telemóvel e distribuição nas lojas**,
para **não se misturar** com Windows, macOS ou Electron.

## O que **não** fica aqui

- **Código da app** (React, player, PWA): continua em **`src/`**, **`public/`**, **`vite.config.ts`**.
  O PWA que abre no Chrome do telemóvel é o mesmo build **WEB**; não há fork do player.
- **Desktop**: **`electron/`**, `build/*.ico`, NSIS, `VITE_IBIZA_TARGET=W` / `M`, etc. —
  **não tocar** ao trabalhar só em mobile/lojas.

## O que **fica** aqui

- Documentação e **templates** para Play Store / App Store (ex.: modelo de `assetlinks.json`).
- Projeto **Android TWA** gerado pelo Bubblewrap (quando existir) — ver subpastas abaixo.
- No futuro: assets só para ficha da loja (screenshots exportados, copies, checklists).

## Estrutura sugerida

```
mobile/
├── README.md                 ← este ficheiro
├── play-store/               ← modelos e notas Google Play (TWA)
│   └── assetlinks.json.example
└── android-twa/              ← (opcional) saída do Bubblewrap — ver .gitignore
```

Coloca o output do **Bubblewrap** em `mobile/android-twa/` (configura o caminho ao inicializar)
para manter o repositório organizado. Os **artefactos de build** (`build/`, `.gradle/`…)
ficam ignorados pelo git — ver `mobile/.gitignore`.

## Ligação ao site (Digital Asset Links)

O ficheiro **real** servido em produção continua a ser:

`public/.well-known/assetlinks.json`

O modelo com placeholders está em **`mobile/play-store/assetlinks.json.example`**.
Depois de preencheres `package_name` e `sha256_cert_fingerprints`, copia o JSON final
para `public/.well-known/assetlinks.json`, faz deploy no Netlify e valida o URL público.

## Documentação completa

Ver **`docs/PLAY-STORE-E-MOBILE.md`** (fluxo TWA, Play Console, testes, fase iOS).
