import { useState } from 'preact/hooks'
import { addNote, answerQuestion, deleteQuestion, updateTask, type StoreError } from '../data/store'
import type { Question, Snapshot } from '../data/types'
import { memberName, when } from '../lib/util'
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

export function QuestionsDialog(props: { snap: Snapshot; onClose: () => void; onChanged: () => void }) {
  const open = props.snap.questions.filter((q) => !q.answer.trim())
  const answered = props.snap.questions.filter((q) => q.answer.trim()).reverse()
  return (
    <Dialog title="Questions" onClose={props.onClose} wide>
      {props.snap.questions.length === 0 && <div class="empty">No questions yet. Members ask through "Ask the PM" on their page.</div>}
      {open.length > 0 && (
        <section class="stack">
          <h3 class="eyebrow">Waiting for an answer</h3>
          {open.map((q) => <QuestionItem key={q.id} snap={props.snap} q={q} onChanged={props.onChanged} />)}
        </section>
      )}
      {answered.length > 0 && (
        <section class="stack">
          <h3 class="eyebrow">Answered</h3>
          {answered.map((q) => <QuestionItem key={q.id} snap={props.snap} q={q} onChanged={props.onChanged} />)}
        </section>
      )}
    </Dialog>
  )
}

function QuestionItem(props: { snap: Snapshot; q: Question; onChanged: () => void }) {
  const { q } = props
  const [editing, setEditing] = useState(!q.answer.trim())
  const [text, setText] = useState(q.answer)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)

  async function send(e: Event) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await answerQuestion(q.id, text.trim())
      toast('Answer sent')
      setEditing(false)
      props.onChanged()
    } catch (err) {
      setError((err as StoreError).message)
    }
    setBusy(false)
  }

  async function remove() {
    setBusy(true)
    try {
      await deleteQuestion(q.id)
      props.onChanged()
    } catch (err) {
      setError((err as StoreError).message)
      setBusy(false)
    }
  }

  return (
    <article class="card card-tight stack">
      <div class="stack-sm">
        <span class="note-meta">{memberName(props.snap, q.author) || 'A member'} · {when(q.created)}</span>
        <span class="pre-wrap">{q.text}</span>
      </div>
      {!editing && (
        <div class="note">
          <span class="note-meta">Your answer</span>
          <span class="pre-wrap">{q.answer}</span>
        </div>
      )}
      {editing && (
        <form class="stack" onSubmit={send}>
          <Field label="Your answer">
            {(id) => <textarea id={id} class="textarea" rows={3} maxLength={5000} value={text} onInput={(e) => setText(e.currentTarget.value)} />}
          </Field>
        </form>
      )}
      <ErrorBox error={error} />
      <div class="row-between">
        <div class="row">
          {editing ? (
            <>
              <button type="button" class="btn btn-primary btn-sm" disabled={busy || !text.trim()} onClick={send}>{busy ? 'Sending…' : q.answer ? 'Save answer' : 'Send answer'}</button>
              {q.answer && <button type="button" class="btn btn-soft btn-sm" onClick={() => { setText(q.answer); setEditing(false) }}>Cancel</button>}
            </>
          ) : (
            <button type="button" class="btn btn-soft btn-sm" onClick={() => setEditing(true)}>Edit answer</button>
          )}
        </div>
        {!confirm ? (
          <button type="button" class="btn-text" style={{ color: 'var(--muted)' }} onClick={() => setConfirm(true)}>Remove</button>
        ) : (
          <div class="row">
            <span class="xsmall warn-text">Remove this question?</span>
            <button type="button" class="btn btn-danger btn-sm" disabled={busy} onClick={remove}>Remove</button>
            <button type="button" class="btn btn-soft btn-sm" onClick={() => setConfirm(false)}>Keep</button>
          </div>
        )}
      </div>
    </article>
  )
}
