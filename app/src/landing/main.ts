// Landing page preview (/test). Static HTML; this only loads the fonts and styles and opens screenshots larger on click.
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import './landing.css'

const dialog = document.querySelector<HTMLDialogElement>('dialog.zoom')
const big = dialog?.querySelector('img')

document.querySelectorAll<HTMLImageElement>('img[data-zoom]').forEach((img) => {
  img.tabIndex = 0
  img.setAttribute('role', 'button')
  const open = () => {
    if (!dialog || !big) return
    big.src = img.currentSrc || img.src
    big.alt = img.alt
    dialog.classList.toggle('zoom-tall', img.naturalHeight > img.naturalWidth)
    dialog.showModal()
  }
  img.addEventListener('click', open)
  img.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } })
})

// Clicking the dark area around the picture closes it.
dialog?.addEventListener('click', (e) => { if (e.target === dialog) dialog.close() })
