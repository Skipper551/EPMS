import { render } from 'preact'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/jetbrains-mono/400.css'
import '../styles/app.css'
import { MemberApp } from './MemberApp'
import { VersionFooter } from '../ui/ui'

render(<><MemberApp /><VersionFooter /></>, document.getElementById('app')!)
