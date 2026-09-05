import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  root: 'frontend',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./frontend/src', import.meta.url)) } },
  build: { outDir: '../web-dist', emptyOutDir: true, target: 'es2022' },
  server: {
    host: '127.0.0.1',
    proxy: Object.fromEntries(['/api', '/preview.js', '/geometry.js', '/motion.js', '/animation-export.js', '/fonts', '/vendor', '/renders'].map(path => [path, 'http://127.0.0.1:8879'])),
  },
})
