// First visit: pick your name, a three-step tour, then AI setup with the project's real AI link.

import { useState } from 'preact/hooks'
import { aiLink } from '../data/store'
import type { JoinInfo, Snapshot } from '../data/types'
import { aiPrompt, copyText, joinNames, pms } from '../lib/util'
import { ErrorBox, toast } from '../ui/ui'

export type WelcomeStep = 'name' | 'tour' | 'ai'

function Dots(props: { step: WelcomeStep }) {
  const i = ['name', 'tour', 'ai'].indexOf(props.step)
  return (
    <div class="row" style={{ gap: '8px' }} aria-label={`Setup step ${i + 1} of 3`} role="img">
      {[0, 1, 2].map((n) => (
        <span key={n} style={{ width: n === i ? 24 : 8, height: 8, borderRadius: 4, background: n <= i ? 'var(--accent)' : 'var(--line-strong)', transition: 'width 150ms' }} />
      ))}
    </div>
  )
}

export function WelcomeShell(props: { step: WelcomeStep; children: preact.ComponentChildren }) {
  return (
    <div class="app">
      <header class="header">
        <span class="logo">EPMS</span>
        <Dots step={props.step} />
      </header>
      <main class="main-center">
        <div class="center-col">{props.children}</div>
      </main>
    </div>
  )
}

/** 4 digits only, as the member types. */
export function PinInput(props: { id: string; value: string; onInput: (v: string) => void; hidden?: boolean; autoFocus?: boolean }) {
  return (
    <input
      id={props.id}
      class="input pin-input"
      type={props.hidden ? 'password' : 'text'}
      inputMode="numeric"
      autoComplete={props.hidden ? 'current-password' : 'off'}
      pattern="[0-9]{4}"
      maxLength={4}
      value={props.value}
      onInput={(e) => props.onInput(e.currentTarget.value.replace(/[^0-9]/g, '').slice(0, 4))}
      {...(props.autoFocus ? { 'data-autofocus': true, autoFocus: true } : {})}
    />
  )
}

