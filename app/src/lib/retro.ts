// Retrospective wording and sums. Pure: no requests. The summaries are fixed templates per score band,
// so the same totals always read the same way.

import type { Member, RetroReview, RetroScore, Snapshot, Task } from '../data/types'
import { PM_RETRO_SCORES, RETRO_SCORES } from '../data/types'

export const SCORE_LABEL: Record<RetroScore, string> = {
  overall: 'Overall',
  quality: 'Quality of work',
  punctuality: 'Punctuality',
  organization: 'Organization',
  communication: 'Communication',
  fairness: 'Fair task distribution',
}

export const SCORE_QUESTION: Record<RetroScore, string> = {
  overall: 'How was working with them, all in all?',
  quality: 'How good was their work?',
  punctuality: 'Did they keep to deadlines?',
  organization: 'How well did they organize the project?',
  communication: 'How clearly and often did they keep the group informed?',
  fairness: 'Was the work shared out fairly?',
}

/** The five points of the scale, -2 to +2. */
export const SCALE: { value: number; label: string }[] = [
  { value: -2, label: 'Poor' },
  { value: -1, label: 'Below par' },
  { value: 0, label: 'Not enough to say' },
  { value: 1, label: 'Good' },
  { value: 2, label: 'Excellent' },
]

export const ZERO_HELP = "Leave it on \"Not enough to say\" if you didn't work with them enough or see enough of their work to score it."

export function scoresFor(m: Member): RetroScore[] {
  return m.is_pm ? [...RETRO_SCORES, ...PM_RETRO_SCORES] : RETRO_SCORES
}

export function emptyReview(m: Member): RetroReview {
  const r: RetroReview = { member: m.id, overall: 0, quality: 0, punctuality: 0, commends: [], comment: '', anonymous: true }
  if (m.is_pm) Object.assign(r, { organization: 0, communication: 0, fairness: 0 })
  return r
}

/** Has the reviewer said anything about this person? */
export function touched(r: RetroReview): boolean {
  return [...RETRO_SCORES, ...PM_RETRO_SCORES].some((s) => (r[s] ?? 0) !== 0) || r.commends.length > 0 || r.comment.trim() !== ''
}

/** The tasks a member was responsible for: the ones they led or helped on (quick to-dos left out). */
export function tasksOf(snap: Snapshot, memberId: string): Task[] {
  return snap.tasks.filter((t) => t.owner === memberId || t.helpers.includes(memberId))
}

export type Band = 'great' | 'good' | 'neutral' | 'low' | 'poor'

export function band(avg: number): Band {
  if (avg >= 1.25) return 'great'
  if (avg >= 0.5) return 'good'
  if (avg > -0.5) return 'neutral'
  if (avg > -1.25) return 'low'
  return 'poor'
}

const SUMMARY: Record<RetroScore, Record<Band, string>> = {
  overall: {
    great: 'Your teammates really valued working with you.',
    good: 'Your teammates were glad to have you in the group.',
    neutral: "Overall, your teammates had mixed views, or didn't see enough of your work to say.",
    low: 'Some teammates felt working together could have gone better. Worth thinking about what you would do differently next time.',
    poor: 'Your teammates found this collaboration hard. Next project, talk to the group early about how you like to work and what they need from you.',
  },
  quality: {
    great: 'Your work stood out for its quality.',
    good: 'Your work was solid and dependable.',
    neutral: "The quality of your work came across as average, or your teammates didn't see enough of it to say.",
    low: 'Some teammates felt your work needed more polish. Next time, ask for feedback before handing things in.',
    poor: 'Your teammates felt the quality of your work fell short. Next time, check the guidelines first and ask for an early look at drafts.',
  },
  punctuality: {
    great: 'You were reliably on time.',
    good: 'You mostly kept to the schedule.',
    neutral: 'Timing was neither a strength nor a problem for you.',
    low: 'You were a bit behind schedule. You can improve next time.',
    poor: 'You often fell behind schedule. Next time, flag delays early so the group can plan around them.',
  },
  organization: {
    great: 'The group found the project very well organized.',
    good: 'The group found the project well organized.',
    neutral: 'The group had no strong view on how the project was organized.',
    low: 'The group felt the project could have been better organized. Clearer plans and deadlines would help next time.',
    poor: 'The group struggled with how the project was organized. Next time, share the plan early and check it with the group.',
  },
  communication: {
    great: 'Your communication kept everyone in the loop.',
    good: 'You kept the group informed.',
    neutral: 'The group had no strong view on your communication.',
    low: 'The group wanted clearer or more frequent updates from you.',
    poor: 'The group often felt out of the loop. Next time, post short regular updates so nobody has to ask.',
  },
  fairness: {
    great: 'The group felt the work was shared out very fairly.',
    good: 'The group felt the work was shared out fairly.',
    neutral: 'The group had no strong view on how the work was shared out.',
    low: "Some felt the work wasn't shared out evenly. Next time, check everyone's load as you assign tasks.",
    poor: 'The group felt the work was shared out unevenly. Next time, compare workloads openly before assigning tasks.',
  },
}

export function summaryFor(score: RetroScore, avg: number): string {
  return SUMMARY[score][band(avg)]
}

/** "+1.3", "0", "-0.7" */
export function formatAvg(avg: number): string {
  const r = Math.round(avg * 10) / 10
  if (r === 0) return '0'
  return (r > 0 ? '+' : '') + r.toFixed(1)
}

export interface Share {
  member: Member
  led: Task[]
  helped: Task[]
  /** Led tasks still open at wrap-up */
  unfinished: number
  /** Subtasks ticked off on tasks they led or helped on */
  steps: number
}

/** How the work was divided across the group, from the tasks as they stood when the project closed. */
export function workDivision(snap: Snapshot): { shares: Share[]; total: number; maxLed: number } {
  const shares = snap.members.map((m) => {
    const led = snap.tasks.filter((t) => t.owner === m.id)
    const helped = snap.tasks.filter((t) => t.owner !== m.id && t.helpers.includes(m.id))
    const ids = new Set([...led, ...helped].map((t) => t.id))
    return {
      member: m,
      led,
      helped,
      unfinished: led.filter((t) => t.closed_from).length,
      steps: snap.subtasks.filter((s) => s.done && ids.has(s.task)).length,
    }
  })
  return { shares, total: snap.tasks.length, maxLed: Math.max(1, ...shares.map((s) => s.led.length + s.helped.length)) }
}
