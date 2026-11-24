import { useState } from 'preact/hooks'
import { addNote, updateTask, type StoreError } from '../data/store'
import type { Snapshot } from '../data/types'
import { memberName } from '../lib/util'
import { Dialog, ErrorBox, Field, toast } from '../ui/ui'

/** Review → In progress, with a comment the owner sees as a note. */
export function SendBackDialog(props: { snap: Snapshot; taskId: string; pmAuthorId: string; onClose: () => void; onDone: () => void }) {
  const task = props.snap.tasks.find((t) => t.id === props.taskId)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!task) return null
  const owner = memberName(props.snap, task.owner)

  async function submit(e: Event) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await addNote(task!.id, props.pmAuthorId, text.trim())
      await updateTask(task!.id, { status: 'doing' })
      toast(`Sent back to ${owner || 'In progress'}`)
      props.onDone()
      props.onClose()
    } catch (err) {
      setError((err as StoreError).message)
      setBusy(false)
    }
  }

  return (
    <Dialog
      title="Send back"
      onClose={props.onClose}
      footer={
        <>
          <span />
          <div class="row">
            <button type="button" class="btn btn-soft btn-md" onClick={props.onClose}>Cancel</button>
            <button type="submit" form="send-back" class="btn btn-primary btn-md" disabled={busy || !text.trim()}>{busy ? 'Sending…' : 'Send back to In progress'}</button>
          </div>
        </>
      }
    >
      <form id="send-back" class="stack" onSubmit={submit}>
        <p class="soft" style={{ margin: 0 }}>
          <strong style={{ color: 'var(--text)', fontWeight: 500 }}>{task.title}</strong>
          {owner ? ` goes back to ${owner}` : ' goes back'} as In progress. Say what needs to change; it is added to the task as a note.
        </p>
        <Field label="What needs to change">
          {(id) => <textarea id={id} class="textarea" rows={4} required maxLength={5000} value={text} onInput={(e) => setText(e.currentTarget.value)} data-autofocus />}
        </Field>
        <ErrorBox error={error} />
      </form>
    </Dialog>
  )
}

/** One-tap Behind from the board, with an optional note for the owner. */
export function BehindDialog(props: { snap: Snapshot; taskId: string; onClose: () => void; onDone: () => void }) {
  const task = props.snap.tasks.find((t) => t.id === props.taskId)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!task) return null

  async function submit(e: Event) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await updateTask(task!.id, { behind: true, behind_note: note.trim() })
      toast('Marked behind schedule')
      props.onDone()
      props.onClose()
    } catch (err) {
      setError((err as StoreError).message)
      setBusy(false)
    }
  }

  return (
    <Dialog
      title="Mark behind schedule"
      onClose={props.onClose}
      footer={
        <>
          <span />
          <div class="row">
            <button type="button" class="btn btn-soft btn-md" onClick={props.onClose}>Cancel</button>
            <button type="submit" form="behind-form" class="btn btn-primary btn-md" disabled={busy}>{busy ? 'Saving…' : 'Mark behind'}</button>
          </div>
        </>
      }
    >
      <form id="behind-form" class="stack" onSubmit={submit}>
        <p class="soft" style={{ margin: 0 }}>
          <strong style={{ color: 'var(--text)', fontWeight: 500 }}>{task.title}</strong>
          {task.owner ? ` (${memberName(props.snap, task.owner)})` : ''}. They see it in their updates the next time they open SPMS.
        </p>
        <Field label="Note for them (optional)">
          {(id) => <input id={id} class="input" maxLength={300} value={note} placeholder="Need this by Thursday" onInput={(e) => setNote(e.currentTarget.value)} data-autofocus />}
        </Field>
        <ErrorBox error={error} />
      </form>
    </Dialog>
  )
}
