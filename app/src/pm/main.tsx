import { render } from 'preact'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '../styles/app.css'
import { initPm } from '../data/store'
import { PmApp } from './PmApp'
import { VersionFooter } from '../ui/ui'

initPm()
render(<><PmApp /><VersionFooter /></>, document.getElementById('app')!)
