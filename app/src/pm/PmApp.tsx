import { useEffect, useRef, useState } from 'preact/hooks'
import { aiLink, backendUrl, getKeys, initPm, setBackend, listEvents, listProjects, pmEmail, pmLogout, pmResume, updateTask, type StoreError } from '../data/store'
import type { ActivityEvent, Project, ProjectKeys, Snapshot, Status } from '../data/types'
import { copyText, groupLink, load, memberName, save } from '../lib/util'
import { pmChangeCount } from '../lib/summary'
import { useSnapshot } from '../lib/useSnapshot'
import { DEFAULT_PB_URL } from '../config'
import { ChevronIcon, Dialog, ErrorBox, Loading, toast, Toasts } from '../ui/ui'
import { Board, type BoardActions } from './Board'
import { QuickTodos } from '../ui/QuickTodos'
import { BehindDialog, SendBackDialog } from './Dialogs'
import { ChatUpdateDialog } from './ChatUpdate'
import { Login } from './Login'
import { GettingStarted, markGroupLinkShared } from './GettingStarted'
import { SetupCheckContent, SetupGate, useSetupReport } from './SetupCheck'
import { NewProjectDialog, NewProjectForm } from './NewProject'
import { ImportTasksDialog } from './ImportTasks'
import { Settings } from './Settings'
import { TaskEditor } from './TaskEditor'
import { TaskView } from './TaskView'
import { AddSubtasksDialog } from '../ui/Subtasks'
import { GroupView } from '../ui/Group'
import { Logo } from '../ui/Logo'
import { RetroScreen } from '../ui/Retro'
import { WrapUpDialog } from './WrapUp'


const LAST_PROJECT = 'gh:pm:project'
export const INSTANCE = 'epms:pm:instance'
const authorKey = (projectId: string) => `gh:pm:author:${projectId}`

export function PmApp() {
  const [auth, setAuth] = useState<'checking' | 'out' | 'setup' | 'in'>('checking')
  useEffect(() => {
    // The instance this browser last logged in to (or this build's default). Without one, ask on the login screen.
    const url = load(INSTANCE) || DEFAULT_PB_URL
    if (!url) return setAuth('out')
    setBackend(url)
    initPm()
    pmResume().then((ok) => setAuth(ok ? 'setup' : 'out'))
  }, [])

  return (
    <>
      {auth === 'checking' && <Loading />}
      {auth === 'out' && <Login onDone={() => setAuth('setup')} />}
      {auth === 'setup' && <SetupGate onReady={() => setAuth('in')} onLogout={() => { pmLogout(); setAuth('out') }} />}
      {auth === 'in' && <PmHome onLogout={() => { pmLogout(); setAuth('out') }} onExpired={() => setAuth('out')} />}
      <Toasts />
    </>
  )
}

