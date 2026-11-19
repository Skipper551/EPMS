import { useState } from 'preact/hooks'
import type { Snapshot, Status, Task } from '../data/types'
import { STATUSES, STATUS_LABEL } from '../data/types'
import { daysLeftText, dueKey, formatDay, involvement, memberName, peopleText, startState, today } from '../lib/util'
import { Avatar } from '../ui/ui'
import { BlockerSummary } from '../ui/BlockerSummary'
import { SubtaskProgress } from '../ui/Subtasks'

export interface BoardActions {
  open: (taskId: string) => void
  approve: (taskId: string) => void
  sendBack: (taskId: string) => void
  move: (taskId: string, status: Status) => void
  /** Mark behind (asks for an optional note) or back on schedule. */
  toggleBehind: (taskId: string) => void
}

const UNASSIGNED = '__nobody'

export function Board(props: { snap: Snapshot; actions: BoardActions; busy: Set<string>; changes: number; onUpdate: () => void }) {
  const { snap, actions } = props
  const [filter, setFilter] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropCol, setDropCol] = useState<Status | null>(null)

  const total = snap.tasks.length
  const done = snap.tasks.filter((t) => t.status === 'done').length
  const deadline = snap.project.final_deadline
  const summary = [
    `${done} of ${total} done`,
    deadline && `final deadline ${formatDay(deadline)}`,
    deadline && daysLeftText(deadline),
  ].filter(Boolean).join(' · ')

  const review = snap.tasks.filter((t) => t.status === 'review')
  const behind = snap.tasks.filter((t) => t.behind && t.status !== 'done')
  const who = (t: Task) => memberName(snap, t.owner) || 'Nobody'
  const hasUnassigned = snap.tasks.some((t) => !t.owner && !t.helpers.length && !t.everyone)

  const visible = snap.tasks.filter((t) => !filter || (filter === UNASSIGNED ? !t.owner && !t.helpers.length && !t.everyone : !!involvement(t, filter)))

  const filters: { id: string | null; label: string }[] = [
    { id: null, label: 'Everyone' },
    ...snap.members.map((m) => ({ id: m.id, label: m.name })),
    ...(hasUnassigned ? [{ id: UNASSIGNED, label: 'Nobody yet' }] : []),
  ]

  return (
    <>
      <div class="title-row">
        <div class="title-block">
          <h1 class="h1">Board</h1>
          <span class="muted small">{total ? summary : 'No tasks yet.'}</span>
        </div>
        {snap.members.length > 0 && (
          <div class="row" style={{ gap: '8px' }} role="group" aria-label="Filter by member">
            {filters.map((f) => (
              <button key={f.label} type="button" class="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>
            ))}
          </div>
        )}
      </div>


      {(review.length > 0 || behind.length > 0 || props.changes > 0) && (
        <div class="banners">
          {props.changes > 0 && (
            <div class="banner banner-accent" style={{ justifyContent: 'space-between' }}>
              <span>
                <strong>{props.changes === 1 ? '1 task changed' : `${props.changes} tasks changed`}</strong>
                <span class="banner-detail"> since the last chat update</span>
              </span>
              <button type="button" class="btn btn-primary btn-sm" onClick={props.onUpdate}>Update the group</button>
            </div>
          )}
          {review.length > 0 && (
            <div class="banner banner-accent">
              <strong>{review.length === 1 ? '1 task waiting for your review' : `${review.length} tasks waiting for your review`}</strong>
              <span class="banner-detail">{review.map((t) => `${who(t)} · ${t.title}`).join(', ')}</span>
            </div>
          )}
          {behind.length > 0 && (
            <div class="banner banner-warn">
              <strong>{behind.length} behind schedule</strong>
              <span class="banner-detail">{behind.map((t) => `${who(t)} · ${t.title}`).join(', ')}</span>
            </div>
          )}
        </div>
      )}

      <div class="board-scroll">
        <div class="board">
          {STATUSES.map((status) => {
            const cards = visible.filter((t) => t.status === status).sort((a, b) => dueKey(a).localeCompare(dueKey(b)))
            return (
              <section
                key={status}
                class={dropCol === status ? 'column drop' : 'column'}
                aria-label={STATUS_LABEL[status]}
                onDragOver={(e) => {
                  if (!dragId) return
                  e.preventDefault()
                  if (dropCol !== status) setDropCol(status)
                }}
                onDragLeave={(e) => {
                  if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDropCol(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const id = dragId
                  setDragId(null)
                  setDropCol(null)
                  const t = id && snap.tasks.find((x) => x.id === id)
                  if (t && t.status !== status) actions.move(t.id, status)
                }}
              >
                <div class="column-head">
                  <h2>{STATUS_LABEL[status]}</h2>
                  <span class="muted xsmall">{cards.length}</span>
                </div>
                {cards.length === 0 && <div class="column-empty">{status === 'review' ? 'Nothing to review' : 'Empty'}</div>}
                {cards.map((t) => (
                  <TaskCard
                    key={t.id}
                    snap={snap}
                    task={t}
                    actions={actions}
                    busy={props.busy.has(t.id)}
                    dragging={dragId === t.id}
                    onDrag={(on) => setDragId(on ? t.id : null)}
                  />
                ))}
              </section>
            )
          })}
        </div>
      </div>
    </>
  )
}