export function PickName(props: {
  join: JoinInfo
  busy: boolean
  error: string | null
  onPick: (id: string, pin: string, skipIntro: boolean) => void
  onSignIn: (id: string, pin: string) => void
}) {
  const { join } = props
  const [who, setWho] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const chosen = join.members.find((m) => m.id === who)
  const returning = !!chosen?.claimed
  const shown = error ?? props.error

  const choose = (id: string) => {
    setWho(id)
    setPin('')
    setError(null)
  }

  const go = (skipIntro: boolean) => () => {
    if (!who) return setError('Pick your name first.')
    if (pin.length !== 4) return setError(returning ? 'Enter your 4-digit PIN.' : 'Choose a 4-digit PIN.')
    setError(null)
    if (returning) props.onSignIn(who, pin)
    else props.onPick(who, pin, skipIntro)
  }

  return (
    <WelcomeShell step="name">
      <div class="stack-sm">
        <span class="muted small">{join.project.name}</span>
        <h1 class="h1-xl">Which one is you?</h1>
        <p class="muted" style={{ margin: 0 }}>
          {join.pms.length ? `${joinNames(join.pms)} set this project up. ` : ''}Pick your name and you'll see your tasks. This device stays signed in as you.
        </p>
      </div>
      {join.members.length === 0 ? (
        <div class="empty">Your PM hasn't added anyone to this project yet. Check back once they have.</div>
      ) : (
        <div role="radiogroup" aria-label="Your name" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
          {join.members.map((m) => {
            const on = who === m.id
            // A taken name can only be picked to sign in with its PIN; while the link is locked, only those.
            const disabled = (m.claimed && !m.has_pin) || (join.locked && !m.claimed)
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={disabled}
                onClick={() => choose(m.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', textAlign: 'left',
                  background: on ? 'var(--accent-bg)' : 'var(--surface)', color: 'var(--text)', opacity: disabled ? 0.5 : 1,
                  border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`, borderRadius: '12px', padding: '16px 18px', fontSize: '15px',
                }}
              >
                <span style={{ fontWeight: 600 }}>{m.name}</span>
                <span class="muted xsmall">{m.claimed ? (m.has_pin ? 'Set up · sign in with your PIN' : 'Already set up') : m.role || 'Member'}</span>
              </button>
            )
          })}
        </div>
      )}

      {chosen && (
        <div class="card card-tight stack-sm">
          <label class="field-label" for="pin">{returning ? `Welcome back, ${chosen.name}. Enter your PIN` : 'Choose a 4-digit PIN'}</label>
          <PinInput id="pin" value={pin} onInput={setPin} hidden={returning} autoFocus />
          <span class="muted xsmall">
            {returning
              ? 'The PIN you chose when you first joined. Forgot it? Ask the PM to reset your name.'
              : 'You need it to sign in on another device, like your phone. Pick something you will remember; the PM never sees it.'}
          </span>
        </div>
      )}

      <ErrorBox error={shown} />

      {join.locked && !chosen && (
        <div class="muted small">The PM has locked this link, so new names can't join. If you're already set up, pick your name and enter your PIN.</div>
      )}

      {chosen && (
        <div class="row" style={{ gap: '20px' }}>
          <button type="button" class="btn btn-primary btn-lg" disabled={props.busy} onClick={go(false)}>
            {props.busy ? (returning ? 'Signing in…' : 'Setting up…') : returning ? 'Sign in' : 'Continue'}
          </button>
          {!returning && <button type="button" class="btn-text" disabled={props.busy} onClick={go(true)}>Skip the intro, go to my tasks</button>}
        </div>
      )}

      {join.members.some((m) => m.claimed && !m.has_pin) && (
        <p class="muted small" style={{ margin: 0 }}>
          Greyed-out names joined before PINs existed. To sign in here, open your personal link from your other device (in the menu next to the project name), or ask the PM for it.
        </p>
      )}
    </WelcomeShell>
  )
}

export function Tour(props: { snap: Snapshot; name: string; onBack?: () => void; onNext: () => void }) {
  const pmNames = pms(props.snap).map((m) => m.name)
  const approvers = pmNames.length ? joinNames(pmNames) : 'Your PM'
  const verb = pmNames.length > 1 ? 'check finished work and mark it' : 'checks finished work and marks it'
  const tour = [
    { title: 'My tasks is your home', body: 'Everything you need to do, in order. Start a task when you begin, send it to review when you finish.' },
    { title: 'Blockers tell you who you are waiting on', body: 'If someone else has to finish first, you will see it. If you are stuck, press "I\'m blocked" and the PM sees it.' },
    { title: 'The PM approves', body: `${approvers} ${verb} done. For questions, use the group chat as usual.` },
  ]
  return (
    <WelcomeShell step="tour">
      <div class="stack-sm">
        <span class="muted small">Hi {props.name}</span>
        <h1 class="h1-xl">Three things to know</h1>
      </div>
      <ol class="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {tour.map((t, i) => (
          <li key={i} class="card card-tight" style={{ display: 'flex', gap: '16px' }}>
            <span aria-hidden="true" style={{ flex: 'none', width: 28, height: 28, borderRadius: 999, background: 'var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600 }}>{i + 1}</span>
            <div class="stack-sm" style={{ gap: '2px' }}>
              <strong style={{ fontWeight: 600 }}>{t.title}</strong>
              <span class="muted small">{t.body}</span>
            </div>
          </li>
        ))}
      </ol>
      <div class="row">
        {props.onBack && <button type="button" class="btn btn-soft btn-lg" onClick={props.onBack}>Back</button>}
        <button type="button" class="btn btn-primary btn-lg" onClick={props.onNext} data-autofocus>Got it</button>
      </div>
    </WelcomeShell>
  )
}

/** The AI setup content, used on the first visit and again from the project menu. */
export function AiSetupContent(props: { snap: Snapshot; name: string; aiKey: string }) {
  const [copied, setCopied] = useState(false)
  const folder = props.snap.project.course || props.snap.project.name
  const prompt = props.aiKey ? aiPrompt(props.name, props.snap.project.name, aiLink(props.snap.project.id, props.aiKey)) : ''

  return (
    <>
      <ol class="stack-sm small soft" style={{ margin: 0, paddingLeft: '20px' }}>
        <li>In Claude or ChatGPT, create a Project called "{folder}".</li>
        <li>Open its instructions and paste the text below.</li>
        <li>Ask about the group project in any chat inside that Project.</li>
      </ol>
      {prompt ? (
        <>
          <div class="prompt-box" aria-label="Instructions to paste into your AI">{prompt}</div>
          <div class="row">
            <button
              type="button"
              class="btn btn-primary btn-lg"
              onClick={async () => {
                const ok = await copyText(prompt)
                setCopied(ok)
                if (!ok) toast("Couldn't copy. Select the text and copy it by hand.", true)
              }}
            >
              {copied ? 'Copied' : 'Copy instructions'}
            </button>
          </div>
        </>
      ) : (
        <div class="error-box">This link doesn't include the AI link. Ask your PM to send you your personal link from EPMS, then open it.</div>
      )}
    </>
  )
}

export function AiSetup(props: { snap: Snapshot; name: string; aiKey: string; onDone: () => void }) {
  return (
    <WelcomeShell step="ai">
      <div class="stack-sm">
        <span class="muted small">Last step, optional</span>
        <h1 class="h1-xl">Connect your AI</h1>
        <p class="muted" style={{ margin: 0 }}>
          Paste this once and your AI will always know the project: who's doing what, what's blocked, and the PM's guidelines. Then just ask it things like "what should I do next?"
        </p>
      </div>
      <AiSetupContent snap={props.snap} name={props.name} aiKey={props.aiKey} />
      <div>
        <button type="button" class="btn btn-soft btn-lg" onClick={props.onDone}>Go to my tasks</button>
      </div>
    </WelcomeShell>
  )
}
