/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "primary": "#638C6D",
        "primary-dark": "#3D6448",
        "primary-container": "#557E60",
        "secondary": "#E7FBB4",
        "secondary-dark": "#54642D",
        "secondary-container": "#D7EBA5",
        "on-secondary-container": "#5A6A32",
        "tertiary": "#DF6D2D",
        "tertiary-dark": "#9C3F00",
        "tertiary-rust": "#C84C05",
        "tertiary-container": "#BF5515",
        "background": "#FAFAF5",
        "surface": "#FFFDE7",
        "surface-container": "#F0EFE9",
        "surface-container-high": "#DAEDDC",
        "surface-container-low": "#E5F9E7",
        "surface-container-lowest": "#FFFFFF",
        "on-background": "#0F1F15",
        "on-surface": "#0F1F15",
        "on-surface-variant": "#414942",
        "outline": "#727971",
        "outline-variant": "#C1C8C0",
        "error": "#BA1A1A",
        "error-container": "#FFDAD6",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        serif: ["Source Serif 4", "Georgia", "serif"],
        statutory: ["Source Serif 4", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;

