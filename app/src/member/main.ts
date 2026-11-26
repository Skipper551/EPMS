// The site root is both the landing page and the member app. The inline script in index.html has already
// decided which one this visit is (html.as-app or html.as-landing) before anything is drawn.
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'

if (document.documentElement.classList.contains('as-app')) {
  document.getElementById('landing')?.remove()
  import('./app')
} else {
  document.getElementById('app')?.remove()
  import('../landing/main')
}
