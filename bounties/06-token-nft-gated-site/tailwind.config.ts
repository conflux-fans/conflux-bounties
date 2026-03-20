import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        paper: "#f1efe8",
        surface: "#fcfaf7",
        ink: {
          DEFAULT: "#0c1210",
          muted: "#5c6562",
          faint: "#8a9591",
        },
        accent: {
          DEFAULT: "#0f766e",
          hover: "#0d5c56",
          soft: "#ccfbf1",
          muted: "#5eead4",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(12, 18, 16, 0.04), 0 12px 32px -12px rgba(12, 18, 16, 0.12)",
        "card-sm": "0 1px 0 rgba(12, 18, 16, 0.06), 0 4px 16px -4px rgba(12, 18, 16, 0.08)",
      },
      backgroundImage: {
        "mesh-page":
          "radial-gradient(ellipse 100% 70% at 100% -15%, rgba(15, 118, 110, 0.14), transparent 52%), radial-gradient(ellipse 65% 45% at -5% 105%, rgba(180, 130, 70, 0.09), transparent 48%)",
      },
    },
  },
  plugins: [],
} satisfies Config;
