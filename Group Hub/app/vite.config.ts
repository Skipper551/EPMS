import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { resolve } from 'node:path'

// Relative base so the built folder works from any path (PocketBase Cloud frontend slot, GitHub Pages subfolder).
export default defineConfig({
  base: './',
  plugins: [preact()],
  build: {
    rollupOptions: {
      input: {
        member: resolve(__dirname, 'index.html'),
        pm: resolve(__dirname, 'pm.html'),
      },
    },
  },
})
