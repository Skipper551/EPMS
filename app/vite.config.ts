import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

/** The commit this build comes from (GitHub Actions sets GITHUB_SHA; locally ask git), shortened. '' if unknown. */
function commit(): string {
  const fromCi = process.env.GITHUB_SHA
  if (fromCi) return fromCi.slice(0, 7)
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return ''
  }
}

// Relative base so the built folder works from any path (PocketBase Cloud frontend slot, GitHub Pages subfolder).
export default defineConfig({
  base: './',
  plugins: [preact()],
  // The version and commit shown at the bottom of every page.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(commit()),
  },
  build: {
    rollupOptions: {
      // test/: preview of the student-facing landing page, not linked from the site.
      input: { member: 'index.html', pm: 'pm.html', landing: 'test/index.html' },
    },
  },
})
