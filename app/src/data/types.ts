// Plain data shapes the app works with. They mirror pb_schema.json but carry no PocketBase types,
// so the rest of the app does not depend on the backend.

export type Status = 'todo' | 'doing' | 'review' | 'done'

export const STATUSES: Status[] = ['todo', 'doing', 'review', 'done']

export const STATUS_LABEL: Record<Status, string> = {
  todo: 'To do',
  doing: 'In progress',
  review: 'Review',
  done: 'Done',
}

export interface Project {
  id: string
  name: string
  course: string
  /** YYYY-MM-DD or '' */
  final_deadline: string
  guidelines: string
  /** Optional link to the group's chat (Teams, WhatsApp, Discord…), or '' */
  chat_url: string
  created: string
  updated: string
}

export interface ProjectKeys {
  id: string
  project: string
  /** The group link's key: only good for picking a name (claiming) */
  member_key: string
  ai_key: string
  /** When true, nobody can claim a name through the group link */
  claims_locked: boolean
  /** Teams Workflows, Discord or Slack webhook for the PM's chat updates, or '' */
  chat_webhook: string
  /** Discord, Slack, Teams Workflows or any JSON webhook that hears when a member sends a task to review, or '' */
  review_webhook: string
  /** When the PM last shared an update with the chat (ISO), or '' */
  last_summary_at: string
}

export type EventKind =
  | 'created' | 'assigned' | 'helper_added' | 'started' | 'submitted' | 'sent_back' | 'approved' | 'moved'
  | 'behind' | 'on_schedule' | 'blocked' | 'unblocked' | 'note'

/** One entry in the activity log, written by the server. */
export interface ActivityEvent {
  id: string
  task: string
  kind: EventKind
  /** member who did it, or '' */
  actor: string
  by_pm: boolean
  /** members it concerns */
  targets: string[]
  text: string
  created: string
}

/** A member's personal key, created when they claim their name. */
export interface MemberKey {
  id: string
  member: string
  key: string
  has_pin: boolean
}

/** What the group link shows before someone has picked their name. */
export interface JoinInfo {
  project: { id: string; name: string }
  locked: boolean
  pms: string[]
  members: { id: string; name: string; role: string; claimed: boolean; has_pin: boolean }[]
}

export interface Claim {
  member: string
  key: string
  ai_key: string
}

export interface Member {
  id: string
  project: string
  name: string
  role: string
  is_pm: boolean
  created: string
}

export interface TaskLink {
  label: string
  url: string
}

export interface Task {
  id: string
  project: string
  title: string
  /** Lead: the one member accountable for the task. Member id or '' */
  owner: string
  /** Other members working on it */
  helpers: string[]
  /** Whole-group task: shows on every member's page */
  everyone: boolean
  /** When work should begin, YYYY-MM-DD or ''. Set by the PM or the task's lead. */
  start_date: string
  /** YYYY-MM-DD or '' */
  due_date: string
  status: Status
  behind: boolean
  /** Optional note the PM adds when marking behind, e.g. "Need this by Thursday" */
  behind_note: string
  blocked_by_tasks: string[]
  blocked_by_members: string[]
  /** Free-text blocker that isn't a task or a person, e.g. "Waiting for the professor's feedback" */
  blocked_reason: string
  links: TaskLink[]
  /** Quick to-do: a small thing anyone in the group can add, take and tick off, with no review.
   *  Only title, owner and status are used. Kept out of the board, progress and updates. */
  mini: boolean
  /** Member who added it (quick to-dos), or '' */
  created_by: string
  created: string
  updated: string
}

export interface Note {
  id: string
  task: string
  /** member id or '' */
  author: string
  text: string
  created: string
}

/** One step of a task: a checklist item the lead and helpers tick off. */
export interface Subtask {
  id: string
  task: string
  title: string
  done: boolean
  order: number
  created: string
}

/** Everything in one project, loaded in a single request. */
export interface Snapshot {
  project: Project
  members: Member[]
  /** The plan: every task that isn't a quick to-do */
  tasks: Task[]
  /** Quick to-dos (mini tasks), oldest first */
  todos: Task[]
  notes: Note[]
  subtasks: Subtask[]
}

export interface ProjectInput {
  name: string
  course: string
  final_deadline: string
  guidelines: string
  chat_url?: string
}

export interface MemberInput {
  name: string
  role: string
  is_pm: boolean
}

export interface TaskInput {
  title: string
  owner: string
  helpers: string[]
  everyone: boolean
  start_date: string
  due_date: string
  status: Status
  behind: boolean
  behind_note: string
  blocked_by_tasks: string[]
  blocked_by_members: string[]
  blocked_reason: string
  links: TaskLink[]
}
