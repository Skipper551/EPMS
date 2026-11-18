import { useEffect, useState } from 'preact/hooks'
import {
  aiLink, createMember, deleteMember, deleteProject, regenerateKey, updateMember, updateProject, type StoreError,
} from '../data/store'
import type { Member, ProjectKeys, Snapshot } from '../data/types'
import { copyText, memberLink } from '../lib/util'
import { Avatar, ErrorBox, Field, toast } from '../ui/ui'

export function Settings(props: {
  snap: Snapshot
  keys: ProjectKeys | null
  onKeys: (k: ProjectKeys) => void
  pmAuthorId: string
  onPmAuthor: (id: string) => void
  onChanged: () => void
  onDeleted: () => void
}) {
  return (
    <>
      <div class="title-block">
        <h1 class="h1">Project settings</h1>
        <span class="muted small">{props.snap.project.name}</span>
      </div>
      <Details snap={props.snap} onChanged={props.onChanged} />
      <Guidelines snap={props.snap} onChanged={props.onChanged} />
      <Members snap={props.snap} pmAuthorId={props.pmAuthorId} onPmAuthor={props.onPmAuthor} onChanged={props.onChanged} />
      <Links snap={props.snap} keys={props.keys} onKeys={props.onKeys} />
      <DeleteProject snap={props.snap} onDeleted={props.onDeleted} />
    </>
  )
}

function useSaver() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      if (ok) toast(ok)
      setBusy(false)
      return true
    } catch (e) {
      setError((e as StoreError).message)
      setBusy(false)
      return false
    }
  }
  return { busy, error, run }
}

function Details(props: { snap: Snapshot; onChanged: () => void }) {
  const p = props.snap.project
  const [name, setName] = useState(p.name)
  const [course, setCourse] = useState(p.course)
  const [deadline, setDeadline] = useState(p.final_deadline)
  const s = useSaver()
  useEffect(() => { setName(p.name); setCourse(p.course); setDeadline(p.final_deadline) }, [p.id])
  const dirty = name !== p.name || course !== p.course || deadline !== p.final_deadline

  return (
    <section class="panel">
      <h2 class="eyebrow">Details</h2>
      <form
        class="stack-lg"
        onSubmit={async (e) => {
          e.preventDefault()
          if (await s.run(() => updateProject(p.id, { name: name.trim(), course: course.trim(), final_deadline: deadline }), 'Details saved')) props.onChanged()
        }}
      >
        <div class="form-grid">
          <Field label="Project name" class="span-2">{(id) => <input id={id} class="input" required maxLength={200} value={name} onInput={(e) => setName(e.currentTarget.value)} />}</Field>
          <Field label="Course">{(id) => <input id={id} class="input" maxLength={200} value={course} onInput={(e) => setCourse(e.currentTarget.value)} />}</Field>
          <Field label="Final deadline">{(id) => <input id={id} class="input" type="date" value={deadline} onInput={(e) => setDeadline(e.currentTarget.value)} />}</Field>
        </div>
        <ErrorBox error={s.error} />
        <div><button type="submit" class="btn btn-primary btn-md" disabled={s.busy || !dirty || !name.trim()}>Save details</button></div>
      </form>
    </section>
  )
}

function Guidelines(props: { snap: Snapshot; onChanged: () => void }) {
  const p = props.snap.project
  const [text, setText] = useState(p.guidelines)
  const s = useSaver()
  useEffect(() => setText(p.guidelines), [p.id])

  return (
    <section class="panel">
      <div class="stack-sm">
        <h2 class="eyebrow">Guidelines</h2>
        <span class="muted small">
          How the group works, standards, tone, and what "done" means. Members see this on their page, and every member's AI follows it.
        </span>
      </div>
      <form
        class="stack"
        onSubmit={async (e) => {
          e.preventDefault()
          if (await s.run(() => updateProject(p.id, { guidelines: text }), 'Guidelines saved')) props.onChanged()
        }}
      >
        <label class="sr-only" for="guidelines">Guidelines</label>
        <textarea id="guidelines" class="textarea" rows={8} maxLength={20000} value={text} onInput={(e) => setText(e.currentTarget.value)}
          placeholder="APA 7 for all references. Keep your section under 600 words. Send things to review by Thursday evening so I can merge on Friday." />
        <ErrorBox error={s.error} />
        <div class="row-between">
          <button type="submit" class="btn btn-primary btn-md" disabled={s.busy || text === p.guidelines}>Save guidelines</button>
          <span class="muted xsmall">{text.length.toLocaleString()} / 20,000</span>
        </div>
      </form>
    </section>
  )
}

