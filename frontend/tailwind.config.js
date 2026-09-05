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
        "primary": "#7D4F39",
        "primary-dark": "#643B28",
        "primary-container": "#643B28",
        "secondary": "#F6EDE7",
        "secondary-dark": "#643B28",
        "secondary-container": "#F1EDE6",
        "on-secondary-container": "#7D4F39",
        "tertiary": "#7D4F39",
        "tertiary-dark": "#643B28",
        "tertiary-rust": "#C86D3B",
        "tertiary-container": "#7D4F39",
        "background": "#FBF9F5",
        "surface": "#FAF7F2",
        "surface-container": "#F1EDE6",
        "surface-container-high": "#F1EDE6",
        "surface-container-low": "#F6EDE7",
        "surface-container-lowest": "#FFFFFF",
        "on-background": "#1E1B18",
        "on-surface": "#1E1B18",
        "on-surface-variant": "#645D56",
        "outline": "#8C827A",
        "outline-variant": "#E5DCD0",
        "error": "#B3261E",
        "error-container": "#FDF2F2",
        "statutory-jade": "#2D6A4F",
        "statutory-jade-bg": "#EBF5EE",
      },
      fontFamily: {
        sans: ["'Hanken Grotesk'", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        serif: ["'Libre Caslon Text'", "Georgia", "serif"],
        statutory: ["'Libre Caslon Text'", "Georgia", "serif"],
        display: ["'Cinzel'", "serif"],
        emblem: ["'Cinzel'", "serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        'stone': '0 4px 20px -2px rgba(125, 79, 57, 0.12), 0 2px 6px -1px rgba(30, 27, 24, 0.06)',
        'xs': '0 1px 2px rgba(30, 27, 24, 0.05)',
      },
    },
  },
  plugins: [],
};

export default config;

