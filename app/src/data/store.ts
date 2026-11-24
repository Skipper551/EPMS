// The only file that talks to PocketBase. Swap this module to change backends.
//
// Two modes:
//  - PM: logged in as the instance superuser; bypasses access rules.
//  - Member: no account; every request carries the project's member key in the X-Member-Key header.

import PocketBase, { BaseAuthStore, ClientResponseError, type RecordModel } from 'pocketbase'
import { DEFAULT_PB_URL } from '../config'
import type {
  ActivityEvent, Claim, EventKind, JoinInfo, Member, MemberInput, MemberKey, Note, Project, ProjectInput, ProjectKeys, Snapshot, Subtask, Status, Task, TaskInput, TaskLink,
} from './types'

const SNAPSHOT_EXPAND =
  'members_via_project,tasks_via_project,tasks_via_project.notes_via_task,tasks_via_project.subtasks_via_task'

let pb: PocketBase | null = null
let mode: 'pm' | 'member' | null = null
/** The instance this page is talking to; set before initPm, initMember or the join routes. */
let baseUrl = DEFAULT_PB_URL

export function setBackend(url: string): void {
  baseUrl = url
}

export function backendUrl(): string {
  return baseUrl
}

/** Is there a PocketBase instance at this address? */
export async function checkInstance(url: string): Promise<boolean> {
  try {
    const r = await fetch(`${url}/api/health`, { method: 'GET' })
    if (!r.ok) return false
    const j = await r.json()
    return typeof j?.message === 'string'
  } catch {
    return false
  }
}

function client(): PocketBase {
  if (!pb) throw new Error('Storage not initialised')
  return pb
}

/** Start in PM mode. The superuser session is kept in this browser's localStorage. */
export function initPm(): void {
  pb = new PocketBase(baseUrl)
  pb.autoCancellation(false)
  mode = 'pm'
}

/** Start in member mode: no session, the member's personal key goes on every request. */
export function initMember(memberKey: string): void {
  // A memory-only auth store, so a PM session in the same browser is never sent from the member page.
  pb = new PocketBase(baseUrl, new BaseAuthStore())
  pb.autoCancellation(false)
  pb.beforeSend = (url, options) => {
    options.headers = { ...(options.headers as Record<string, string>), 'X-Member-Key': memberKey }
    return { url, options }
  }
  mode = 'member'
}


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
    start_date: dateOnly(r.start_date), due_date: dateOnly(r.due_date),
    status, behind: !!r.behind, behind_note: str(r.behind_note), blocked_by_tasks: ids(r.blocked_by_tasks), blocked_by_members: ids(r.blocked_by_members),
    blocked_reason: str(r.blocked_reason),
    links: toLinks(r.links), mini: !!r.mini, created_by: str(r.created_by), created: str(r.created), updated: str(r.updated),
  }
}

function toNote(r: RecordModel): Note {
  return { id: r.id, task: str(r.task), author: str(r.author), text: str(r.text), created: str(r.created) }
}

function toSubtask(r: RecordModel): Subtask {
  return { id: r.id, task: str(r.task), title: str(r.title), done: !!r.done, order: typeof r.order === 'number' ? r.order : 0, created: str(r.created) }
}

function toKeys(r: RecordModel): ProjectKeys {
  return { id: r.id, project: str(r.project), member_key: str(r.member_key), ai_key: str(r.ai_key), claims_locked: !!r.claims_locked,
    chat_webhook: str(r.chat_webhook), last_summary_at: str(r.last_summary_at) }
}

const byCreated = <T extends { created: string }>(a: T, b: T) => a.created.localeCompare(b.created)

function taskBody(t: Partial<TaskInput>): Record<string, unknown> {
  const body: Record<string, unknown> = { ...t }
  if (t.due_date !== undefined) body.due_date = toPbDate(t.due_date)
  if (t.start_date !== undefined) body.start_date = toPbDate(t.start_date)
  return body
}

// ---------- links ----------

/** Read-only link an AI can fetch: the whole project as one JSON document. */
export function aiLink(projectId: string, aiKey: string): string {
  return `${baseUrl}/api/collections/projects/records/${projectId}?ai_key=${encodeURIComponent(aiKey)}&expand=${SNAPSHOT_EXPAND}`
}

// ---------- whole project ----------

