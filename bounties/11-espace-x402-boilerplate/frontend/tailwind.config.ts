import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1a73e8',
        conflux: '#1f2937',
      },
    },
  },
  plugins: [],
};

export default config;
