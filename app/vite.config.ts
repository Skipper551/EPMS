import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// Relative base so the built folder works from any path (PocketBase Cloud frontend slot, GitHub Pages subfolder).
export default defineConfig({
  base: './',
  plugins: [preact()],
  // The version shown at the bottom of every page comes from package.json.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    rollupOptions: {
      input: { member: 'index.html', pm: 'pm.html' },
    },
  },
})