function TaskCard(props: { snap: Snapshot; task: Task; actions: BoardActions; busy: boolean; dragging: boolean; onDrag: (on: boolean) => void }) {
  const { snap, task: t, actions } = props
  const people = t.everyone ? (t.owner ? `Led by ${memberName(snap, t.owner)}` : 'No lead yet') : peopleText(snap, t)
  const faces = [t.owner, ...(t.everyone ? [] : t.helpers)].filter(Boolean).slice(0, 4)
  const overdue = t.status !== 'done' && t.due_date && t.due_date < today()
  const cls = ['tcard', t.behind && t.status !== 'done' && 'is-behind', t.status === 'done' && 'is-done', props.dragging && 'dragging'].filter(Boolean).join(' ')

  return (
    <article
      class={cls}
      draggable
      onDragStart={(e) => {
        e.dataTransfer?.setData('text/plain', t.id)
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
        props.onDrag(true)
      }}
      onDragEnd={() => props.onDrag(false)}
    >
      <button type="button" class="tcard-open" onClick={() => actions.open(t.id)} aria-label={`Edit task: ${t.title}`}>
        <div class="tcard-title-row">
          <h3>{t.title}</h3>
          <span class="row" style={{ gap: '6px', flexWrap: 'nowrap' }}>
            {t.everyone && <span class="group-tag">Everyone</span>}
            {t.behind && t.status !== 'done' && <span class="behind-tag">Behind</span>}
          </span>
        </div>
        <div class="tcard-meta">
          <span class="tcard-owner">
            {faces.length > 0 && <span class="avatars">{faces.map((id) => <Avatar key={id} snap={snap} memberId={id} />)}</span>}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={people}>{people}</span>
          </span>
          {(t.due_date || t.start_date) && (
            <span class={overdue ? 'warn-text' : undefined} style={{ whiteSpace: 'nowrap' }}>
              {t.start_date && t.status === 'todo' ? `${formatDay(t.start_date)} to ` : ''}{t.due_date ? formatDay(t.due_date) : `from ${formatDay(t.start_date)}`}
            </span>
          )}
        </div>
        {startState(t) === 'late' && <div class="tcard-blocked">Should have started {formatDay(t.start_date)}</div>}
        {t.status !== 'done' && <SubtaskProgress snap={snap} task={t} />}
        {t.behind && t.status !== 'done' && t.behind_note && <div class="tcard-blocked">Behind: {t.behind_note}</div>}
      </button>
      <BlockerSummary snap={snap} task={t} variant="board" />
      {(t.status === 'todo' || t.status === 'doing') && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-4px' }}>
          <button type="button" class="btn-text xsmall" style={{ color: t.behind ? 'var(--warn)' : 'var(--muted)', fontSize: '12px' }} disabled={props.busy}
            onClick={() => actions.toggleBehind(t.id)}>
            {t.behind ? 'Back on schedule' : 'Mark behind'}
          </button>
        </div>
      )}
      {t.status === 'review' && (
        <div class="tcard-review">
          <button type="button" class="btn btn-primary btn-sm" disabled={props.busy} onClick={() => actions.approve(t.id)}>Approve</button>
          <button type="button" class="btn btn-soft btn-sm" disabled={props.busy} onClick={() => actions.sendBack(t.id)}>Send back</button>
        </div>
      )}
    </article>
  )
}

