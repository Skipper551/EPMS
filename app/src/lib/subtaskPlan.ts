// Reads subtasks pasted from an AI (an "epms-subtasks" JSON block) or typed by hand (one per line).
// Pure: no backend calls. Format reference: the member's AI setup prompt in util.ts.

export const SUBTASK_FORMAT = 'epms-subtasks'
export const MAX_SUBTASKS = 30

export interface SubtaskParse {
  titles: string[]
  error: string | null
}

/** "- Find sources", "1. Find sources", "[ ] Find sources" → "Find sources" */
function cleanLine(line: string): string {
  return line.replace(/^\s*(?:[-*•]|\d+[.)]|\[[ xX]?\])\s*/, '').trim()
}

/** One subtask per line, typed by the member. */
export function parseLines(text: string): string[] {
  return text.split('\n').map(cleanLine).filter(Boolean).map((t) => t.slice(0, 200))
}

function titlesFrom(data: unknown): string[] | null {
  const list = Array.isArray(data) ? data : data && typeof data === 'object' ? (data as Record<string, unknown>).subtasks : null
  if (!Array.isArray(list)) return null
  return list
    .map((item) => (typeof item === 'string' ? item : item && typeof item === 'object' ? String((item as Record<string, unknown>).title ?? '') : ''))
    .map((t) => t.trim().slice(0, 200))
    .filter(Boolean)
}

/** The AI's reply: the JSON block if there is one, otherwise a plain list. */
export function parseFromAi(text: string): SubtaskParse {
  const t = text.trim()
  if (!t) return { titles: [], error: 'Paste what your AI gave you first.' }
  const fence = /```(?:json)?\s*\n([\s\S]*?)\n```/i.exec(t)
  const candidates = [fence?.[1] ?? '', t, t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1), t.slice(t.indexOf('['), t.lastIndexOf(']') + 1)]
  for (const c of candidates) {
    if (!c) continue
    try {
      const titles = titlesFrom(JSON.parse(c))
      if (titles) return titles.length ? { titles, error: null } : { titles, error: "The AI's list is empty." }
    } catch {
      /* try the next shape */
    }
  }
  const lines = parseLines(t).filter((l) => !/^```/.test(l))
  if (lines.length >= 2) return { titles: lines, error: null }
  return { titles: [], error: "Couldn't find a list of subtasks in that. Ask your AI for the SPMS subtasks block again." }
}
