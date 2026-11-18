import { useMemo, useState } from 'preact/hooks'
import { addNote, createMember, createTask, updateProject, updateTask, type StoreError } from '../data/store'
import type { Snapshot } from '../data/types'
import { STATUS_LABEL } from '../data/types'
import { claudeInstructions, parsePlan, previewPlan, type OwnerMatch, type Preview } from '../lib/importPlan'
import { copyText } from '../lib/util'
import { Dialog, ErrorBox, toast } from '../ui/ui'

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ')

function ownerText(o: OwnerMatch): string {
  if (o.kind === 'member') return o.name
  if (o.kind === 'new') return `${o.name} (new)`
  return 'Nobody yet'
}

export function ImportTasksDialog(props: { snap: Snapshot; pmAuthorId: string; onClose: () => void; onDone: () => void }) {
  const { snap } = props
  const [text, setText] = useState('')
  const [stage, setStage] = useState<'input' | 'preview' | 'running'>('input')
  const [addMembers, setAddMembers] = useState(true)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [useGuidelines, setUseGuidelines] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)

  const parsed = useMemo(() => (stage === 'input' ? null : parsePlan(text)), [text, stage])
  const preview: Preview | null = useMemo(() => (parsed?.plan ? previewPlan(parsed.plan, snap) : null), [parsed, snap])

  async function readFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0]
    if (!file) return
    if (file.size > 1_000_000) return setError('That file is over 1 MB. A task file is usually a few KB.')
    setText(await file.text())
    setError(null)
  }

  function check() {
    const r = parsePlan(text)
    if (!r.plan) return setError(r.errors.join(' '))
    setError(null)
    setUseGuidelines(!!r.plan.guidelines && !snap.project.guidelines.trim())
    setStage('preview')
  }

  const toImport = preview ? preview.rows.filter((r) => !(skipDuplicates && r.duplicate)) : []

  async function run() {
    if (!preview || !parsed?.plan) return
    setStage('running')
    setError(null)
    let created = 0
    try {
      // 1. Members the project doesn't have yet.
      const people = new Map(snap.members.map((m) => [norm(m.name), m.id]))
      if (addMembers) {
        for (const m of preview.newMembers) {
          setProgress(`Adding ${m.name}…`)
          const made = await createMember(snap.project.id, { name: m.name, role: m.role, is_pm: m.pm })
          people.set(norm(m.name), made.id)
        }
      }
      const personId = (o: OwnerMatch) => (o.kind === 'member' ? o.id : o.kind === 'new' ? people.get(norm(o.name)) ?? '' : '')

      // 2. Tasks, with blockers that point at tasks already on the board.
      const refToId = new Map<string, string>()
      const boardByTitle = new Map(snap.tasks.map((t) => [norm(t.title), t.id]))
      for (const row of preview.rows) {
        if (skipDuplicates && row.duplicate) refToId.set(norm(row.task.ref), boardByTitle.get(norm(row.task.title))!)
      }
      for (const row of toImport) {
        setProgress(`Creating task ${created + 1} of ${toImport.length}…`)
        const t = await createTask(snap.project.id, {
          title: row.task.title,
          owner: personId(row.owner),
          helpers: [...new Set(row.helpers.map(personId).filter((id) => id && id !== personId(row.owner)))],
          everyone: row.task.everyone,
          due_date: row.task.due,
          status: row.task.status,
          behind: false,
          blocked_by_tasks: row.blockers.flatMap((b) => (b.kind === 'board' ? [b.id] : [])),
          blocked_by_members: [...new Set(row.waitingOn.map(personId).filter(Boolean))],
          links: row.task.links,
        })
        refToId.set(norm(row.task.ref), t.id)
        created++
      }

      // 3. Blockers between tasks in the file, now that they all have ids.
      for (const row of toImport) {
        const inFile = row.blockers.flatMap((b) => (b.kind === 'plan' ? [refToId.get(norm(b.ref))] : [])).filter((x): x is string => !!x)
        if (!inFile.length) continue
        setProgress('Linking blockers…')
        const board = row.blockers.flatMap((b) => (b.kind === 'board' ? [b.id] : []))
        await updateTask(refToId.get(norm(row.task.ref))!, { blocked_by_tasks: [...new Set([...board, ...inFile])] })
      }

      // 4. Descriptions become the first note on each task.
      for (const row of toImport) {
        if (!row.task.description) continue
        setProgress('Adding descriptions…')
        await addNote(refToId.get(norm(row.task.ref))!, props.pmAuthorId, row.task.description)
      }

      // 5. Guidelines, if the PM chose to use them.
      if (useGuidelines && parsed.plan.guidelines) {
        setProgress('Saving guidelines…')
        await updateProject(snap.project.id, { guidelines: parsed.plan.guidelines })
      }

      toast(`Imported ${created} ${created === 1 ? 'task' : 'tasks'}`)
      props.onDone()
      props.onClose()
    } catch (e) {
      setError(`${(e as StoreError).message} ${created ? `${created} ${created === 1 ? 'task was' : 'tasks were'} created before this happened; check the board before importing again.` : 'Nothing was imported.'}`)
      setStage('preview')
      props.onDone()
    }
  }

  // ---------- input ----------

  if (stage === 'input') {
    return (
      <Dialog
        title="Import tasks"
        onClose={props.onClose}
        wide
        footer={
          <>
            <span />
            <div class="row">
              <button type="button" class="btn btn-soft btn-md" onClick={props.onClose}>Cancel</button>
              <button type="button" class="btn btn-primary btn-md" disabled={!text.trim()} onClick={check}>Preview</button>
            </div>
          </>
        }
      >
        <p class="soft small" style={{ margin: 0 }}>
          Plan the tasks with Claude, go back and forth until they're right, then ask for the EPMS task file and paste it here. You'll see a preview before anything is created.
        </p>
        <div class="card card-tight stack">
          <strong style={{ fontWeight: 600 }}>Tell Claude the format</strong>
          <span class="muted small">
            Either install the EPMS skill in Claude once, or paste the instructions into your chat. The instructions include this project's member names and deadline.
          </span>
          <div class="row">
            <button
              type="button"
              class="btn btn-soft btn-sm"
              onClick={async () => toast((await copyText(claudeInstructions(snap))) ? 'Instructions copied. Paste them into your chat with Claude.' : "Couldn't copy.", false)}
            >
              Copy instructions for Claude
            </button>
            <a class="btn btn-soft btn-sm" href="./epms-task-plan.zip" download>Download the Claude skill</a>
          </div>
          <span class="muted xsmall">To install the skill, upload the downloaded file under Skills in Claude's settings.</span>
        </div>
        <div class="field">
          <label class="field-label" for="import-text">Task file</label>
          <textarea id="import-text" class="textarea" rows={10} style={{ fontFamily: 'var(--mono)', fontSize: '12px' }} value={text}
            onInput={(e) => setText(e.currentTarget.value)} placeholder='{ "format": "epms-tasks", "version": 1, "tasks": [ … ] }' data-autofocus />
        </div>
        <div class="row">
          <label class="btn btn-soft btn-sm" style={{ cursor: 'pointer' }}>
            Choose a file
            <input type="file" accept=".json,.txt,.md,application/json,text/plain" class="sr-only" onChange={readFile} />
          </label>
          <span class="muted xsmall">or paste Claude's reply above; the JSON is picked out of it.</span>
        </div>
        <ErrorBox error={error} />
      </Dialog>
    )
  }

  // ---------- preview ----------

  const p = preview!
  const dupes = p.rows.filter((r) => r.duplicate).length
  const plan = parsed!.plan!

  return (
    <Dialog
      title="Check before importing"
      onClose={stage === 'running' ? () => {} : props.onClose}
      wide
      footer={
        <>
          <button type="button" class="btn btn-soft btn-md" disabled={stage === 'running'} onClick={() => setStage('input')}>Back</button>
          <div class="row">
            {stage === 'running' && <span class="muted small" role="status">{progress}</span>}
            <button type="button" class="btn btn-primary btn-md" disabled={stage === 'running' || toImport.length === 0} onClick={run}>
              {stage === 'running' ? 'Importing…' : `Import ${toImport.length} ${toImport.length === 1 ? 'task' : 'tasks'}`}
            </button>
          </div>
        </>
      }
    >
      <div class="stack-sm">
        <span class="soft small">
          {p.rows.length} {p.rows.length === 1 ? 'task' : 'tasks'} in the file
          {plan.project && norm(plan.project) !== norm(snap.project.name) ? `, written for "${plan.project}"` : ''}.
          They go into <strong style={{ color: 'var(--text)', fontWeight: 500 }}>{snap.project.name}</strong>.
        </span>
      </div>

      {(p.newMembers.length > 0 || dupes > 0 || plan.guidelines) && (
        <div class="stack-sm">
          {p.newMembers.length > 0 && (
            <label class="check">
              <input type="checkbox" checked={addMembers} onChange={(e) => setAddMembers(e.currentTarget.checked)} />
              Add {p.newMembers.length} new {p.newMembers.length === 1 ? 'member' : 'members'}: {p.newMembers.map((m) => m.name).join(', ')}
              {!addMembers && <span class="muted"> (their tasks start with nobody assigned)</span>}
            </label>
          )}
          {dupes > 0 && (
            <label class="check">
              <input type="checkbox" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.currentTarget.checked)} />
              Skip {dupes} {dupes === 1 ? 'task that is' : 'tasks that are'} already on the board (same title)
            </label>
          )}
          {plan.guidelines && (
            <label class="check">
              <input type="checkbox" checked={useGuidelines} onChange={(e) => setUseGuidelines(e.currentTarget.checked)} />
              {snap.project.guidelines.trim() ? "Replace the project's guidelines with the ones in the file" : 'Use the guidelines in the file for this project'}
            </label>
          )}
        </div>
      )}

      {[...parsed!.warnings, ...p.notes].length > 0 && (
        <ul class="small" style={{ margin: 0, paddingLeft: '18px', color: 'var(--warn-soft)' }}>
          {[...parsed!.warnings, ...p.notes].map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}

      <div class="stack-sm" style={{ maxHeight: '46vh', overflowY: 'auto' }}>
        {p.rows.map((r) => {
          const skipped = skipDuplicates && r.duplicate
          const blockers = r.blockers.filter((b) => b.kind !== 'missing').map((b) => b.title)
          const waiting = r.waitingOn.map(ownerText)
          return (
            <div key={r.task.ref} class="note" style={{ gap: '4px', opacity: skipped ? 0.5 : 1 }}>
              <div class="row-between" style={{ alignItems: 'flex-start' }}>
                <strong style={{ fontWeight: 500 }}>{r.task.title}</strong>
                <span class="xsmall muted">{skipped ? 'Already on the board' : STATUS_LABEL[r.task.status]}</span>
              </div>
              <span class="xsmall muted">
                {[r.task.everyone ? `Everyone, led by ${ownerText(r.owner)}` : r.helpers.length ? `${ownerText(r.owner)} with ${r.helpers.map(ownerText).join(', ')}` : ownerText(r.owner), r.dueText ? `due ${r.dueText}` : 'no due date', r.task.links.length && `${r.task.links.length} ${r.task.links.length === 1 ? 'link' : 'links'}`]
                  .filter(Boolean).join(' · ')}
              </span>
              {(blockers.length > 0 || waiting.length > 0) && (
                <span class="xsmall warn-text">Blocked by {[...blockers, ...waiting].join(', ')}</span>
              )}
              {r.task.description && <span class="xsmall soft pre-wrap">{r.task.description.length > 220 ? `${r.task.description.slice(0, 220)}…` : r.task.description}</span>}
            </div>
          )
        })}
      </div>

      <ErrorBox error={error} />
    </Dialog>
  )
}
