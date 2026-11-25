import { useState } from 'preact/hooks'
import { startRetro, type StoreError } from '../data/store'
import type { ProjectKeys, Snapshot } from '../data/types'
import { formatDay, today } from '../lib/util'
import { Dialog, ErrorBox, Field, toast } from '../ui/ui'

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00`)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** The PM ends the project: open tasks are closed, the retrospective opens until the chosen day, and the board locks. */
export function WrapUpDialog(props: { snap: Snapshot; keys: ProjectKeys | null; onClose: () => void; onDone: () => void; onOpenSettings: () => void }) {
  const { snap } = props
  const [day, setDay] = useState(addDays(today(), 3))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const open = snap.tasks.filter((t) => t.status !== 'done').length + snap.todos.filter((t) => t.status !== 'done').length
  const noPm = !snap.members.some((m) => m.is_pm)
  const noChat = props.keys !== null && !props.keys.chat_webhook

  async function wrapUp(e: Event) {
    e.preventDefault()
    if (!day || day <= today()) return setError('Pick a day after today.')
    setBusy(true)
    setError(null)
    try {
      // The end of the chosen day, in the PM's time zone.
      const due = new Date(`${day}T23:59:00`).toISOString()
      const r = await startRetro(snap.project.id, due)
      toast(r.notified ? 'Project wrapped up. The group chat has been told.' : 'Project wrapped up. Let the group know the retrospective is open.')
      props.onDone()
    } catch (err) {
      setError((err as StoreError).message)
      setBusy(false)
    }
  }

  return (
    <Dialog
      title="Wrap up project"
      onClose={() => !busy && props.onClose()}
      footer={
        <>
          <button type="button" class="btn btn-md" onClick={props.onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="wrap-up" class="btn btn-primary btn-md" disabled={busy || !day}>{busy ? 'Wrapping up…' : 'Wrap up and start the retrospective'}</button>
        </>
      }
    >
      <form id="wrap-up" class="stack" onSubmit={wrapUp}>
        <p class="muted" style={{ margin: 0 }}>
          Ends {snap.project.name}. Everyone, you included, reviews their teammates: overall, quality of work and punctuality, plus organization,
          communication and fair task distribution for the PM. Each person only ever sees their own totals.
        </p>
        <ul class="muted small" style={{ margin: 0, paddingLeft: '18px' }}>
          <li>{open ? `${open} open ${open === 1 ? 'task is' : 'tasks are'} closed now. The archive shows which ones were still open.` : 'Every task is done.'}</li>
          <li>The board, tasks and project details become read-only for everyone, you included. This can't be undone.</li>
          <li>The retrospective ends when everyone has submitted, or at the end of the day you pick. A reminder goes to the group chat a day before.</li>
          <li>Then the project is archived. Everyone keeps access to their results and how the work was divided.</li>
        </ul>
        <Field label="Retrospective due" help={day ? `Closes at 23:59 on ${formatDay(day)}.` : undefined}>
          {(id) => <input id={id} type="date" class="input" style={{ maxWidth: '220px' }} min={addDays(today(), 1)} value={day} onInput={(e) => setDay(e.currentTarget.value)} required />}
        </Field>
        {noChat && (
          <div class="hint-box small">
            <span>
              No chat webhook is set, so SPMS can't post the start, the reminder or the archive notice to the group chat. Share the news yourself, or{' '}
              <button type="button" class="btn-text small" onClick={props.onOpenSettings}>add a webhook first</button>.
            </span>
          </div>
        )}
        {noPm && <ErrorBox error="Nobody in the group is marked as PM, so you can't review or be reviewed. Mark yourself as PM in Project settings before wrapping up: members can't be changed afterwards." />}
        <ErrorBox error={error} />
      </form>
    </Dialog>
  )
}
