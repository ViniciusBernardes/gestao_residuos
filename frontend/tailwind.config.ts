import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        /** 600/800/200/300 são referenciados no app; sem definição o Tailwind não gera a classe e botões com text-white ficam invisíveis no fundo claro até o hover (quando bg-brand-700 existia). */
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          500: '#059669',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
      },
    },
  },
  plugins: [],
};

export default config;
