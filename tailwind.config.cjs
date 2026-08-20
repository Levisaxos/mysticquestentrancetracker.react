/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          800: '#2a2a2a',
          900: '#1e1e1e',
        }
      }
    },
  },
  plugins: [],
}