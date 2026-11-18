// Plain data shapes the app works with. They mirror pb_schema.json but carry no PocketBase types,
// so the rest of the app does not depend on the backend.

export type Status = 'todo' | 'doing' | 'review' | 'done'

export const STATUSES: Status[] = ['todo', 'doing', 'review', 'done']

export const STATUS_LABEL: Record<Status, string> = {
  todo: 'To do',
  doing: 'Doing',
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
  created: string
  updated: string
}

export interface ProjectKeys {
  id: string
  project: string
  member_key: string
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
  /** member id or '' */
  owner: string
  /** YYYY-MM-DD or '' */
  due_date: string
  status: Status
  behind: boolean
  blocked_by_tasks: string[]
  blocked_by_members: string[]
  links: TaskLink[]
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

/** Everything in one project, loaded in a single request. */
export interface Snapshot {
  project: Project
  members: Member[]
  tasks: Task[]
  notes: Note[]
}

export interface ProjectInput {
  name: string
  course: string
  final_deadline: string
  guidelines: string
}

export interface MemberInput {
  name: string
  role: string
  is_pm: boolean
}

export interface TaskInput {
  title: string
  owner: string
  due_date: string
  status: Status
  behind: boolean
  blocked_by_tasks: string[]
  blocked_by_members: string[]
  links: TaskLink[]
}
