/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#FAF9F6",
        surface: "#FFFFFF",
        ink: "#1C1B1A",
        primary: {
          DEFAULT: "#0E7C6B",
          dark: "#0B5F52",
        },
        accent: "#E8A33D",
        border: "#E5E2DC",
        danger: "#C1443D",
        success: "#1E7A4C",
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
}