import { useState } from 'preact/hooks'
import { addNote, setBlockers, setStartDate, type StoreError } from '../data/store'
import type { Member, Snapshot, Task } from '../data/types'
import { canMove, dateRange, formatDay, memberName, peopleText, when } from '../lib/util'
import { BlockerPicker } from '../ui/BlockerPicker'
import { SubtaskList, subtasksOf } from '../ui/Subtasks'
import { BlockedIcon, Dialog, ErrorBox, Field, StatusPill, toast } from '../ui/ui'

export function TaskDetail(props: {
  snap: Snapshot
  me: Member
  taskId: string
  focusNote: boolean
  busy: boolean
  onAdvance: (t: Task) => void
  onBlocked: (t: Task) => void
  onAddSubtasks: (t: Task) => void
  onClose: () => void
  onChanged: () => void
}) {
  const { snap } = props
  const t = snap.tasks.find((x) => x.id === props.taskId)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!t) return null
  const notes = snap.notes.filter((n) => n.task === t.id)
  const blockerTasks = t.blocked_by_tasks.map((id) => snap.tasks.find((x) => x.id === id)).filter((x): x is Task => !!x)
  const blockerMembers = t.blocked_by_members.map((id) => memberName(snap, id)).filter(Boolean)
  const mine = canMove(t, props.me.id)
  const primary = mine ? (t.status === 'todo' ? 'Start' : t.status === 'doing' ? 'Send to review' : null) : null

  async function post(e: Event) {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    setError(null)
    try {
      await addNote(t!.id, props.me.id, text.trim())
      setText('')
      toast('Note added')
      props.onChanged()
    } catch (err) {
      setError((err as StoreError).message)
    }
    setBusy(false)
  }

  return (
    <Dialog title={t.title} onClose={props.onClose} wide>
      <div class="row" style={{ gap: '8px 16px' }}>
        <StatusPill status={t.status} />
        {t.behind && t.status !== 'done' && <span class="behind-tag">Behind</span>}
        <span class="muted small">{dateRange(t.start_date, t.due_date) || 'No due date'}</span>
        <span class="muted small">{peopleText(snap, t)}</span>
      </div>

      {(blockerTasks.length > 0 || blockerMembers.length > 0 || !!t.blocked_reason) && (
        <section class="stack-sm">
          <h3 class="eyebrow">Blocked by</h3>
          {blockerTasks.map((b) => (
            <div key={b.id} class="blocked-box" style={b.status === 'done' ? { background: 'var(--sunk)', color: 'var(--muted)' } : undefined}>
              {b.status !== 'done' && <BlockedIcon />}
              <span>{b.title}{b.owner ? ` · ${memberName(snap, b.owner)}` : ''}{b.status === 'done' ? ' · done' : ''}</span>
            </div>
          ))}
          {blockerMembers.map((n) => <div key={n} class="blocked-box"><BlockedIcon /><span>Waiting on {n}</span></div>)}
          {t.blocked_reason && <div class="blocked-box"><BlockedIcon /><span>{t.blocked_reason}</span></div>}
        </section>
      )}

      {t.links.length > 0 && (
        <section class="stack-sm">
          <h3 class="eyebrow">Files and links</h3>
          {t.links.map((l, i) => <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" style={{ overflowWrap: 'anywhere' }}>{l.label}</a>)}
        </section>
      )}

      {t.owner === props.me.id && t.status !== 'done' && <StartDateEditor task={t} max={t.due_date} onChanged={props.onChanged} />}

      {(mine || subtasksOf(snap, t.id).length > 0) && (
        <SubtaskList snap={snap} task={t} canEdit={mine && t.status !== 'done'} onChanged={props.onChanged} onAddMany={() => props.onAddSubtasks(t)} />
      )}

      <section class="stack">
        <h3 class="eyebrow">Notes</h3>
        {notes.length === 0 && <span class="muted small">No notes yet.</span>}
        {notes.map((n) => (
          <div key={n.id} class="note">
            <span class="note-meta">{n.author === props.me.id ? 'You' : memberName(snap, n.author) || 'PM'} · {when(n.created)}</span>
            <span class="pre-wrap">{n.text}</span>
          </div>
        ))}
        <form class="stack" onSubmit={post}>
          <Field label="Add a note">
            {(id) => (
              <textarea id={id} class="textarea" rows={3} maxLength={5000} value={text} onInput={(e) => setText(e.currentTarget.value)}
                placeholder="Progress, a question for whoever picks this up, where you saved the file…" {...(props.focusNote ? { 'data-autofocus': true } : {})} />
            )}
          </Field>
          <ErrorBox error={error} />
          <div><button type="submit" class="btn btn-soft btn-md" disabled={busy || !text.trim()}>{busy ? 'Adding…' : 'Add note'}</button></div>
        </form>
      </section>

      {mine && t.status !== 'done' && (
        <div class="row" style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          {primary && <button type="button" class="btn btn-primary btn-md" disabled={props.busy} onClick={() => props.onAdvance(t)}>{primary}</button>}
          {t.status === 'review' && <span class="muted small">Waiting for the PM to approve</span>}
          {t.status !== 'review' && <button type="button" class="btn btn-soft btn-md" onClick={() => props.onBlocked(t)}>I'm blocked</button>}
        </div>
      )}
    </Dialog>
  )
}

export function BlockedDialog(props: { snap: Snapshot; me: Member; taskId: string; onClose: () => void; onChanged: () => void }) {
  const t = props.snap.tasks.find((x) => x.id === props.taskId)
  const [tasks, setTasks] = useState<string[]>(t?.blocked_by_tasks ?? [])
  const [members, setMembers] = useState<string[]>(t?.blocked_by_members ?? [])
  const [reason, setReason] = useState(t?.blocked_reason ?? '')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!t) return null

  const changed = tasks.join() !== t.blocked_by_tasks.join() || members.join() !== t.blocked_by_members.join() || reason.trim() !== t.blocked_reason

  async function save(e: Event) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (changed) await setBlockers(t!.id, tasks, members, reason.trim())
      if (note.trim()) await addNote(t!.id, props.me.id, note.trim())
      toast(tasks.length || members.length || reason.trim() ? 'Blocker saved. The PM can see it.' : 'Blockers cleared')
      props.onChanged()
      props.onClose()
    } catch (err) {
      setError((err as StoreError).message)
      setBusy(false)
    }
  }

  return (
    <Dialog
      title="I'm blocked"
      onClose={props.onClose}
      footer={
        <>
          <span />
          <div class="row">
            <button type="button" class="btn btn-soft btn-md" onClick={props.onClose}>Cancel</button>
            <button type="submit" form="blocked-form" class="btn btn-primary btn-md" disabled={busy || (!changed && !note.trim())}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </>
      }
    >
      <form id="blocked-form" class="stack-lg" onSubmit={save}>
        <p class="soft small" style={{ margin: 0 }}>
          What is <strong style={{ color: 'var(--text)', fontWeight: 500 }}>{t.title}</strong> waiting on? The PM sees it on the board, and it clears by itself once the other task is done.
        </p>
        <BlockerPicker snap={props.snap} task={t} tasks={tasks} members={members} reason={reason} onChange={(a, b, c) => { setTasks(a); setMembers(b); setReason(c) }} />
        <Field label="Anything to add? (optional)" help="Posted as a note on the task.">
          {(id) => <textarea id={id} class="textarea" rows={2} maxLength={5000} value={note} onInput={(e) => setNote(e.currentTarget.value)} />}
        </Field>
        <ErrorBox error={error} />
      </form>
    </Dialog>
  )
}

