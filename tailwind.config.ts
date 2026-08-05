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
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        // Cool mist canvas — outdoor HOA daylight, not cream
        canvas: "#f2f5f3",
        ink: {
          50: "#f6f8f7",
          100: "#ebefec",
          200: "#d5ddd7",
          300: "#b0bcb4",
          400: "#849288",
          500: "#66756c",
          600: "#505c55",
          700: "#414b45",
          800: "#373f3a",
          900: "#1c2420",
          950: "#0f1612",
        },
        // Forest road mark — RideBy green
        brand: {
          50: "#f0f7f2",
          100: "#dceee3",
          200: "#bbddc8",
          300: "#8dc5a5",
          400: "#5aa67c",
          500: "#3a8a5f",
          600: "#2b6f4b",
          700: "#23593d",
          800: "#1e4733",
          900: "#193b2b",
        },
        // Status / warning only (not a brand accent)
        signal: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#d97706",
          600: "#b45309",
          700: "#92400e",
          800: "#78350f",
          900: "#451a03",
        },
        // Legacy aliases so existing copper-/accent- classes keep compiling
        copper: {
          50: "#f0f7f2",
          100: "#dceee3",
          200: "#bbddc8",
          300: "#8dc5a5",
          400: "#5aa67c",
          500: "#3a8a5f",
          600: "#2b6f4b",
          700: "#23593d",
          800: "#1e4733",
          900: "#193b2b",
        },
        accent: {
          50: "#f0f7f2",
          100: "#dceee3",
          200: "#bbddc8",
          300: "#8dc5a5",
          400: "#5aa67c",
          500: "#3a8a5f",
          600: "#2b6f4b",
          700: "#23593d",
          800: "#1e4733",
          900: "#193b2b",
        },
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,22,18,0.04), 0 6px 20px rgba(15,22,18,0.05)",
        "card-hover": "0 2px 6px rgba(15,22,18,0.06), 0 12px 28px rgba(15,22,18,0.08)",
        nav: "0 1px 0 rgba(15,22,18,0.06)",
        soft: "0 1px 2px rgba(15,22,18,0.03)",
        cta: "0 1px 2px rgba(43,111,75,0.2), 0 8px 20px rgba(43,111,75,0.18)",
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
