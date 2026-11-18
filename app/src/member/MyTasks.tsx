import { useState } from 'preact/hooks'
import type { Member, Snapshot, Task } from '../data/types'
import { STATUS_LABEL } from '../data/types'
import { activeBlockers, canMove, dueKey, formatDay, involvement, joinNames, memberName, today, waitingOn } from '../lib/util'
import { BlockedIcon, SparkIcon, StatusPill } from '../ui/ui'

export interface TaskActions {
  advance: (t: Task) => void
  openDetail: (t: Task, focusNote?: boolean) => void
  blocked: (t: Task) => void
  setUpAi: () => void
}

function blockerSentence(snap: Snapshot, t: Task): string {
  return activeBlockers(t, snap)
    .map((b) => {
      if (b.kind === 'member') return `Waiting on ${b.label}`
      if (b.kind === 'custom') return `Waiting: ${b.label}`
      const owner = b.task?.owner ? memberName(snap, b.task.owner) : ''
      return `Waiting on ${owner ? `${owner}: ` : ''}${b.label} (${STATUS_LABEL[b.task!.status].toLowerCase()})`
    })
    .join('. ')
}

export function MyTasks(props: { snap: Snapshot; me: Member; busy: Set<string>; actions: TaskActions; aiReady: boolean; highlight: Set<string>; updates: preact.ComponentChildren }) {
  const { snap, me, actions } = props
  const [showDone, setShowDone] = useState(false)
  const mine = snap.tasks.filter((t) => involvement(t, me.id)).sort((a, b) => dueKey(a).localeCompare(dueKey(b)))
  const open = mine.filter((t) => t.status !== 'done')
  const done = mine.filter((t) => t.status === 'done')
  const nextDue = open.find((t) => t.due_date && t.status !== 'review')

  const summary = [
    `${open.length} ${open.length === 1 ? 'task' : 'tasks'}`,
    nextDue && `next due ${formatDay(nextDue.due_date)}`,
  ].filter(Boolean).join(' · ')

  return (
    <section class="stack" style={{ flex: '999 1 560px', minWidth: 0, gap: '16px' }}>
      <div class="row-between" style={{ alignItems: 'baseline' }}>
        <h1 class="h1">My tasks</h1>
        <span class="muted small">{summary}</span>
      </div>

      {props.updates}

      {open.length === 0 && (
        <div class="empty">{mine.length ? 'All your tasks are done. Nice work.' : 'No tasks for you yet. Your PM will add them here.'}</div>
      )}

      {open.map((t) => <TaskCard key={t.id} snap={snap} me={me} task={t} busy={props.busy.has(t.id)} actions={actions} fresh={props.highlight.has(t.id)} />)}

      <div class="hint-box">
        <SparkIcon />
        <span>
          Stuck on how to start? Ask your AI: <span style={{ color: 'var(--text)' }}>"Walk me through my next task."</span> It knows the project and the PM's guidelines.
          {!props.aiReady && <> <button type="button" class="btn-text" onClick={actions.setUpAi}>Set up your AI</button></>}
        </span>
      </div>

      {done.length > 0 && (
        <div class="stack">
          <button type="button" class="btn-text" style={{ alignSelf: 'flex-start', color: 'var(--muted)' }} aria-expanded={showDone} onClick={() => setShowDone(!showDone)}>
            {showDone ? 'Hide' : 'Show'} {done.length} done {done.length === 1 ? 'task' : 'tasks'}
          </button>
          {showDone && done.map((t) => <TaskCard key={t.id} snap={snap} me={me} task={t} busy={false} actions={actions} fresh={props.highlight.has(t.id)} />)}
        </div>
      )}
    </section>
  )
}

