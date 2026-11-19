// Builds the PM's chat update: what changed since the last update, plus what's due soon.
// One message after a "management session" instead of one per change. Pure: no backend calls.

import type { ActivityEvent, Snapshot, Task } from '../data/types'
import { daysLeftText, daysUntil, formatDay, memberName, peopleText } from './util'

export interface Summary {
  text: string
  /** Tasks the PM changed since the last update */
  changed: number
}

const by = (snap: Snapshot, t: Task) => peopleText(snap, t)

export function buildSummary(snap: Snapshot, events: ActivityEvent[], pmName: string, appUrl: string): Summary {
  const pmEvents = events.filter((e) => e.by_pm && e.task)
  const touched = (kind: ActivityEvent['kind']) => {
    const ids = new Set(pmEvents.filter((e) => e.kind === kind).map((e) => e.task))
    return snap.tasks.filter((t) => ids.has(t.id))
  }
  const createdIds = new Set(pmEvents.filter((e) => e.kind === 'created').map((e) => e.task))

  const approved = touched('approved').filter((t) => t.status === 'done')
  const sentBack = touched('sent_back').filter((t) => t.status === 'doing')
  const behind = touched('behind').filter((t) => t.behind && t.status !== 'done')
  const onSchedule = touched('on_schedule').filter((t) => !t.behind && t.status !== 'done')
  const created = snap.tasks.filter((t) => createdIds.has(t.id) && t.status !== 'done')
  const reassigned = [...touched('assigned'), ...touched('helper_added')].filter((t, i, a) => !createdIds.has(t.id) && a.indexOf(t) === i)

  const dueSoon = snap.tasks
    .filter((t) => t.status !== 'done' && t.due_date && (daysUntil(t.due_date) ?? 99) <= 3)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))

  const startingSoon = snap.tasks
    .filter((t) => t.status === 'todo' && t.start_date && (daysUntil(t.start_date) ?? -1) >= 0 && (daysUntil(t.start_date) ?? 99) <= 7)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))

  const block = (title: string, lines: string[]) => (lines.length ? `${title}\n${lines.map((l) => `- ${l}`).join('\n')}` : '')
  const due = (t: Task) => (t.due_date ? `, due ${formatDay(t.due_date)}` : '')

  const blocks = [
    `Update on ${snap.project.name}${pmName ? ` from ${pmName}` : ''}`,
    block('Approved', approved.map((t) => `${t.title} (${by(snap, t)})`)),
    block('Sent back for changes', sentBack.map((t) => `${t.title} (${by(snap, t)})`)),
    block('Behind schedule', behind.map((t) => `${t.title} (${by(snap, t)})${t.behind_note ? `: ${t.behind_note}` : ''}`)),
    block('Back on schedule', onSchedule.map((t) => `${t.title} (${by(snap, t)})`)),
    created.length > 6
      ? `${created.length} new tasks are on the board. Open EPMS to see yours.`
      : block('New tasks', created.map((t) => `${t.title} (${by(snap, t)}${due(t)})`)),
    block('Changed hands', reassigned.map((t) => `${t.title} is now with ${by(snap, t)}`)),
    block('Starting in the next 7 days', startingSoon.map((t) => `${t.title} (${by(snap, t)}, starts ${formatDay(t.start_date)})`)),
    block('Due in the next 3 days', dueSoon.map((t) => {
      const late = (daysUntil(t.due_date) ?? 0) < 0
      return `${t.title} (${by(snap, t)}, ${late ? 'was due' : 'due'} ${formatDay(t.due_date)})`
    })),
    [
      snap.project.final_deadline ? `Final deadline ${formatDay(snap.project.final_deadline)}, ${daysLeftText(snap.project.final_deadline)}.` : '',
      `Open EPMS: ${appUrl}`,
    ].filter(Boolean).join(' '),
  ].filter(Boolean)

  const changed = new Set([...approved, ...sentBack, ...behind, ...onSchedule, ...created, ...reassigned].map((t) => t.id)).size
  return { text: blocks.join('\n\n'), changed }
}

/** How many tasks the PM has changed since the last update (for the reminder on the board). */
export function pmChangeCount(events: ActivityEvent[]): number {
  const kinds = new Set(['approved', 'sent_back', 'behind', 'on_schedule', 'created', 'assigned', 'helper_added'])
  return new Set(events.filter((e) => e.by_pm && e.task && kinds.has(e.kind)).map((e) => e.task)).size
}

/** A member's name, or the PM's when the server recorded the PM (superuser) as the one who did it. */
export function actorName(snap: Snapshot, e: ActivityEvent): string {
  if (e.actor) return memberName(snap, e.actor) || 'Someone'
  if (e.by_pm) {
    const pms = snap.members.filter((m) => m.is_pm)
    return pms.length === 1 ? pms[0].name : 'The PM'
  }
  return 'Someone'
}
