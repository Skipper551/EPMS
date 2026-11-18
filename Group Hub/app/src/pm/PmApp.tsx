import { useEffect, useRef, useState } from 'preact/hooks'
import { getKeys, listProjects, pmEmail, pmLogout, pmResume, updateTask, type StoreError } from '../data/store'
import type { Project, ProjectKeys, Snapshot, Status } from '../data/types'
import { copyText, load, memberLink, save } from '../lib/util'
import { useSnapshot } from '../lib/useSnapshot'
import { ChevronIcon, ErrorBox, Loading, toast, Toasts } from '../ui/ui'
import { Board, type BoardActions } from './Board'
import { QuestionsDialog, SendBackDialog } from './Dialogs'
import { Login } from './Login'
import { NewProjectDialog, NewProjectForm } from './NewProject'
import { ImportTasksDialog } from './ImportTasks'
import { Settings } from './Settings'
import { TaskEditor } from './TaskEditor'


const LAST_PROJECT = 'gh:pm:project'
const authorKey = (projectId: string) => `gh:pm:author:${projectId}`

export function PmApp() {
  const [auth, setAuth] = useState<'checking' | 'out' | 'in'>('checking')
  useEffect(() => {
    pmResume().then((ok) => setAuth(ok ? 'in' : 'out'))
  }, [])

  return (
    <>
      {auth === 'checking' && <Loading />}
      {auth === 'out' && <Login onDone={() => setAuth('in')} />}
      {auth === 'in' && <PmHome onLogout={() => { pmLogout(); setAuth('out') }} onExpired={() => setAuth('out')} />}
      <Toasts />
    </>
  )
}

