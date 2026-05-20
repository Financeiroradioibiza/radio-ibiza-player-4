# Mobile — lojas (Android / iOS)

Esta pasta concentra **tudo que é específico de telemóvel e distribuição nas lojas**,
para **não se misturar** com Windows, macOS ou Electron.

## O que **não** fica aqui

- **Código da app** (React, player, PWA): continua em **`src/`**, **`public/`**, **`vite.config.ts`**.
  O PWA que abre no Chrome do telemóvel é o mesmo build **WEB**; não há fork do player.
- **Desktop**: **`electron/`**, `build/*.ico`, NSIS, `VITE_IBIZA_TARGET=W` / `M`, etc. —
  **não tocar** ao trabalhar só em mobile/lojas.

## O que **fica** aqui

- Projeto **Android TWA** (Bubblewrap) — **`app/`**, `gradlew`, `build.gradle`, `twa-manifest.json`.
- **`play-store/`** — modelo de Digital Asset Links e notas.
- Keystore de release: ficheiro **`android.keystore`** na raiz de **`mobile/`** (ver `.gitignore` na raiz do repo — **não** versionar).

## Estrutura actual (TWA)

```
mobile/
├── README.md                    ← este ficheiro
├── twa-manifest.json            ← config Bubblewrap (keystore relativa: android.keystore)
├── app/build.gradle             ← applicationId, host, launcherName…
├── app/src/main/…               ← Java TWA, recursos, manifest
├── gradle/, gradlew, …
├── play-store/
│   └── assetlinks.json.example  ← modelo; package já = br.com.radioibiza.player4.twa
└── store_icon.png               ← ícone loja (referência)
```

*(A documentação antiga falava em `android-twa/`; o Bubblewrap foi inicializado na raiz de `mobile/` — ambas as abordagens são válidas.)*

## Próximos passos (checklist)

1. **Conta Play Console** — após D‑U‑N‑S / verificação de organização (ou conta pessoal, se for esse o caminho).
2. **Keystore** — `mobile/android.keystore` local + palavras-passe em gestor de segredos (1Password, etc.); **backup** offline da keystore.
3. **Build release** — a partir de `mobile/` (Android Studio ou CLI), com `JAVA_HOME` e Android SDK:

   ```bash
   cd mobile
   ./gradlew bundleRelease
   ```

   O `.aab` sai em `app/build/outputs/bundle/release/` (pasta ignorada pelo git).

4. **Play App Signing** — na primeira subida, a consola mostra o **SHA-256** da chave de assinatura da app (ou da upload key). Copiar esse valor.
5. **Digital Asset Links** — preencher `mobile/play-store/assetlinks.json.example` com o(s) SHA-256 **reais**; copiar o JSON final para:

   `public/.well-known/assetlinks.json`

   A pasta existe no repo (`.gitkeep`). **Só** commitar `assetlinks.json` quando o fingerprint estiver correcto.
6. **Deploy Netlify** — publicar `/.well-known/assetlinks.json` em `https://player4.radioibiza.com.br`.
7. **Validar** — [Statement List Generator](https://developers.google.com/digital-asset-links/tools/generator) ou Chrome no dispositivo; TWA em ecrã cheio sem barra quando estiver correcto.
8. **Play** — track interna/fechada → produção.

## PWA no mesmo domínio (`/m/...`)

O build **WEB** (Netlify) serve o player em rotas **desktop** (`/login`, `/player`, …) e em **`/m/*`** para o shell optimizado a touch (ver **DEC-012** em `DECISIONS.md`). O **TWA** deve abrir uma URL sob **`/m/...`** (ex. `start_url` = `/m/login` ou `/m/player`) para alinhar com esse shell — não é obrigatório mudar o `host` no Bubblewrap, só o caminho inicial.

## Ligação ao site (Digital Asset Links)

O ficheiro **real** servido em produção é:

`public/.well-known/assetlinks.json`

O modelo com o **package** já definido está em **`mobile/play-store/assetlinks.json.example`**.  
Falta apenas substitute o **SHA-256** vindo da Play Console após configurar assinatura.

## Documentação completa

Ver **`docs/PLAY-STORE-E-MOBILE.md`** (fluxo TWA, testes, fase iOS).
