// Quick to-dos: small things anyone in the group can add, take and tick off, with no review.
// Shown in a box beside the board (PM) and in the members' sidebar. The server (pb_hooks/todos.pb.js)
// enforces who may do what; the buttons here only show what it will allow.

import { useState } from 'preact/hooks'
import { createTodo, deleteTask, promoteTodo, updateTodo, type StoreError } from '../data/store'
import type { Snapshot, Task } from '../data/types'
import { memberName } from '../lib/util'
import { CloseIcon, toast } from './ui'

export const TODO_LIMIT = 30

export function QuickTodos(props: {
  snap: Snapshot
  /** The viewer's member id; for the PM, their own member entry if they have one, else '' */
  meId: string
  isPm?: boolean
  /** The PM previewing a member's screen: show the list, change nothing */
  readOnly?: boolean
  onChanged: () => Promise<void> | void
  /** PM: open the task editor once a to-do has become a full task */
  onPromoted?: (taskId: string) => void
}) {
  const { snap, meId, isPm = false, readOnly = false } = props
  const [title, setTitle] = useState('')
  const [mine, setMine] = useState(false)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [showDone, setShowDone] = useState(false)
  // A tick shows straight away; the reload after saving confirms it.
  const [ticked, setTicked] = useState<Record<string, 'todo' | 'done'>>({})
  const statusOf = (t: Task) => ticked[t.id] ?? t.status

  const open = snap.todos.filter((t) => statusOf(t) !== 'done')
  const done = snap.todos.filter((t) => statusOf(t) === 'done').sort((a, b) => b.updated.localeCompare(a.updated))
  const full = open.length >= TODO_LIMIT

  async function act(id: string, fn: () => Promise<unknown>, ok?: string) {
    setBusy((b) => new Set(b).add(id))
    try {
      await fn()
      if (ok) toast(ok)
    } catch (e) {
      toast((e as StoreError).message, true)
    }
    await props.onChanged()
    setBusy((b) => { const n = new Set(b); n.delete(id); return n })
    setTicked((m) => { const n = { ...m }; delete n[id]; return n })
  }

  async function add(e: Event) {
    e.preventDefault()
    const text = title.trim()
    if (!text || adding) return
    setAdding(true)
    try {
      await createTodo(snap.project.id, text, mine && meId ? meId : '', meId)
      setTitle('')
    } catch (err) {
      toast((err as StoreError).message, true)
    }
    await props.onChanged()
    setAdding(false)
  }

  const canTick = (t: Task) => isPm || !t.owner || t.owner === meId || t.created_by === meId
  const canRemove = (t: Task) => isPm || (!!meId && t.created_by === meId)

  const item = (t: Task) => {
    const isDone = statusOf(t) === 'done'
    const owner = t.owner ? (t.owner === meId ? 'You' : memberName(snap, t.owner) || 'Someone') : 'Up for grabs'
    const added = t.created_by && t.created_by !== t.owner ? ` · added by ${t.created_by === meId ? 'you' : memberName(snap, t.created_by) || 'someone'}` : ''
    const b = busy.has(t.id)
    const tickable = !readOnly && canTick(t)
    return (
      <li key={t.id} class={isDone ? 'todo-item is-done' : 'todo-item'}>
        <input
          type="checkbox"
          checked={isDone}
          disabled={!tickable || b}
          aria-label={`${isDone ? 'Reopen' : 'Tick off'}: ${t.title}`}
          title={tickable ? undefined : `${owner} ticks this one off`}
          onChange={() => {
            const next = isDone ? 'todo' : 'done'
            setTicked((m) => ({ ...m, [t.id]: next }))
            act(t.id, () => updateTodo(t.id, { status: next }))
          }}
        />
        <span class="todo-body">
          <span class="todo-title">{t.title}</span>
          <span class={t.owner ? 'muted xsmall' : 'xsmall todo-free'}>{owner}{added}</span>
          {!readOnly && !isDone && (
            <span class="todo-actions">
              {!t.owner && meId && <button type="button" class="btn-text xsmall" disabled={b} onClick={() => act(t.id, () => updateTodo(t.id, { owner: meId }), "It's yours")}>Take it</button>}
              {t.owner && t.owner === meId && <button type="button" class="btn-text xsmall" disabled={b} onClick={() => act(t.id, () => updateTodo(t.id, { owner: '' }))}>Let go</button>}
              {isPm && (
                <button type="button" class="btn-text xsmall" disabled={b}
                  onClick={async () => {
                    let moved = false
                    await act(t.id, async () => { await promoteTodo(t.id); moved = true }, 'Moved to the board as a task')
                    // After the reload, so the editor finds it among the tasks.
                    if (moved) props.onPromoted?.(t.id)
                  }}>
                  Make it a task
                </button>
              )}
            </span>
          )}
        </span>
        {!readOnly && canRemove(t) && (
          <button type="button" class="icon-btn todo-remove" disabled={b} aria-label={`Remove: ${t.title}`} onClick={() => act(t.id, () => deleteTask(t.id))}>
            <CloseIcon />
          </button>
        )}
      </li>
    )
  }

  return (
    <section class="panel todos" aria-label="Quick to-dos">
      <div class="row-between" style={{ alignItems: 'baseline' }}>
        <h2 class="eyebrow">Quick to-dos</h2>
        {open.length > 0 && <span class="muted xsmall">{open.length} open</span>}
      </div>

      {!readOnly && (
        <form class="stack-sm" style={{ gap: '8px' }} onSubmit={add}>
          <div class="row" style={{ flexWrap: 'nowrap', gap: '8px' }}>
            <input class="input" style={{ minWidth: 0 }} value={title} maxLength={300} disabled={full}
              placeholder={full ? `${TODO_LIMIT} open: tick some off first` : 'Add a to-do'} aria-label="New to-do"
              onInput={(e) => setTitle(e.currentTarget.value)} />
            <button type="submit" class="btn btn-soft btn-sm" disabled={!title.trim() || adding || full}>Add</button>
          </div>
          {meId && (
            <label class="check xsmall">
              <input type="checkbox" checked={mine} onChange={(e) => setMine(e.currentTarget.checked)} />
              I'll do it myself
            </label>
          )}
        </form>
      )}

      {open.length === 0 && (
        <span class="muted small">
          {readOnly ? 'No open to-dos.' : 'Small things anyone can do, like booking a room or emailing the professor. No review needed.'}
        </span>
      )}
      {open.length > 0 && <ul class="todo-list">{open.map(item)}</ul>}

      {done.length > 0 && (
        <>
          <button type="button" class="btn-text xsmall" style={{ alignSelf: 'flex-start', color: 'var(--muted)' }} aria-expanded={showDone} onClick={() => setShowDone(!showDone)}>
            {showDone ? 'Hide' : 'Show'} {done.length} done
          </button>
          {showDone && <ul class="todo-list">{done.slice(0, 20).map(item)}</ul>}
        </>
      )}
    </section>
  )
}
