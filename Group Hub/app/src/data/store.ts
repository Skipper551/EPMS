// The only file that talks to PocketBase. Swap this module to change backends.
//
// Two modes:
//  - PM: logged in as the instance superuser; bypasses access rules.
//  - Member: no account; every request carries the project's member key in the X-Member-Key header.

import PocketBase, { BaseAuthStore, ClientResponseError, type RecordModel } from 'pocketbase'
import { PB_URL } from '../config'
import type {
  Member, MemberInput, Note, Project, ProjectInput, ProjectKeys, Snapshot, Status, Task, TaskInput, TaskLink,
} from './types'

const SNAPSHOT_EXPAND =
  'members_via_project,tasks_via_project,tasks_via_project.notes_via_task'

let pb: PocketBase | null = null
let mode: 'pm' | 'member' | null = null

function client(): PocketBase {
  if (!pb) throw new Error('Storage not initialised')
  return pb
}

/** Start in PM mode. The superuser session is kept in this browser's localStorage. */
export function initPm(): void {
  pb = new PocketBase(PB_URL)
  pb.autoCancellation(false)
  mode = 'pm'
}

/** Start in member mode: no session, the member key goes on every request. */
export function initMember(memberKey: string): void {
  // A memory-only auth store, so a PM session in the same browser is never sent from the member page.
  pb = new PocketBase(PB_URL, new BaseAuthStore())
  pb.autoCancellation(false)
  pb.beforeSend = (url, options) => {
    options.headers = { ...(options.headers as Record<string, string>), 'X-Member-Key': memberKey }
    return { url, options }
  }
  mode = 'member'
}

export const backendUrl = PB_URL

// ---------- errors ----------

export class StoreError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** Turn any backend error into a short sentence a person can act on. */
export function friendly(e: unknown): StoreError {
  if (e instanceof StoreError) return e
  if (e instanceof ClientResponseError) {
    const s = e.status
    if (s === 0) return new StoreError("Can't reach the server. Check your connection and try again.", s)
    if (s === 400) {
      const fields = e.response?.data as Record<string, { message?: string }> | undefined
      const first = fields && Object.entries(fields)[0]
      if (first) return new StoreError(`${first[0]}: ${first[1]?.message ?? 'invalid value'}`, s)
      return new StoreError(e.response?.message || 'Something in that form is not valid.', s)
    }
    if (s === 401) return new StoreError('Your session has ended. Log in again.', s)
    if (s === 403) return new StoreError("You don't have permission to do that.", s)
    if (s === 404) {
      return new StoreError(
        mode === 'member'
          ? 'This link no longer works. Ask your PM for the current project link.'
          : 'That item no longer exists.',
        s,
      )
    }
    if (s === 429) return new StoreError('Too many requests right now. Wait a minute and try again.', s)
    return new StoreError(e.response?.message || 'Something went wrong on the server.', s)
  }
  return new StoreError(e instanceof Error ? e.message : 'Something went wrong.', -1)
}

async function run<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    throw friendly(e)
  }
}

// ---------- mapping ----------

/** PocketBase dates look like "2026-11-26 12:00:00.000Z"; the app uses date-only "2026-11-26". */
function dateOnly(v: unknown): string {
  return typeof v === 'string' && v.length >= 10 ? v.slice(0, 10) : ''
}

