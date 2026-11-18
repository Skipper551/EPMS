import { useState } from 'preact/hooks'
import { markUpdateShared, postToChat, type StoreError } from '../data/store'
import type { ActivityEvent, ProjectKeys, Snapshot } from '../data/types'
import { buildSummary } from '../lib/summary'
import { copyText, formatDay } from '../lib/util'
import { Dialog, ErrorBox, toast } from '../ui/ui'

/** After a session on the board: one summary of what changed, posted to the group chat. */
export function ChatUpdateDialog(props: {
  snap: Snapshot
  keys: ProjectKeys
  events: ActivityEvent[]
  pmName: string
  onClose: () => void
  onShared: () => void
  onOpenSettings: () => void
}) {
  const appUrl = new URL('./', location.href).toString()
  const [text, setText] = useState(() => buildSummary(props.snap, props.events, props.pmName, appUrl).text)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasWebhook = !!props.keys.chat_webhook
  const since = props.keys.last_summary_at ? `since your last update (${formatDay(props.keys.last_summary_at.slice(0, 10))})` : 'so far'

  async function post() {
    setBusy(true)
    setError(null)
    try {
      await postToChat(props.snap.project.id, text.trim())
      toast('Update posted to the group chat')
      props.onShared()
      props.onClose()
    } catch (e) {
      setError((e as StoreError).message)
      setBusy(false)
    }
  }

  async function copyAndMark() {
    const ok = await copyText(text.trim())
    if (!ok) return setError("Couldn't copy. Select the text and copy it by hand.")
    setBusy(true)
    try {
      await markUpdateShared(props.keys.id)
      toast('Update copied. Paste it in the group chat.')
      props.onShared()
      props.onClose()
    } catch (e) {
      setError((e as StoreError).message)
      setBusy(false)
    }
  }

  return (
    <Dialog
      title="Update the group"
      onClose={props.onClose}
      wide
      footer={
        <>
          <span class="muted xsmall">{hasWebhook ? 'Posts to the chat set up in Project settings.' : ''}</span>
          <div class="row">
            <button type="button" class={hasWebhook ? 'btn btn-soft btn-md' : 'btn btn-primary btn-md'} disabled={busy || !text.trim()} onClick={copyAndMark}>Copy instead</button>
            {hasWebhook && <button type="button" class="btn btn-primary btn-md" disabled={busy || !text.trim()} onClick={post}>{busy ? 'Posting…' : 'Post to chat'}</button>}
          </div>
        </>
      }
    >
      <p class="soft small" style={{ margin: 0 }}>
        What you changed on the board {since}, and what's due soon. Edit it as you like before sending.
      </p>
      {!hasWebhook && (
        <div class="hint-box" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span>To post straight into Teams, Discord or Slack, add a chat webhook in Project settings. Until then, copy it and paste it in the chat.</span>
          <button type="button" class="btn btn-soft btn-sm" onClick={props.onOpenSettings}>Set up</button>
        </div>
      )}
      <label class="sr-only" for="update-text">Update text</label>
      <textarea id="update-text" class="textarea" rows={14} maxLength={4000} value={text} onInput={(e) => setText(e.currentTarget.value)} style={{ fontSize: '13px' }} />
      <ErrorBox error={error} />
    </Dialog>
  )
}
