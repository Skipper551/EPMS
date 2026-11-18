import { useState } from 'preact/hooks'
import { addNote, updateTask, type StoreError } from '../data/store'
import type { Snapshot } from '../data/types'
import { memberName } from '../lib/util'
import { Dialog, ErrorBox, Field, toast } from '../ui/ui'

/** Review → Doing, with a comment the owner sees as a note. */
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
      toast(`Sent back to ${owner || 'Doing'}`)
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
            <button type="submit" form="send-back" class="btn btn-primary btn-md" disabled={busy || !text.trim()}>{busy ? 'Sending…' : 'Send back to Doing'}</button>
          </div>
        </>
      }
    >
      <form id="send-back" class="stack" onSubmit={submit}>
        <p class="soft" style={{ margin: 0 }}>
          <strong style={{ color: 'var(--text)', fontWeight: 500 }}>{task.title}</strong>
          {owner ? ` goes back to ${owner}` : ' goes back'} in Doing. Say what needs to change; it is added to the task as a note.
        </p>
        <Field label="What needs to change">
          {(id) => <textarea id={id} class="textarea" rows={4} required maxLength={5000} value={text} onInput={(e) => setText(e.currentTarget.value)} data-autofocus />}
        </Field>
        <ErrorBox error={error} />
      </form>
    </Dialog>
  )
}
