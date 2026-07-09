import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      colors: {
        canvas: "#f4f6f3",
        ink: {
          50: "#f7f7f6",
          100: "#eeefed",
          200: "#d9dbd7",
          300: "#b8bcb5",
          400: "#8b9088",
          500: "#6b7168",
          600: "#545a52",
          700: "#454a43",
          800: "#3a3e38",
          900: "#222521",
          950: "#121411",
        },
        // Sage — outdoor / HOA, not generic AI blue
        brand: {
          50: "#f3f7f4",
          100: "#e2ece4",
          200: "#c5d9ca",
          300: "#9bbda5",
          400: "#6f9c7d",
          500: "#4f7f5f",
          600: "#3d654a",
          700: "#32513c",
          800: "#2a4132",
          900: "#23362a",
        },
        copper: {
          50: "#faf6f1",
          100: "#f2e8db",
          200: "#e4cfb4",
          300: "#d3b087",
          400: "#c4925f",
          500: "#b57a45",
          600: "#9a6239",
          700: "#7c4d31",
          800: "#66402c",
          900: "#553627",
        },
        accent: {
          50: "#faf6f1",
          100: "#f2e8db",
          200: "#e4cfb4",
          300: "#d3b087",
          400: "#c4925f",
          500: "#b57a45",
          600: "#9a6239",
          700: "#7c4d31",
          800: "#66402c",
          900: "#553627",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(34,37,33,0.04), 0 4px 16px rgba(34,37,33,0.05)",
        "card-hover": "0 2px 4px rgba(34,37,33,0.05), 0 10px 28px rgba(34,37,33,0.08)",
        nav: "0 1px 0 rgba(34,37,33,0.06)",
      },
      animation: {
        "fade-in": "fadeIn 0.45s ease-out",
        "slide-up": "slideUp 0.45s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
