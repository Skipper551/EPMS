import type { ActivityEvent, Member, Snapshot, Task } from '../data/types'
import { activeBlockers, byPriorityThenDue, canMove, dateRange, formatDay, memberName, startState, today, when } from '../lib/util'
import { Avatar, PriorityTag, StatusPill } from './ui'
import { subtasksOf, SubtaskProgress } from './Subtasks'

/** Days without any activity after which someone with open work is shown as quiet. */
const QUIET_DAYS = 7

interface Person {
  m: Member
  tasks: Task[]
  doing: Task[]
  review: Task[]
  next: Task | null
  done: number
  /** Tasks this person leads, so is accountable for (done ones included). */
  leads: number
  steps: { done: number; total: number }
  overdue: number
  behind: number
  blocked: number
  lastActive: string
}

function person(snap: Snapshot, m: Member, events: ActivityEvent[]): Person {
  const tasks = snap.tasks.filter((t) => canMove(t, m.id))
  const open = tasks.filter((t) => t.status !== 'done')
  const doing = open.filter((t) => t.status === 'doing').sort(byPriorityThenDue)
  const todo = open.filter((t) => t.status === 'todo')
  // Next up: what can be started now, most pressing then by due date; otherwise the next one to start.
  const next = todo.filter((t) => startState(t) !== 'upcoming').sort(byPriorityThenDue)[0]
    ?? todo.sort((a, b) => (a.start_date || '9999').localeCompare(b.start_date || '9999'))[0]
    ?? null
  const steps = tasks.flatMap((t) => subtasksOf(snap, t.id))
  const now = today()
  const stamps = [
    ...events.filter((e) => e.actor === m.id).map((e) => e.created),
    ...snap.notes.filter((n) => n.author === m.id).map((n) => n.created),
  ].sort()
  return {
    m,
    tasks,
    doing,
    review: open.filter((t) => t.status === 'review'),
    next,
    done: tasks.length - open.length,
    leads: tasks.filter((t) => t.owner === m.id).length,
    steps: { done: steps.filter((s) => s.done).length, total: steps.length },
    overdue: open.filter((t) => t.status !== 'review' && !!t.due_date && t.due_date < now).length,
    behind: open.filter((t) => t.behind).length,
    blocked: open.filter((t) => t.status !== 'review' && activeBlockers(t, snap).length > 0).length,
    lastActive: stamps[stamps.length - 1] ?? '',
  }
}

