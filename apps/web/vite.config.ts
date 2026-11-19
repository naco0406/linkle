import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const api = { target: process.env.API_TARGET ?? 'http://127.0.0.1:8801' }

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { target: 'es2022' },
  server: { proxy: { '/api': api } },
  preview: { proxy: { '/api': api } },
})
