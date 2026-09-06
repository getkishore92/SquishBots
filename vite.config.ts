import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

const {version}=JSON.parse(readFileSync(new URL('./package.json',import.meta.url),'utf8'))

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  root: 'frontend',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./frontend/src', import.meta.url)) } },
  build: { outDir: '../web-dist', emptyOutDir: true, target: 'es2022' },
  server: {
    host: '127.0.0.1',
    proxy: Object.fromEntries(['/api', '/preview.js', '/fur-eyes.js', '/geometry.js', '/motion.js', '/animation-export.js', '/fonts', '/vendor', '/renders'].map(path => [path, 'http://127.0.0.1:8879'])),
  },
})