function TaskCard(props: { snap: Snapshot; me: Member; task: Task; busy: boolean; actions: TaskActions; fresh: boolean }) {
  const { snap, task: t, actions } = props
  const notes = snap.notes.filter((n) => n.task === t.id)
  const fromOthers = notes.filter((n) => n.author !== props.me.id)
  const last = notes[notes.length - 1]
  const lastFromOther = last && last.author !== props.me.id && t.status !== 'done' ? last : null
  const blocked = t.status !== 'done' ? blockerSentence(snap, t) : ''
  const overdue = t.status !== 'done' && t.status !== 'review' && t.due_date && t.due_date < today()

  const role = involvement(t, props.me.id)
  const lead = memberName(snap, t.owner)
  const others = t.helpers.filter((id) => id !== props.me.id).map((id) => memberName(snap, id)).filter(Boolean)
  const withText =
    t.everyone ? (lead && role !== 'lead' ? `Whole group, led by ${lead}` : 'Whole group') :
    role === 'helper' ? `Helping ${[lead, ...others].filter(Boolean).length ? joinNames([lead, ...others].filter(Boolean)) : 'out'}` :
    others.length ? `With ${joinNames(others)}` : ''
  const movable = canMove(t, props.me.id)
  const meta = [
    withText,
    t.due_date ? `Due ${formatDay(t.due_date)}` : 'No due date',
    fromOthers.length === 1 && `1 note from ${memberName(snap, fromOthers[0].author) || 'the PM'}`,
    fromOthers.length > 1 && `${fromOthers.length} notes`,
  ].filter(Boolean).join(' · ')

  const primary = !movable ? null :
    t.status === 'todo' ? 'Start' :
    t.status === 'doing' ? 'Send to review' : null

  return (
    <article class="card stack" style={{ opacity: t.status === 'done' ? 0.7 : 1, borderColor: props.fresh ? 'var(--accent)' : undefined }}>
      <div class="row-between" style={{ alignItems: 'flex-start' }}>
        <div class="stack-sm grow" style={{ gap: '4px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 600 }}>
            <button type="button" class="tcard-open" style={{ display: 'inline', fontWeight: 600, fontSize: '17px' }} onClick={() => actions.openDetail(t)}>{t.title}</button>
          </h2>
          <span class={overdue ? 'small warn-text' : 'muted small'}>{meta}{overdue ? ' · overdue' : ''}</span>
        </div>
        <div class="row" style={{ gap: '8px' }}>
          {props.fresh && <span class="group-tag">Updated</span>}
          {t.behind && t.status !== 'done' && <span class="behind-tag">Behind</span>}
          <StatusPill status={t.status} />
        </div>
      </div>

      {t.behind && t.status !== 'done' && t.behind_note && (
        <div class="blocked-box"><span>Behind schedule: {t.behind_note}</span></div>
      )}

      {blocked && (
        <div class="blocked-box"><BlockedIcon /><span>{blocked}</span></div>
      )}

      {lastFromOther && (
        <div class="note">
          <span class="note-meta">Latest note from {memberName(snap, lastFromOther.author) || 'the PM'}</span>
          <span class="pre-wrap">{lastFromOther.text.length > 280 ? `${lastFromOther.text.slice(0, 280)}…` : lastFromOther.text}</span>
        </div>
      )}

      {t.status !== 'done' && (
        <div class="row">
          {primary && (
            <button type="button" class={blocked && t.status === 'todo' ? 'btn btn-muted btn-md' : 'btn btn-primary btn-md'} disabled={props.busy} onClick={() => actions.advance(t)}>
              {primary}
            </button>
          )}
          {t.status === 'review' && <span class="muted small">Waiting for the PM to approve</span>}
          {!movable && t.status !== 'review' && <span class="muted small">{lead ? `${lead} moves this one` : 'The PM moves this one'}</span>}
          <button type="button" class="btn btn-soft btn-md" onClick={() => actions.openDetail(t, true)}>Add a note</button>
          {movable && t.status !== 'review' && <button type="button" class="btn btn-soft btn-md" onClick={() => actions.blocked(t)}>I'm blocked</button>}
          {t.links.length > 0 && (
            <span class="row" style={{ marginLeft: 'auto', gap: '14px' }}>
              {t.links.slice(0, 2).map((l, i) => <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" class="small">{l.label}</a>)}
              {t.links.length > 2 && <button type="button" class="btn-text" onClick={() => actions.openDetail(t)}>+{t.links.length - 2} more</button>}
            </span>
          )}
        </div>
      )}
    </article>
  )
}

// ---------- sidebar ----------

export function Sidebar(props: { snap: Snapshot; me: Member }) {
  const { snap, me } = props
  const mineIds = snap.tasks.filter((t) => canMove(t, me.id) && t.status !== 'done').map((t) => t.id)
  const waiting = waitingOn(snap, { taskIds: mineIds, memberId: me.id }).filter((t) => !canMove(t, me.id))
  const total = snap.tasks.length
  const done = snap.tasks.filter((t) => t.status === 'done').length
  const pct = total ? Math.round((done / total) * 100) : 0
  const people = snap.members
    .map((m) => {
      const tasks = snap.tasks.filter((t) => canMove(t, m.id))
      return { m, total: tasks.length, done: tasks.filter((t) => t.status === 'done').length }
    })
    .filter((p) => p.total > 0)

  const why = (t: Task) => {
    const mine = t.blocked_by_tasks.map((id) => snap.tasks.find((x) => x.id === id)).filter((x): x is Task => !!x && canMove(x, me.id) && x.status !== 'done')
    if (mine.length) return `Needs ${mine.map((x) => x.title).join(' and ')} first`
    return 'Waiting on you'
  }

  return (
    <aside class="stack" style={{ flex: '1 1 320px', minWidth: 0, gap: '24px' }}>
      <section class="panel">
        <h2 class="eyebrow">Waiting on you</h2>
        {waiting.length === 0 && <span class="muted small">Nobody is waiting on you right now.</span>}
        {waiting.map((t) => (
          <div key={t.id} class="stack-sm" style={{ gap: '4px' }}>
            <span style={{ fontWeight: 500 }}>{memberName(snap, t.owner) || 'Unassigned'} · {t.title}</span>
            <span class="muted small">{why(t)}</span>
          </div>
        ))}
      </section>

      <section class="panel" style={{ gap: '16px' }}>
        <div class="row-between" style={{ alignItems: 'baseline' }}>
          <h2 class="eyebrow">The group</h2>
          {snap.project.final_deadline && <span class="muted xsmall">Due {formatDay(snap.project.final_deadline)}</span>}
        </div>
        <div class="stack-sm">
          <div class="row-between small"><span>Overall</span><span class="muted">{done} of {total} done</span></div>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 4 }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Group progress">
            <div style={{ width: `${pct}%`, height: 8, background: 'var(--accent)', borderRadius: 4 }} />
          </div>
        </div>
        {people.map(({ m, total: n, done: d }) => (
          <div key={m.id} class="row small" style={{ flexWrap: 'nowrap', gap: '12px' }}>
            <span style={{ width: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: m.id === me.id ? 600 : 400 }}>{m.name}</span>
            <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3 }} aria-hidden="true">
              <div style={{ width: `${Math.round((d / n) * 100)}%`, height: 6, background: 'var(--accent)', borderRadius: 3 }} />
            </div>
            <span class="muted" style={{ width: 40, textAlign: 'right' }} aria-label={`${m.name}: ${d} of ${n} done`}>{d}/{n}</span>
          </div>
        ))}
      </section>

      {snap.project.guidelines.trim() && <FromPm text={snap.project.guidelines} />}
    </aside>
  )
}

function FromPm(props: { text: string }) {
  const long = props.text.length > 420
  const [open, setOpen] = useState(false)
  return (
    <section class="panel" style={{ gap: '10px' }}>
      <h2 class="eyebrow">From the PM</h2>
      <p class="small soft pre-wrap" style={{ margin: 0 }}>{long && !open ? `${props.text.slice(0, 400).trimEnd()}…` : props.text}</p>
      {long && <button type="button" class="btn-text" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(!open)}>{open ? 'Show less' : 'Show all'}</button>}
    </section>
  )
}
