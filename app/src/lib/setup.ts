// What a working SPMS instance needs, and how this one compares. Pure: the PM screens call the store for the data.
// When a hook file changes, bump its version in pb_hooks AND here, so the setup check flags old copies.

// A committed copy of ../pb_schema.json, refreshed by every build (scripts/build-schema.sh), so the app folder builds on its own.
import schema from '../generated/pb_schema.json'
import type { CollectionInfo } from '../data/store'

export const SCHEMA = schema as unknown as { name: string; fields: { name: string }[]; listRule: string | null; viewRule: string | null; createRule: string | null; updateRule: string | null; deleteRule: string | null }[]

export const HOOKS: { name: string; file: string; version: string; what: string }[] = [
  { name: 'claim', file: 'claim.pb.js', version: '2026-11-19', what: 'joining with the group link, PINs' },
  { name: 'events', file: 'events.pb.js', version: '2026-11-24', what: 'updates for members, chat posts and review alerts' },
  { name: 'subtasks', file: 'subtasks.pb.js', version: '2026-11-21', what: 'the 30 subtask limit' },
  { name: 'todos', file: 'todos.pb.js', version: '2026-11-25', what: 'quick to-dos anyone can add' },
  { name: 'ai', file: 'ai.pb.js', version: '2026-11-25', what: 'the guide in the AI link' },
  { name: 'retro', file: 'retro.pb.js', version: '2026-11-25', what: 'wrapping up, the retrospective and the archive' },
]

export type CollectionState = 'ok' | 'missing' | 'outdated'

export interface SetupReport {
  collections: { name: string; state: CollectionState }[]
  hooks: { name: string; file: string; what: string; state: 'ok' | 'missing' | 'outdated' }[]
  schemaOk: boolean
  hooksOk: boolean
}

const RULES = ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule'] as const

export function compare(onInstance: CollectionInfo[], hookVersions: Record<string, string | null>): SetupReport {
  const byName = new Map(onInstance.map((c) => [c.name, c]))
  const collections = SCHEMA.map((want) => {
    const have = byName.get(want.name)
    if (!have) return { name: want.name, state: 'missing' as const }
    const fieldsOk = want.fields.every((f) => have.fields.includes(f.name))
    const rulesOk = RULES.every((r) => (have.rules[r] ?? null) === (want[r] ?? null))
    return { name: want.name, state: fieldsOk && rulesOk ? ('ok' as const) : ('outdated' as const) }
  })
  const hooks = HOOKS.map((h) => {
    const v = hookVersions[h.name]
    return { name: h.name, file: h.file, what: h.what, state: v === null || v === undefined ? ('missing' as const) : v < h.version ? ('outdated' as const) : ('ok' as const) }
  })
  return {
    collections,
    hooks,
    schemaOk: collections.every((c) => c.state === 'ok'),
    hooksOk: hooks.every((h) => h.state === 'ok'),
  }
}
