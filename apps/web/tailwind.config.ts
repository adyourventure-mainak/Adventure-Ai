import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#fff8ed",
          100: "#ffefd4",
          400: "#ff9d3d",
          500: "#fb7f14",
          600: "#ec640a",
          700: "#c44a0b",
          900: "#7e330f",
        },
        ink: {
          50: "#f6f6f7",
          100: "#e2e3e6",
          400: "#83858f",
          600: "#4c4e57",
          800: "#25262c",
          900: "#161619",
          950: "#0b0b0d",
        },
      },
    },
  },
  plugins: [],
};

export default config;