function PmHome(props: { onLogout: () => void; onExpired: () => void }) {
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [view, setView] = useState<'board' | 'settings'>('board')
  const [keys, setKeys] = useState<ProjectKeys | null>(null)
  const [editing, setEditing] = useState<{ id: string | null } | null>(null)
  const [sendBack, setSendBack] = useState<string | null>(null)
  const [questionsOpen, setQuestionsOpen] = useState(false)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [author, setAuthor] = useState('')

  const { snap, error, reload, patch } = useSnapshot(projectId)

  async function refreshProjects(select?: string) {
    try {
      const list = await listProjects()
      setProjects(list)
      setListError(null)
      const wanted = select ?? load(LAST_PROJECT)
      const next = list.find((p) => p.id === wanted)?.id ?? list[0]?.id ?? null
      choose(next)
    } catch (e) {
      const err = e as StoreError
      if (err.status === 401) props.onExpired()
      else setListError(err.message)
    }
  }

  function choose(id: string | null) {
    setProjectId(id)
    save(LAST_PROJECT, id)
    setKeys(null)
  }

  useEffect(() => {
    refreshProjects()
  }, [])

  useEffect(() => {
    if (error?.status === 401) props.onExpired()
  }, [error])

  // Keys for the member and AI links.
  useEffect(() => {
    if (!projectId) return
    let live = true
    getKeys(projectId).then((k) => live && setKeys(k)).catch(() => {})
    return () => { live = false }
  }, [projectId])

  // Which PM member writes notes from this browser.
  useEffect(() => {
    if (!snap) return
    const pmMembers = snap.members.filter((m) => m.is_pm)
    const saved = load(authorKey(snap.project.id))
    setAuthor(pmMembers.find((m) => m.id === saved)?.id ?? pmMembers[0]?.id ?? '')
  }, [snap?.project.id, snap?.members.map((m) => `${m.id}${m.is_pm}`).join()])

  // Keep the project list in step with renames.
  useEffect(() => {
    if (snap && projects) setProjects(projects.map((p) => (p.id === snap.project.id ? snap.project : p)))
  }, [snap?.project.name])

  async function withBusy(id: string, fn: () => Promise<unknown>) {
    setBusy((b) => new Set(b).add(id))
    try {
      await fn()
    } catch (e) {
      toast((e as StoreError).message, true)
    }
    await reload()
    setBusy((b) => { const n = new Set(b); n.delete(id); return n })
  }

  const setLocalStatus = (id: string, status: Status) =>
    patch((s: Snapshot) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, status } : t)) }))

  const actions: BoardActions = {
    open: (id) => setEditing({ id }),
    approve: (id) => {
      setLocalStatus(id, 'done')
      withBusy(id, async () => {
        await updateTask(id, { status: 'done' })
        toast('Approved and marked done')
      })
    },
    sendBack: (id) => setSendBack(id),
    move: (id, status) => {
      setLocalStatus(id, status)
      withBusy(id, () => updateTask(id, { status }))
    },
  }

  async function copyMemberLink() {
    if (!projectId) return
    try {
      const k = keys ?? (await getKeys(projectId))
      setKeys(k)
      const ok = await copyText(memberLink(projectId, k.member_key, k.ai_key))
      toast(ok ? 'Member link copied. Paste it in the Teams group chat.' : "Couldn't copy. Open Project settings to copy it by hand.", !ok)
    } catch (e) {
      toast((e as StoreError).message, true)
    }
  }

  if (!projects) {
    return listError ? (
      <div class="main-center"><div class="center-col"><ErrorBox error={listError} /><div><button class="btn" onClick={() => refreshProjects()}>Try again</button></div></div></div>
    ) : <Loading />
  }

  if (projects.length === 0) {
    return (
      <div class="app">
        <header class="header">
          <div class="header-side"><span class="logo">Group Hub</span><span class="tag-pm">PM</span></div>
          <button type="button" class="btn btn-soft" onClick={props.onLogout}>Log out</button>
        </header>
        <main class="main-center">
          <div class="center-col">
            <div class="stack-sm">
              <span class="muted small">Welcome, PM</span>
              <h1 class="h1-xl">Set up your first project</h1>
              <p class="muted" style={{ margin: 0 }}>Add the basics and your group. You can change everything later.</p>
            </div>
            <NewProjectForm onCreated={(p) => { toast('Project created'); refreshProjects(p.id) }} />
          </div>
        </main>
      </div>
    )
  }

  const openQuestions = snap ? snap.questions.filter((q) => !q.answer.trim()).length : 0
  const current = projects.find((p) => p.id === projectId)

  return (
    <div class="app">
      <header class="header">
        <div class="header-side">
          <span class="logo">Group Hub</span>
          <ProjectMenu
            projects={projects}
            current={current ?? null}
            onPick={(id) => { choose(id); setView('board') }}
            onNew={() => setNewProjectOpen(true)}
            onSettings={() => setView('settings')}
            onLogout={props.onLogout}
          />
          <span class="tag-pm">PM</span>
        </div>
        <div class="header-actions">
          <button type="button" class="btn" onClick={() => setQuestionsOpen(true)} disabled={!snap}>
            Questions {openQuestions > 0 && <span class="badge">{openQuestions}</span>}
          </button>
          {view === 'board'
            ? <button type="button" class="btn" onClick={() => setView('settings')} disabled={!snap}>Project settings</button>
            : <button type="button" class="btn" onClick={() => setView('board')}>Back to board</button>}
          <button type="button" class="btn" onClick={copyMemberLink} disabled={!projectId}>Copy link for Teams</button>
          <button type="button" class="btn" onClick={() => setImportOpen(true)} disabled={!snap}>Import tasks</button>
          <button type="button" class="btn btn-primary" onClick={() => setEditing({ id: null })} disabled={!snap}>New task</button>
        </div>
      </header>

      {!snap && !error && <Loading />}
      {error && !snap && (
        <div class="main-center"><div class="center-col"><ErrorBox error={error.message} /><div><button class="btn" onClick={reload}>Try again</button></div></div></div>
      )}

      {snap && view === 'board' && (
        <main class="main-board">
          {error && <ErrorBox error={`Couldn't refresh: ${error.message}`} />}
          <Board snap={snap} actions={actions} busy={busy} onImport={() => setImportOpen(true)} />
        </main>
      )}

      {snap && view === 'settings' && (
        <main class="main-narrow">
          <Settings
            snap={snap}
            keys={keys}
            onKeys={setKeys}
            pmAuthorId={author}
            onPmAuthor={(id) => { setAuthor(id); save(authorKey(snap.project.id), id) }}
            onChanged={reload}
            onDeleted={() => { setView('board'); save(LAST_PROJECT, null); refreshProjects() }}
          />
        </main>
      )}

      {snap && editing && <TaskEditor snap={snap} taskId={editing.id} pmAuthorId={author} onClose={() => setEditing(null)} onSaved={reload} />}
      {snap && sendBack && <SendBackDialog snap={snap} taskId={sendBack} pmAuthorId={author} onClose={() => setSendBack(null)} onDone={reload} />}
      {snap && importOpen && <ImportTasksDialog snap={snap} pmAuthorId={author} onClose={() => setImportOpen(false)} onDone={reload} />}
      {snap && questionsOpen && <QuestionsDialog snap={snap} onClose={() => setQuestionsOpen(false)} onChanged={reload} />}
      {newProjectOpen && (
        <NewProjectDialog
          onClose={() => setNewProjectOpen(false)}
          onCreated={(p) => { setNewProjectOpen(false); toast('Project created'); setView('board'); refreshProjects(p.id) }}
        />
      )}
    </div>
  )
}

function ProjectMenu(props: {
  projects: Project[]
  current: Project | null
  onPick: (id: string) => void
  onNew: () => void
  onSettings: () => void
  onLogout: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (fn: () => void) => () => { setOpen(false); fn() }

  return (
    <div class="menu-wrap" ref={ref}>
      <button type="button" class="btn select-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} style={{ maxWidth: '360px' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{props.current?.name ?? 'Choose a project'}</span>
        <ChevronIcon />
      </button>
      {open && (
        <div class="menu" role="menu">
          <span class="menu-label">Projects</span>
          {props.projects.map((p) => (
            <button key={p.id} type="button" role="menuitem" class="menu-item" aria-current={p.id === props.current?.id} onClick={pick(() => props.onPick(p.id))}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              {p.id === props.current?.id && <span class="xsmall muted">Open</span>}
            </button>
          ))}
          <button type="button" role="menuitem" class="menu-item" onClick={pick(props.onNew)}>New project</button>
          <div class="menu-sep" />
          <button type="button" role="menuitem" class="menu-item" onClick={pick(props.onSettings)}>Project settings</button>
          <div class="menu-sep" />
          <span class="menu-label" style={{ overflowWrap: 'anywhere' }}>Logged in as {pmEmail()}</span>
          <button type="button" role="menuitem" class="menu-item" onClick={pick(props.onLogout)}>Log out</button>
        </div>
      )}
    </div>
  )
}
