// "Since your last visit": what changed on the member's tasks while they were away, from the activity log.

import type { ActivityEvent, Snapshot } from '../data/types'
import { STATUS_LABEL, type Status } from '../data/types'
import { actorName } from '../lib/summary'
import { when } from '../lib/util'

export function describe(snap: Snapshot, e: ActivityEvent, meId: string): string {
  const task = snap.tasks.find((t) => t.id === e.task)
  const title = task?.title ?? 'a task'
  const who = actorName(snap, e)
  const quote = (s: string) => (s.length > 160 ? `${s.slice(0, 160)}…` : s)
  switch (e.kind) {
    case 'created': return task?.owner === meId ? `${who} added ${title} for you` : `${who} added you to ${title}`
    case 'assigned': return `${who} made you the lead on ${title}`
    case 'helper_added': return `${who} added you as a helper on ${title}`
    case 'behind': return `${who} marked ${title} behind schedule${e.text ? `: "${quote(e.text)}"` : ''}`
    case 'on_schedule': return `${title} is back on schedule`
    case 'sent_back': return `${who} sent ${title} back to In progress`
    case 'approved': return `${who} approved ${title}. It's done.`
    case 'unblocked': return `${title} is unblocked: ${e.text || 'the task it waited on'} is done`
    case 'note': return `${who} added a note on ${title}: "${quote(e.text)}"`
    case 'started': return `${who} started ${title}`
    case 'submitted': return `${who} sent ${title} to review`
    case 'blocked': return `${who} flagged ${title} as blocked${e.text ? `: ${quote(e.text)}` : ''}`
    default: return `${who} moved ${title} to ${STATUS_LABEL[e.text as Status] ?? 'a new column'}`
  }
}

export function SinceLastVisit(props: { snap: Snapshot; meId: string; events: ActivityEvent[]; onDismiss: () => void }) {
  const shown = props.events.slice(0, 8)
  const more = props.events.length - shown.length
  return (
    <section class="panel" style={{ borderColor: 'var(--accent-bg)', gap: '10px' }} aria-label="Since your last visit">
      <div class="row-between">
        <h2 class="eyebrow" style={{ color: 'var(--accent-text)' }}>Since your last visit</h2>
        <button type="button" class="btn btn-soft btn-sm" onClick={props.onDismiss}>Got it</button>
      </div>
      <ul class="stack-sm" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {shown.map((e) => (
          <li key={e.id} class="row small" style={{ flexWrap: 'nowrap', alignItems: 'baseline', gap: '12px' }}>
            <span class="grow" style={{ color: e.kind === 'behind' || e.kind === 'sent_back' ? 'var(--warn)' : 'var(--text)', overflowWrap: 'anywhere' }}>
              {describe(props.snap, e, props.meId)}
            </span>
            <span class="muted xsmall" style={{ whiteSpace: 'nowrap' }}>{when(e.created)}</span>
          </li>
        ))}
      </ul>
      {more > 0 && <span class="muted xsmall">and {more} more</span>}
    </section>
  )
}