function Members(props: { snap: Snapshot; pmAuthorId: string; onPmAuthor: (id: string) => void; onChanged: () => void }) {
  const { snap } = props
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [isPm, setIsPm] = useState(false)
  const s = useSaver()
  const pmMembers = snap.members.filter((m) => m.is_pm)

  return (
    <section class="panel">
      <div class="stack-sm">
        <h2 class="eyebrow">Members</h2>
        <span class="muted small">
          PMs can own tasks but never appear in the member name picker. Each PM logs in here with their own superuser account, added in the instance dashboard.
        </span>
      </div>
      <div class="list">
        {snap.members.map((m) => <MemberRow key={m.id} snap={snap} m={m} onChanged={props.onChanged} />)}
        {snap.members.length === 0 && <span class="muted small">No members yet.</span>}
      </div>

      <form
        class="stack"
        style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}
        onSubmit={async (e) => {
          e.preventDefault()
          if (await s.run(() => createMember(snap.project.id, { name: name.trim(), role: role.trim(), is_pm: isPm }), `${name.trim()} added`)) {
            setName('')
            setRole('')
            setIsPm(false)
            props.onChanged()
          }
        }}
      >
        <h3 class="field-label">Add a member</h3>
        <div class="row" style={{ alignItems: 'flex-end' }}>
          <div class="grow" style={{ minWidth: '160px' }}><Field label="Name">{(id) => <input id={id} class="input" required maxLength={100} value={name} onInput={(e) => setName(e.currentTarget.value)} />}</Field></div>
          <div class="grow" style={{ minWidth: '160px' }}><Field label="Role in the group">{(id) => <input id={id} class="input" maxLength={200} value={role} placeholder="Research" onInput={(e) => setRole(e.currentTarget.value)} />}</Field></div>
          <label class="check" style={{ marginBottom: '10px' }}><input type="checkbox" checked={isPm} onChange={(e) => setIsPm(e.currentTarget.checked)} /> PM</label>
          <button type="submit" class="btn btn-primary btn-md" disabled={s.busy || !name.trim()}>Add</button>
        </div>
        <ErrorBox error={s.error} />
      </form>

      {pmMembers.length > 1 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          <Field label="On this device, notes you write are posted as" help="Saved in this browser only, so each PM can pick their own name.">
            {(id) => (
              <select id={id} class="select" style={{ maxWidth: '280px' }} value={props.pmAuthorId} onChange={(e) => props.onPmAuthor(e.currentTarget.value)}>
                {pmMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            )}
          </Field>
        </div>
      )}
    </section>
  )
}

function MemberRow(props: { snap: Snapshot; m: Member; onChanged: () => void }) {
  const { m, snap } = props
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(m.name)
  const [role, setRole] = useState(m.role)
  const [isPm, setIsPm] = useState(m.is_pm)
  const [confirm, setConfirm] = useState(false)
  const s = useSaver()
  const owned = snap.tasks.filter((t) => t.owner === m.id).length

  if (editing) {
    return (
      <form
        class="list-item stack"
        style={{ alignItems: 'stretch' }}
        onSubmit={async (e) => {
          e.preventDefault()
          if (await s.run(() => updateMember(m.id, { name: name.trim(), role: role.trim(), is_pm: isPm }), 'Member saved')) {
            setEditing(false)
            props.onChanged()
          }
        }}
      >
        <div class="row" style={{ alignItems: 'flex-end' }}>
          <div class="grow" style={{ minWidth: '160px' }}><Field label="Name">{(id) => <input id={id} class="input" required maxLength={100} value={name} onInput={(e) => setName(e.currentTarget.value)} data-autofocus />}</Field></div>
          <div class="grow" style={{ minWidth: '160px' }}><Field label="Role in the group">{(id) => <input id={id} class="input" maxLength={200} value={role} onInput={(e) => setRole(e.currentTarget.value)} />}</Field></div>
          <label class="check" style={{ marginBottom: '10px' }}><input type="checkbox" checked={isPm} onChange={(e) => setIsPm(e.currentTarget.checked)} /> PM</label>
        </div>
        <ErrorBox error={s.error} />
        <div class="row">
          <button type="submit" class="btn btn-primary btn-sm" disabled={s.busy || !name.trim()}>Save</button>
          <button type="button" class="btn btn-soft btn-sm" onClick={() => { setEditing(false); setName(m.name); setRole(m.role); setIsPm(m.is_pm) }}>Cancel</button>
        </div>
      </form>
    )
  }

  return (
    <div class="list-item" style={{ alignItems: 'center' }}>
      <div class="row grow" style={{ flexWrap: 'nowrap' }}>
        <Avatar snap={snap} memberId={m.id} size={28} />
        <div class="stack-sm grow" style={{ gap: 0 }}>
          <span style={{ fontWeight: 500 }}>
            {m.name} {m.is_pm && <span class="tag-pm" style={{ marginLeft: '6px' }}>PM</span>}
          </span>
          <span class="muted xsmall">{[m.role, `${owned} ${owned === 1 ? 'task' : 'tasks'}`].filter(Boolean).join(' · ')}</span>
        </div>
      </div>
      {!confirm ? (
        <div class="row">
          <button type="button" class="btn btn-soft btn-sm" onClick={() => setEditing(true)}>Edit</button>
          <button type="button" class="btn btn-soft btn-sm" onClick={() => setConfirm(true)}>Remove</button>
        </div>
      ) : (
        <div class="row">
          <span class="xsmall warn-text">{owned ? `Remove ${m.name}? Their ${owned} ${owned === 1 ? 'task becomes' : 'tasks become'} unassigned.` : `Remove ${m.name}?`}</span>
          <button type="button" class="btn btn-danger btn-sm" disabled={s.busy} onClick={async () => { if (await s.run(() => deleteMember(m.id), `${m.name} removed`)) props.onChanged() }}>Remove</button>
          <button type="button" class="btn btn-soft btn-sm" onClick={() => setConfirm(false)}>Keep</button>
        </div>
      )}
      <ErrorBox error={s.error} />
    </div>
  )
}

