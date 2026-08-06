/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefdf3', 100: '#d6f9e2', 300: '#7de8ab', 500: '#16a34a',
          600: '#0f8a3d', 700: '#0c6e31', 900: '#0a4a22',
        },
        accent: { 500: '#f59e0b', 600: '#d97706' },
      },
      borderRadius: { xl2: '1.25rem' },
    },
  },
  plugins: [],
};
