/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3C1558',
          dark: '#2A0E3C',
          light: '#907AA6',
        },
        accent: '#F39B93',
      },
      fontSize: {
        'fluid-h1': 'clamp(2rem, 5vw, 3.5rem)',
        'fluid-h2': 'clamp(1.5rem, 4vw, 2.5rem)',
        'fluid-h3': 'clamp(1.25rem, 3vw, 2rem)',
        'fluid-h4': 'clamp(1.125rem, 2.5vw, 1.5rem)',
        'fluid-base': 'clamp(0.875rem, 2vw, 1rem)',
        'fluid-sm': 'clamp(0.75rem, 1.5vw, 0.875rem)',
        'fluid-xs': 'clamp(0.625rem, 1vw, 0.75rem)',
      },
      spacing: {
        'fluid-1': 'clamp(0.25rem, 1vw, 0.5rem)',
        'fluid-2': 'clamp(0.5rem, 2vw, 1rem)',
        'fluid-3': 'clamp(0.75rem, 3vw, 1.5rem)',
        'fluid-4': 'clamp(1rem, 4vw, 2rem)',
        'fluid-5': 'clamp(1.25rem, 5vw, 2.5rem)',
        'fluid-6': 'clamp(1.5rem, 6vw, 3rem)',
        'fluid-8': 'clamp(2rem, 8vw, 4rem)',
        'fluid-10': 'clamp(2.5rem, 10vw, 5rem)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
