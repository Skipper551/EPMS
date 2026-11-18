import { useEffect, useRef, useState } from 'preact/hooks'
import { initMember, setStatus, type StoreError } from '../data/store'
import type { Snapshot, Status, Task } from '../data/types'
import { readMemberFragment, type MemberLinkParts } from '../lib/util'
import { useSnapshot } from '../lib/useSnapshot'
import { ChevronIcon, ErrorBox, Loading, toast, Toasts } from '../ui/ui'
import { AiAgainDialog, AskPmDialog, BlockedDialog, TaskDetail } from './Dialogs'
import { forgetProject, loadChoice, rememberedProjects, rememberProject, saveChoice, type Choice } from './memory'
import { MyTasks, Sidebar, type TaskActions } from './MyTasks'
import { AiSetup, AiSetupContent, PickName, Tour, type WelcomeStep } from './Welcome'

/** The link from the URL, or else the project this device opened last. */
function currentLink(): MemberLinkParts | null {
  const fromUrl = readMemberFragment()
  if (fromUrl) {
    const saved = rememberedProjects().find((p) => p.projectId === fromUrl.projectId && p.key === fromUrl.key)
    return { ...fromUrl, ai: fromUrl.ai || saved?.ai || '' }
  }
  const last = rememberedProjects()[0]
  if (!last) return null
  history.replaceState(null, '', `#p=${last.projectId}&key=${last.key}${last.ai ? `&ai=${last.ai}` : ''}`)
  return { projectId: last.projectId, key: last.key, ai: last.ai }
}

