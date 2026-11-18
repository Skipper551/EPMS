import { useState } from 'preact/hooks'
import { backendUrl, pmLogin, type StoreError } from '../data/store'
import { ErrorBox, Field } from '../ui/ui'

export function Login(props: { onDone: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: Event) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await pmLogin(email.trim(), password)
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
        <div class="center-col" style={{ maxWidth: '460px' }}>
          <div class="stack-sm">
            <span class="muted small">For the project manager</span>
            <h1 class="h1-xl">Log in to your board</h1>
            <p class="muted" style={{ margin: 0 }}>
              Use the superuser account of your PocketBase instance. Members never log in: they open the link you share in the group chat.
            </p>
          </div>

          <form class="stack-lg" onSubmit={submit}>
            <Field label="Email">
              {(id) => <input id={id} class="input" type="email" autoComplete="username" required value={email} onInput={(e) => setEmail(e.currentTarget.value)} />}
            </Field>
            <Field label="Password">
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

          <details class="card card-tight">
            <summary style={{ cursor: 'pointer', fontWeight: 500 }}>Setting up for the first time?</summary>
            <div class="stack small soft" style={{ marginTop: '12px' }}>
              <p style={{ margin: 0 }}>
                EPMS keeps each PM's projects in their own PocketBase instance. PocketBase is free, open source software.
              </p>
              <p style={{ margin: 0 }}>
                PocketBase Cloud's free plan asks for a card to start a free subscription through Stripe. The subscription costs 0 and the card is never charged. You get one instance with 50 MB of storage, which is plenty for many group projects.
              </p>
              <p style={{ margin: 0 }}>
                The email and password you set for the instance's superuser are what you use here. If your group has more than one PM, each PM gets their own superuser account from the instance dashboard.
              </p>
              <p class="muted xsmall" style={{ margin: 0, overflowWrap: 'anywhere' }}>This copy of EPMS talks to {backendUrl}</p>
            </div>
          </details>
        </div>
      </main>
    </div>
  )
}