function PmHome(props: { onLogout: () => void; onExpired: () => void }) {
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [view, setView] = useState<'board' | 'tasks' | 'group' | 'settings' | 'retro'>('board')
  const [keys, setKeys] = useState<ProjectKeys | null>(null)
  const [editing, setEditing] = useState<{ id: string | null } | null>(null)
  const [addSubtasksFor, setAddSubtasksFor] = useState<string | null>(null)
  const [sendBack, setSendBack] = useState<string | null>(null)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [author, setAuthor] = useState('')
  const [behindFor, setBehindFor] = useState<string | null>(null)
  const [updateOpen, setUpdateOpen] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [wrapOpen, setWrapOpen] = useState(false)
  const [events, setEvents] = useState<ActivityEvent[]>([])

  const { snap, error, reload, patch } = useSnapshot(projectId)

  async function refreshProjects(select?: string) {
    try {
      const list = await listProjects()
      setProjects(list)
      setListError(null)
      const wanted = select ?? load(LAST_PROJECT)
      // Running projects first, then those in their retrospective, archived ones last.
      const next = list.find((p) => p.id === wanted)?.id ?? sortProjects(list)[0]?.id ?? null
      choose(next)
    } catch (e) {
      const err = e as StoreError
      if (err.status === 401) props.onExpired()
      else setListError(err.message)
    }
  }

  function choose(id: string | null) {
    if (id !== projectId) setKeys(null)
    setProjectId(id)
    save(LAST_PROJECT, id)
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

  // What changed since the last chat update, for the reminder on the board and the update itself.
  useEffect(() => {
    if (!snap || !keys || keys.project !== snap.project.id) return
    let live = true
    listEvents(snap.project.id, keys.last_summary_at || snap.project.created).then((ev) => live && setEvents(ev), () => {})
    return () => { live = false }
  }, [snap, keys?.last_summary_at, keys?.project])

  // Recent activity of everyone, for "last active" in the Group view.
  const [groupEvents, setGroupEvents] = useState<ActivityEvent[] | null>(null)
  useEffect(() => {
    if (!snap || view !== 'group') return
    let live = true
    listEvents(snap.project.id, '').then((ev) => live && setGroupEvents(ev), () => live && setGroupEvents([]))
    return () => { live = false }
  }, [snap, view])

  // Which PM member writes notes from this browser.
  useEffect(() => {
    if (!snap) return
    const pmMembers = snap.members.filter((m) => m.is_pm)
    const saved = load(authorKey(snap.project.id))
    setAuthor(pmMembers.find((m) => m.id === saved)?.id ?? pmMembers[0]?.id ?? '')
  }, [snap?.project.id, snap?.members.map((m) => `${m.id}${m.is_pm}`).join()])

  // Keep the project list in step with renames and wrap-ups.
  useEffect(() => {
    if (snap && projects) setProjects(projects.map((p) => (p.id === snap.project.id ? snap.project : p)))
  }, [snap?.project.name, snap?.project.phase])

  // A wrapped-up project is read-only: the board and task view give way to the retrospective.
  const locked = !!snap?.project.phase
  useEffect(() => {
    if (locked && (view === 'board' || view === 'tasks')) setView('retro')
    if (!locked && view === 'retro') setView('board')
  }, [locked, snap?.project.id])

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
    toggleBehind: (id) => {
      const t = snap?.tasks.find((x) => x.id === id)
      if (!t) return
      if (!t.behind) return setBehindFor(id)
      patch((s: Snapshot) => ({ ...s, tasks: s.tasks.map((x) => (x.id === id ? { ...x, behind: false, behind_note: '' } : x)) }))
      withBusy(id, async () => {
        await updateTask(id, { behind: false, behind_note: '' })
        toast('Back on schedule')
      })
    },
    move: (id, status) => {
      setLocalStatus(id, status)
      withBusy(id, () => updateTask(id, { status }))
    },
  }

  async function copyGroupLink() {
    if (!projectId) return
    try {
      const k = keys ?? (await getKeys(projectId))
      setKeys(k)
      const ok = await copyText(groupLink(projectId, k.member_key, backendUrl()))
      if (ok) markGroupLinkShared(projectId)
      toast(ok ? 'Group link copied. Paste it in the group chat; everyone picks their name once.' : "Couldn't copy. Open Project settings to copy it by hand.", !ok)
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
          <div class="header-side"><Logo /><span class="tag-pm">PM</span></div>
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

  const current = projects.find((p) => p.id === projectId)

  return (
    <div class="app">
      <header class="header header-pm">
        <div class="header-side">
          <Logo />
          <ProjectMenu
            projects={projects}
            current={current ?? null}
            onPick={(id) => { choose(id); setView('board') }}
            onNew={() => setNewProjectOpen(true)}
            onSettings={() => setView('settings')}
            onUpdate={() => setUpdateOpen(true)}
            onSetup={() => setSetupOpen(true)}
            onWrapUp={() => setWrapOpen(true)}
            onLogout={props.onLogout}
          />
          <span class="tag-pm">PM</span>
          <div class="row view-tabs" style={{ gap: '6px' }} role="tablist" aria-label="View">
            {locked ? (
              <button type="button" role="tab" class="chip" aria-selected={view === 'retro'} onClick={() => setView('retro')}>
                {snap?.project.phase === 'archived' ? 'Results' : 'Retrospective'}
              </button>
            ) : (
              <>
                <button type="button" role="tab" class="chip" aria-selected={view === 'board'} onClick={() => setView('board')}>Board</button>
                <button type="button" role="tab" class="chip" aria-selected={view === 'tasks'} onClick={() => setView('tasks')} disabled={!snap}>Task view</button>
              </>
            )}
            <button type="button" role="tab" class="chip" aria-selected={view === 'group'} onClick={() => setView('group')} disabled={!snap}>Group</button>
          </div>
        </div>
        <div class="header-actions">
          {view !== 'settings'
            ? <button type="button" class="btn" onClick={() => setView('settings')} disabled={!snap}>Project settings</button>
            : <button type="button" class="btn" onClick={() => setView(locked ? 'retro' : 'board')}>{locked ? 'Back' : 'Back to board'}</button>}
          <button type="button" class="btn" onClick={copyGroupLink} disabled={!projectId}>Copy group link</button>
          {!locked && <button type="button" class="btn" onClick={() => setImportOpen(true)} disabled={!snap}>Import tasks</button>}
          {!locked && <button type="button" class="btn btn-primary" onClick={() => setEditing({ id: null })} disabled={!snap}>New task</button>}
        </div>
      </header>

      {!snap && !error && <Loading />}
      {error && !snap && (
        <div class="main-center"><div class="center-col"><ErrorBox error={error.message} /><div><button class="btn" onClick={reload}>Try again</button></div></div></div>
      )}

      {snap && view === 'board' && (
        <main class="main-board">
          {error && <ErrorBox error={`Couldn't refresh: ${error.message}`} />}
          <GettingStarted
            snap={snap} keys={keys}
            onSettings={() => setView('settings')} onImport={() => setImportOpen(true)} onNewTask={() => setEditing({ id: null })}
            onCopyLink={copyGroupLink} onChat={() => setView('settings')}
          />
          <Board snap={snap} actions={actions} busy={busy} changes={pmChangeCount(events)} onUpdate={() => setUpdateOpen(true)}
            side={<QuickTodos snap={snap} meId={author} isPm onChanged={reload} onPromoted={(id) => setEditing({ id })} />} />
        </main>
      )}

      {snap && view === 'tasks' && (
        <main class="main-board" style={{ maxWidth: '1240px' }}>
          {error && <ErrorBox error={`Couldn't refresh: ${error.message}`} />}
          <TaskView key={snap.project.id} snap={snap} pmAuthorId={author} aiKey={keys?.project === snap.project.id ? keys.ai_key : ''} onChanged={reload} />
        </main>
      )}

      {snap && view === 'group' && (
        <main class="main-board" style={{ maxWidth: '1240px' }}>
          {error && <ErrorBox error={`Couldn't refresh: ${error.message}`} />}
          <GroupView snap={snap} meId={author} events={groupEvents} onOpen={(id) => !locked && setEditing({ id })} />
        </main>
      )}

      {snap && view === 'retro' && locked && (
        <main class="main-board" style={{ maxWidth: '1240px' }}>
          {error && <ErrorBox error={`Couldn't refresh: ${error.message}`} />}
          <RetroScreen key={`${snap.project.id}:${author}`} snap={snap} meId={author} asPm={author} />
        </main>
      )}

      {snap && view === 'settings' && (
        <main class="main-narrow">
          {locked && (
            <div class="hint-box small">
              <span>
                {snap.project.phase === 'archived' ? 'This project is archived.' : 'This project is wrapped up.'} Its details, group and tasks are read-only.
                The links, the chat webhook and deleting the project still work.
              </span>
            </div>
          )}
          <Settings
            snap={snap}
            keys={keys}
            onKeys={setKeys}
            pmAuthorId={author}
            onPmAuthor={(id) => { setAuthor(id); save(authorKey(snap.project.id), id) }}
            onChanged={reload}
            onDeleted={() => { setView('board'); save(LAST_PROJECT, null); refreshProjects() }}
            onWrapUp={() => setWrapOpen(true)}
          />
        </main>
      )}

      {setupOpen && <SetupDialog onClose={() => setSetupOpen(false)} />}
      {snap && wrapOpen && !locked && (
        <WrapUpDialog snap={snap} keys={keys} onClose={() => setWrapOpen(false)}
          onOpenSettings={() => { setWrapOpen(false); setView('settings') }}
          onDone={() => { setWrapOpen(false); reload().then(() => setView('retro')) }} />
      )}
      {snap && behindFor && <BehindDialog snap={snap} taskId={behindFor} onClose={() => setBehindFor(null)} onDone={reload} />}
      {snap && keys && updateOpen && (
        <ChatUpdateDialog
          snap={snap} keys={keys} events={events} pmName={memberName(snap, author)}
          onClose={() => setUpdateOpen(false)}
          onShared={() => { if (projectId) getKeys(projectId).then(setKeys, () => {}) }}
          onOpenSettings={() => { setUpdateOpen(false); setView('settings') }}
        />
      )}
      {snap && editing && (
        <TaskEditor snap={snap} taskId={editing.id} pmAuthorId={author} onClose={() => setEditing(null)} onSaved={reload}
          onAddSubtasks={(id) => { setEditing(null); setAddSubtasksFor(id) }} />
      )}
      {snap && addSubtasksFor && snap.tasks.some((t) => t.id === addSubtasksFor) && (
        <AddSubtasksDialog snap={snap} task={snap.tasks.find((t) => t.id === addSubtasksFor)!} onDone={reload}
          onClose={() => { const id = addSubtasksFor; setAddSubtasksFor(null); setEditing({ id }) }} />
      )}
      {snap && sendBack && <SendBackDialog snap={snap} taskId={sendBack} pmAuthorId={author} onClose={() => setSendBack(null)} onDone={reload} />}
      {snap && importOpen && <ImportTasksDialog snap={snap} pmAuthorId={author} aiLinkUrl={keys ? aiLink(snap.project.id, keys.ai_key) : ''} onClose={() => setImportOpen(false)} onDone={reload} />}
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
  onUpdate: () => void
  onSetup: () => void
  onWrapUp: () => void
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
          {sortProjects(props.projects).map((p) => (
            <button key={p.id} type="button" role="menuitem" class="menu-item" aria-current={p.id === props.current?.id} onClick={pick(() => props.onPick(p.id))}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              {p.phase === 'archived' && <span class="archived-tag">Archived</span>}
              {p.phase === 'retro' && <span class="archived-tag">Retrospective</span>}
              {p.id === props.current?.id && <span class="xsmall muted">Open</span>}
            </button>
          ))}
          <button type="button" role="menuitem" class="menu-item" onClick={pick(props.onNew)}>New project</button>
          <div class="menu-sep" />
          <button type="button" role="menuitem" class="menu-item" onClick={pick(props.onUpdate)}>Update the group chat</button>
          <button type="button" role="menuitem" class="menu-item" onClick={pick(props.onSettings)}>Project settings</button>
          {props.current && !props.current.phase && (
            <button type="button" role="menuitem" class="menu-item" onClick={pick(props.onWrapUp)}>Wrap up project</button>
          )}
          <a role="menuitem" class="menu-item" href="./spms-task-plan.zip" download onClick={() => setOpen(false)} style={{ textDecoration: 'none' }}>
            Download the Claude skill
          </a>
          <div class="menu-sep" />
          <button type="button" role="menuitem" class="menu-item" onClick={pick(props.onSetup)}>Check setup</button>
          <div class="menu-sep" />
          <span class="menu-label" style={{ overflowWrap: 'anywhere' }}>Logged in as {pmEmail()}<br />on {backendUrl().replace(/^https?:\/\//, '')}</span>
          <button type="button" role="menuitem" class="menu-item" onClick={pick(props.onLogout)}>Log out</button>
        </div>
      )}
    </div>
  )
}

/** Running projects first, then ones in their retrospective, archived ones last; newest first within each. */
function sortProjects(list: Project[]): Project[] {
  const rank = (p: Project) => (p.phase === 'archived' ? 2 : p.phase === 'retro' ? 1 : 0)
  return [...list].sort((a, b) => rank(a) - rank(b))
}

function SetupDialog(props: { onClose: () => void }) {
  const { report, error, recheck } = useSetupReport()
  return (
    <Dialog title="Check setup" onClose={props.onClose} wide>
      {error && <ErrorBox error={error} />}
      {!report && !error && <Loading text="Checking your instance…" />}
      {report && <SetupCheckContent report={report} recheck={recheck} />}
    </Dialog>
  )
}
