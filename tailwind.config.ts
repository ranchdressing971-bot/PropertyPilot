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
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      colors: {
        canvas: "#f6f4f0",
        ink: {
          50: "#f7f7f8",
          100: "#ececee",
          200: "#d5d5da",
          300: "#b0b0b9",
          400: "#858592",
          500: "#676774",
          600: "#52525e",
          700: "#43434d",
          800: "#2e2e36",
          900: "#1a1a20",
          950: "#0c0c10",
        },
        copper: {
          50: "#fbf5f0",
          100: "#f5e8dc",
          200: "#ead0b8",
          300: "#dcb08a",
          400: "#cf9160",
          500: "#c47844",
          600: "#b66339",
          700: "#974e2f",
          800: "#79412b",
          900: "#633726",
        },
        accent: {
          50: "#fbf5f0",
          100: "#f5e8dc",
          200: "#ead0b8",
          300: "#dcb08a",
          400: "#cf9160",
          500: "#c47844",
          600: "#b66339",
          700: "#974e2f",
          800: "#79412b",
          900: "#633726",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
