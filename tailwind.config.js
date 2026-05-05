/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // paleta inspirada no player antigo (preto/dourado da identidade Radio Ibiza)
        ibiza: {
          gold: '#d4af37',
          dark: '#0a0a0a',
        },
      },
    },
  },
  plugins: [],
};
