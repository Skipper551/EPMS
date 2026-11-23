// Task view: the PM's own "My tasks", built from the same pieces members see. A picker previews any member's
// screen (read only, so nothing is done in their name).

import { useState } from 'preact/hooks'
import { updateTask, type StoreError } from '../data/store'
import type { Snapshot, Status, Task } from '../data/types'
import { BlockedDialog, TaskDetail } from '../member/Dialogs'
import { MyTasks, Sidebar, type TaskActions } from '../member/MyTasks'
import { AddSubtasksDialog } from '../ui/Subtasks'
import { QuickTodos } from '../ui/QuickTodos'
import { toast } from '../ui/ui'

export function TaskView(props: { snap: Snapshot; pmAuthorId: string; onChanged: () => Promise<void> | void }) {
  const { snap } = props
  const fallback = snap.members.find((m) => m.id === props.pmAuthorId) ?? snap.members.find((m) => m.is_pm) ?? snap.members[0]
  const [viewingId, setViewingId] = useState(fallback?.id ?? '')
  const viewing = snap.members.find((m) => m.id === viewingId) ?? fallback
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [detail, setDetail] = useState<{ id: string; focusNote: boolean } | null>(null)
  const [blocked, setBlocked] = useState<string | null>(null)
  const [addSubtasksFor, setAddSubtasksFor] = useState<string | null>(null)

  if (!viewing) return <div class="empty">Add members in Project settings to see task views.</div>

  // The PM's own tasks, or a PM previewing another PM's: they finish directly. Anyone else's: a read-only preview.
  const mode = viewing.id === fallback?.id ? 'pm' : 'preview'

  async function advance(t: Task) {
    const next: Status | null = t.status === 'todo' ? 'doing' : t.status === 'doing' ? 'done' : null
    if (!next) return
    setBusy((b) => new Set(b).add(t.id))
    try {
      await updateTask(t.id, { status: next })
      toast(next === 'doing' ? 'Started' : 'Marked done')
    } catch (e) {
      toast((e as StoreError).message, true)
    }
    await props.onChanged()
    setBusy((b) => { const n = new Set(b); n.delete(t.id); return n })
  }

  const actions: TaskActions = {
    advance,
    openDetail: (t, focusNote = false) => setDetail({ id: t.id, focusNote }),
    blocked: (t) => { setDetail(null); setBlocked(t.id) },
    setUpAi: () => {},
    addSubtasks: (t) => setAddSubtasksFor(t.id),
  }

  return (
    <>
      <div class="row-between">
        <div class="row" style={{ gap: '10px' }}>
          <label class="field-label" for="viewing-as">Viewing as</label>
          <select id="viewing-as" class="select" style={{ width: 'auto', minWidth: '180px' }} value={viewing.id} onChange={(e) => setViewingId(e.currentTarget.value)}>
            {snap.members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}{m.id === fallback?.id ? ' (you)' : m.is_pm ? ' (PM)' : ''}</option>
            ))}
          </select>
        </div>
        {mode === 'preview' && <span class="group-tag" style={{ fontSize: '12px' }}>Preview of {viewing.name}'s screen · read only</span>}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '40px' }}>
        <MyTasks snap={snap} me={viewing} busy={busy} actions={actions} aiReady highlight={new Set()} updates={null} mode={mode} />
        <Sidebar snap={snap} me={viewing} todos={<QuickTodos snap={snap} meId={mode === 'pm' ? viewing.id : ''} isPm={mode === 'pm'} readOnly={mode === 'preview'} onChanged={props.onChanged} />} />
      </div>

      {detail && (
        <TaskDetail
          snap={snap} me={viewing} taskId={detail.id} focusNote={detail.focusNote} busy={busy.has(detail.id)} mode={mode}
          onAdvance={advance} onBlocked={actions.blocked} onClose={() => setDetail(null)} onChanged={props.onChanged}
          onAddSubtasks={(t) => { setDetail(null); setAddSubtasksFor(t.id) }}
        />
      )}
      {blocked && mode === 'pm' && <BlockedDialog snap={snap} me={viewing} taskId={blocked} onClose={() => setBlocked(null)} onChanged={props.onChanged} />}
      {addSubtasksFor && snap.tasks.some((t) => t.id === addSubtasksFor) && (
        <AddSubtasksDialog snap={snap} task={snap.tasks.find((t) => t.id === addSubtasksFor)!} onDone={props.onChanged}
          onClose={() => { const id = addSubtasksFor; setAddSubtasksFor(null); setDetail({ id, focusNote: false }) }} />
      )}
    </>
  )
}
