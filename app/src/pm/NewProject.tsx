import { useState } from 'preact/hooks'
import { createMember, createProject, deleteProject, type StoreError } from '../data/store'
import type { Project } from '../data/types'
import { Dialog, ErrorBox, Field } from '../ui/ui'
import { normaliseUrl } from '../lib/util'

/** "Ala, Research" or "Ala - Research" per line → { name, role } */
function parseMembers(text: string): { name: string; role: string }[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...rest] = line.split(/\s*[,;]\s*|\s+-\s+/)
      return { name: name.trim().slice(0, 100), role: rest.join(', ').trim().slice(0, 200) }
    })
    .filter((m) => m.name)
}

export function NewProjectForm(props: { onCreated: (p: Project) => void; onCancel?: () => void }) {
  const [name, setName] = useState('')
  const [course, setCourse] = useState('')
  const [deadline, setDeadline] = useState('')
  const [chat, setChat] = useState('')
  const [pmName, setPmName] = useState('')
  const [members, setMembers] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: Event) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    let project: Project | null = null
    try {
      project = await createProject({ name: name.trim(), course: course.trim(), final_deadline: deadline, guidelines: '', chat_url: normaliseUrl(chat) })
      await createMember(project.id, { name: pmName.trim(), role: 'PM', is_pm: true })
      for (const m of parseMembers(members)) await createMember(project.id, { ...m, is_pm: false })
      props.onCreated(project)
    } catch (err) {
      if (project) await deleteProject(project.id).catch(() => {})
      setError((err as StoreError).message)
      setBusy(false)
    }
  }

  const parsed = parseMembers(members)

  return (
    <form class="stack-lg" onSubmit={submit}>
      <div class="form-grid">
        <Field label="Project name" class="span-2" help='What the group calls it, for example "Innovation Management · Group 2".'>
          {(id) => <input id={id} class="input" required maxLength={200} value={name} onInput={(e) => setName(e.currentTarget.value)} data-autofocus />}
        </Field>
        <Field label="Course">
          {(id) => <input id={id} class="input" maxLength={200} value={course} onInput={(e) => setCourse(e.currentTarget.value)} />}
        </Field>
        <Field label="Final deadline">
          {(id) => <input id={id} class="input" type="date" value={deadline} onInput={(e) => setDeadline(e.currentTarget.value)} />}
        </Field>
        <Field label="Group chat link (optional)" class="span-2" help="Teams, WhatsApp, Discord or any other chat. Members get an Open group chat button.">
          {(id) => <input id={id} class="input" type="text" inputMode="url" placeholder="https://…" maxLength={2000} value={chat} onInput={(e) => setChat(e.currentTarget.value)} />}
        </Field>
        <Field label="Your name" class="span-2" help="You appear in the group as the PM. You can own tasks, but you never show up in the member name picker.">
          {(id) => <input id={id} class="input" required maxLength={100} value={pmName} onInput={(e) => setPmName(e.currentTarget.value)} />}
        </Field>
        <Field label="Group members" class="span-2" help={`One per line, with their role after a comma if you like: "Ala, Research". ${parsed.length ? `${parsed.length} ${parsed.length === 1 ? 'member' : 'members'} so far.` : 'You can add them later too.'}`}>
          {(id) => <textarea id={id} class="textarea" rows={5} value={members} onInput={(e) => setMembers(e.currentTarget.value)} placeholder={'Ala, Research\nJimmy, Writing\nOla, Slides'} />}
        </Field>
      </div>
      <ErrorBox error={error} />
      <div class="row">
        <button type="submit" class="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Creating…' : 'Create project'}</button>
        {props.onCancel && <button type="button" class="btn btn-soft btn-lg" onClick={props.onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

export function NewProjectDialog(props: { onCreated: (p: Project) => void; onClose: () => void }) {
  return (
    <Dialog title="New project" onClose={props.onClose}>
      <NewProjectForm onCreated={props.onCreated} onCancel={props.onClose} />
    </Dialog>
  )
}
