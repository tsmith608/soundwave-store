/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        serif: ["var(--font-serif)", "Cormorant Garamond", "Georgia", "serif"],
        sans: ["var(--font-sans)", "Inter", "-apple-system", "sans-serif"],
      },
      colors: {
        "bg-primary": "#FAF7F2",
        "bg-secondary": "#F4EFEB",
        "bg-card": "#FFFFFF",
        "bg-card-hover": "#FDFBF7",
        "accent-gold": "#B76E79",
        "accent-gold-hover": "#A05C66",
        "accent-rosegold": "#B76E79",
        "accent-rosegold-hover": "#A05C66",
        cream: {
          50: "#FDFBF7",
          100: "#FAF7F2",
          200: "#F4EFEB",
          300: "#EAE3DC",
        },
        blush: {
          50: "#FDF6F5",
          100: "#F7E8E5",
          200: "#E8C5B8",
          300: "#D9A596",
          500: "#B76E79",
          600: "#9E5560",
        },
        sage: {
          50: "#F4F7F4",
          100: "#E3EAE2",
          200: "#C4D4C3",
          400: "#8A9A86",
          500: "#738671",
          600: "#63745F",
        },
        sand: {
          50: "#FAF7F2",
          100: "#F0EAE1",
          200: "#D8C7B5",
          400: "#A68B6D",
          500: "#A67C52",
          600: "#7A6347",
        },
        charcoal: {
          700: "#4A453F",
          800: "#3D3A36",
          900: "#2D2A26",
        },
      },
    },
  },
  plugins: [],
};
