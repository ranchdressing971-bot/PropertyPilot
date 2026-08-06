import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        canvas: "#ecefeb",
        ink: {
          50: "#f4f6f4",
          100: "#e6eae6",
          200: "#cfd6d0",
          300: "#a8b3aa",
          400: "#7a877d",
          500: "#5c685f",
          600: "#475149",
          700: "#39413b",
          800: "#2f3631",
          900: "#1a201c",
          950: "#0e1210",
        },
        // Cool compressor teal — HVAC, not SaaS blue/purple
        brand: {
          50: "#eef8f6",
          100: "#d5efe9",
          200: "#aee0d4",
          300: "#7cc9b8",
          400: "#4daa96",
          500: "#328f7b",
          600: "#247264",
          700: "#1f5b51",
          800: "#1c4a42",
          900: "#193e38",
        },
        accent: {
          50: "#eef8f6",
          100: "#d5efe9",
          200: "#aee0d4",
          300: "#7cc9b8",
          400: "#4daa96",
          500: "#328f7b",
          600: "#247264",
          700: "#1f5b51",
          800: "#1c4a42",
          900: "#193e38",
        },
        copper: {
          50: "#eef8f6",
          100: "#d5efe9",
          500: "#328f7b",
          600: "#247264",
          700: "#1f5b51",
        },
        signal: {
          50: "#fff8eb",
          100: "#feefc7",
          500: "#c47d0e",
          600: "#9a5f0a",
          700: "#7a4b0c",
        },
      },
      borderRadius: {
        lg: "0.5rem",
        xl: "0.625rem",
        "2xl": "0.75rem",
      },
      boxShadow: {
        card: "0 1px 0 rgba(14,18,16,0.04)",
        "card-hover": "0 1px 0 rgba(14,18,16,0.06)",
        nav: "0 -1px 0 rgba(14,18,16,0.08)",
        soft: "none",
        cta: "none",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "rise 0.35s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
