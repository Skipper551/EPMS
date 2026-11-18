// What a member's browser remembers: one session per project (which member this device is signed in as,
// with that member's personal key), whether they finished the first visit, and the project name for the menu.
// The personal key works like a password reset link: whoever has it acts as that member.

import { load, save } from '../lib/util'

const SESSIONS = 'gh:member:sessions:v2'

export interface Session {
  projectId: string
  memberId: string
  personalKey: string
  ai: string
  name: string
  setupDone: boolean
  lastOpened: number
  /** When this device last showed the member's updates (ISO); updates newer than this are new */
  lastSeen?: string
}

export function sessions(): Session[] {
  try {
    const list = JSON.parse(load(SESSIONS) ?? '[]')
    return Array.isArray(list)
      ? list.filter((s) => s && typeof s.projectId === 'string' && typeof s.memberId === 'string' && typeof s.personalKey === 'string')
      : []
  } catch {
    return []
  }
}

export function sessionFor(projectId: string): Session | null {
  return sessions().find((s) => s.projectId === projectId) ?? null
}

export function saveSession(s: Omit<Session, 'lastOpened'>): Session {
  const entry: Session = { ...s, lastOpened: Date.now() }
  save(SESSIONS, JSON.stringify([entry, ...sessions().filter((x) => x.projectId !== s.projectId)].slice(0, 20)))
  return entry
}

export function forgetSession(projectId: string): void {
  save(SESSIONS, JSON.stringify(sessions().filter((x) => x.projectId !== projectId)))
}

/** Change some fields of the stored session, keeping everything else as stored now. */
export function patchSession(projectId: string, patch: Partial<Omit<Session, 'projectId' | 'lastOpened'>>): Session | null {
  const current = sessionFor(projectId)
  return current ? saveSession({ ...current, ...patch }) : null
}
