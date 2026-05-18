# Play Store, Android e iPhone — guia do Radio Ibiza Player (PWA)

Este documento alinha **o que já tens** (PWA em `player4.radioibiza.com.br`, offline, Chrome no telemóvel) com o caminho para **Google Play** e, mais tarde, **App Store**.

---

## 1. O que já está feito (sem loja)

- **PWA**: `vite-plugin-pwa` + manifest (`name`, ícones 192/512, `maskable`, `display: standalone`, `start_url: /`).
- **Telemóvel / tablet**: `viewport` responsivo, `PlayerPage` com `usePlayerViewportScale` para encaixar o cartão; tema e fluxo iguais ao desktop.
- **Offline**: Service Worker + IndexedDB — o que testaste (sem internet) é o comportamento esperado após primeira sincronização.
- **Ping**: `versao_player` em PWA Android usa sufixo **`wa`** (ver `src/api/config.ts`, DEC-009).

Ou seja: **a “alma” do produto na loja será a mesma URL**; a loja só acrescenta um **pacote Android/iOS** muito fino que abre essa origem em ecrã cheio.

---

## 2. Android: como aparecer na Play Store

A abordagem standard da Google para um site/PWA já em produção é **Trusted Web Activity (TWA)**:

1. Manténs o deploy atual no **Netlify** (nada muda na lógica React).
2. Geras um **projeto Android mínimo** (wrapper) que:
   - abre `https://player4.radioibiza.com.br/` (ou o domínio final) num Chrome sem UI de browser;
   - declara a relação de confiança com o site via **Digital Asset Links**.
3. Assinas o **APK/AAB** com uma chave própria e envias o **Android App Bundle** pela **Play Console**.

Ferramentas oficiais / comuns:

