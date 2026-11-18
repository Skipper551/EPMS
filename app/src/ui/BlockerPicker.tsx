// Pick what a task is waiting on: other tasks and/or members. Used by the PM editor and the member "I'm blocked" dialog.

import type { Snapshot, Task } from '../data/types'
import { STATUS_LABEL } from '../data/types'
import { CloseIcon, Field } from './ui'
import { memberName } from '../lib/util'

export function BlockerPicker(props: {
  snap: Snapshot
  task: Pick<Task, 'id' | 'owner'>
  tasks: string[]
  members: string[]
  onChange: (tasks: string[], members: string[]) => void
}) {
  const { snap, task } = props
  const taskOptions = snap.tasks.filter((t) => t.id !== task.id && !props.tasks.includes(t.id) && t.status !== 'done')
  const memberOptions = snap.members.filter((m) => m.id !== task.owner && !props.members.includes(m.id))

  return (
    <div class="stack">
      <Field label="Waiting on a task">
        {(id) => (
          <select
            id={id}
            class="select"
            value=""
            onChange={(e) => {
              const v = e.currentTarget.value
              if (v) props.onChange([...props.tasks, v], props.members)
              e.currentTarget.value = ''
            }}
          >
            <option value="">{taskOptions.length ? 'Add a task…' : 'No other open tasks'}</option>
            {taskOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}{t.owner ? ` (${memberName(snap, t.owner)})` : ''}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Waiting on a person">
        {(id) => (
          <select
            id={id}
            class="select"
            value=""
            onChange={(e) => {
              const v = e.currentTarget.value
              if (v) props.onChange(props.tasks, [...props.members, v])
              e.currentTarget.value = ''
            }}
          >
            <option value="">{memberOptions.length ? 'Add a person…' : 'Nobody else to add'}</option>
            {memberOptions.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        )}
      </Field>
      {(props.tasks.length > 0 || props.members.length > 0) && (
        <ul class="stack-sm" style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label="Current blockers">
          {props.tasks.map((id) => {
            const t = snap.tasks.find((x) => x.id === id)
            if (!t) return null
            return (
              <li key={id} class="blocked-box" style={{ alignItems: 'center', padding: '6px 6px 6px 14px' }}>
                <span class="grow">
                  {t.title}
                  <span style={{ color: 'var(--warn-soft)' }}>
                    {t.owner ? ` · ${memberName(snap, t.owner)}` : ''} · {t.status === 'done' ? 'done, no longer blocking' : STATUS_LABEL[t.status].toLowerCase()}
                  </span>
                </span>
                <button type="button" class="icon-btn" aria-label={`Remove blocker ${t.title}`} onClick={() => props.onChange(props.tasks.filter((x) => x !== id), props.members)}>
                  <CloseIcon />
                </button>
              </li>
            )
          })}
          {props.members.map((id) => (
            <li key={id} class="blocked-box" style={{ alignItems: 'center', padding: '6px 6px 6px 14px' }}>
              <span class="grow">Waiting on {memberName(snap, id) || 'a removed member'}</span>
              <button type="button" class="icon-btn" aria-label={`Remove blocker ${memberName(snap, id)}`} onClick={() => props.onChange(props.tasks, props.members.filter((x) => x !== id))}>
                <CloseIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