export function AiAgainDialog(props: { children: preact.ComponentChildren; onClose: () => void }) {
  return <Dialog title="Connect your AI" onClose={props.onClose} wide>{props.children}</Dialog>
}

/** The task's lead can say when they'll start (the PM can too, from the board). */
function StartDateEditor(props: { task: Task; max: string; onChanged: () => void }) {
  const [value, setValue] = useState(props.task.start_date)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const changed = value !== props.task.start_date
  async function save(e: Event) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await setStartDate(props.task.id, value)
      toast(value ? `Start date set to ${formatDay(value)}` : 'Start date cleared')
      props.onChanged()
    } catch (err) {
      setError((err as StoreError).message)
    }
    setBusy(false)
  }
  return (
    <form class="stack-sm" onSubmit={save}>
      <div class="row" style={{ alignItems: 'flex-end' }}>
        <div style={{ minWidth: '180px' }}>
          <Field label="I'll start on" help="You lead this task, so you can set when you begin.">
            {(id) => <input id={id} class="input" type="date" value={value} max={props.max || undefined} onInput={(e) => setValue(e.currentTarget.value)} />}
          </Field>
        </div>
        <button type="submit" class="btn btn-soft btn-md" disabled={busy || !changed} style={{ marginBottom: '22px' }}>Save</button>
        {props.task.start_date && <button type="button" class="btn-text" style={{ marginBottom: '30px', color: 'var(--muted)' }} disabled={busy} onClick={() => setValue('')}>Clear</button>}
      </div>
      {value && props.max && value > props.max && <span class="xsmall warn-text">That's after the due date ({formatDay(props.max)}).</span>}
      <ErrorBox error={error} />
    </form>
  )
}