- **[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)** (CLI da Google) — gera o projeto Android a partir da URL do PWA.
- **[PWABuilder](https://www.pwabuilder.com/)** (Microsoft + parceiros) — fluxo guiado semelhante.

**Recomendação operacional**: começar pelo Bubblewrap na máquina de build (macOS ou Linux com Android Studio/SDK), ou PWABuilder se preferires menos terminal.

---

## 3. Pré-requisitos técnicos (checklist)

| Requisito | Estado no projeto | Nota |
|-----------|-------------------|------|
| Site em **HTTPS** | Sim (Netlify) | Obrigatório para PWA e TWA. |
| **Web App Manifest** servido (200, `application/manifest+json`) | Sim (gerado no build) | Bubblewrap/PWABuilder leem isto. |
| **Service Worker** | Sim | Melhora “instalabilidade” e offline. |
| Ficheiro **Digital Asset Links** no domínio | **A fazer** | Ver secção 5. |

**Play Console (conta e políticas)** — lado negócio, não código:

- Conta de programador Google Play (taxa única atual da Google).
- **Política de privacidade** URL pública (pode ser página estática no próprio site ou site da empresa).
- Classificação de conteúdo, dados recolhidos (para este player: essencialmente credenciais de sessão no teu backend; não vendas in-app neste MVP).
- **Screenshots** telefone + tablet (7 pol, 10 pol) e ícone 512×512 para a ficha.

---

## 4. Testar telemovel e tablet **antes** da loja (simulação local)

### 4.1 Chrome Desktop (rápido)

1. `npm run dev` ou apontar para produção.
2. DevTools (F12) → ícone **telefone/tablet** (Device Toolbar).
3. Escolher presets (ex.: Pixel 8, Galaxy, iPad).
4. Testar: login, player, rotação, instalação PWA (Chrome: menu “Instalar app…” quando elegível).

Isto **não** substitui Android real (áudio, gestos, memória são diferentes).

### 4.2 Android Emulator (Android Studio)

1. Instalar **Android Studio** → **Virtual Device** (AVD) com imagem recente (API 34+).
2. Abrir **Chrome** no emulador → `https://player4.radioibiza.com.br` (ou IP da máquina em dev com túnel tipo `ngrok` se precisares de HTTPS local).
3. Validar: som, segundo plano (limitações: reprodução em background pode parar conforme versão Android), “Adicionar à ecrã inicial”.

### 4.3 Dispositivo físico

- Mesmo URL em **Chrome** ou **Edge** Android.
- Instalar PWA e repetir testes offline (já validaste — manter como regressão antes de cada submissão à loja).

---

## 5. Digital Asset Links (`assetlinks.json`)

Para o TWA, o domínio do PWA tem de servir:

`https://player4.radioibiza.com.br/.well-known/assetlinks.json`

O conteúdo **depende** do:

- **package name** escolhido ao criar o projeto Android (ex.: `com.radioibiza.player`);
- **SHA-256** da chave com que assinas o app (Play App Signing mostra o fingerprint correcto depois da primeira configuração).

**Fluxo típico**:

1. Geras o projeto com Bubblewrap **uma primeira vez** (podes usar debug keystore para testes locais).
2. Para **produção**, usas a keystore de release (ou deixas a Google gerir com Play App Signing).
3. Copias o **SHA-256** que a documentação da Play mostra para a app.
4. Publicas `assetlinks.json` na pasta **`public/.well-known/`** deste repositório (o Netlify copia `public/` para a raiz do site). Exemplo de forma (valores fictícios — substituir):

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.radioibiza.player",
      "sha256_cert_fingerprints": [
        "AA:BB:CC:…:FF"
      ]
    }
  }
]
```

5. Fazes deploy; verificas no browser `…/.well-known/assetlinks.json` (200, JSON correcto).
6. No telemóvel, TWA só abre “sem barra de browser” se isto estiver certo (podes iterar com várias fingerprints se usares mais de uma chave).

*Nota:* até este ficheiro estar certo, o wrapper ainda pode abrir o site, mas o Chrome pode mostrar **barra superior** (fallback) — normal durante desenvolvimento.

---

## 6. Empacotar e enviar para a Play Store (resumo)

1. Gerar **Android App Bundle (.aab)** assinado (release).
2. **Play Console** → Criar app → preencher ficha, privacidade, screenshots.
3. Canal **interno** ou **fechado** primeiro (testadores Gmail) — recomendado.
4. Depois **produção** quando estiver estável.

O **update do player** (UI, lógica, correções): na maior parte dos casos **continua a ser só deploy Netlify**; só precisas de novo build Android se mudares **package name**, **assinatura crítica**, ou **config nativa** (ícone da loja, permissões extra).

---

## 7. iPhone / App Store (fase 2)

A Apple **não** usa TWA. Opções reais:

- **Safari → Partilhar → Adicionar ao Ecrã Inicial** (PWA) — já funciona para muitos clientes, **sem** ficha na App Store.
- Para **existir na App Store**: wrapper nativo (ex.: **Capacitor** + WKWebView apontando ao mesmo origin) ou solução equivalente; conta Apple Developer, revisão Apple, e eventualmente mais regras de conteúdo/áudio em background.

Recomendação: fechar **Android na Play Store**; depois avaliar se o negócio exige App Store ou se PWA iOS chega.

---

## 8. Ordem de trabalho sugerida (alinhada com a equipa)

1. **Documentação** — este ficheiro + screenshots internos; confirmar URL final e package name.
2. **UI/UX** — passar lista de ecrãs críticos em telemovel + tablet (login, player, primeira carga, instalar); corrigir só o que quebrar.
3. **Simulação** — DevTools + emulador + 1–2 físicos Android.
4. **TWA** — Bubblewrap ou PWABuilder; publicar `assetlinks.json`.
5. **Play** — track interno → produção.
6. **iOS** — decisão Capacitor vs só PWA; projeto separado quando for o caso.

---

## 9. Referências úteis

- [Trusted Web Activity — documentação Chrome](https://developer.chrome.com/docs/android/trusted-web-activity)
- [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) (ver README atualizado no repositório)
- `public/instalar.html` — guia para utilizadores (PWA no telemóvel)
- `DECISIONS.md` — DEC-009 (sufixos `versao_player`), DEC-011 (prioridade PWA)
- `docs/VERSOES.md` — tags `v4.x.x-A` quando houver release Android na loja

---

*Última atualização: 2026-05-18 — alinhado ao PWA actual no Netlify.*
