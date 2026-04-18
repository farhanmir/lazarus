/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',
        mist: '#eef2ff',
        pulse: '#1d4ed8',
        ember: '#f97316',
        signal: '#16a34a',
        evidence: '#7c3aed',
        hypothesis: '#dc2626',
      },
      boxShadow: {
        panel: '0 24px 48px rgba(15, 23, 42, 0.10)',
      },
    },
  },
  plugins: [],
}
