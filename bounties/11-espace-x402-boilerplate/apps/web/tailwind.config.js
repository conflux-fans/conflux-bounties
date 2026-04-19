const path = require("path");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    path.join(__dirname, "src/**/*.{js,ts,jsx,tsx,mdx}"),
  ],
  theme: {
    extend: {
      colors: {
        conflux: {
          blue: "#1E3A5F",
          teal: "#00B4D8",
          dark: "#0A1929",
          light: "#E2E8F0",
        },
      },
    },
  },
  plugins: [],
};
