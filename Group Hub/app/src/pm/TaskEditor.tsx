import { useState } from 'preact/hooks'
import { addNote, createTask, deleteTask, updateTask, type StoreError } from '../data/store'
import type { Snapshot, Status, TaskInput, TaskLink } from '../data/types'
import { STATUSES, STATUS_LABEL } from '../data/types'
import { memberName, normaliseUrl, when } from '../lib/util'
import { BlockerPicker } from '../ui/BlockerPicker'
import { CloseIcon, Dialog, ErrorBox, Field, Toggle, toast } from '../ui/ui'

export function TaskEditor(props: {
  snap: Snapshot
  taskId: string | null
  pmAuthorId: string
  onClose: () => void
  onSaved: () => void
}) {
  const { snap } = props
  const existing = props.taskId ? snap.tasks.find((t) => t.id === props.taskId) ?? null : null
  const [form, setForm] = useState<TaskInput>(() =>
    existing
      ? {
          title: existing.title, owner: existing.owner, helpers: existing.helpers, everyone: existing.everyone, due_date: existing.due_date, status: existing.status, behind: existing.behind,
          blocked_by_tasks: existing.blocked_by_tasks, blocked_by_members: existing.blocked_by_members,
          links: existing.links.length ? existing.links : [],
        }
      : { title: '', owner: '', helpers: [], everyone: false, due_date: '', status: 'todo', behind: false, blocked_by_tasks: [], blocked_by_members: [], links: [] },
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const set = <K extends keyof TaskInput>(k: K, v: TaskInput[K]) => setForm((f) => ({ ...f, [k]: v }))
  const setLink = (i: number, patch: Partial<TaskLink>) => set('links', form.links.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  const notes = existing ? snap.notes.filter((n) => n.task === existing.id) : []

  async function save(e: Event) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const links = form.links
      .map((l) => ({ label: l.label.trim(), url: normaliseUrl(l.url) }))
      .filter((l) => l.url)
      .map((l) => ({ label: l.label || l.url.replace(/^https?:\/\//, '').slice(0, 60), url: l.url }))
    const body: TaskInput = { ...form, title: form.title.trim(), links, helpers: form.everyone ? [] : form.helpers.filter((id) => id !== form.owner) }
    try {
      if (existing) await updateTask(existing.id, body)
      else await createTask(snap.project.id, body)
      if (existing && note.trim()) await addNote(existing.id, props.pmAuthorId, note.trim())
      toast(existing ? 'Task saved' : 'Task added')
      props.onSaved()
      props.onClose()
    } catch (err) {
      setError((err as StoreError).message)
      setBusy(false)
    }
  }

  async function postNote() {
    if (!existing || !note.trim()) return
    setBusy(true)
    try {
      await addNote(existing.id, props.pmAuthorId, note.trim())
      setNote('')
      props.onSaved()
    } catch (err) {
      setError((err as StoreError).message)
    }
    setBusy(false)
  }

  async function remove() {
    if (!existing) return
    setBusy(true)
    try {
      await deleteTask(existing.id)
      toast('Task deleted')
      props.onSaved()
      props.onClose()
    } catch (err) {
      setError((err as StoreError).message)
      setBusy(false)
    }
  }

  return (
    <Dialog
      title={existing ? 'Edit task' : 'New task'}
      onClose={props.onClose}
      wide
      footer={
        <>
          <div class="row">
            {existing && !confirmDelete && <button type="button" class="btn btn-danger" onClick={() => setConfirmDelete(true)}>Delete task</button>}
            {existing && confirmDelete && (
              <>
                <span class="small warn-text">Delete this task and its notes?</span>
                <button type="button" class="btn btn-danger" disabled={busy} onClick={remove}>Yes, delete</button>
                <button type="button" class="btn btn-soft" onClick={() => setConfirmDelete(false)}>Keep it</button>
              </>
            )}
          </div>
          <div class="row">
            <button type="button" class="btn btn-soft btn-md" onClick={props.onClose}>Cancel</button>
            <button type="submit" form="task-form" class="btn btn-primary btn-md" disabled={busy || !form.title.trim()}>
              {busy ? 'Saving…' : existing ? 'Save task' : 'Add task'}
            </button>
          </div>
        </>
      }
    >
      <form id="task-form" class="stack-lg" onSubmit={save}>
        <Field label="Title">
          {(id) => <input id={id} class="input" required maxLength={300} value={form.title} onInput={(e) => set('title', e.currentTarget.value)} data-autofocus />}
        </Field>

        <div class="form-grid">
          <Field label="Lead" help="The one person accountable. They start it and send it to review.">
            {(id) => (
              <select id={id} class="select" value={form.owner} onChange={(e) => { const v = e.currentTarget.value; setForm((f) => ({ ...f, owner: v, helpers: f.helpers.filter((h) => h !== v) })) }}>
                <option value="">Nobody yet</option>
                {snap.members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}{m.is_pm ? ' (PM)' : ''}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Due date">
            {(id) => <input id={id} class="input" type="date" value={form.due_date} onInput={(e) => set('due_date', e.currentTarget.value)} />}
          </Field>
          <Field label="Status">
            {(id) => (
              <select id={id} class="select" value={form.status} onChange={(e) => set('status', e.currentTarget.value as Status)}>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            )}
          </Field>
          <div class="field">
            <span class="field-label">Schedule</span>
            <Toggle checked={form.behind} onChange={(v) => set('behind', v)} label={form.behind ? 'Behind schedule' : 'On schedule'} />
          </div>
        </div>

        <fieldset class="stack" style={{ border: 0, margin: 0, padding: 0 }}>
          <legend class="eyebrow" style={{ marginBottom: '10px' }}>Working with</legend>
          <div class="row">
            <Toggle checked={form.everyone} onChange={(v) => set('everyone', v)} label="Whole group" accent />
            <span class="muted xsmall">{form.everyone ? 'Shows on every member\'s page, including people added later.' : 'For things like rehearsals or reading the final draft.'}</span>
          </div>
          {!form.everyone && (
            <div class="stack-sm">
              <span class="field-label" id="helpers-label">Helpers</span>
              <div class="row" style={{ gap: '8px' }} role="group" aria-labelledby="helpers-label">
                {snap.members.filter((m) => m.id !== form.owner).map((m) => (
                  <button key={m.id} type="button" class="chip" aria-pressed={form.helpers.includes(m.id)}
                    onClick={() => set('helpers', form.helpers.includes(m.id) ? form.helpers.filter((h) => h !== m.id) : [...form.helpers, m.id])}>
                    {m.name}
                  </button>
                ))}
              </div>
              <span class="field-help">Helpers see the task on their page and can start it or send it to review too.</span>
            </div>
          )}
        </fieldset>

        <fieldset class="stack" style={{ border: 0, margin: 0, padding: 0 }}>
          <legend class="eyebrow" style={{ marginBottom: '10px' }}>Blocked by</legend>
          <BlockerPicker
            snap={snap}
            task={{ id: existing?.id ?? '', owner: form.owner }}
            tasks={form.blocked_by_tasks}
            members={form.blocked_by_members}
            onChange={(tasks, members) => setForm((f) => ({ ...f, blocked_by_tasks: tasks, blocked_by_members: members }))}
          />
        </fieldset>

        <fieldset class="stack" style={{ border: 0, margin: 0, padding: 0 }}>
          <legend class="eyebrow" style={{ marginBottom: '10px' }}>Files and links</legend>
          {form.links.map((l, i) => (
            <div key={i} class="row" style={{ alignItems: 'flex-end', flexWrap: 'nowrap' }}>
              <div class="grow">
                <Field label="Label">{(id) => <input id={id} class="input" value={l.label} placeholder="Report draft" onInput={(e) => setLink(i, { label: e.currentTarget.value })} />}</Field>
              </div>
              <div class="grow" style={{ flex: 2 }}>
                <Field label="Address">{(id) => <input id={id} class="input" value={l.url} placeholder="https://…" onInput={(e) => setLink(i, { url: e.currentTarget.value })} />}</Field>
              </div>
              <button type="button" class="icon-btn" style={{ marginBottom: '4px' }} aria-label={`Remove link ${l.label || i + 1}`} onClick={() => set('links', form.links.filter((_, j) => j !== i))}>
                <CloseIcon />
              </button>
            </div>
          ))}
          <div>
            <button type="button" class="btn btn-soft btn-sm" onClick={() => set('links', [...form.links, { label: '', url: '' }])}>Add a file or link</button>
          </div>
        </fieldset>

        {existing && (
          <section class="stack">
            <h3 class="eyebrow">Notes</h3>
            {notes.length === 0 && <span class="muted small">No notes yet.</span>}
            {notes.map((n) => (
              <div key={n.id} class="note">
                <span class="note-meta">{memberName(snap, n.author) || 'PM'} · {when(n.created)}</span>
                <span class="pre-wrap">{n.text}</span>
              </div>
            ))}
            <Field label={`Add a note${props.pmAuthorId ? ` as ${memberName(snap, props.pmAuthorId)}` : ''}`}>
              {(id) => <textarea id={id} class="textarea" rows={2} maxLength={5000} value={note} onInput={(e) => setNote(e.currentTarget.value)} />}
            </Field>
            <div>
              <button type="button" class="btn btn-soft btn-sm" disabled={busy || !note.trim()} onClick={postNote}>Post note</button>
            </div>
          </section>
        )}

        <ErrorBox error={error} />
      </form>
    </Dialog>
  )
}
