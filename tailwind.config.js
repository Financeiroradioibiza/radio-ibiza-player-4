/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-ui-theme="night"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        // Identidade Radio Ibiza: dourado legado + cores “pop” do material de marca (rede social)
        ibiza: {
          gold: '#d4af37',
          dark: '#0a0a0a',
          magenta: '#e11d8c',
          lemon: '#facc15',
          purple: '#8b5cf6',
          forest: '#22c55e',
          sky: '#38bdf8',
        },
      },
      backgroundImage: {
        // Shell tipo mesh: mancha magenta/roxo/amarelo + base quase preta (leitura Spotify + cartazes)
        'ibiza-shell':
          'radial-gradient(ellipse 90% 65% at 12% -8%, rgba(225, 29, 140, 0.18), transparent 52%), radial-gradient(ellipse 70% 50% at 92% 8%, rgba(139, 92, 246, 0.16), transparent 48%), radial-gradient(ellipse 55% 40% at 50% 102%, rgba(250, 204, 21, 0.06), transparent 55%), radial-gradient(ellipse 50% 35% at 78% 55%, rgba(56, 189, 248, 0.08), transparent 50%), #08080a',
        // Pele diurna: mesh suave sobre base quase branca (contraste legível com texto escuro).
        'ibiza-shell-day':
          'radial-gradient(ellipse 95% 70% at 10% -5%, rgba(225, 29, 140, 0.09), transparent 55%), radial-gradient(ellipse 75% 55% at 95% 0%, rgba(139, 92, 246, 0.08), transparent 52%), radial-gradient(ellipse 60% 45% at 50% 105%, rgba(250, 204, 21, 0.07), transparent 58%), radial-gradient(ellipse 55% 40% at 82% 48%, rgba(56, 189, 248, 0.06), transparent 52%), #f4f2f8',
        // Cartões / destaque (gradiente editorial)
        'ibiza-card-wash':
          'linear-gradient(135deg, rgba(225, 29, 140, 0.12) 0%, rgba(12, 10, 12, 0.92) 45%, rgba(139, 92, 246, 0.1) 100%)',
      },
      boxShadow: {
        'ibiza-glow': '0 0 48px -12px rgba(212, 175, 55, 0.22)',
        // brilho multi-cor (instagram + neon suave)
        'ibiza-pop':
          '0 0 40px -10px rgba(225, 29, 140, 0.35), 0 0 56px -14px rgba(250, 204, 21, 0.12), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        panel: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
      },
      keyframes: {
        'ibiza-play-beacon': {
          '0%, 100%': {
            boxShadow:
              '0 0 0 0 rgba(250, 204, 21, 0.45), 0 0 18px -2px rgba(225, 29, 140, 0.55)',
            transform: 'scale(1)',
          },
          '50%': {
            boxShadow:
              '0 0 0 10px rgba(250, 204, 21, 0), 0 0 26px 0 rgba(225, 29, 140, 0.45)',
            transform: 'scale(1.07)',
          },
        },
      },
      animation: {
        'ibiza-play-beacon': 'ibiza-play-beacon 1.25s ease-in-out infinite',
      },
    },
  },
  plugins: [
    function ibizaPlayerLayoutVariants({ matchVariant }) {
      /** Telemóvel / tablet (dedo) ou viewport estreita — ecrã cheio no player. */
      matchVariant('ibiza-touch', () => '@media (max-width: 1023px), (pointer: coarse)');
      /** Portátil / desktop com rato — cartão centrado (layout clássico). */
      matchVariant('ibiza-desk', () => '@media (min-width: 1024px) and (pointer: fine)');
    },
  ],
};
