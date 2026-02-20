import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        conflux: {
          primary: '#1E3A5F',
          accent: '#00D4AA',
          dark: '#0A1628',
        },
      },
    },
  },
  plugins: [],
};

export default config;
