// The member app (group links, personal links, #start). Loaded by main.ts when the address is for the app.
import { render } from 'preact'
import '@fontsource/jetbrains-mono/400.css'
import '../styles/app.css'
import { MemberApp } from './MemberApp'
import { VersionFooter } from '../ui/ui'

document.title = 'SPMS'
render(<><MemberApp /><VersionFooter /></>, document.getElementById('app')!)
