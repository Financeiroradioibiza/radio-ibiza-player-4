# Shells PWA (DEC-012)

Separação **física** da UI que pode divergir entre PC e telemóvel/tablet (prefixo `/m`).

## Onde editar

| O quê | Pasta |
|--------|--------|
| **Layout / cópias / fluxo visual desktop** | `src/shells/desktop/pages/` |
| **Layout / cópias / fluxo visual mobile** | `src/shells/mobile/pages/` |
| **Instalação (HTML estático)** | `public/instalar.html` (PC) · `public/m/instalar.html` (mobile) |
| **Loja Android (TWA)** | `mobile/` (Gradle — não é React) |
| **Lógica partilhada** (API, player, storage, hooks genéricos) | `src/api/`, `src/player/`, `src/storage/`, `src/components/` quando forem agnósticos |

## Regras

- **Sem imports cruzados** entre `shells/desktop/**` e `shells/mobile/**` — `npm run lint:shells`.
- Os ficheiros em `src/pages/LoginPage.tsx` (etc.) são **re-exports** para compatibilidade; rotas novas devem importar directamente de `shells/.../pages/`.
- Hoje as quatro páginas mobile são **cópias** das desktop; ao corrigir bugs que afectem ambos, convém actualizar os dois ficheiros **ou** extrair só a lógica para um hook/`src/` neutro (nunca UI desktop a importar mobile ou o contrário).