function LinkRow(props: { label: string; help: string; url: string | null; copyLabel: string; onRegenerate: () => Promise<void>; regenerateWarning: string }) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  return (
    <div class="stack">
      <div class="stack-sm">
        <h3 class="field-label">{props.label}</h3>
        <span class="muted small">{props.help}</span>
      </div>
      <div class="link-box">
        <code>{props.url ?? 'Loading…'}</code>
        <button type="button" class="btn btn-primary btn-sm" disabled={!props.url} onClick={async () => toast((await copyText(props.url!)) ? 'Copied' : "Couldn't copy. Select the link and copy it by hand.", false)}>
          {props.copyLabel}
        </button>
      </div>
      {!confirm ? (
        <div><button type="button" class="btn-text" style={{ color: 'var(--muted)' }} onClick={() => setConfirm(true)}>Make a new link</button></div>
      ) : (
        <div class="row">
          <span class="xsmall warn-text">{props.regenerateWarning}</span>
          <button type="button" class="btn btn-danger btn-sm" disabled={busy} onClick={async () => { setBusy(true); await props.onRegenerate(); setBusy(false); setConfirm(false) }}>Make a new link</button>
          <button type="button" class="btn btn-soft btn-sm" onClick={() => setConfirm(false)}>Cancel</button>
        </div>
      )}
    </div>
  )
}

function Links(props: { snap: Snapshot; keys: ProjectKeys | null; onKeys: (k: ProjectKeys) => void }) {
  const { keys, snap } = props
  const [error, setError] = useState<string | null>(null)
  const regen = (which: 'member_key' | 'ai_key') => async () => {
    if (!keys) return
    setError(null)
    try {
      props.onKeys(await regenerateKey(keys.id, which))
      toast('New link made. Share it with the group.')
    } catch (e) {
      setError((e as StoreError).message)
    }
  }
  return (
    <section class="panel">
      <h2 class="eyebrow">Links</h2>
      <LinkRow
        label="Member link"
        help="Post this in the group chat. Anyone with it can see the project and act as a member, so keep it inside the group."
        url={keys ? memberLink(snap.project.id, keys.member_key) : null}
        copyLabel="Copy member link"
        onRegenerate={regen('member_key')}
        regenerateWarning="The old member link stops working straight away."
      />
      <div style={{ borderTop: '1px solid var(--border)' }} />
      <LinkRow
        label="AI link"
        help="Read only. Members get it inside the AI setup prompt on their first visit. It shows the whole project as one document, without any keys."
        url={keys ? aiLink(snap.project.id, keys.ai_key) : null}
        copyLabel="Copy AI link"
        onRegenerate={regen('ai_key')}
        regenerateWarning="Every member has to paste the new AI setup prompt into their AI again."
      />
      <ErrorBox error={error} />
    </section>
  )
}

function DeleteProject(props: { snap: Snapshot; onDeleted: () => void }) {
  const [text, setText] = useState('')
  const s = useSaver()
  const name = props.snap.project.name
  return (
    <section class="panel" style={{ borderColor: 'var(--warn-border)' }}>
      <div class="stack-sm">
        <h2 class="eyebrow">Delete project</h2>
        <span class="muted small">Removes the project with all its members, tasks, notes and questions. This can't be undone.</span>
      </div>
      <form class="row" style={{ alignItems: 'flex-end' }} onSubmit={async (e) => { e.preventDefault(); if (await s.run(() => deleteProject(props.snap.project.id), 'Project deleted')) props.onDeleted() }}>
        <div class="grow" style={{ minWidth: '220px' }}>
          <Field label={`Type the project name to confirm`}>{(id) => <input id={id} class="input" value={text} placeholder={name} onInput={(e) => setText(e.currentTarget.value)} />}</Field>
        </div>
        <button type="submit" class="btn btn-danger btn-md" disabled={s.busy || text.trim() !== name.trim()}>Delete project</button>
      </form>
      <ErrorBox error={s.error} />
    </section>
  )
}