export function MemberApp() {
  const [link, setLink] = useState<MemberLinkParts | null>(() => {
    const l = currentLink()
    if (l) initMember(l.key)
    return l
  })

  useEffect(() => {
    const onHash = () => {
      const l = currentLink()
      if (l && (l.projectId !== link?.projectId || l.key !== link?.key)) {
        initMember(l.key)
        setLink(l)
      }
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [link])

  return (
    <>
      {link ? <Project key={`${link.projectId}:${link.key}`} link={link} /> : <NoLink />}
      <Toasts />
    </>
  )
}

function NoLink() {
  return (
    <div class="app">
      <header class="header"><span class="logo">Group Hub</span></header>
      <main class="main-center">
        <div class="center-col">
          <h1 class="h1-xl">Open your project link</h1>
          <p class="muted" style={{ margin: 0 }}>
            Group Hub opens from the link your PM posts in the group chat. Open that link on this device and you'll go straight to your project. After that, this page remembers it.
          </p>
          <p class="muted small" style={{ margin: 0 }}>Are you the PM? <a href="./pm.html">Log in to your board</a></p>
        </div>
      </main>
    </div>
  )
}

function Project(props: { link: MemberLinkParts }) {
  const { projectId, ai } = props.link
  const { snap, error, reload, patch } = useSnapshot(projectId)
  const [choice, setChoiceState] = useState<Choice | null>(() => loadChoice(projectId))
  const [step, setStep] = useState<WelcomeStep>('name')
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [detail, setDetail] = useState<{ id: string; focusNote: boolean } | null>(null)
  const [blocked, setBlocked] = useState<string | null>(null)
  const [askOpen, setAskOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)

  const setChoice = (c: Choice | null) => { saveChoice(projectId, c); setChoiceState(c) }

  useEffect(() => {
    if (snap) rememberProject(props.link, snap.project.name)
  }, [snap?.project.name])

  useEffect(() => {
    if (snap) document.title = `${snap.project.name} · Group Hub`
  }, [snap?.project.name])

  if (!snap) {
    if (error) {
      return (
        <div class="app">
          <header class="header"><span class="logo">Group Hub</span></header>
          <main class="main-center">
            <div class="center-col">
              <h1 class="h1-xl">{error.status === 404 ? "This link doesn't work any more" : "Can't load the project"}</h1>
              <ErrorBox error={error.status === 404 ? 'The PM may have made a new member link. Ask them for the current one in the group chat.' : error.message} />
              <div class="row">
                <button type="button" class="btn btn-md" onClick={reload}>Try again</button>
                {error.status === 404 && <button type="button" class="btn btn-soft btn-md" onClick={() => { forgetProject(projectId); location.hash = ''; location.reload() }}>Forget this link</button>}
              </div>
            </div>
          </main>
        </div>
      )
    }
    return <Loading />
  }

  const me = choice ? snap.members.find((m) => m.id === choice.memberId && !m.is_pm) ?? null : null

  // First visit, or the remembered name was removed by the PM.
  if (!me || !choice?.setupDone) {
    const pickedId = me?.id ?? (step !== 'name' ? choice?.memberId : '') ?? ''
    const picked = snap.members.find((m) => m.id === pickedId && !m.is_pm)
    if (step === 'name' || !picked) {
      return (
        <PickName
          snap={snap}
          initial={choice?.memberId ?? ''}
          onContinue={(id) => { setChoice({ memberId: id, setupDone: false }); setStep('tour') }}
          onSkip={(id) => setChoice({ memberId: id, setupDone: true })}
        />
      )
    }
    if (step === 'tour') return <Tour snap={snap} name={picked.name} onBack={() => setStep('name')} onNext={() => setStep('ai')} />
    return <AiSetup snap={snap} name={picked.name} aiKey={ai} onDone={() => setChoice({ memberId: picked.id, setupDone: true })} />
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
          <span class="logo">Group Hub</span>
          <MemberMenu
            snap={snap}
            link={props.link}
            onChangeName={() => { setChoice(null); setStep('name') }}
            onAi={() => setAiOpen(true)}
          />
        </div>
        <div class="row" style={{ gap: '12px' }}>
          <span class="muted small">You're <strong style={{ color: 'var(--text)', fontWeight: 500 }}>{me.name}</strong></span>
          <button type="button" class="btn" onClick={() => setAskOpen(true)}>Ask the PM</button>
        </div>
      </header>

      <main style={{ width: '100%', maxWidth: '1240px', margin: '0 auto', padding: '40px var(--gutter)', display: 'flex', flexWrap: 'wrap', gap: '40px' }}>
        {error && <div style={{ flexBasis: '100%' }}><ErrorBox error={`Couldn't refresh: ${error.message}`} /></div>}
        <MyTasks snap={snap} me={me} busy={busy} actions={actions} aiReady={!!ai} />
        <Sidebar snap={snap} me={me} />
      </main>

      {detail && (
        <TaskDetail
          snap={snap} me={me} taskId={detail.id} focusNote={detail.focusNote} busy={busy.has(detail.id)}
          onAdvance={advance} onBlocked={actions.blocked} onClose={() => setDetail(null)} onChanged={reload}
        />
      )}
      {blocked && <BlockedDialog snap={snap} me={me} taskId={blocked} onClose={() => setBlocked(null)} onChanged={reload} />}
      {askOpen && <AskPmDialog snap={snap} me={me} onClose={() => setAskOpen(false)} onChanged={reload} />}
      {aiOpen && (
        <AiAgainDialog onClose={() => setAiOpen(false)}>
          <p class="muted" style={{ margin: 0 }}>Paste this once and your AI will always know the project. Then ask it things like "what should I do next?"</p>
          <AiSetupContent snap={snap} name={me.name} aiKey={ai} />
        </AiAgainDialog>
      )}
    </div>
  )
}

function MemberMenu(props: { snap: Snapshot; link: MemberLinkParts; onChangeName: () => void; onAi: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const others = rememberedProjects().filter((p) => p.projectId !== props.link.projectId)

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
              {others.map((p) => (
                <button key={p.projectId} type="button" role="menuitem" class="menu-item"
                  onClick={pick(() => { location.hash = `p=${p.projectId}&key=${p.key}${p.ai ? `&ai=${p.ai}` : ''}` })}>
                  {p.name}
                </button>
              ))}
              <div class="menu-sep" />
            </>
          )}
          <button type="button" role="menuitem" class="menu-item" onClick={pick(props.onAi)}>Set up my AI</button>
          <button type="button" role="menuitem" class="menu-item" onClick={pick(props.onChangeName)}>I'm not this person</button>
        </div>
      )}
    </div>
  )
}
