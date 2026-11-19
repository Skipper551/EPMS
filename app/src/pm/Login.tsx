import { useState } from 'preact/hooks'
import { cleanUrl, DEFAULT_PB_URL } from '../config'
import { backendUrl, checkInstance, initPm, pmLogin, setBackend, type StoreError } from '../data/store'
import { load, save } from '../lib/util'
import { ErrorBox, Field } from '../ui/ui'

const INSTANCE = 'epms:pm:instance'

export function Login(props: { onDone: () => void }) {
  const [instance, setInstance] = useState(() => load(INSTANCE) || backendUrl() || DEFAULT_PB_URL)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: Event) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const url = cleanUrl(instance)
    if (!(await checkInstance(url))) {
      setError(`There's no PocketBase instance at ${url || 'that address'}. Copy the address from your PocketBase Cloud dashboard; it looks like https://abc123.pocketbasecloud.com`)
      setBusy(false)
      return
    }
    // A different instance means a different superuser: start a fresh session.
    if (url !== load(INSTANCE)) save('pocketbase_auth', null)
    setBackend(url)
    initPm()
    try {
      await pmLogin(email.trim(), password)
      save(INSTANCE, url)
      props.onDone()
    } catch (err) {
      setError((err as StoreError).message)
      setBusy(false)
    }
  }

  return (
    <div class="app">
      <header class="header">
        <span class="logo">EPMS</span>
        <span class="tag-pm">PM</span>
      </header>
      <main class="main-center">
        <div class="center-col" style={{ maxWidth: '480px' }}>
          <div class="stack-sm">
            <span class="muted small">For the project manager</span>
            <h1 class="h1-xl">Log in to your board</h1>
            <p class="muted" style={{ margin: 0 }}>
              Your projects live in your own PocketBase instance. Log in with its superuser account. Members never log in: they open the group link you share.
            </p>
          </div>

          <form class="stack-lg" onSubmit={submit}>
            <Field label="Your PocketBase address" help="From your PocketBase Cloud dashboard. This browser remembers it.">
              {(id) => <input id={id} class="input" type="text" inputMode="url" autoComplete="url" required placeholder="https://abc123.pocketbasecloud.com" value={instance} onInput={(e) => setInstance(e.currentTarget.value)} />}
            </Field>
            <Field label="Superuser email">
              {(id) => <input id={id} class="input" type="email" autoComplete="username" required value={email} onInput={(e) => setEmail(e.currentTarget.value)} />}
            </Field>
            <Field label="Superuser password">
              {(id) => <input id={id} class="input" type="password" autoComplete="current-password" required value={password} onInput={(e) => setPassword(e.currentTarget.value)} />}
            </Field>
            <ErrorBox error={error} />
            <div class="row">
              <button type="submit" class="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
            </div>
            <p class="muted xsmall" style={{ margin: 0 }}>
              Only log in on your own laptop or phone. This browser keeps you logged in until you log out.
            </p>
          </form>

          <div class="card card-tight row-between">
            <span class="small soft">No instance yet? Setting one up is free and takes about 10 minutes.</span>
            <a class="btn btn-soft btn-sm" href="./#start">Set up EPMS</a>
          </div>
        </div>
      </main>
    </div>
  )
}
