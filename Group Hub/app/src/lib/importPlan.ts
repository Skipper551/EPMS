// Reads a "group-hub-tasks" file (usually written by Claude) and works out what importing it would do.
// Pure: no backend calls. The PM import dialog shows the preview, then runs the plan through the store.
// Format reference: skills/group-hub-task-plan/SKILL.md

import type { Snapshot, Status, TaskLink } from '../data/types'
import { formatDay, today } from './util'

export const FORMAT = 'group-hub-tasks'

export interface PlanMember { name: string; role: string; pm: boolean }

export interface PlanTask {
  ref: string
  title: string
  owner: string
  due: string
  status: Status
  description: string
  blockedBy: string[]
  waitingOn: string[]
  links: TaskLink[]
}

export interface Plan {
  project: string
  guidelines: string
  members: PlanMember[]
  tasks: PlanTask[]
}

export interface ParseResult {
  plan: Plan | null
  /** Problems that stop the import */
  errors: string[]
  /** Things that were fixed up or ignored */
  warnings: string[]
}

const STATUS_ALIASES: Record<string, Status> = {
  todo: 'todo', 'to do': 'todo', 'to-do': 'todo', open: 'todo', backlog: 'todo',
  doing: 'doing', 'in progress': 'doing', 'in-progress': 'doing', started: 'doing',
  review: 'review', 'in review': 'review',
  done: 'done', complete: 'done', completed: 'done',
}

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(s).filter(Boolean) : typeof v === 'string' && v.trim() ? [v.trim()] : [])
const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ')

/** Pull the JSON out of whatever was pasted: a bare object, a ```json block, or text around it. */
function extractJson(text: string): unknown {
  const t = text.trim()
  const fence = /```(?:json)?\s*\n([\s\S]*?)\n```/i.exec(t)
  const candidates = [t, fence?.[1] ?? '', t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1), t.slice(t.indexOf('['), t.lastIndexOf(']') + 1)]
  for (const c of candidates) {
    if (!c) continue
    try {
      return JSON.parse(c)
    } catch {
      /* try the next shape */
    }
  }
  throw new Error('not json')
}

function toDate(v: unknown, where: string, warnings: string[]): string {
  const raw = s(v)
  if (!raw) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw)
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    if (d.getMonth() === Number(m[2]) - 1) return `${m[1]}-${m[2]}-${m[3]}`
  }
  warnings.push(`${where}: "${raw}" isn't a date in YYYY-MM-DD form, so it was left empty.`)
  return ''
}