/** Store dates at noon UTC so they read as the same calendar day in every time zone a student is likely in. */
function toPbDate(d: string): string {
  return d ? `${d} 12:00:00.000Z` : ''
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

function toProject(r: RecordModel): Project {
  return {
    id: r.id, name: str(r.name), course: str(r.course), final_deadline: dateOnly(r.final_deadline),
    guidelines: str(r.guidelines), chat_url: str(r.chat_url), created: str(r.created), updated: str(r.updated),
  }
}

function toMember(r: RecordModel): Member {
  return { id: r.id, project: str(r.project), name: str(r.name), role: str(r.role), is_pm: !!r.is_pm, created: str(r.created) }
}

function toLinks(v: unknown): TaskLink[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((l): l is Record<string, unknown> => !!l && typeof l === 'object')
    .map((l) => ({ label: str(l.label), url: str(l.url) }))
    .filter((l) => l.url)
}

function toTask(r: RecordModel): Task {
  const status = (['todo', 'doing', 'review', 'done'] as Status[]).includes(r.status) ? (r.status as Status) : 'todo'
  return {
    id: r.id, project: str(r.project), title: str(r.title), owner: str(r.owner), helpers: ids(r.helpers), everyone: !!r.everyone,
    due_date: dateOnly(r.due_date),
    status, behind: !!r.behind, blocked_by_tasks: ids(r.blocked_by_tasks), blocked_by_members: ids(r.blocked_by_members),
    links: toLinks(r.links), created: str(r.created), updated: str(r.updated),
  }
}

function toNote(r: RecordModel): Note {
  return { id: r.id, task: str(r.task), author: str(r.author), text: str(r.text), created: str(r.created) }
}

function toKeys(r: RecordModel): ProjectKeys {
  return { id: r.id, project: str(r.project), member_key: str(r.member_key), ai_key: str(r.ai_key) }
}

const byCreated = <T extends { created: string }>(a: T, b: T) => a.created.localeCompare(b.created)

function taskBody(t: Partial<TaskInput>): Record<string, unknown> {
  const body: Record<string, unknown> = { ...t }
  if (t.due_date !== undefined) body.due_date = toPbDate(t.due_date)
  return body
}

// ---------- links ----------

/** Read-only link an AI can fetch: the whole project as one JSON document. */
export function aiLink(projectId: string, aiKey: string): string {
  return `${PB_URL}/api/collections/projects/records/${projectId}?ai_key=${encodeURIComponent(aiKey)}&expand=${SNAPSHOT_EXPAND}`
}

// ---------- whole project ----------

/** Load a project with its members, tasks and notes in one request. */
export function loadSnapshot(projectId: string): Promise<Snapshot> {
  return run(async () => {
    const r = await client().collection('projects').getOne(projectId, { expand: SNAPSHOT_EXPAND })
    const ex = r.expand ?? {}
    const taskRecords: RecordModel[] = ex.tasks_via_project ?? []
    const notes: Note[] = []
    for (const t of taskRecords) for (const n of (t.expand?.notes_via_task ?? []) as RecordModel[]) notes.push(toNote(n))
    return {
      project: toProject(r),
      members: ((ex.members_via_project ?? []) as RecordModel[]).map(toMember).sort(byCreated),
      tasks: taskRecords.map(toTask).sort(byCreated),
      notes: notes.sort(byCreated),
    }
  })
}

// ---------- PM session ----------

export function pmIsLoggedIn(): boolean {
  return mode === 'pm' && client().authStore.isValid && client().authStore.isSuperuser
}

export function pmEmail(): string {
  return str(client().authStore.record?.email)
}

export function pmLogin(email: string, password: string): Promise<void> {
  return run(async () => {
    try {
      await client().collection('_superusers').authWithPassword(email, password)
    } catch (e) {
      if (e instanceof ClientResponseError && e.status === 400) {
        throw new StoreError("That email and password don't match the superuser account on this instance.", 400)
      }
      throw e
    }
  })
}

/** Refresh the saved session on page load; false if it has expired. */
export async function pmResume(): Promise<boolean> {
  if (!client().authStore.isValid || !client().authStore.isSuperuser) return false
  try {
    await client().collection('_superusers').authRefresh()
    return true
  } catch {
    client().authStore.clear()
    return false
  }
}

export function pmLogout(): void {
  client().authStore.clear()
}

// ---------- projects (PM) ----------

export function listProjects(): Promise<Project[]> {
  return run(async () => (await client().collection('projects').getFullList({ sort: '-created' })).map(toProject))
}

/** Create a project and its private keys row (keys are generated by the server). */
export function createProject(input: ProjectInput): Promise<Project> {
  return run(async () => {
    const r = await client().collection('projects').create({ ...input, final_deadline: toPbDate(input.final_deadline) })
    try {
      await client().collection('project_keys').create({ project: r.id })
    } catch (e) {
      await client().collection('projects').delete(r.id).catch(() => {})
      throw e
    }
    return toProject(r)
  })
}

export function updateProject(id: string, patch: Partial<ProjectInput>): Promise<Project> {
  const body: Record<string, unknown> = { ...patch }
  if (patch.final_deadline !== undefined) body.final_deadline = toPbDate(patch.final_deadline)
  return run(async () => toProject(await client().collection('projects').update(id, body)))
}

export function deleteProject(id: string): Promise<void> {
  return run(async () => {
    await client().collection('projects').delete(id)
  })
}

/** The project's member and AI keys. Creates the row if it is missing. */
export function getKeys(projectId: string): Promise<ProjectKeys> {
  return run(async () => {
    const found = await client().collection('project_keys').getList(1, 1, { filter: client().filter('project = {:p}', { p: projectId }) })
    if (found.items[0]) return toKeys(found.items[0])
    return toKeys(await client().collection('project_keys').create({ project: projectId }))
  })
}

function randomKey(length = 40): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const out: string[] = []
  const buf = new Uint32Array(length)
  crypto.getRandomValues(buf)
  for (const n of buf) out.push(chars[n % chars.length])
  return out.join('')
}

/** Replace a key. Old links stop working immediately. */
export function regenerateKey(keysId: string, which: 'member_key' | 'ai_key'): Promise<ProjectKeys> {
  return run(async () => toKeys(await client().collection('project_keys').update(keysId, { [which]: randomKey() })))
}

// ---------- members (PM) ----------

export function createMember(projectId: string, input: MemberInput): Promise<Member> {
  return run(async () => toMember(await client().collection('members').create({ project: projectId, ...input })))
}

export function updateMember(id: string, patch: Partial<MemberInput>): Promise<Member> {
  return run(async () => toMember(await client().collection('members').update(id, patch)))
}

export function deleteMember(id: string): Promise<void> {
  return run(async () => {
    await client().collection('members').delete(id)
  })
}

// ---------- tasks ----------

export function createTask(projectId: string, input: TaskInput): Promise<Task> {
  return run(async () => toTask(await client().collection('tasks').create({ project: projectId, ...taskBody(input) })))
}

/** PM edit of any field. */
export function updateTask(id: string, patch: Partial<TaskInput>): Promise<Task> {
  return run(async () => toTask(await client().collection('tasks').update(id, taskBody(patch))))
}

export function deleteTask(id: string): Promise<void> {
  return run(async () => {
    await client().collection('tasks').delete(id)
  })
}

/** Member move: only doing or review are allowed by the server. Sends nothing but the status. */
export function setStatus(id: string, status: Status): Promise<Task> {
  return run(async () => toTask(await client().collection('tasks').update(id, { status })))
}

/** Member or PM: replace a task's blockers. Sends nothing but the two blocker fields. */
export function setBlockers(id: string, blockedByTasks: string[], blockedByMembers: string[]): Promise<Task> {
  return run(async () =>
    toTask(await client().collection('tasks').update(id, { blocked_by_tasks: blockedByTasks, blocked_by_members: blockedByMembers })),
  )
}

// ---------- notes ----------

export function addNote(taskId: string, authorId: string, text: string): Promise<Note> {
  return run(async () => toNote(await client().collection('notes').create({ task: taskId, author: authorId || '', text })))
}
