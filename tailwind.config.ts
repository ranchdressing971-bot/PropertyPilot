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
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        canvas: "#f4f6f9",
        ink: {
          50: "#f7f8fa",
          100: "#eef1f5",
          200: "#d9e0ea",
          300: "#b7c3d4",
          400: "#8799b2",
          500: "#667991",
          600: "#4f6076",
          700: "#404d60",
          800: "#374251",
          900: "#1e2633",
          950: "#111722",
        },
        brand: {
          50: "#eef5ff",
          100: "#d9e8ff",
          200: "#bcd6ff",
          300: "#8ebcff",
          400: "#5997ff",
          500: "#3371f5",
          600: "#1f54e8",
          700: "#1a42d0",
          800: "#1c38a8",
          900: "#1c3484",
        },
        accent: {
          50: "#eef5ff",
          100: "#d9e8ff",
          200: "#bcd6ff",
          300: "#8ebcff",
          400: "#5997ff",
          500: "#3371f5",
          600: "#1f54e8",
          700: "#1a42d0",
          800: "#1c38a8",
          900: "#1c3484",
        },
        copper: {
          50: "#eef5ff",
          100: "#d9e8ff",
          200: "#bcd6ff",
          300: "#8ebcff",
          400: "#5997ff",
          500: "#3371f5",
          600: "#1f54e8",
          700: "#1a42d0",
          800: "#1c38a8",
          900: "#1c3484",
        },
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
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(17,23,34,0.04), 0 8px 24px rgba(17,23,34,0.06)",
        "card-hover": "0 2px 8px rgba(17,23,34,0.06), 0 14px 32px rgba(17,23,34,0.08)",
        nav: "0 -1px 0 rgba(17,23,34,0.06), 0 -8px 24px rgba(17,23,34,0.04)",
        soft: "0 1px 2px rgba(17,23,34,0.03)",
        cta: "0 1px 2px rgba(31,84,232,0.2), 0 8px 20px rgba(31,84,232,0.22)",
      },
      animation: {
        "fade-in": "fadeIn 0.35s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
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
