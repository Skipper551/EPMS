// What a task is waiting on, compact. One or two blockers show by name; three or more show as a count with
// progress ("Blocked by 6 tasks · 2 of 8 done") that expands in place to the full list. Used on the board and in My tasks.

import { useState } from 'preact/hooks'
import type { Snapshot, Task } from '../data/types'
import { STATUS_LABEL } from '../data/types'
import { joinNames, memberName } from '../lib/util'
import { BlockedIcon } from './ui'

const INLINE_MAX = 2

export function BlockerSummary(props: { snap: Snapshot; task: Task; variant: 'board' | 'member' }) {
  const { snap, task } = props
  const [open, setOpen] = useState(false)
  if (task.status === 'done') return null

  const blockingTasks = task.blocked_by_tasks.map((id) => snap.tasks.find((t) => t.id === id)).filter((t): t is Task => !!t)
  const pending = blockingTasks.filter((t) => t.status !== 'done')
  const doneCount = blockingTasks.length - pending.length
  const people = task.blocked_by_members.map((id) => memberName(snap, id)).filter(Boolean)
  const reason = task.blocked_reason.trim()
  const active = pending.length + people.length + (reason ? 1 : 0)
  if (active === 0) return null

  const owner = (t: Task) => memberName(snap, t.owner)
  const member = props.variant === 'member'

  // Few blockers: name them, as before.
  if (active <= INLINE_MAX) {
    const named = [
      ...pending.map((t) => (member && owner(t) ? `${owner(t)}: ${t.title} (${STATUS_LABEL[t.status].toLowerCase()})` : t.title)),
      ...people,
    ]
    const text = member
      ? [named.length ? `Waiting on ${named.join(', ')}` : '', reason ? `Waiting: ${reason}` : ''].filter(Boolean).join('. ')
      : [named.length ? `Blocked by ${named.join(', ')}` : '', reason ? (named.length ? reason : `Blocked: ${reason}`) : ''].filter(Boolean).join('. ')
    return member
      ? <div class="blocked-box"><BlockedIcon /><span>{text}</span></div>
      : <div class="tcard-blocked">{text}</div>
  }

  // Many blockers: a count with progress, tap to see them all.
  const parts = [
    pending.length ? `${pending.length} ${pending.length === 1 ? 'task' : 'tasks'}` : '',
    people.length ? (people.length <= 2 ? joinNames(people) : `${people.length} people`) : '',
    reason ? 'something else' : '',
  ].filter(Boolean)
  const progress = blockingTasks.length > 1 ? ` · ${doneCount} of ${blockingTasks.length} done` : ''
  const summary = `${member ? 'Waiting on' : 'Blocked by'} ${joinNames(parts)}${progress}`

  return (
    <div class={member ? 'blocked-box blockers' : 'blockers blockers-board'}>
      {member && <BlockedIcon />}
      <div class="grow" style={{ minWidth: 0 }}>
        <button type="button" class="blockers-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span>{summary}</span>
          <span aria-hidden="true" style={{ flex: 'none', display: 'inline-flex', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }}>
            <svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
          </span>
        </button>
        {open && (
          <ul class="blockers-list">
            {blockingTasks
              .slice()
              .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done'))
              .map((t) => (
                <li key={t.id} class={t.status === 'done' ? 'is-done' : undefined}>
                  <span class="blockers-mark" aria-hidden="true">{t.status === 'done' ? '✓' : '•'}</span>
                  <span class="grow">
                    {t.title}
                    <span class="blockers-meta">{[owner(t), STATUS_LABEL[t.status]].filter(Boolean).join(' · ')}</span>
                  </span>
                </li>
              ))}
            {people.map((n) => (
              <li key={n}><span class="blockers-mark" aria-hidden="true">•</span><span class="grow">Waiting on {n}</span></li>
            ))}
            {reason && <li><span class="blockers-mark" aria-hidden="true">•</span><span class="grow">{reason}</span></li>}
          </ul>
        )}
      </div>
    </div>
  )
}
