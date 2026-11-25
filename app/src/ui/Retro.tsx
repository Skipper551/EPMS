// The retrospective: the review form while it's open, and each person's own results plus how the work was divided
// once the project is archived. Used by members and by the PM (who reviews and reads as their PM member).

import { useEffect, useRef, useState } from 'preact/hooks'
import { retroInfo, submitRetro, type StoreError } from '../data/store'
import type { Member, RetroInfo, RetroResults, RetroReview, RetroScore, Snapshot, Task } from '../data/types'
import { PM_RETRO_SCORES, RETRO_SCORES, STATUS_LABEL } from '../data/types'
import { load, save } from '../lib/util'
import {
  emptyReview, formatAvg, SCALE, SCORE_LABEL, SCORE_QUESTION, scoresFor, summaryFor, tasksOf, touched, workDivision, ZERO_HELP,
} from '../lib/retro'
import { Avatar, Dialog, ErrorBox, Loading, Toggle, toast } from './ui'

/** "Fri 28 Nov, 23:59" in this browser's time zone. */
export function retroDue(iso: string): string {
  const t = Date.parse(iso.replace(' ', 'T'))
  if (isNaN(t)) return ''
  return new Date(t).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function RetroScreen(props: { snap: Snapshot; meId: string; asPm?: string }) {
  const { snap, meId } = props
  const [info, setInfo] = useState<RetroInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const phase = snap.project.phase

  const refresh = () => retroInfo(snap.project.id, props.asPm ?? '').then((i) => { setInfo(i); setError(null) }, (e: StoreError) => setError(e.message))
  // Again when the phase changes (the last submission archives the project).
  useEffect(() => { if (meId) refresh() }, [snap.project.id, meId, phase])

  if (!meId) {
    return <div class="retro"><ErrorBox error="Add yourself to the group as a PM in Project settings to take part in the retrospective." /></div>
  }
  if (error && !info) return <div class="retro"><ErrorBox error={error} /><div><button type="button" class="btn" onClick={refresh}>Try again</button></div></div>
  if (!info) return <Loading />

  if (info.phase === 'archived') {
    return (
      <div class="retro">
        <div class="title-block">
          <span class="eyebrow">Archived project</span>
          <h1 class="h1">{snap.project.name}: your retrospective</h1>
          <span class="muted small">Only you can see this page. Scores are totals from the whole group; nobody can see who gave what.</span>
        </div>
        {info.results ? <Results snap={snap} meId={meId} results={info.results} /> : <ErrorBox error="No results for you in this project." />}
        <WorkDivision snap={snap} />
      </div>
    )
  }

  if (info.submitted) {
    return (
      <div class="retro">
        <section class="panel retro-done">
          <span class="eyebrow">Retrospective</span>
          <h1 class="h1">Thanks, your reviews are in</h1>
          <p class="muted" style={{ margin: 0 }}>
            {info.done} of {info.total} people have finished. Your results open here when everyone is done, or on {retroDue(info.due)} at the latest.
          </p>
        </section>
      </div>
    )
  }

  return <ReviewForm snap={snap} meId={meId} asPm={props.asPm ?? ''} info={info} onSubmitted={refresh} />
}

// ---------- the form ----------

function draftKey(projectId: string, meId: string) {
  return `epms:retro-draft:${projectId}:${meId}`
}

function ReviewForm(props: { snap: Snapshot; meId: string; asPm: string; info: RetroInfo; onSubmitted: () => void }) {
  const { snap, meId } = props
  const people = snap.members.filter((m) => m.id !== meId)
  const key = draftKey(snap.project.id, meId)
  const [reviews, setReviews] = useState<Record<string, RetroReview>>(() => {
    let saved: Record<string, RetroReview> = {}
    try { saved = JSON.parse(load(key) || '{}') || {} } catch { saved = {} }
    const out: Record<string, RetroReview> = {}
    for (const m of people) out[m.id] = { ...emptyReview(m), ...(saved[m.id] ?? {}), member: m.id }
    return out
  })
  const [index, setIndex] = useState(0)
  const [confirm, setConfirm] = useState<'submit' | 'skip' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const top = useRef<HTMLDivElement>(null)

  useEffect(() => { save(key, JSON.stringify(reviews)) }, [reviews])

  const person = people[index]
  const set = (id: string, patch: Partial<RetroReview>) => setReviews((r) => ({ ...r, [id]: { ...r[id], ...patch } }))
  const go = (i: number) => { setIndex(i); top.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }

  async function send(skip: boolean) {
    setBusy(true)
    setError(null)
    try {
      const list = skip ? [] : people.map((m) => clip(m, reviews[m.id]))
      await submitRetro(snap.project.id, list, props.asPm)
      save(key, null)
      toast(skip ? 'Done. You skipped the reviews.' : 'Reviews submitted. Thank you.')
      setConfirm(null)
      props.onSubmitted()
    } catch (e) {
      setError((e as StoreError).message)
      setBusy(false)
    }
  }

  if (!people.length) {
    return <div class="retro"><section class="panel"><h1 class="h1">Nobody else to review</h1></section></div>
  }

  return (
    <div class="retro" ref={top}>
      <div class="title-block">
        <span class="eyebrow">Retrospective, open until {retroDue(props.info.due)}</span>
        <h1 class="h1">Review your teammates</h1>
        <span class="muted small">
          Optional and private: everyone only ever sees their own totals, never who gave which score. Comments are anonymous unless you choose to show your name.
          You submit once, at the end, and can't change it afterwards. {props.info.done} of {props.info.total} people have finished.
        </span>
      </div>

      <div class="row retro-people" role="tablist" aria-label="Teammates">
        {people.map((m, i) => (
          <button key={m.id} type="button" role="tab" class="chip retro-person-chip" aria-selected={i === index} onClick={() => go(i)}>
            <Avatar snap={snap} memberId={m.id} size={20} />
            {m.name}
            {touched(reviews[m.id]) && <span class="retro-chip-mark">reviewed</span>}
          </button>
        ))}
      </div>

      <PersonReview key={person.id} snap={snap} member={person} review={reviews[person.id]} onChange={(p) => set(person.id, p)} />

      <div class="row retro-nav">
        <button type="button" class="btn btn-md" disabled={index === 0} onClick={() => go(index - 1)}>Previous</button>
        <div class="row" style={{ gap: '10px', marginLeft: 'auto' }}>
          <button type="button" class="btn-text" onClick={() => setConfirm('skip')}>Skip the retrospective</button>
          {index < people.length - 1
            ? <button type="button" class="btn btn-primary btn-md" onClick={() => go(index + 1)}>Next: {people[index + 1].name}</button>
            : <button type="button" class="btn btn-primary btn-md" onClick={() => setConfirm('submit')}>Review and submit</button>}
        </div>
      </div>

      {confirm && (
        <Dialog
          title={confirm === 'skip' ? 'Skip the retrospective?' : 'Submit your reviews?'}
          onClose={() => !busy && setConfirm(null)}
          footer={
            <>
              <button type="button" class="btn btn-md" onClick={() => setConfirm(null)} disabled={busy}>Go back</button>
              <button type="button" class="btn btn-primary btn-md" data-autofocus onClick={() => send(confirm === 'skip')} disabled={busy}>
                {busy ? 'Sending…' : confirm === 'skip' ? 'Skip' : 'Submit'}
              </button>
            </>
          }
        >
          {confirm === 'skip' ? (
            <p class="muted" style={{ margin: 0 }}>Everyone gets a 0 from you, and you're counted as done, so the retrospective can finish early. You can't review later.</p>
          ) : (
            <div class="stack-sm">
              <ul class="retro-confirm-list">
                {people.map((m) => {
                  const r = reviews[m.id]
                  return (
                    <li key={m.id}>
                      <strong style={{ fontWeight: 600 }}>{m.name}</strong>
                      <span class="muted small">
                        {touched(r)
                          ? scoresFor(m).map((s) => `${SCORE_LABEL[s]} ${formatScore(r[s] ?? 0)}`).join(' · ') +
                            (r.commends.length ? ` · ${r.commends.length} commended` : '') +
                            (r.comment.trim() ? (r.anonymous ? ' · anonymous comment' : ' · comment with your name') : '')
                          : 'Not reviewed (counts as 0)'}
                      </span>
                    </li>
                  )
                })}
              </ul>
              <p class="muted small" style={{ margin: 0 }}>Once submitted, your reviews can't be changed.</p>
            </div>
          )}
          <ErrorBox error={error} />
        </Dialog>
      )}
    </div>
  )
}

const formatScore = (n: number) => (n > 0 ? `+${n}` : String(n))

/** Only what the server takes for this person: no PM scores for a non-PM. */
function clip(m: Member, r: RetroReview): RetroReview {
  const out: RetroReview = { member: m.id, overall: r.overall, quality: r.quality, punctuality: r.punctuality, commends: r.commends, comment: r.comment.trim(), anonymous: r.anonymous }
  if (m.is_pm) Object.assign(out, { organization: r.organization ?? 0, communication: r.communication ?? 0, fairness: r.fairness ?? 0 })
  return out
}

function PersonReview(props: { snap: Snapshot; member: Member; review: RetroReview; onChange: (p: Partial<RetroReview>) => void }) {
  const { snap, member: m, review: r } = props
  const tasks = tasksOf(snap, m.id)
  const toggleCommend = (id: string) => props.onChange({ commends: r.commends.includes(id) ? r.commends.filter((x) => x !== id) : [...r.commends, id] })
  return (
    <section class="panel retro-person" aria-label={`Review of ${m.name}`}>
      <div class="row" style={{ gap: '12px' }}>
        <Avatar snap={snap} memberId={m.id} size={36} />
        <div class="stack-xs">
          <h2 class="h2">{m.name}{m.is_pm && <span class="tag-pm" style={{ marginLeft: '8px' }}>PM</span>}</h2>
          {m.role && <span class="muted small">{m.role}</span>}
        </div>
      </div>
      <p class="muted small" style={{ margin: 0 }}>{ZERO_HELP}</p>

      <ScoreRow score="overall" value={r.overall} onChange={(v) => props.onChange({ overall: v })} />

      <ScoreRow score="quality" value={r.quality} onChange={(v) => props.onChange({ quality: v })}>
        {tasks.length > 0 && (
          <div class="stack-sm">
            <span class="muted small">Their tasks. Commend the ones that were really well done.</span>
            <ul class="retro-tasks">
              {tasks.map((t) => <TaskCommend key={t.id} snap={snap} task={t} memberId={m.id} on={r.commends.includes(t.id)} onToggle={() => toggleCommend(t.id)} />)}
            </ul>
          </div>
        )}
      </ScoreRow>

      <ScoreRow score="punctuality" value={r.punctuality} onChange={(v) => props.onChange({ punctuality: v })} />

      {m.is_pm && (
        <div class="stack retro-pm-block">
          <span class="eyebrow">As the PM</span>
          {PM_RETRO_SCORES.map((s) => <ScoreRow key={s} score={s} value={r[s] ?? 0} onChange={(v) => props.onChange({ [s]: v })} />)}
        </div>
      )}

      <div class="stack-sm">
        <label class="field-label" for={`retro-comment-${m.id}`}>Comment for {m.name} (optional)</label>
        <textarea id={`retro-comment-${m.id}`} class="textarea" rows={3} maxLength={2000} value={r.comment}
          placeholder="What went well, and what could be better next time?"
          onInput={(e) => props.onChange({ comment: (e.target as HTMLTextAreaElement).value })} />
        <div class="row" style={{ gap: '10px' }}>
          <Toggle accent checked={r.anonymous} onChange={(v) => props.onChange({ anonymous: v })} label="Anonymous" />
          <span class="muted xsmall">{r.anonymous ? `${m.name} sees the comment without your name.` : `${m.name} sees your name with this comment.`}</span>
        </div>
      </div>
    </section>
  )
}

function ScoreRow(props: { score: RetroScore; value: number; onChange: (v: number) => void; children?: preact.ComponentChildren }) {
  const id = `retro-${props.score}`
  return (
    <div class="stack-sm retro-score">
      <div class="stack-xs">
        <span class="field-label" id={id}>{SCORE_LABEL[props.score]}</span>
        <span class="muted small">{SCORE_QUESTION[props.score]}</span>
      </div>
      <div class="retro-scale" role="radiogroup" aria-labelledby={id}>
        {SCALE.map((p) => (
          <button key={p.value} type="button" role="radio" aria-checked={props.value === p.value}
            class={`chip retro-scale-btn${p.value === 0 ? ' is-zero' : ''}`} onClick={() => props.onChange(p.value)}>
            <span class="retro-scale-num">{formatScore(p.value)}</span>
            <span class="retro-scale-label">{p.label}</span>
          </button>
        ))}
      </div>
      {props.children}
    </div>
  )
}

function TaskCommend(props: { snap: Snapshot; task: Task; memberId: string; on: boolean; onToggle: () => void }) {
  const t = props.task
  const role = t.owner === props.memberId ? 'Led' : 'Helped'
  return (
    <li class="retro-task">
      <div class="stack-xs" style={{ minWidth: 0 }}>
        <span class="retro-task-title">{t.title}</span>
        <span class="muted xsmall">{role}{t.closed_from ? ` · closed at wrap-up (was ${STATUS_LABEL[t.closed_from]})` : ''}</span>
      </div>
      <CommendButton on={props.on} onToggle={props.onToggle} />
    </li>
  )
}

const CONFETTI_COLOURS = ['#6ca0ff', '#9cc0ff', '#c9d9ff', '#f2b880', '#e8eaed']

/** "Commend" with a small burst of confetti when it's switched on. */
export function CommendButton(props: { on: boolean; onToggle: () => void }) {
  const ref = useRef<HTMLSpanElement>(null)
  function burst() {
    const host = ref.current
    if (!host || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    for (let i = 0; i < 16; i++) {
      const piece = document.createElement('span')
      piece.className = 'confetti-piece'
      const angle = (Math.PI * 2 * i) / 16 + Math.random() * 0.4
      const dist = 26 + Math.random() * 22
      piece.style.setProperty('--dx', `${Math.cos(angle) * dist}px`)
      piece.style.setProperty('--dy', `${Math.sin(angle) * dist - 10}px`)
      piece.style.setProperty('--rot', `${Math.round(Math.random() * 540 - 270)}deg`)
      piece.style.background = CONFETTI_COLOURS[i % CONFETTI_COLOURS.length]
      host.appendChild(piece)
      setTimeout(() => piece.remove(), 900)
    }
  }
  return (
    <span class="commend-wrap" ref={ref}>
      <button type="button" class={props.on ? 'btn btn-sm commend is-on' : 'btn btn-sm commend'} aria-pressed={props.on}
        onClick={() => { if (!props.on) burst(); props.onToggle() }}>
        {props.on ? 'Commended' : 'Commend'}
      </button>
    </span>
  )
}

// ---------- results ----------

function Results(props: { snap: Snapshot; meId: string; results: RetroResults }) {
  const { snap, results: res } = props
  const scores: RetroScore[] = res.is_pm ? [...RETRO_SCORES, ...PM_RETRO_SCORES] : RETRO_SCORES
  const counts = new Map(res.commends.map((c) => [c.task, c.count]))
  const tasks = tasksOf(snap, props.meId).sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
  return (
    <>
      <section class="panel">
        <div class="row" style={{ justifyContent: 'space-between' }}>
          <h2 class="eyebrow">Your scores</h2>
          <span class="muted small">{res.reviewed_by} of {res.teammates} teammates sent reviews. Skipped reviews count as 0.</span>
        </div>
        <div class="retro-results">
          {scores.map((s) => {
            const avg = res.averages[s] ?? 0
            return (
              <div key={s} class="retro-result">
                <div class="row" style={{ justifyContent: 'space-between' }}>
                  <span class="field-label">{SCORE_LABEL[s]}</span>
                  <span class="retro-avg">{formatAvg(avg)}</span>
                </div>
                <ScoreBar avg={avg} />
                <span class="small">{summaryFor(s, avg)}</span>
              </div>
            )
          })}
        </div>
      </section>

      {tasks.length > 0 && (
        <section class="panel">
          <h2 class="eyebrow">Your tasks</h2>
          <span class="muted small">How many teammates commended each one as really well done.</span>
          <ul class="retro-tasks">
            {tasks.map((t) => {
              const n = counts.get(t.id) ?? 0
              return (
                <li key={t.id} class="retro-task">
                  <div class="stack-xs" style={{ minWidth: 0 }}>
                    <span class="retro-task-title">{t.title}</span>
                    <span class="muted xsmall">{t.owner === props.meId ? 'Led' : 'Helped'}{t.closed_from ? ' · closed at wrap-up' : ''}</span>
                  </div>
                  <span class={n ? 'commend-count is-on' : 'commend-count'}>{n ? `${n} commended` : 'No commends'}</span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section class="panel">
        <h2 class="eyebrow">Comments</h2>
        {res.comments.length === 0 && <span class="muted small">Nobody left a comment.</span>}
        {res.comments.map((c, i) => (
          <blockquote key={i} class="retro-comment">
            <p>{c.text}</p>
            <span class="muted xsmall">{c.author || 'Anonymous'}</span>
          </blockquote>
        ))}
      </section>
    </>
  )
}

/** -2 to +2, filled from the middle. */
function ScoreBar(props: { avg: number }) {
  const pct = (Math.min(2, Math.abs(props.avg)) / 2) * 50
  const style = props.avg >= 0 ? { left: '50%', width: `${pct}%` } : { left: `${50 - pct}%`, width: `${pct}%` }
  return (
    <div class="retro-bar" role="img" aria-label={`${formatAvg(props.avg)} on a scale from -2 to +2`}>
      <span class={props.avg < 0 ? 'retro-bar-fill is-low' : 'retro-bar-fill'} style={style} />
      <span class="retro-bar-mid" />
    </div>
  )
}

/** How the work was divided across the group, as the project closed. */
export function WorkDivision(props: { snap: Snapshot }) {
  const { snap } = props
  const { shares, total, maxLed } = workDivision(snap)
  return (
    <section class="panel">
      <div class="row" style={{ justifyContent: 'space-between' }}>
        <h2 class="eyebrow">How the work was divided</h2>
        <span class="muted small">{total} tasks in the plan</span>
      </div>
      <ul class="retro-division">
        {shares.map((s) => (
          <li key={s.member.id}>
            <div class="row" style={{ gap: '10px' }}>
              <Avatar snap={snap} memberId={s.member.id} size={24} />
              <strong style={{ fontWeight: 600 }}>{s.member.name}</strong>
              {s.member.is_pm && <span class="tag-pm">PM</span>}
              <span class="muted small" style={{ marginLeft: 'auto' }}>
                Led {s.led.length} · helped on {s.helped.length}{s.steps ? ` · ${s.steps} steps ticked off` : ''}{s.unfinished ? ` · ${s.unfinished} closed unfinished` : ''}
              </span>
            </div>
            <div class="retro-division-bar" aria-hidden="true">
              <span class="is-led" style={{ width: `${(s.led.length / maxLed) * 100}%` }} />
              <span class="is-helped" style={{ width: `${(s.helped.length / maxLed) * 100}%` }} />
            </div>
            {s.led.length > 0 && <span class="muted xsmall">{s.led.map((t) => t.title).join(' · ')}</span>}
          </li>
        ))}
      </ul>
      <span class="muted xsmall">Solid bar: tasks led. Light bar: tasks helped on.</span>
    </section>
  )
}
