// Subtasks: a progress line for cards, the checklist inside a task, and the dialog for adding several at once
// (written by hand, or pasted from the member's AI).

import { useState } from 'preact/hooks'
import { createSubtasks, deleteSubtask, updateSubtask, type StoreError } from '../data/store'
import type { Snapshot, Subtask, Task } from '../data/types'
import { MAX_SUBTASKS, parseFromAi, parseLines } from '../lib/subtaskPlan'
import { CloseIcon, Dialog, ErrorBox, toast } from './ui'

export function subtasksOf(snap: Snapshot, taskId: string): Subtask[] {
  return snap.subtasks.filter((s) => s.task === taskId)
}

/** "3 of 7 subtasks · 43%" with a thin bar. Nothing when the task has no subtasks. */
export function SubtaskProgress(props: { snap: Snapshot; task: Task }) {
  const list = subtasksOf(props.snap, props.task.id)
  if (!list.length) return null
  const done = list.filter((s) => s.done).length
  const pct = Math.round((done / list.length) * 100)
  return (
    <div class="subtask-progress" aria-label={`${done} of ${list.length} subtasks done`}>
      <div class="row-between xsmall muted" style={{ flexWrap: 'nowrap' }}>
        <span>{done} of {list.length} subtasks</span>
        <span>{pct}%</span>
      </div>
      <div class="subtask-bar" aria-hidden="true"><div style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

/** The checklist inside a task. Lead, helpers and the PM can tick, add, rename and remove. */
export function SubtaskList(props: { snap: Snapshot; task: Task; canEdit: boolean; onChanged: () => void; onAddMany: () => void }) {
  const list = subtasksOf(props.snap, props.task.id)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null)
  // Ticks show straight away; the saved value takes over once the project reloads.
  const [ticked, setTicked] = useState<Record<string, boolean>>({})
  const isDone = (s: Subtask) => (s.id in ticked ? ticked[s.id] : s.done)
  const nextOrder = list.reduce((max, s) => Math.max(max, s.order), 0) + 1
  const full = list.length >= MAX_SUBTASKS

  async function act(fn: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      props.onChanged()
    } catch (e) {
      setError((e as StoreError).message)
    }
    setBusy(false)
  }

  return (
    <section class="stack">
      <div class="row-between">
        <h3 class="eyebrow">Subtasks</h3>
        {list.length > 0 && <span class="muted xsmall">{list.filter(isDone).length} of {list.length} done</span>}
      </div>
      {list.length === 0 && (
        <span class="muted small">
          {props.canEdit ? 'Break this task into smaller steps you can tick off. Write them yourself or ask your AI to help.' : 'No subtasks yet.'}
        </span>
      )}
      {list.length > 0 && (
        <ul class="subtask-list">
          {list.map((s) => (
            <li key={s.id} class={isDone(s) ? 'is-done' : undefined}>
              <input
                type="checkbox"
                checked={isDone(s)}
                disabled={!props.canEdit}
                aria-label={`${s.title}: ${isDone(s) ? 'done' : 'not done'}`}
                onChange={(e) => {
                  const done = e.currentTarget.checked
                  setTicked((t) => ({ ...t, [s.id]: done }))
                  act(async () => {
                    try {
                      await updateSubtask(s.id, { done })
                    } catch (err) {
                      setTicked((t) => { const n = { ...t }; delete n[s.id]; return n })
                      throw err
                    }
                  })
                }}
              />
              {editing?.id === s.id ? (
                <form
                  class="grow row"
                  style={{ flexWrap: 'nowrap', gap: '6px' }}
                  onSubmit={(e) => {
                    e.preventDefault()
                    const t = editing.title.trim()
                    if (t && t !== s.title) act(() => updateSubtask(s.id, { title: t }))
                    setEditing(null)
                  }}
                >
                  <label class="sr-only" for={`st-${s.id}`}>Subtask</label>
                  <input id={`st-${s.id}`} class="input" maxLength={200} value={editing.title} onInput={(e) => setEditing({ id: s.id, title: e.currentTarget.value })} autoFocus />
                  <button type="submit" class="btn btn-soft btn-sm">Save</button>
                </form>
              ) : (
                <span class="grow subtask-title">{s.title}</span>
              )}
              {props.canEdit && editing?.id !== s.id && (
                <span class="row subtask-actions" style={{ gap: '2px', flexWrap: 'nowrap' }}>
                  <button type="button" class="btn-text xsmall" style={{ color: 'var(--muted)' }} onClick={() => setEditing({ id: s.id, title: s.title })} aria-label={`Rename ${s.title}`}>Edit</button>
                  <button type="button" class="icon-btn" disabled={busy} onClick={() => act(() => deleteSubtask(s.id))} aria-label={`Remove ${s.title}`}><CloseIcon /></button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {props.canEdit && !full && (
        <form
          class="row"
          style={{ flexWrap: 'nowrap' }}
          onSubmit={(e) => {
            e.preventDefault()
            const t = title.trim()
            if (!t) return
            act(async () => {
              await createSubtasks(props.task.id, [t], nextOrder)
              setTitle('')
            })
          }}
        >
          <label class="sr-only" for={`new-st-${props.task.id}`}>New subtask</label>
          <input id={`new-st-${props.task.id}`} class="input" maxLength={200} placeholder="Add a subtask" value={title} onInput={(e) => setTitle(e.currentTarget.value)} />
          <button type="submit" class="btn btn-soft btn-md" disabled={busy || !title.trim()}>Add</button>
        </form>
      )}
      {props.canEdit && !full && (
        <div><button type="button" class="btn-text" onClick={props.onAddMany}>Add several at once, or paste from your AI</button></div>
      )}
      {full && props.canEdit && <span class="muted xsmall">That's the limit of {MAX_SUBTASKS}. Split the task if it needs more.</span>}
      <ErrorBox error={error} />
    </section>
  )
}

/** Add several subtasks: typed one per line, or pasted from the member's AI. */
export function AddSubtasksDialog(props: { snap: Snapshot; task: Task; onClose: () => void; onDone: () => void }) {
  const [tab, setTab] = useState<'write' | 'paste'>('write')
  const [written, setWritten] = useState('')
  const [pasted, setPasted] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const existing = subtasksOf(props.snap, props.task.id)
  const room = MAX_SUBTASKS - existing.length

  const parsed = tab === 'write' ? { titles: parseLines(written), error: null } : pasted.trim() ? parseFromAi(pasted) : { titles: [], error: null }
  const titles = parsed.titles.slice(0, room)
  const cut = parsed.titles.length - titles.length

  async function add() {
    if (!titles.length) return setError(parsed.error ?? 'Add at least one subtask.')
    setBusy(true)
    setError(null)
    try {
      const start = existing.reduce((max, s) => Math.max(max, s.order), 0) + 1
      await createSubtasks(props.task.id, titles, start)
      toast(`${titles.length} ${titles.length === 1 ? 'subtask' : 'subtasks'} added`)
      props.onDone()
      props.onClose()
    } catch (e) {
      setError((e as StoreError).message)
      setBusy(false)
    }
  }

  return (
    <Dialog
      title="Add subtasks"
      onClose={props.onClose}
      wide
      footer={
        <>
          <span class="muted xsmall">{titles.length ? `${titles.length} ${titles.length === 1 ? 'subtask' : 'subtasks'} to add` : ''}</span>
          <div class="row">
            <button type="button" class="btn btn-soft btn-md" onClick={props.onClose}>Cancel</button>
            <button type="button" class="btn btn-primary btn-md" disabled={busy || !titles.length} onClick={add}>{busy ? 'Adding…' : 'Add subtasks'}</button>
          </div>
        </>
      }
    >
      <p class="soft small" style={{ margin: 0 }}>
        For <strong style={{ color: 'var(--text)', fontWeight: 500 }}>{props.task.title}</strong>. Small steps you can tick off as you go; the PM sees how far along you are.
      </p>
      <div class="row" style={{ gap: '8px' }} role="tablist" aria-label="How to add subtasks">
        <button type="button" role="tab" class="chip" aria-selected={tab === 'write'} onClick={() => { setTab('write'); setError(null) }}>Write them</button>
        <button type="button" role="tab" class="chip" aria-selected={tab === 'paste'} onClick={() => { setTab('paste'); setError(null) }}>Paste from your AI</button>
      </div>
      {tab === 'write' ? (
        <div class="field">
          <label class="field-label" for="subtasks-write">One subtask per line</label>
          <textarea id="subtasks-write" class="textarea" rows={8} value={written} onInput={(e) => setWritten(e.currentTarget.value)}
            placeholder={'Read the brief again\nFind 3 examples\nWrite the first draft\nAsk Ala to read it'} data-autofocus />
        </div>
      ) : (
        <div class="stack">
          <span class="muted small">
            Ask your AI: <span style={{ color: 'var(--text)' }}>"Help me break {props.task.title} into subtasks for EPMS."</span> When you're happy with the list, paste its reply here.
          </span>
          <div class="field">
            <label class="field-label" for="subtasks-paste">Your AI's reply</label>
            <textarea id="subtasks-paste" class="textarea" rows={8} style={{ fontFamily: 'var(--mono)', fontSize: '12px' }} value={pasted} onInput={(e) => setPasted(e.currentTarget.value)}
              placeholder='{ "format": "epms-subtasks", "version": 1, "subtasks": [ … ] }' />
          </div>
        </div>
      )}
      {titles.length > 0 && (
        <ol class="small soft" style={{ margin: 0, paddingLeft: '20px', maxHeight: '30vh', overflowY: 'auto' }} aria-label="Preview">
          {titles.map((t, i) => <li key={i}>{t}</li>)}
        </ol>
      )}
      {cut > 0 && <span class="xsmall warn-text">Only the first {titles.length} fit: a task can have up to {MAX_SUBTASKS} subtasks.</span>}
      <ErrorBox error={error ?? (tab === 'paste' && pasted.trim() ? parsed.error : null)} />
    </Dialog>
  )
}