function toLinks(v: unknown, where: string, warnings: string[]): TaskLink[] {
  if (!Array.isArray(v)) return []
  const out: TaskLink[] = []
  for (const item of v) {
    const url = typeof item === 'string' ? item.trim() : s((item as Record<string, unknown>)?.url)
    const label = typeof item === 'string' ? '' : s((item as Record<string, unknown>)?.label)
    if (!url) continue
    if (!/^https?:\/\//i.test(url)) {
      warnings.push(`${where}: skipped the link "${url}" because it doesn't start with http:// or https://.`)
      continue
    }
    out.push({ label: (label || url.replace(/^https?:\/\//, '')).slice(0, 120), url })
  }
  return out
}

export function parsePlan(text: string): ParseResult {
  const errors: string[] = []
  const warnings: string[] = []
  if (!text.trim()) return { plan: null, errors: ['Paste a task file or choose one first.'], warnings }

  let data: unknown
  try {
    data = extractJson(text)
  } catch {
    return { plan: null, errors: ["That isn't a Group Hub task file. It should be JSON; ask Claude for the group-hub-tasks file again."], warnings }
  }

  const root = (Array.isArray(data) ? { tasks: data } : data) as Record<string, unknown>
  if (!root || typeof root !== 'object') return { plan: null, errors: ["That file doesn't contain any tasks."], warnings }
  if (root.format && root.format !== FORMAT) warnings.push(`The file says its format is "${s(root.format)}", not "${FORMAT}". Reading it anyway.`)
  if (root.version && Number(root.version) > 1) warnings.push(`The file is format version ${s(root.version)}; this copy of Group Hub knows version 1.`)

  const members: PlanMember[] = (Array.isArray(root.members) ? root.members : [])
    .map((m: unknown) => (typeof m === 'string' ? { name: m } : (m as Record<string, unknown>)) ?? {})
    .map((m: Record<string, unknown>) => ({ name: s(m.name).slice(0, 100), role: s(m.role).slice(0, 200), pm: m.pm === true || m.is_pm === true }))
    .filter((m: PlanMember) => m.name)

  const rawTasks = Array.isArray(root.tasks) ? root.tasks : []
  if (!rawTasks.length) errors.push("The file doesn't contain a \"tasks\" list.")

  const tasks: PlanTask[] = []
  const seenRefs = new Set<string>()
  rawTasks.forEach((raw: unknown, i: number) => {
    const r = (raw ?? {}) as Record<string, unknown>
    const title = s(r.title ?? r.name)
    const where = `Task ${i + 1}${title ? ` ("${title.slice(0, 40)}")` : ''}`
    if (!title) return errors.push(`${where} has no title.`)
    if (title.length > 300) warnings.push(`${where}: the title was cut to 300 characters.`)

    let ref = s(r.id ?? r.ref ?? r.key) || `task-${i + 1}`
    if (seenRefs.has(norm(ref))) {
      warnings.push(`${where}: the id "${ref}" is used twice; this one was renamed.`)
      ref = `${ref}-${i + 1}`
    }
    seenRefs.add(norm(ref))

    const statusRaw = norm(s(r.status))
    const status = statusRaw ? STATUS_ALIASES[statusRaw] : 'todo'
    if (statusRaw && !status) warnings.push(`${where}: unknown status "${s(r.status)}", so it starts in To do.`)

    let description = s(r.description ?? r.details ?? r.notes)
    if (description.length > 5000) {
      warnings.push(`${where}: the description was cut to 5,000 characters.`)
      description = description.slice(0, 5000)
    }

    tasks.push({
      ref,
      title: title.slice(0, 300),
      owner: s(r.owner ?? r.assignee ?? r.assigned_to),
      due: toDate(r.due ?? r.due_date ?? r.deadline, where, warnings),
      status: status ?? 'todo',
      description,
      blockedBy: list(r.blocked_by ?? r.depends_on ?? r.after),
      waitingOn: list(r.waiting_on ?? r.blocked_by_members),
      links: toLinks(r.links, where, warnings),
    })
  })

  return {
    plan: errors.length ? null : { project: s(root.project), guidelines: s(root.guidelines).slice(0, 20000), members, tasks },
    errors,
    warnings,
  }
}

// ---------- matching against the open project ----------

export type OwnerMatch = { kind: 'member'; id: string; name: string } | { kind: 'new'; name: string } | { kind: 'none' }

export type BlockerMatch =
  | { kind: 'plan'; ref: string; title: string }
  | { kind: 'board'; id: string; title: string }
  | { kind: 'missing'; text: string }

export interface PreviewRow {
  task: PlanTask
  owner: OwnerMatch
  blockers: BlockerMatch[]
  waitingOn: OwnerMatch[]
  duplicate: boolean
  dueText: string
}

export interface Preview {
  rows: PreviewRow[]
  newMembers: PlanMember[]
  notes: string[]
}

export function previewPlan(plan: Plan, snap: Snapshot): Preview {
  const byName = new Map(snap.members.map((m) => [norm(m.name), m]))
  const firstNames = new Map<string, typeof snap.members>()
  for (const m of snap.members) {
    const f = norm(m.name).split(' ')[0]
    firstNames.set(f, [...(firstNames.get(f) ?? []), m])
  }
  const declared = new Map(plan.members.map((m) => [norm(m.name), m]))
  const newMembers = new Map<string, PlanMember>()
  const notes: string[] = []

  const matchPerson = (name: string): OwnerMatch => {
    if (!name) return { kind: 'none' }
    const key = norm(name)
    const exact = byName.get(key)
    if (exact) return { kind: 'member', id: exact.id, name: exact.name }
    const sameFirst = firstNames.get(key.split(' ')[0])
    if (sameFirst?.length === 1) return { kind: 'member', id: sameFirst[0].id, name: sameFirst[0].name }
    if (!newMembers.has(key)) newMembers.set(key, declared.get(key) ?? { name: name.trim().slice(0, 100), role: '', pm: false })
    return { kind: 'new', name: newMembers.get(key)!.name }
  }

  const planByRef = new Map(plan.tasks.map((t) => [norm(t.ref), t]))
  const planByTitle = new Map(plan.tasks.map((t) => [norm(t.title), t]))
  const boardByTitle = new Map(snap.tasks.map((t) => [norm(t.title), t]))

  // Members listed in the file but not in the project are offered too, even without tasks.
  for (const m of plan.members) if (!byName.has(norm(m.name))) matchPerson(m.name)

  const rows = plan.tasks.map((t) => {
    const blockers: BlockerMatch[] = t.blockedBy.map((b) => {
      const k = norm(b)
      const p = planByRef.get(k) ?? planByTitle.get(k)
      if (p && p !== t) return { kind: 'plan', ref: p.ref, title: p.title }
      const onBoard = boardByTitle.get(k)
      if (onBoard) return { kind: 'board', id: onBoard.id, title: onBoard.title }
      return { kind: 'missing', text: b }
    })
    return {
      task: t,
      owner: matchPerson(t.owner),
      blockers,
      waitingOn: t.waitingOn.map(matchPerson),
      duplicate: boardByTitle.has(norm(t.title)),
      dueText: t.due ? formatDay(t.due) : '',
    }
  })

  const missing = rows.flatMap((r) => r.blockers.filter((b) => b.kind === 'missing').map((b) => `"${r.task.title}" is blocked by "${(b as { text: string }).text}", which isn't in the file or on the board, so that blocker is skipped.`))
  notes.push(...missing)
  const deadline = snap.project.final_deadline
  if (deadline) {
    const late = rows.filter((r) => r.task.due && r.task.due > deadline)
    if (late.length) notes.push(`${late.length} ${late.length === 1 ? 'task is' : 'tasks are'} due after the final deadline (${formatDay(deadline)}).`)
  }

  return { rows, newMembers: [...newMembers.values()], notes }
}

// ---------- instructions for Claude, filled in with this project ----------

export function claudeInstructions(snap: Snapshot): string {
  const people = snap.members.map((m) => `- ${m.name}${m.role ? ` (${m.role})` : ''}${m.is_pm ? ', PM' : ''}`).join('\n') || '- (no members added yet)'
  const open = snap.tasks.filter((t) => t.status !== 'done').map((t) => `- ${t.title}`).slice(0, 60).join('\n')
  return `When we've agreed the task plan for my group project, give it to me as a Group Hub task file so I can import it.

Project: ${snap.project.name}${snap.project.course ? ` (${snap.project.course})` : ''}
Final deadline: ${snap.project.final_deadline || 'not set'}
Today: ${today()}
Members (use these names exactly as task owners):
${people}
${open ? `\nTasks already on the board (you can list these in blocked_by by their exact title):\n${open}\n` : ''}
Format: one JSON code block, nothing else in it.

{
  "format": "group-hub-tasks",
  "version": 1,
  "project": "${snap.project.name.replace(/"/g, '\\"')}",
  "members": [{ "name": "Ala", "role": "Research" }],
  "tasks": [
    {
      "id": "find-sources",
      "title": "Find 5 sources",
      "owner": "Ala",
      "due": "2026-11-20",
      "description": "What to do, step by step, and what done looks like.",
      "blocked_by": [],
      "waiting_on": [],
      "links": [{ "label": "Brief", "url": "https://example.com/brief" }]
    }
  ]
}

Rules:
- "title" is required and short (under 80 characters), starting with a verb.
- "id" is a short lowercase reference, unique in the file, used by other tasks' "blocked_by".
- "owner" is one member's name exactly as listed above, or leave it out.
- "due" is YYYY-MM-DD, on or before the final deadline.
- "description" is shown to the owner as the task's first note; write it for them.
- "blocked_by" lists ids of tasks in this file, or exact titles of tasks already on the board.
- "waiting_on" lists member names the task waits on that aren't a task.
- "members" only needs people who aren't in the list above.
- Leave out "status"; new tasks start in To do.
- Plain punctuation only: no em dashes.`
}
