// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      fontSize: {
        '10xl': '10rem', // Custom extra huge size
        'super-huge': ['12rem', { lineHeight: '1', letterSpacing: '-0.05em' }], // Custom size with line height and letter spacing
      },
    },
  },
  plugins: [],
}