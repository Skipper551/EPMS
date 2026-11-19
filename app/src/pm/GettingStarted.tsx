// A new project's checklist on the board. Ticks itself off as the PM goes; hidden once the essentials are done,
// or when the PM dismisses it.

import { useState } from 'preact/hooks'
import type { ProjectKeys, Snapshot } from '../data/types'
import { load, save } from '../lib/util'

const sharedKey = (projectId: string) => `epms:pm:shared:${projectId}`
const hiddenKey = (projectId: string) => `epms:pm:checklist-hidden:${projectId}`

/** Remember that the PM copied this project's group link (the checklist's "share it" step). */
export function markGroupLinkShared(projectId: string): void {
  save(sharedKey(projectId), '1')
}

export function GettingStarted(props: {
  snap: Snapshot
  keys: ProjectKeys | null
  onSettings: () => void
  onImport: () => void
  onNewTask: () => void
  onCopyLink: () => void
  onChat: () => void
}) {
  const { snap } = props
  const id = snap.project.id
  const [hidden, setHidden] = useState(() => load(hiddenKey(id)) === '1')
  const [, refresh] = useState(0)

  const steps = [
    { done: snap.members.some((m) => !m.is_pm), title: 'Add your group', body: 'Names and roles. You can paste them all at once.', action: 'Add members', onClick: props.onSettings },
    { done: !!snap.project.guidelines.trim(), title: 'Write the guidelines', body: 'How the group works and what "done" means. Members and their AIs follow them.', action: 'Write them', onClick: props.onSettings },
    { done: snap.tasks.length > 0, title: 'Plan the tasks', body: 'Plan them with Claude and import the whole plan, or add them one by one.', action: 'Import from Claude', onClick: props.onImport, alt: { action: 'New task', onClick: props.onNewTask } },
    { done: load(sharedKey(id)) === '1', title: 'Share the group link', body: 'Post it in your group chat. Everyone picks their name once.', action: 'Copy group link', onClick: () => { props.onCopyLink(); markGroupLinkShared(id); refresh((n) => n + 1) } },
    { done: !!(props.keys?.chat_webhook || props.keys?.last_summary_at), title: 'Set up chat updates', body: 'Optional: post a summary to Teams, Discord or Slack after each session on the board.', action: 'Set up', onClick: props.onChat, optional: true },
  ]
  const essentials = steps.filter((s) => !s.optional)
  if (hidden || essentials.every((s) => s.done)) return null
  const doneCount = steps.filter((s) => s.done).length

  return (
    <section class="panel" aria-label="Getting started" style={{ gap: '12px' }}>
      <div class="row-between">
        <div class="stack-sm" style={{ gap: '2px' }}>
          <h2 class="eyebrow" style={{ color: 'var(--accent-text)' }}>Getting started</h2>
          <span class="muted small">{doneCount} of {steps.length} done</span>
        </div>
        <button type="button" class="btn-text" style={{ color: 'var(--muted)' }} onClick={() => { save(hiddenKey(id), '1'); setHidden(true) }}>Hide</button>
      </div>
      <ol class="getting-started">
        {steps.map((s, i) => (
          <li key={i} class={s.done ? 'is-done' : undefined}>
            <span class="gs-mark" aria-hidden="true">{s.done ? '✓' : i + 1}</span>
            <div class="grow stack-sm" style={{ gap: '2px' }}>
              <strong style={{ fontWeight: 500 }}>{s.title}{s.optional ? <span class="muted xsmall"> · optional</span> : null}</strong>
              {!s.done && <span class="muted small">{s.body}</span>}
            </div>
            {!s.done && (
              <div class="row" style={{ gap: '8px' }}>
                {s.alt && <button type="button" class="btn btn-soft btn-sm" onClick={s.alt.onClick}>{s.alt.action}</button>}
                <button type="button" class="btn btn-primary btn-sm" onClick={s.onClick}>{s.action}</button>
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
