import { useEffect, useRef, useState } from 'preact/hooks'
import { claimName, initMember, setBackend, joinInfo, listEvents, memberStatus, setPin, setStatus, signInWithPin, type StoreError } from '../data/store'
import type { ActivityEvent, JoinInfo, Snapshot, Status, Task } from '../data/types'
import { copyText, personalHash, personalLink, readFragment, type LinkParts } from '../lib/util'
import { useSnapshot } from '../lib/useSnapshot'
import { ChevronIcon, Dialog, ErrorBox, Loading, toast, Toasts } from '../ui/ui'
import { AiAgainDialog, BlockedDialog, TaskDetail } from './Dialogs'
import { forgetSession, patchSession, saveSession, sessionFor, sessions, type Session } from './memory'
import { MyTasks, Sidebar, type TaskActions } from './MyTasks'
import { AiSetup, AiSetupContent, PickName, PinInput, Tour } from './Welcome'
import { SinceLastVisit } from './Updates'
import { StartGuide } from './StartGuide'
import { AddSubtasksDialog } from '../ui/Subtasks'

type Route =
  | { kind: 'session'; session: Session }
  | { kind: 'join'; projectId: string; groupKey: string; pbUrl: string }
  | { kind: 'none' }
  | { kind: 'start' }

/** Work out what to show from the URL and what this device remembers. */
function route(): Route {
  const link: LinkParts | null = readFragment()
  if (link?.personalKey) {
    // A personal link: sign this device in as that member (opened on a new device, or a bookmark).
    const known = sessionFor(link.projectId)
    const same = known && known.memberId === link.memberId && known.personalKey === link.personalKey
    if (!link.pbUrl) return { kind: 'none' }
    const session = saveSession({
      projectId: link.projectId, memberId: link.memberId, personalKey: link.personalKey, pbUrl: link.pbUrl,
      ai: link.ai || (same ? known.ai : ''), name: same ? known.name : '', setupDone: same ? known.setupDone : true,
      lastSeen: same ? known.lastSeen : undefined,
    })
    return { kind: 'session', session }
  }
  if (link?.groupKey) {
    // The group link: if this device already picked a name in this project, go straight in.
    const known = sessionFor(link.projectId)
    if (known) return { kind: 'session', session: known }
    return link.pbUrl ? { kind: 'join', projectId: link.projectId, groupKey: link.groupKey, pbUrl: link.pbUrl } : { kind: 'none' }
  }
  if (location.hash === '#start') return { kind: 'start' }
  if (location.hash.replace(/^#/, '')) return { kind: 'none' }
  const last = sessions()[0]
  return last ? { kind: 'session', session: last } : { kind: 'none' }
}

/** Keep the personal link in the address bar so a bookmark brings the member back. */
function showPersonalHash(s: Session) {
  history.replaceState(null, '', `#${personalHash(s.projectId, s.memberId, s.personalKey, s.ai, s.pbUrl)}`)
}

export function MemberApp() {
  const [r, setR] = useState<Route>(route)

  useEffect(() => {
    const onHash = () => setR(route())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <>
      {r.kind === 'session' && <Project key={`${r.session.projectId}:${r.session.personalKey}`} session={r.session} onLeave={() => setR(route())} />}
      {r.kind === 'join' && <Join projectId={r.projectId} groupKey={r.groupKey} pbUrl={r.pbUrl} onJoined={(s) => setR({ kind: 'session', session: s })} />}
      {r.kind === 'none' && <NoLink />}
      {r.kind === 'start' && <StartGuide />}
      <Toasts />
    </>
  )
}

function Shell(props: { children: preact.ComponentChildren }) {
  return (
    <div class="app">
      <header class="header"><span class="logo">EPMS</span></header>
      <main class="main-center"><div class="center-col">{props.children}</div></main>
    </div>
  )
}

function NoLink() {
  const hash = location.hash.replace(/^#/, '')
  const broken = !!hash
  const noInstance = /(^|&)p=/.test(hash) && !/(^|&)pb=/.test(hash)
  if (broken) {
    return (
      <Shell>
        <h1 class="h1-xl">This link isn't complete</h1>
        <p class="muted" style={{ margin: 0 }}>
          {noInstance
            ? "This link doesn't say which instance the project lives on; it may be from an older version of EPMS. Ask your PM to copy the group link again and share the new one."
            : 'Part of the link is missing. Copy the whole link from the group chat and open it again.'}
        </p>
      </Shell>
    )
  }
  return (
    <Shell>
      <div class="stack-sm">
        <span class="muted small">Educational Project Management Software</span>
        <h1 class="h1-xl">Welcome to EPMS</h1>
        <p class="muted" style={{ margin: 0 }}>Free, open-source project management for university group projects, run by one project manager.</p>
      </div>
      <div class="card stack-sm">
        <strong style={{ fontWeight: 600 }}>In a group already?</strong>
        <span class="muted small">Open the link your PM posted in the group chat, on this device. After that, this page remembers your project.</span>
      </div>
      <div class="card stack">
        <div class="stack-sm">
          <strong style={{ fontWeight: 600 }}>Running a group project?</strong>
          <span class="muted small">Set up EPMS for your group in about 10 minutes. Free, and your data stays in your own instance.</span>
        </div>
        <div class="row">
          <a class="btn btn-primary btn-md" href="#start">Set up EPMS</a>
          <a class="btn btn-soft btn-md" href="./pm.html">Log in to my board</a>
        </div>
      </div>
    </Shell>
  )
}

function Join(props: { projectId: string; groupKey: string; pbUrl: string; onJoined: (s: Session) => void }) {
  setBackend(props.pbUrl)
  const [info, setInfo] = useState<JoinInfo | null>(null)
  const [loadError, setLoadError] = useState<StoreError | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => joinInfo(props.projectId, props.groupKey).then(setInfo, setLoadError)
  useEffect(() => { load() }, [])

  if (loadError) {
    return (
      <Shell>
        <h1 class="h1-xl">{loadError.status === 404 ? "This link doesn't work any more" : "Can't open the project"}</h1>
        <ErrorBox error={loadError.status === 404 ? 'The PM may have made a new group link. Ask them for the current one.' : loadError.message} />
        <div><button type="button" class="btn btn-md" onClick={() => { setLoadError(null); load() }}>Try again</button></div>
      </Shell>
    )
  }
  if (!info) return <Loading />

  async function signIn(memberId: string, pin: string) {
    setBusy(true)
    setError(null)
    try {
      const claim = await signInWithPin(props.projectId, props.groupKey, memberId, pin)
      const s = saveSession({
        projectId: props.projectId, memberId: claim.member, personalKey: claim.key, ai: claim.ai_key, pbUrl: props.pbUrl,
        name: info!.project.name, setupDone: true, lastSeen: new Date().toISOString(),
      })
      showPersonalHash(s)
      props.onJoined(s)
    } catch (e) {
      setError((e as StoreError).message)
      setBusy(false)
    }
  }

  async function pick(memberId: string, pin: string, skipIntro: boolean) {
    setBusy(true)
    setError(null)
    try {
      const claim = await claimName(props.projectId, props.groupKey, memberId, pin)
      const s = saveSession({
        projectId: props.projectId, memberId: claim.member, personalKey: claim.key, ai: claim.ai_key, pbUrl: props.pbUrl,
        name: info!.project.name, setupDone: skipIntro, lastSeen: new Date().toISOString(),
      })
      showPersonalHash(s)
      props.onJoined(s)
    } catch (e) {
      setError((e as StoreError).message)
      setBusy(false)
      joinInfo(props.projectId, props.groupKey).then(setInfo, () => {})
    }
  }

  return <PickName join={info} busy={busy} error={error} onPick={pick} onSignIn={signIn} />
}

function Project(props: { session: Session; onLeave: () => void }) {
  const [session, setSession] = useState(props.session)
  const started = useRef(false)
  if (!started.current) {
    setBackend(session.pbUrl)
    initMember(session.personalKey)
    started.current = true
  }
  const { projectId } = session
  const { snap, error, reload, patch } = useSnapshot(projectId)
  const [step, setStep] = useState<'tour' | 'ai'>('tour')
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [detail, setDetail] = useState<{ id: string; focusNote: boolean } | null>(null)
  const [addSubtasksFor, setAddSubtasksFor] = useState<string | null>(null)
  const [blocked, setBlocked] = useState<string | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [hasPin, setHasPin] = useState(true)
  const [pinOpen, setPinOpen] = useState(false)
  // Updates newer than the last visit; the next visit starts from now.
  const [since, setSince] = useState(() => props.session.lastSeen || new Date().toISOString())
  const [updates, setUpdates] = useState<ActivityEvent[]>([])

  useEffect(() => {
    const s = patchSession(projectId, { lastSeen: new Date().toISOString() })
    if (s) setSession(s)
  }, [])

  useEffect(() => {
    if (!snap) return
    let live = true
    listEvents(projectId, since, session.memberId)
      .then((ev) => live && setUpdates(ev.filter((e) => e.actor !== session.memberId)), () => {})
    return () => { live = false }
  }, [snap, since])

  useEffect(() => {
    showPersonalHash(session)
    memberStatus(session.projectId).then((status) => {
      if (!status) return
      setHasPin(status.has_pin)
      const ai = status.ai_key
      if (ai && ai !== session.ai) {
        const next = patchSession(projectId, { ai })
        if (next) { setSession(next); showPersonalHash(next) }
      }
    })
  }, [])

  useEffect(() => {
    if (!snap) return
    document.title = `${updates.length ? `(${updates.length}) ` : ''}${snap.project.name} · EPMS`
    if (snap.project.name !== session.name) { const s = patchSession(projectId, { name: snap.project.name }); if (s) setSession(s) }
  }, [snap?.project.name, updates.length])

  const leave = () => {
    forgetSession(projectId)
    history.replaceState(null, '', location.pathname)
    props.onLeave()
  }

  if (!snap) {
    if (error) {
      return (
        <Shell>
          <h1 class="h1-xl">{error.status === 404 ? 'You are signed out of this project' : "Can't load the project"}</h1>
          <ErrorBox error={error.status === 404 ? 'The PM reset your name or made new links. Open the group link from the chat to pick your name again, or ask the PM for your personal link.' : error.message} />
          <div class="row">
            <button type="button" class="btn btn-md" onClick={reload}>Try again</button>
            {error.status === 404 && <button type="button" class="btn btn-soft btn-md" onClick={leave}>Forget this project on this device</button>}
          </div>
        </Shell>
      )
    }
    return <Loading />
  }

  const me = snap.members.find((m) => m.id === session.memberId) ?? null
  if (!me) {
    return (
      <Shell>
        <h1 class="h1-xl">You're no longer in this project</h1>
        <p class="muted" style={{ margin: 0 }}>The PM removed your name. If that's a mistake, ask them to add you back and share the group link again.</p>
        <div><button type="button" class="btn btn-md" onClick={leave}>Forget this project on this device</button></div>
      </Shell>
    )
  }

  const finishSetup = () => { const s = patchSession(projectId, { setupDone: true }); if (s) setSession(s) }
  if (!session.setupDone) {
    if (step === 'tour') return <Tour snap={snap} name={me.name} onNext={() => setStep('ai')} />
    return <AiSetup snap={snap} name={me.name} aiKey={session.ai} onDone={finishSetup} />
  }

  async function advance(t: Task) {
    const next: Status | null = t.status === 'todo' ? 'doing' : t.status === 'doing' ? 'review' : null
    if (!next) return
    setBusy((b) => new Set(b).add(t.id))
    patch((s: Snapshot) => ({ ...s, tasks: s.tasks.map((x) => (x.id === t.id ? { ...x, status: next } : x)) }))
    try {
      await setStatus(t.id, next)
      toast(next === 'doing' ? 'Started. Good luck.' : 'Sent to review. The PM will take a look.')
    } catch (e) {
      toast((e as StoreError).message, true)
    }
    await reload()
    setBusy((b) => { const n = new Set(b); n.delete(t.id); return n })
  }

  const actions: TaskActions = {
    advance,
    openDetail: (t, focusNote = false) => setDetail({ id: t.id, focusNote }),
    blocked: (t) => { setDetail(null); setBlocked(t.id) },
    setUpAi: () => setAiOpen(true),
    addSubtasks: (t) => setAddSubtasksFor(t.id),
  }

  return (
    <div class="app">
      <header class="header">
        <div class="header-side">
          <span class="logo">EPMS</span>
          <MemberMenu snap={snap} session={session} onAi={() => setAiOpen(true)} onPin={() => setPinOpen(true)} hasPin={hasPin} />
        </div>
        <div class="row" style={{ gap: '12px' }}>
          <span class="muted small">Hello <strong style={{ color: 'var(--text)', fontWeight: 500 }}>{me.name}</strong></span>
          {snap.project.chat_url && <a class="btn" href={snap.project.chat_url} target="_blank" rel="noopener noreferrer">Open group chat</a>}
        </div>
      </header>

      <main style={{ width: '100%', maxWidth: '1240px', margin: '0 auto', padding: '40px var(--gutter)', display: 'flex', flexWrap: 'wrap', gap: '40px' }}>
        {error && <div style={{ flexBasis: '100%' }}><ErrorBox error={`Couldn't refresh: ${error.message}`} /></div>}
        <MyTasks
          snap={snap} me={me} busy={busy} actions={actions} aiReady={!!session.ai}
          highlight={new Set(updates.map((e) => e.task))}
          pinPrompt={!hasPin && <SetPinPanel projectId={projectId} onDone={() => setHasPin(true)} />}
          updates={updates.length > 0 && <SinceLastVisit snap={snap} meId={me.id} events={updates} onDismiss={() => { setUpdates([]); setSince(new Date().toISOString()) }} />}
        />
        <Sidebar snap={snap} me={me} />
      </main>

      {detail && (
        <TaskDetail
          snap={snap} me={me} taskId={detail.id} focusNote={detail.focusNote} busy={busy.has(detail.id)}
          onAdvance={advance} onBlocked={actions.blocked} onClose={() => setDetail(null)} onChanged={reload}
          onAddSubtasks={(t) => { setDetail(null); setAddSubtasksFor(t.id) }}
        />
      )}
      {addSubtasksFor && snap.tasks.some((t) => t.id === addSubtasksFor) && (
        <AddSubtasksDialog snap={snap} task={snap.tasks.find((t) => t.id === addSubtasksFor)!} onDone={reload}
          onClose={() => { const id = addSubtasksFor; setAddSubtasksFor(null); setDetail({ id, focusNote: false }) }} />
      )}
      {blocked && <BlockedDialog snap={snap} me={me} taskId={blocked} onClose={() => setBlocked(null)} onChanged={reload} />}
      {pinOpen && (
        <Dialog title={hasPin ? 'Change my PIN' : 'Set a PIN'} onClose={() => setPinOpen(false)}>
          <SetPinPanel projectId={projectId} plain onDone={() => { setHasPin(true); setPinOpen(false) }} />
        </Dialog>
      )}
      {aiOpen && (
        <AiAgainDialog onClose={() => setAiOpen(false)}>
          <p class="muted" style={{ margin: 0 }}>Paste this once and your AI will always know the project. Then ask it things like "what should I do next?"</p>
          <AiSetupContent snap={snap} name={me.name} aiKey={session.ai} />
        </AiAgainDialog>
      )}
    </div>
  )
}

function MemberMenu(props: { snap: Snapshot; session: Session; onAi: () => void; onPin: () => void; hasPin: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const others = sessions().filter((s) => s.projectId !== props.session.projectId)
  const s = props.session

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const pick = (fn: () => void) => () => { setOpen(false); fn() }

  return (
    <div class="menu-wrap" ref={ref}>
      <button type="button" class="btn select-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} style={{ maxWidth: '360px' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{props.snap.project.name}</span>
        <ChevronIcon />
      </button>
      {open && (
        <div class="menu" role="menu">
          {others.length > 0 && (
            <>
              <span class="menu-label">Your other projects on this device</span>
              {others.map((o) => (
                <button key={o.projectId} type="button" role="menuitem" class="menu-item"
                  onClick={pick(() => { location.hash = personalHash(o.projectId, o.memberId, o.personalKey, o.ai, o.pbUrl) })}>
                  {o.name || 'Project'}
                </button>
              ))}
              <div class="menu-sep" />
            </>
          )}
          <button type="button" role="menuitem" class="menu-item" onClick={pick(props.onAi)}>Set up my AI</button>
          <button type="button" role="menuitem" class="menu-item" onClick={pick(props.onPin)}>{props.hasPin ? 'Change my PIN' : 'Set a PIN'}</button>
          <button
            type="button"
            role="menuitem"
            class="menu-item"
            onClick={pick(async () => {
              const ok = await copyText(personalLink(s.projectId, s.memberId, s.personalKey, s.ai, s.pbUrl))
              toast(ok ? 'Personal link copied. Open it on your other devices, and keep it to yourself: it signs in as you.' : "Couldn't copy the link.", !ok)
            })}
          >
            Copy my personal link
          </button>
        </div>
      )}
    </div>
  )
}

/** Members who joined before PINs existed set one here; everyone can change theirs from the menu. */
function SetPinPanel(props: { projectId: string; plain?: boolean; onDone: () => void }) {
  const [pin, setPinValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(e: Event) {
    e.preventDefault()
    if (pin.length !== 4) return setError('Choose a 4-digit PIN.')
    setBusy(true)
    setError(null)
    try {
      await setPin(props.projectId, pin)
      toast('PIN saved. Use it to sign in on your other devices.')
      props.onDone()
    } catch (err) {
      setError((err as StoreError).message)
      setBusy(false)
    }
  }

  const body = (
    <form class="stack-sm" onSubmit={save}>
      <label class="field-label" for="new-pin">Choose a 4-digit PIN</label>
      <div class="row">
        <PinInput id="new-pin" value={pin} onInput={setPinValue} autoFocus={props.plain} />
        <button type="submit" class="btn btn-primary btn-md" disabled={busy || pin.length !== 4}>{busy ? 'Saving…' : 'Save PIN'}</button>
      </div>
      <span class="muted xsmall">
        On another device, open the group link, pick your name and enter this PIN. The PM never sees it; if you forget it, they can reset your name.
      </span>
      <ErrorBox error={error} />
    </form>
  )

  if (props.plain) return body
  return (
    <section class="panel" style={{ borderColor: 'var(--accent-bg)', gap: '10px' }} aria-label="Set a PIN">
      <h2 class="eyebrow" style={{ color: 'var(--accent-text)' }}>Set a PIN for your other devices</h2>
      {body}
    </section>
  )
}
