/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        neo: {
          bg: "#FFFDF5",
          ink: "#000000",
          accent: "#FF6B6B",
          secondary: "#FFD93D",
          muted: "#C4B5FD",
          ok: "#4ADE80",
          blue: "#4D96FF",
          pink: "#FF6FB5",
          orange: "#FF9F45",
          teal: "#2EC4B6",
          lime: "#B5E61C",
        },
      },
      fontFamily: {
        display: ["Space Grotesk", "system-ui", "sans-serif"],
        sans: ["Space Grotesk", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "neo-sm": "4px 4px 0px 0px #000",
        "neo": "8px 8px 0px 0px #000",
        "neo-lg": "12px 12px 0px 0px #000",
        "neo-xl": "16px 16px 0px 0px #000",
        "neo-inv": "8px 8px 0px 0px #FFFDF5",
      },
      keyframes: {
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "pop-in": {
          "0%": { transform: "scale(0.9) translateY(8px)", opacity: "0" },
          "100%": { transform: "scale(1) translateY(0)", opacity: "1" },
        },
      },
      animation: {
        "spin-slow": "spin-slow 10s linear infinite",
        "pop-in": "pop-in 0.18s ease-out",
      },
    },
  },
  plugins: [],
};