/** Load a project with its members, tasks and notes in one request. */
export function loadSnapshot(projectId: string): Promise<Snapshot> {
  return run(async () => {
    const r = await client().collection('projects').getOne(projectId, { expand: SNAPSHOT_EXPAND })
    const ex = r.expand ?? {}
    const taskRecords: RecordModel[] = ex.tasks_via_project ?? []
    const notes: Note[] = []
    const subtasks: Subtask[] = []
    for (const t of taskRecords) {
      for (const n of (t.expand?.notes_via_task ?? []) as RecordModel[]) notes.push(toNote(n))
      for (const st of (t.expand?.subtasks_via_task ?? []) as RecordModel[]) subtasks.push(toSubtask(st))
    }
    const all = taskRecords.map(toTask).sort(byCreated)
    return {
      project: toProject(r),
      members: ((ex.members_via_project ?? []) as RecordModel[]).map(toMember).sort(byCreated),
      tasks: all.filter((t) => !t.mini),
      todos: all.filter((t) => t.mini),
      notes: notes.sort(byCreated),
      subtasks: subtasks.sort((a, b) => a.order - b.order || a.created.localeCompare(b.created)),
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

/** Lead or PM: set or clear when work on a task begins. Sends nothing but the start date. */
export function setStartDate(id: string, date: string): Promise<Task> {
  return run(async () => toTask(await client().collection('tasks').update(id, { start_date: toPbDate(date) })))
}

/** Member or PM: replace a task's blockers. Sends nothing but the blocker fields. */
export function setBlockers(id: string, blockedByTasks: string[], blockedByMembers: string[], blockedReason: string): Promise<Task> {
  return run(async () =>
    toTask(await client().collection('tasks').update(id, {
      blocked_by_tasks: blockedByTasks, blocked_by_members: blockedByMembers, blocked_reason: blockedReason,
    })),
  )
}

// ---------- quick to-dos ----------

/** Add a quick to-do. Members can only add one for themselves or leave it up for grabs (owner ''). */
export function createTodo(projectId: string, title: string, owner: string, createdBy: string): Promise<Task> {
  return run(async () =>
    toTask(await client().collection('tasks').create({ project: projectId, title: title.trim().slice(0, 300), owner, created_by: createdBy, mini: true, status: 'todo' })),
  )
}

/** Take, let go, tick off, reopen or rename a quick to-do. Sends only what changes. */
export function updateTodo(id: string, patch: { owner?: string; status?: 'todo' | 'done'; title?: string }): Promise<Task> {
  return run(async () => toTask(await client().collection('tasks').update(id, patch)))
}

/** PM: turn a quick to-do into a full task on the board. */
export function promoteTodo(id: string): Promise<Task> {
  return run(async () => toTask(await client().collection('tasks').update(id, { mini: false })))
}

// ---------- notes ----------

export function addNote(taskId: string, authorId: string, text: string): Promise<Note> {
  return run(async () => toNote(await client().collection('notes').create({ task: taskId, author: authorId || '', text })))
}

// ---------- joining with the group link (no personal key yet) ----------

/** A plain client for the join routes: sends the group key, never a personal key or a PM session. */
function joinClient(groupKey: string): PocketBase {
  const c = new PocketBase(baseUrl, new BaseAuthStore())
  c.autoCancellation(false)
  c.beforeSend = (url, options) => {
    options.headers = { ...(options.headers as Record<string, string>), 'X-Group-Key': groupKey }
    return { url, options }
  }
  return c
}

/** The server's own message for the join routes; they are written for people. */
function joinError(e: unknown): StoreError {
  if (e instanceof ClientResponseError && e.status && e.response?.message) return new StoreError(e.response.message, e.status)
  return friendly(e)
}

export async function joinInfo(projectId: string, groupKey: string): Promise<JoinInfo> {
  try {
    return await joinClient(groupKey).send(`/api/gh/join/${projectId}`, { method: 'GET' })
  } catch (e) {
    throw joinError(e)
  }
}

/** Take a name and choose a PIN. Returns the personal key that signs this device in as that member. */
export async function claimName(projectId: string, groupKey: string, memberId: string, pin: string): Promise<Claim> {
  try {
    return await joinClient(groupKey).send(`/api/gh/claim/${projectId}`, { method: 'POST', body: { member: memberId, pin } })
  } catch (e) {
    throw joinError(e)
  }
}

/** Sign in on another device: a name that's already set up, plus its PIN. */
export async function signInWithPin(projectId: string, groupKey: string, memberId: string, pin: string): Promise<Claim> {
  try {
    return await joinClient(groupKey).send(`/api/gh/signin/${projectId}`, { method: 'POST', body: { member: memberId, pin } })
  } catch (e) {
    throw joinError(e)
  }
}

// ---------- personal keys (PM) ----------

function toMemberKey(r: RecordModel): MemberKey {
  return { id: r.id, member: str(r.member), key: str(r.key), has_pin: !!str(r.pin_hash) }
}

/** Personal keys of a project's members, by member id. */
export function listMemberKeys(projectId: string): Promise<Map<string, MemberKey>> {
  return run(async () => {
    const list = await client().collection('member_keys').getFullList({ filter: client().filter('member.project = {:p}', { p: projectId }) })
    return new Map(list.map((r) => [str(r.member), toMemberKey(r)]))
  })
}

/** Make a personal key for a member who hasn't claimed their name (for example while the group link is locked). */
export function createMemberKey(memberId: string): Promise<MemberKey> {
  return run(async () => toMemberKey(await client().collection('member_keys').create({ member: memberId, key: randomKey() })))
}

/** Reset a claim: the member's devices stop working and the name can be picked again. */
export function deleteMemberKey(id: string): Promise<void> {
  return run(async () => {
    await client().collection('member_keys').delete(id)
  })
}

export function setClaimsLocked(keysId: string, locked: boolean): Promise<ProjectKeys> {
  return run(async () => toKeys(await client().collection('project_keys').update(keysId, { claims_locked: locked })))
}

/** Member mode: the project's current AI key (it changes when the PM makes a new AI link) and whether this member has a PIN. */
export async function memberStatus(projectId: string): Promise<{ ai_key: string; has_pin: boolean } | null> {
  try {
    const r = await client().send(`/api/gh/ai/${projectId}`, { method: 'GET' })
    return { ai_key: typeof r?.ai_key === 'string' ? r.ai_key : '', has_pin: !!r?.has_pin }
  } catch {
    return null
  }
}

/** Member mode: set or change this member's 4-digit PIN. */
export async function setPin(projectId: string, pin: string): Promise<void> {
  try {
    await client().send(`/api/gh/pin/${projectId}`, { method: 'POST', body: { pin } })
  } catch (e) {
    throw joinError(e)
  }
}

// ---------- activity log ----------

/** PocketBase date-time form, for filters: "2026-11-18 20:00:00.000Z". */
function pbTime(iso: string): string {
  return new Date(iso).toISOString().replace('T', ' ')
}

function toEvent(r: RecordModel): ActivityEvent {
  return {
    id: r.id, task: str(r.task), kind: str(r.kind) as EventKind, actor: str(r.actor), by_pm: !!r.by_pm,
    targets: ids(r.targets), text: str(r.text), created: str(r.created),
  }
}

/** Events in a project since a moment (ISO), newest first. With forMember, only the ones about that member. */
export function listEvents(projectId: string, sinceIso: string, forMember = ''): Promise<ActivityEvent[]> {
  return run(async () => {
    const c = client()
    const parts = [c.filter('project = {:p}', { p: projectId })]
    if (sinceIso) parts.push(c.filter('created > {:t}', { t: pbTime(sinceIso) }))
    if (forMember) parts.push(c.filter('targets.id ?= {:m}', { m: forMember }))
    const page = await c.collection('events').getList(1, 200, { filter: parts.join(' && '), sort: '-created' })
    return page.items.map(toEvent)
  })
}

// ---------- chat updates (PM) ----------

export function setChatWebhook(keysId: string, url: string): Promise<ProjectKeys> {
  return run(async () => toKeys(await client().collection('project_keys').update(keysId, { chat_webhook: url })))
}

/** Post the PM's update to the group chat; the server sends it to the webhook and records the time. */
export async function postToChat(projectId: string, text: string): Promise<void> {
  try {
    await client().send(`/api/gh/chat/${projectId}`, { method: 'POST', body: { text } })
  } catch (e) {
    if (e instanceof ClientResponseError && e.response?.message && e.status === 400) throw new StoreError(e.response.message, 400)
    throw friendly(e)
  }
}

/** Record that the PM shared an update some other way (copied it into the chat). */
export function markUpdateShared(keysId: string): Promise<ProjectKeys> {
  return run(async () => toKeys(await client().collection('project_keys').update(keysId, { last_summary_at: pbTime(new Date().toISOString()) })))
}

// ---------- subtasks ----------

/** Add subtasks to a task, in order, after any it already has. */
export function createSubtasks(taskId: string, titles: string[], startOrder: number): Promise<Subtask[]> {
  return run(async () => {
    const out: Subtask[] = []
    for (const [i, title] of titles.entries()) {
      out.push(toSubtask(await client().collection('subtasks').create({ task: taskId, title: title.slice(0, 200), done: false, order: startOrder + i })))
    }
    return out
  })
}

export function updateSubtask(id: string, patch: Partial<Pick<Subtask, 'title' | 'done' | 'order'>>): Promise<Subtask> {
  return run(async () => toSubtask(await client().collection('subtasks').update(id, patch)))
}

export function deleteSubtask(id: string): Promise<void> {
  return run(async () => {
    await client().collection('subtasks').delete(id)
  })
}

// ---------- setup check (PM) ----------

export interface CollectionInfo {
  name: string
  fields: string[]
  rules: Record<string, string | null>
}

/** The collections on this instance, with their fields and rules. */
export function listCollections(): Promise<CollectionInfo[]> {
  return run(async () => {
    const list = await client().collections.getFullList()
    return list.map((c) => ({
      name: c.name,
      fields: ((c.fields ?? []) as { name: string }[]).map((f) => f.name),
      rules: { listRule: c.listRule ?? null, viewRule: c.viewRule ?? null, createRule: c.createRule ?? null, updateRule: c.updateRule ?? null, deleteRule: c.deleteRule ?? null },
    }))
  })
}

/** Create or update SPMS's collections from the bundled schema. Never deletes anything else on the instance. */
export function importSchema(schema: unknown[]): Promise<void> {
  return run(async () => {
    await client().collections.import(schema as never, false)
  })
}

/** Which SPMS hook files answer, and their versions. */
export async function probeHooks(names: string[]): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {}
  await Promise.all(
    names.map(async (n) => {
      try {
        const r = await fetch(`${baseUrl}/api/gh/hooks/${n}`)
        const j = r.ok ? await r.json() : null
        out[n] = typeof j?.version === 'string' ? j.version : null
      } catch {
        out[n] = null
      }
    }),
  )
  return out
}
