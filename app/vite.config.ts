import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

// Relative base so the built folder works from any path (PocketBase Cloud frontend slot, GitHub Pages subfolder).
export default defineConfig({
  base: './',
  plugins: [preact()],
  build: {
    rollupOptions: {
      input: { member: 'index.html', pm: 'pm.html' },
    },
  },
})
