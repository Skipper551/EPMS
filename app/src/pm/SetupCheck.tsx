// After login: does this PocketBase instance have everything SPMS needs? Installs the collections in one click
// and walks the PM through uploading the hook files (PocketBase can't install those remotely).

import { useEffect, useState } from 'preact/hooks'
import { backendUrl, importSchema, listCollections, probeHooks, type StoreError } from '../data/store'
import { compare, HOOKS, SCHEMA, type SetupReport } from '../lib/setup'
import { ErrorBox, Loading, toast } from '../ui/ui'
import { Logo } from '../ui/Logo'

export function useSetupReport(): { report: SetupReport | null; error: string | null; recheck: () => Promise<SetupReport | null> } {
  const [report, setReport] = useState<SetupReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  async function recheck() {
    setError(null)
    try {
      const [cols, hooks] = await Promise.all([listCollections(), probeHooks(HOOKS.map((h) => h.name))])
      const r = compare(cols, hooks)
      setReport(r)
      return r
    } catch (e) {
      setError((e as StoreError).message)
      return null
    }
  }
  useEffect(() => { recheck() }, [])
  return { report, error, recheck }
}

const mark = (ok: boolean) => (
  <span aria-hidden="true" style={{ width: 18, display: 'inline-block', color: ok ? 'var(--accent-text)' : 'var(--warn)' }}>{ok ? '✓' : '•'}</span>
)

export function SetupCheckContent(props: { report: SetupReport; recheck: () => Promise<SetupReport | null> }) {
  const { report } = props
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const missingCols = report.collections.filter((c) => c.state !== 'ok')
  const anyMissing = report.collections.some((c) => c.state === 'missing')

  async function install() {
    setBusy(true)
    setError(null)
    try {
      await importSchema(SCHEMA)
      const r = await props.recheck()
      toast(r?.schemaOk ? 'Collections installed' : 'Collections updated')
    } catch (e) {
      setError((e as StoreError).message)
    }
    setBusy(false)
  }

  async function checkAgain() {
    setBusy(true)
    await props.recheck()
    setBusy(false)
  }

  return (
    <div class="stack-lg">
      <section class="panel">
        <div class="row-between">
          <h2 class="eyebrow">1. Collections</h2>
          {report.schemaOk && <span class="xsmall" style={{ color: 'var(--accent-text)' }}>All set</span>}
        </div>
        {report.schemaOk ? (
          <span class="muted small">Your instance has every collection SPMS needs, with the current access rules.</span>
        ) : (
          <>
            <span class="soft small">
              {anyMissing ? 'Your instance is missing' : 'Your instance has older versions of'} {missingCols.length === 1 ? 'one collection' : `${missingCols.length} collections`} SPMS needs:{' '}
              {missingCols.map((c) => c.name).join(', ')}. One click sets them up. It only adds or updates SPMS's own collections and never deletes anything.
            </span>
            <div><button type="button" class="btn btn-primary btn-md" disabled={busy} onClick={install}>{busy ? 'Working…' : anyMissing ? 'Install collections' : 'Update collections'}</button></div>
          </>
        )}
        <ErrorBox error={error} />
      </section>

      <section class="panel">
        <div class="row-between">
          <h2 class="eyebrow">2. Hooks</h2>
          {report.hooksOk && <span class="xsmall" style={{ color: 'var(--accent-text)' }}>All set</span>}
        </div>
        <ul class="stack-sm small" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {report.hooks.map((h) => (
            <li key={h.name} class="row" style={{ flexWrap: 'nowrap', gap: '6px', alignItems: 'baseline' }}>
              {mark(h.state === 'ok')}
              <span class="grow">
                <code style={{ fontFamily: 'var(--mono)', fontSize: '12px' }}>{h.file}</code>
                <span class="muted"> · {h.what}</span>
              </span>
              <span class={h.state === 'ok' ? 'muted xsmall' : 'xsmall warn-text'}>{h.state === 'ok' ? 'Installed' : h.state === 'missing' ? 'Missing' : 'Out of date'}</span>
            </li>
          ))}
        </ul>
        {!report.hooksOk && (
          <div class="stack-sm small soft">
            <span>Hooks are small server files PocketBase can only take through its dashboard. Members can't join until they're in.</span>
            <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>Download the hooks below and unzip them.</li>
              <li>In PocketBase Cloud, open your instance and go to its <strong style={{ color: 'var(--text)', fontWeight: 500 }}>Code</strong> tab (the pb_hooks folder).</li>
              <li>Upload every file, keeping the <code style={{ fontFamily: 'var(--mono)', fontSize: '12px' }}>epms</code> folder inside. Replace any older copies, then press <strong style={{ color: 'var(--text)', fontWeight: 500 }}>Save</strong> and <strong style={{ color: 'var(--text)', fontWeight: 500 }}>Deploy</strong>.</li>
              <li>Come back and press Check again.</li>
            </ol>
          </div>
        )}
        <div class="row">
          {!report.hooksOk && <a class="btn btn-primary btn-md" href="./spms-hooks.zip" download>Download the hooks</a>}
          <button type="button" class="btn btn-soft btn-md" disabled={busy} onClick={checkAgain}>{busy ? 'Checking…' : 'Check again'}</button>
        </div>
      </section>

      <p class="muted xsmall" style={{ margin: 0, overflowWrap: 'anywhere' }}>Checking {backendUrl()}</p>
    </div>
  )
}

/** Full-page version shown after login when something's missing. */
export function SetupGate(props: { onReady: () => void; onLogout: () => void }) {
  const { report, error, recheck } = useSetupReport()

  useEffect(() => {
    if (report?.schemaOk && report.hooksOk) props.onReady()
  }, [report])

  return (
    <div class="app">
      <header class="header">
        <div class="header-side"><Logo /><span class="tag-pm">PM</span></div>
        <button type="button" class="btn btn-soft" onClick={props.onLogout}>Log out</button>
      </header>
      <main class="main-narrow" style={{ maxWidth: '720px' }}>
        <div class="stack-sm">
          <span class="muted small">Almost there</span>
          <h1 class="h1-xl">Finish setting up your instance</h1>
          <p class="muted" style={{ margin: 0 }}>SPMS needs two things on your PocketBase instance. This page checks them and helps you add what's missing.</p>
        </div>
        {error && <ErrorBox error={error} />}
        {!report && !error && <Loading text="Checking your instance…" />}
        {report && <SetupCheckContent report={report} recheck={recheck} />}
        {report && (
          <div class="row">
            <button type="button" class="btn btn-primary btn-lg" disabled={!report.schemaOk} onClick={props.onReady}>
              {report.hooksOk ? 'Go to my board' : 'Continue without hooks for now'}
            </button>
            {!report.schemaOk && <span class="muted small">Install the collections first.</span>}
          </div>
        )}
      </main>
    </div>
  )
}
