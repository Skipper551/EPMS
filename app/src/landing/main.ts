// The landing page at the site root (see member/main.ts). Opens screenshots larger on click, and hands over to the
// app when a link on the page changes the address to an app address such as #start.
import './landing.css'

const ANCHORS = /^#(how|features|open-source|faq)?$/

window.addEventListener('hashchange', () => {
  if (ANCHORS.test(location.hash)) return
  // Open the app at the top, not at the spot the landing page was scrolled to.
  history.scrollRestoration = 'manual'
  window.scrollTo(0, 0)
  location.reload()
})

const dialog = document.querySelector<HTMLDialogElement>('dialog.zoom')
const big = dialog?.querySelector('img')

document.querySelectorAll<HTMLImageElement>('img[data-zoom]').forEach((img) => {
  img.tabIndex = 0
  img.setAttribute('role', 'button')
  const open = () => {
    if (!dialog || !big) return
    big.src = img.currentSrc || img.src
    big.alt = img.alt
    dialog.showModal()
  }
  img.addEventListener('click', open)
  img.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } })
})

// Clicking the dark area around the picture closes it.
dialog?.addEventListener('click', (e) => { if (e.target === dialog) dialog.close() })
