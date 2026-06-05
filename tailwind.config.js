/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.ejs",
    "./public/**/*.html"
  ],
  theme: {
    extend: {
      fontFamily: {
        alkes: ['Alkes', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

