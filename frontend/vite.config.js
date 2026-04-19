import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** FastAPI backend (override with VITE_PROXY_TARGET if needed). */
const API_TARGET = process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000'

/** Paths served by Lazarus backend — proxied in dev so the browser stays same-origin (fixes CORS + “Network Error”). */
const PROXY_PREFIXES = [
  '/api',
  '/assets',
  '/runs',
  '/run-analysis',
  '/graph',
  '/blueprints',
  '/generate-blueprint',
  '/photon',
  '/spectrum',
  '/portfolio',
  '/human-reviews',
  '/scan',
  '/watchlist',
  '/alerts',
  '/openclaw',
  '/strategy',
  '/memories',
  '/hypotheses',
]

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      PROXY_PREFIXES.map((path) => [
        path,
        {
          target: API_TARGET,
          changeOrigin: true,
          ...(path === '/runs' ? { ws: true } : {}),
        },
      ]),
    ),
  },
})
