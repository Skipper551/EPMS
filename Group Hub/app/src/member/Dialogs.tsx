import { useState } from 'preact/hooks'
import { addNote, setBlockers, type StoreError } from '../data/store'
import type { Member, Snapshot, Task } from '../data/types'
import { formatDay, memberName, when } from '../lib/util'
import { BlockerPicker } from '../ui/BlockerPicker'
import { BlockedIcon, Dialog, ErrorBox, Field, StatusPill, toast } from '../ui/ui'

export function TaskDetail(props: {
  snap: Snapshot
  me: Member
  taskId: string
  focusNote: boolean
  busy: boolean
  onAdvance: (t: Task) => void
  onBlocked: (t: Task) => void
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
  const mine = t.owner === props.me.id
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
        <span class="muted small">{t.due_date ? `Due ${formatDay(t.due_date)}` : 'No due date'}</span>
        <span class="muted small">Owner: {memberName(snap, t.owner) || 'nobody yet'}</span>
      </div>

      {(blockerTasks.length > 0 || blockerMembers.length > 0) && (
        <section class="stack-sm">
          <h3 class="eyebrow">Blocked by</h3>
          {blockerTasks.map((b) => (
            <div key={b.id} class="blocked-box" style={b.status === 'done' ? { background: 'var(--sunk)', color: 'var(--muted)' } : undefined}>
              {b.status !== 'done' && <BlockedIcon />}
              <span>{b.title}{b.owner ? ` · ${memberName(snap, b.owner)}` : ''}{b.status === 'done' ? ' · done' : ''}</span>
            </div>
          ))}
          {blockerMembers.map((n) => <div key={n} class="blocked-box"><BlockedIcon /><span>Waiting on {n}</span></div>)}
        </section>
      )}

      {t.links.length > 0 && (
        <section class="stack-sm">
          <h3 class="eyebrow">Files and links</h3>
          {t.links.map((l, i) => <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" style={{ overflowWrap: 'anywhere' }}>{l.label}</a>)}
        </section>
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
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!t) return null

  const changed = tasks.join() !== t.blocked_by_tasks.join() || members.join() !== t.blocked_by_members.join()

  async function save(e: Event) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (changed) await setBlockers(t!.id, tasks, members)
      if (note.trim()) await addNote(t!.id, props.me.id, note.trim())
      toast(tasks.length || members.length ? 'Blocker saved. The PM can see it.' : 'Blockers cleared')
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
        <BlockerPicker snap={props.snap} task={t} tasks={tasks} members={members} onChange={(a, b) => { setTasks(a); setMembers(b) }} />
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