function daysSince(iso: string): number {
  const t = Date.parse(iso.replace(' ', 'T'))
  return Number.isNaN(t) ? Infinity : (Date.now() - t) / 86_400_000
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** Where everyone is: one row per person with what they're on now, what's next, flags and when they were last active.
 *  Read only; tasks open in the usual detail dialog. */
export function GroupView(props: { snap: Snapshot; meId: string; events: ActivityEvent[] | null; onOpen: (taskId: string) => void }) {
  const { snap, meId } = props
  const events = props.events ?? []
  const people = snap.members
    .map((m) => person(snap, m, events))
    // Everyone who isn't the PM is listed, even with no tasks, so nobody drops out of sight; PMs only when they have tasks.
    .filter((p) => !p.m.is_pm || p.tasks.length > 0)
    .sort((a, b) => Number(b.m.id === meId) - Number(a.m.id === meId))

  const total = snap.tasks.length
  const done = snap.tasks.filter((t) => t.status === 'done').length
  const summary = [
    `${done} of ${total} done`,
    snap.project.final_deadline && `final deadline ${formatDay(snap.project.final_deadline)}`,
  ].filter(Boolean).join(' · ')

  return (
    <section class="stack" style={{ flex: '1 1 100%', minWidth: 0, gap: '16px' }} aria-label="The group">
      <div class="row-between" style={{ alignItems: 'baseline' }}>
        <h1 class="h1">The group</h1>
        <span class="muted small">{total ? summary : 'No tasks yet.'}</span>
      </div>
      <p class="muted small" style={{ margin: 0 }}>
        Where everyone is. You all share the grade, so if someone looks stuck, offer a hand or tell the PM.
      </p>
      <div class="group-grid">
        {people.map((p) => <PersonCard key={p.m.id} snap={snap} p={p} me={p.m.id === meId} loaded={props.events !== null} onOpen={props.onOpen} />)}
      </div>
    </section>
  )
}

function PersonCard(props: { snap: Snapshot; p: Person; me: boolean; loaded: boolean; onOpen: (taskId: string) => void }) {
  const { snap, p } = props
  const open = p.tasks.length - p.done
  // Quiet: open work and nothing done for a week (counted from joining, so a new group isn't all flagged on day one).
  const quiet = open > 0 && props.loaded && daysSince(p.lastActive || p.m.created) > QUIET_DAYS
  const active = !props.loaded ? '' : p.lastActive ? `Active ${when(p.lastActive)}` : 'No activity yet'
  const flags = [
    p.overdue > 0 && plural(p.overdue, 'overdue', 'overdue'),
    p.behind > 0 && plural(p.behind, 'behind', 'behind'),
    p.blocked > 0 && plural(p.blocked, 'blocked', 'blocked'),
  ].filter((x): x is string => !!x)

  return (
    <article class="panel person-card" aria-label={p.m.name}>
      <div class="row-between" style={{ alignItems: 'center', flexWrap: 'nowrap', gap: '12px' }}>
        <div class="row" style={{ gap: '10px', flexWrap: 'nowrap', minWidth: 0 }}>
          <Avatar snap={snap} memberId={p.m.id} size={28} />
          <div class="stack-sm" style={{ gap: 0, minWidth: 0 }}>
            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.m.name}{props.me && <span class="muted" style={{ fontWeight: 400 }}> (you)</span>}
            </span>
            {(p.m.role || p.m.is_pm) && <span class="muted xsmall">{[p.m.is_pm && 'PM', p.m.role].filter(Boolean).join(' · ')}</span>}
          </div>
        </div>
        <span class={`xsmall ${quiet ? 'warn-text' : 'muted'}`} style={{ whiteSpace: 'nowrap' }}>{active}</span>
      </div>

      {p.tasks.length === 0 ? (
        <span class="muted small">No tasks yet.</span>
      ) : (
        <>
          <div class="stack-sm" style={{ gap: '6px' }}>
            <div class="row-between small">
              <span>{p.done} of {plural(p.tasks.length, 'task')} done{p.leads > 0 && <span class="muted"> · leads {p.leads}</span>}</span>
              {p.steps.total > 0 && <span class="muted">{p.steps.done} of {plural(p.steps.total, 'step')}</span>}
            </div>
            <div style={{ height: 6, background: 'var(--border)', borderRadius: 3 }} role="progressbar" aria-valuenow={p.done} aria-valuemin={0} aria-valuemax={p.tasks.length} aria-label={`${p.m.name}: ${p.done} of ${p.tasks.length} tasks done`}>
              <div style={{ width: `${Math.round((p.done / p.tasks.length) * 100)}%`, height: 6, background: 'var(--accent)', borderRadius: 3 }} />
            </div>
          </div>

          {flags.length > 0 && (
            <div class="row" style={{ gap: '6px' }}>
              {flags.map((f) => <span key={f} class="behind-tag">{f}</span>)}
            </div>
          )}

          <div class="stack-sm" style={{ gap: '6px' }}>
            <h3 class="eyebrow" style={{ fontSize: '12px' }}>Working on</h3>
            {p.doing.length === 0 && <span class="muted small">{open === 0 ? 'All done.' : 'Nothing in progress.'}</span>}
            {p.doing.map((t) => <TaskLine key={t.id} snap={snap} t={t} memberId={p.m.id} onOpen={props.onOpen} />)}
          </div>

          {p.review.length > 0 && (
            <div class="stack-sm" style={{ gap: '6px' }}>
              <h3 class="eyebrow" style={{ fontSize: '12px' }}>Waiting for review</h3>
              {p.review.map((t) => <TaskLine key={t.id} snap={snap} t={t} memberId={p.m.id} onOpen={props.onOpen} />)}
            </div>
          )}

          {p.next && (
            <div class="stack-sm" style={{ gap: '6px' }}>
              <h3 class="eyebrow" style={{ fontSize: '12px' }}>Up next</h3>
              <TaskLine snap={snap} t={p.next} memberId={p.m.id} onOpen={props.onOpen} />
            </div>
          )}
        </>
      )}
    </article>
  )
}

function TaskLine(props: { snap: Snapshot; t: Task; memberId: string; onOpen: (taskId: string) => void }) {
  const { snap, t } = props
  const leads = t.owner === props.memberId
  const lead = memberName(snap, t.owner)
  const late = t.status !== 'done' && t.status !== 'review' && !!t.due_date && t.due_date < today()
  const dates = dateRange(t.status === 'todo' ? t.start_date : '', t.due_date)
  const hasSteps = subtasksOf(snap, t.id).length > 0
  return (
    <button type="button" class="person-task" onClick={() => props.onOpen(t.id)}>
      <span class="row-between" style={{ flexWrap: 'nowrap', gap: '8px', width: '100%' }}>
        <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
        <span class="row" style={{ gap: '6px', flexWrap: 'nowrap' }}>
          {t.status !== 'done' && <PriorityTag priority={t.priority} />}
          {t.status === 'review' && <StatusPill status={t.status} />}
        </span>
      </span>
      {(dates || !leads) && (
        <span class={`xsmall ${late ? 'warn-text' : 'muted'}`}>
          {[!leads && (lead ? `Helping ${lead}` : 'Helping, no lead yet'), dates && `${dates}${late ? ' · overdue' : ''}`].filter(Boolean).join(' · ')}
        </span>
      )}
      {hasSteps && <SubtaskProgress snap={snap} task={t} />}
    </button>
  )
}
