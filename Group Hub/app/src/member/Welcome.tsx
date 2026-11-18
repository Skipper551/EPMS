// First visit: pick your name, a three-step tour, then AI setup with the project's real AI link.

import { useState } from 'preact/hooks'
import { aiLink } from '../data/store'
import type { Snapshot } from '../data/types'
import { aiPrompt, copyText, joinNames, pms, type AiKind } from '../lib/util'
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
        <span class="logo">Group Hub</span>
        <Dots step={props.step} />
      </header>
      <main class="main-center">
        <div class="center-col">{props.children}</div>
      </main>
    </div>
  )
}

export function PickName(props: { snap: Snapshot; initial: string; onContinue: (id: string) => void; onSkip: (id: string) => void }) {
  const people = props.snap.members.filter((m) => !m.is_pm)
  const [who, setWho] = useState(people.some((m) => m.id === props.initial) ? props.initial : '')
  const [error, setError] = useState<string | null>(null)
  const pmNames = pms(props.snap).map((m) => m.name)

  const go = (fn: (id: string) => void) => () => {
    if (!who) return setError('Pick your name first.')
    fn(who)
  }

  return (
    <WelcomeShell step="name">
      <div class="stack-sm">
        <span class="muted small">{props.snap.project.name}</span>
        <h1 class="h1-xl">Which one is you?</h1>
        <p class="muted" style={{ margin: 0 }}>
          {pmNames.length ? `${joinNames(pmNames)} set this project up. ` : ''}Pick your name and you'll see your tasks.
        </p>
      </div>
      {people.length === 0 ? (
        <div class="empty">Your PM hasn't added anyone to this project yet. Check back once they have.</div>
      ) : (
        <div role="radiogroup" aria-label="Your name" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
          {people.map((m) => {
            const on = who === m.id
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => { setWho(m.id); setError(null) }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', textAlign: 'left',
                  background: on ? 'var(--accent-bg)' : 'var(--surface)', color: 'var(--text)',
                  border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`, borderRadius: '12px', padding: '16px 18px', fontSize: '15px',
                }}
              >
                <span style={{ fontWeight: 600 }}>{m.name}</span>
                <span class="muted xsmall">{m.role || 'Member'}</span>
              </button>
            )
          })}
        </div>
      )}
      <ErrorBox error={error} />
      <div class="row" style={{ gap: '20px' }}>
        <button type="button" class="btn btn-primary btn-lg" disabled={!people.length} onClick={go(props.onContinue)}>Continue</button>
        <button type="button" class="btn-text" disabled={!people.length} onClick={go(props.onSkip)}>Been here before? Skip straight to my tasks</button>
      </div>
    </WelcomeShell>
  )
}

export function Tour(props: { snap: Snapshot; name: string; onBack: () => void; onNext: () => void }) {
  const pmNames = pms(props.snap).map((m) => m.name)
  const approvers = pmNames.length ? joinNames(pmNames) : 'Your PM'
  const verb = pmNames.length > 1 ? 'check finished work and mark it' : 'checks finished work and marks it'
  const tour = [
    { title: 'My tasks is your home', body: 'Everything you need to do, in order. Start a task when you begin, send it to review when you finish.' },
    { title: 'Blockers tell you who you are waiting on', body: 'If someone else has to finish first, you will see it. If you are stuck, press "I\'m blocked" and the PM sees it.' },
    { title: 'The PM approves', body: `${approvers} ${verb} done. Questions go through "Ask the PM", not the group chat.` },
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
        <button type="button" class="btn btn-soft btn-lg" onClick={props.onBack}>Back</button>
        <button type="button" class="btn btn-primary btn-lg" onClick={props.onNext} data-autofocus>Got it</button>
      </div>
    </WelcomeShell>
  )
}

/** The AI setup content, used on the first visit and again from the project menu. */
export function AiSetupContent(props: { snap: Snapshot; name: string; aiKey: string }) {
  const [ai, setAi] = useState<AiKind>('claude')
  const [copied, setCopied] = useState(false)
  const app = ai === 'claude' ? 'Claude' : 'ChatGPT'
  const folder = props.snap.project.course || props.snap.project.name
  const prompt = props.aiKey ? aiPrompt(props.name, props.snap.project.name, aiLink(props.snap.project.id, props.aiKey)) : ''

  return (
    <>
      <div class="row" style={{ gap: '8px' }} role="tablist" aria-label="Which AI do you use">
        {(['claude', 'chatgpt'] as AiKind[]).map((id) => (
          <button key={id} type="button" role="tab" class="chip" aria-selected={ai === id} onClick={() => { setAi(id); setCopied(false) }} style={{ padding: '7px 16px', fontSize: '14px' }}>
            {id === 'claude' ? 'Claude' : 'ChatGPT'}
          </button>
        ))}
      </div>
      <ol class="stack-sm small soft" style={{ margin: 0, paddingLeft: '20px' }}>
        <li>In {app}, create a Project called "{folder}".</li>
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
        <div class="error-box">This link doesn't include the AI link. Ask your PM to share the current member link from Group Hub, then open it again.</div>
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
