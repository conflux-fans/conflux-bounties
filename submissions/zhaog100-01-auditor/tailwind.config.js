/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        conflux: {
          primary: '#1a56db',
          dark: '#1e293b',
        },
      },
    },
  },
  plugins: [],
};
