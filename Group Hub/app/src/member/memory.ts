// What a member's browser remembers: which name they picked per project, whether they finished the first visit,
// and the projects opened on this device (for the project menu). Nothing here is secret beyond the link itself.

import { load, save, type MemberLinkParts } from '../lib/util'

const PROJECTS = 'gh:member:projects'
const choiceKey = (projectId: string) => `gh:member:choice:${projectId}`

export interface RememberedProject extends MemberLinkParts {
  name: string
  lastOpened: number
}

export interface Choice {
  memberId: string
  setupDone: boolean
}

export function rememberedProjects(): RememberedProject[] {
  try {
    const list = JSON.parse(load(PROJECTS) ?? '[]')
    return Array.isArray(list) ? list.filter((p) => p && typeof p.projectId === 'string' && typeof p.key === 'string') : []
  } catch {
    return []
  }
}

export function rememberProject(p: MemberLinkParts, name: string): void {
  const others = rememberedProjects().filter((x) => x.projectId !== p.projectId)
  const prev = rememberedProjects().find((x) => x.projectId === p.projectId)
  const entry: RememberedProject = { ...p, ai: p.ai || prev?.ai || '', name, lastOpened: Date.now() }
  save(PROJECTS, JSON.stringify([entry, ...others].slice(0, 20)))
}

export function forgetProject(projectId: string): void {
  save(PROJECTS, JSON.stringify(rememberedProjects().filter((x) => x.projectId !== projectId)))
  save(choiceKey(projectId), null)
}

export function loadChoice(projectId: string): Choice | null {
  try {
    const c = JSON.parse(load(choiceKey(projectId)) ?? 'null')
    return c && typeof c.memberId === 'string' ? { memberId: c.memberId, setupDone: !!c.setupDone } : null
  } catch {
    return null
  }
}

export function saveChoice(projectId: string, choice: Choice | null): void {
  save(choiceKey(projectId), choice ? JSON.stringify(choice) : null)
}
