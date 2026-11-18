import { useEffect, useRef, useState } from 'preact/hooks'
import { claimName, currentAiKey, initMember, joinInfo, setStatus, type StoreError } from '../data/store'
import type { JoinInfo, Snapshot, Status, Task } from '../data/types'
import { copyText, personalHash, personalLink, readFragment, type LinkParts } from '../lib/util'
import { useSnapshot } from '../lib/useSnapshot'
import { ChevronIcon, ErrorBox, Loading, toast, Toasts } from '../ui/ui'
import { AiAgainDialog, BlockedDialog, TaskDetail } from './Dialogs'
import { forgetSession, saveSession, sessionFor, sessions, type Session } from './memory'
import { MyTasks, Sidebar, type TaskActions } from './MyTasks'
import { AiSetup, AiSetupContent, PickName, Tour } from './Welcome'

type Route =
  | { kind: 'session'; session: Session }
  | { kind: 'join'; projectId: string; groupKey: string }
  | { kind: 'none' }

/** Work out what to show from the URL and what this device remembers. */
function route(): Route {
  const link: LinkParts | null = readFragment()
  if (link?.personalKey) {
    // A personal link: sign this device in as that member (opened on a new device, or a bookmark).
    const known = sessionFor(link.projectId)
    const same = known && known.memberId === link.memberId && known.personalKey === link.personalKey
    const session = saveSession({
      projectId: link.projectId, memberId: link.memberId, personalKey: link.personalKey,
      ai: link.ai || (same ? known.ai : ''), name: same ? known.name : '', setupDone: same ? known.setupDone : true,
    })
    return { kind: 'session', session }
  }
  if (link?.groupKey) {
    // The group link: if this device already picked a name in this project, go straight in.
    const known = sessionFor(link.projectId)
    return known ? { kind: 'session', session: known } : { kind: 'join', projectId: link.projectId, groupKey: link.groupKey }
  }
  if (location.hash.replace(/^#/, '')) return { kind: 'none' }
  const last = sessions()[0]
  return last ? { kind: 'session', session: last } : { kind: 'none' }
}

/** Keep the personal link in the address bar so a bookmark brings the member back. */
function showPersonalHash(s: Session) {
  history.replaceState(null, '', `#${personalHash(s.projectId, s.memberId, s.personalKey, s.ai)}`)
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
      {r.kind === 'join' && <Join projectId={r.projectId} groupKey={r.groupKey} onJoined={(s) => setR({ kind: 'session', session: s })} />}
      {r.kind === 'none' && <NoLink />}
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
  const broken = !!location.hash.replace(/^#/, '')
  return (
    <Shell>
      <h1 class="h1-xl">{broken ? "This link isn't complete" : 'Open your project link'}</h1>
      <p class="muted" style={{ margin: 0 }}>
        {broken
          ? 'Part of the link is missing. Copy the whole link from the group chat and open it again.'
          : "EPMS opens from the link your PM posts in the group chat. Open that link on this device and you'll go straight to your project. After that, this page remembers it."}
      </p>
      <p class="muted small" style={{ margin: 0 }}>Are you the PM? <a href="./pm.html">Log in to your board</a></p>
    </Shell>
  )
}

function Join(props: { projectId: string; groupKey: string; onJoined: (s: Session) => void }) {
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

  async function pick(memberId: string, skipIntro: boolean) {
    setBusy(true)
    setError(null)
    try {
      const claim = await claimName(props.projectId, props.groupKey, memberId)
      const s = saveSession({
        projectId: props.projectId, memberId: claim.member, personalKey: claim.key, ai: claim.ai_key,
        name: info!.project.name, setupDone: skipIntro,
      })
      showPersonalHash(s)
      props.onJoined(s)
    } catch (e) {
      setError((e as StoreError).message)
      setBusy(false)
      joinInfo(props.projectId, props.groupKey).then(setInfo, () => {})
    }
  }

  return <PickName join={info} busy={busy} error={error} onPick={pick} />
}

function Project(props: { session: Session; onLeave: () => void }) {
  const [session, setSession] = useState(props.session)
  const started = useRef(false)
  if (!started.current) {
    initMember(session.personalKey)
    started.current = true
  }
  const { projectId } = session
  const { snap, error, reload, patch } = useSnapshot(projectId)
  const [step, setStep] = useState<'tour' | 'ai'>('tour')
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [detail, setDetail] = useState<{ id: string; focusNote: boolean } | null>(null)
  const [blocked, setBlocked] = useState<string | null>(null)
  const [aiOpen, setAiOpen] = useState(false)

  useEffect(() => {
    showPersonalHash(session)
    currentAiKey(session.projectId).then((ai) => {
      if (ai && ai !== session.ai) {
        const next = saveSession({ ...session, ai })
        setSession(next)
        showPersonalHash(next)
      }
    })
  }, [])

  useEffect(() => {
    if (!snap) return
    document.title = `${snap.project.name} · EPMS`
    if (snap.project.name !== session.name) setSession(saveSession({ ...session, name: snap.project.name }))
  }, [snap?.project.name])

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

  const finishSetup = () => setSession(saveSession({ ...session, setupDone: true }))
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
  }

  return (
    <div class="app">
      <header class="header">
        <div class="header-side">
          <span class="logo">EPMS</span>
          <MemberMenu snap={snap} session={session} onAi={() => setAiOpen(true)} />
        </div>
        <div class="row" style={{ gap: '12px' }}>
          <span class="muted small">Hello <strong style={{ color: 'var(--text)', fontWeight: 500 }}>{me.name}</strong></span>
          {snap.project.chat_url && <a class="btn" href={snap.project.chat_url} target="_blank" rel="noopener noreferrer">Open group chat</a>}
        </div>
      </header>

      <main style={{ width: '100%', maxWidth: '1240px', margin: '0 auto', padding: '40px var(--gutter)', display: 'flex', flexWrap: 'wrap', gap: '40px' }}>
        {error && <div style={{ flexBasis: '100%' }}><ErrorBox error={`Couldn't refresh: ${error.message}`} /></div>}
        <MyTasks snap={snap} me={me} busy={busy} actions={actions} aiReady={!!session.ai} />
        <Sidebar snap={snap} me={me} />
      </main>

      {detail && (
        <TaskDetail
          snap={snap} me={me} taskId={detail.id} focusNote={detail.focusNote} busy={busy.has(detail.id)}
          onAdvance={advance} onBlocked={actions.blocked} onClose={() => setDetail(null)} onChanged={reload}
        />
      )}
      {blocked && <BlockedDialog snap={snap} me={me} taskId={blocked} onClose={() => setBlocked(null)} onChanged={reload} />}
      {aiOpen && (
        <AiAgainDialog onClose={() => setAiOpen(false)}>
          <p class="muted" style={{ margin: 0 }}>Paste this once and your AI will always know the project. Then ask it things like "what should I do next?"</p>
          <AiSetupContent snap={snap} name={me.name} aiKey={session.ai} />
        </AiAgainDialog>
      )}
    </div>
  )
}

function MemberMenu(props: { snap: Snapshot; session: Session; onAi: () => void }) {
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
                  onClick={pick(() => { location.hash = personalHash(o.projectId, o.memberId, o.personalKey, o.ai) })}>
                  {o.name || 'Project'}
                </button>
              ))}
              <div class="menu-sep" />
            </>
          )}
          <button type="button" role="menuitem" class="menu-item" onClick={pick(props.onAi)}>Set up my AI</button>
          <button
            type="button"
            role="menuitem"
            class="menu-item"
            onClick={pick(async () => {
              const ok = await copyText(personalLink(s.projectId, s.memberId, s.personalKey, s.ai))
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
