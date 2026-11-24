import { useEffect, useState } from 'preact/hooks'
import {
  aiLink, backendUrl, createMember, createMemberKey, deleteMember, deleteMemberKey, deleteProject, listMemberKeys, postToChat, regenerateKey, setChatWebhook, setClaimsLocked,
  StoreError, updateMember, updateProject,
} from '../data/store'
import type { Member, MemberKey, ProjectKeys, Snapshot } from '../data/types'
import { copyText, groupLink, load, normaliseUrl, personalLink, save } from '../lib/util'
import { Avatar, ErrorBox, Field, Toggle, toast } from '../ui/ui'
import { markGroupLinkShared } from './GettingStarted'

export function Settings(props: {
  snap: Snapshot
  keys: ProjectKeys | null
  onKeys: (k: ProjectKeys) => void
  pmAuthorId: string
  onPmAuthor: (id: string) => void
  onChanged: () => void
  onDeleted: () => void
}) {
  return (
    <>
      <div class="title-block">
        <h1 class="h1">Project settings</h1>
        <span class="muted small">{props.snap.project.name}</span>
      </div>
      <Details snap={props.snap} onChanged={props.onChanged} />
      <Guidelines snap={props.snap} onChanged={props.onChanged} />
      <Members snap={props.snap} keys={props.keys} pmAuthorId={props.pmAuthorId} onPmAuthor={props.onPmAuthor} onChanged={props.onChanged} />
      <Links snap={props.snap} keys={props.keys} onKeys={props.onKeys} />
      <ChatUpdates snap={props.snap} keys={props.keys} onKeys={props.onKeys} />
      <DeleteProject snap={props.snap} onDeleted={props.onDeleted} />
    </>
  )
}

function useSaver() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      if (ok) toast(ok)
      setBusy(false)
      return true
    } catch (e) {
      setError((e as StoreError).message)
      setBusy(false)
      return false
    }
  }
  return { busy, error, run }
}

function Details(props: { snap: Snapshot; onChanged: () => void }) {
  const p = props.snap.project
  const [name, setName] = useState(p.name)
  const [course, setCourse] = useState(p.course)
  const [deadline, setDeadline] = useState(p.final_deadline)
  const [chat, setChat] = useState(p.chat_url)
  const s = useSaver()
  useEffect(() => { setName(p.name); setCourse(p.course); setDeadline(p.final_deadline); setChat(p.chat_url) }, [p.id])
  const dirty = name !== p.name || course !== p.course || deadline !== p.final_deadline || chat !== p.chat_url

  return (
    <section class="panel">
      <h2 class="eyebrow">Details</h2>
      <form
        class="stack-lg"
        onSubmit={async (e) => {
          e.preventDefault()
          if (await s.run(() => updateProject(p.id, { name: name.trim(), course: course.trim(), final_deadline: deadline, chat_url: normaliseUrl(chat) }), 'Details saved')) props.onChanged()
        }}
      >
        <div class="form-grid">
          <Field label="Project name" class="span-2">{(id) => <input id={id} class="input" required maxLength={200} value={name} onInput={(e) => setName(e.currentTarget.value)} />}</Field>
          <Field label="Course">{(id) => <input id={id} class="input" maxLength={200} value={course} onInput={(e) => setCourse(e.currentTarget.value)} />}</Field>
          <Field label="Final deadline">{(id) => <input id={id} class="input" type="date" value={deadline} onInput={(e) => setDeadline(e.currentTarget.value)} />}</Field>
          <Field label="Group chat link (optional)" class="span-2" help="Teams, WhatsApp, Discord or any other chat. Members get an Open group chat button.">
            {(id) => <input id={id} class="input" type="text" inputMode="url" placeholder="https://…" maxLength={2000} value={chat} onInput={(e) => setChat(e.currentTarget.value)} />}
          </Field>
        </div>
        <ErrorBox error={s.error} />
        <div><button type="submit" class="btn btn-primary btn-md" disabled={s.busy || !dirty || !name.trim()}>Save details</button></div>
      </form>
    </section>
  )
}

function Guidelines(props: { snap: Snapshot; onChanged: () => void }) {
  const p = props.snap.project
  const draftKey = `epms:pm:guidelines-draft:${p.id}`
  // An unsaved draft survives switching views or closing the tab, so a long text is never lost halfway.
  const [text, setText] = useState(() => load(draftKey) ?? p.guidelines)
  const [restored, setRestored] = useState(() => { const d = load(draftKey); return d !== null && d !== p.guidelines })
  const s = useSaver()
  const dirty = text !== p.guidelines

  useEffect(() => {
    const d = load(draftKey)
    setText(d ?? p.guidelines)
    setRestored(d !== null && d !== p.guidelines)
  }, [p.id])

  useEffect(() => {
    save(draftKey, dirty ? text : null)
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [text, dirty])

  return (
    <section class="panel">
      <div class="stack-sm">
        <h2 class="eyebrow">Guidelines</h2>
        <span class="muted small">
          How the group works, standards, tone, and what "done" means. Members see this on their page, and every member's AI follows it.
        </span>
      </div>
      <form
        class="stack"
        onSubmit={async (e) => {
          e.preventDefault()
          const ok = await s.run(async () => {
            const saved = await updateProject(p.id, { guidelines: text })
            // Never report success unless the whole text came back.
            if (saved.guidelines !== text) {
              throw new StoreError(`Only ${saved.guidelines.length.toLocaleString()} of ${text.length.toLocaleString()} characters were saved. Your full text is still here; copy it somewhere safe, then try again.`, 0)
            }
          }, 'Guidelines saved')
          if (ok) {
            save(draftKey, null)
            setRestored(false)
            props.onChanged()
          }
        }}
      >
        {restored && dirty && <div class="hint-box" style={{ padding: '10px 14px' }}>Restored your unsaved changes. Save them, or <button type="button" class="btn-text" onClick={() => { setText(p.guidelines); setRestored(false) }}>discard them</button>.</div>}
        <label class="sr-only" for="guidelines">Guidelines</label>
        <textarea id="guidelines" class="textarea" rows={8} maxLength={20000} value={text} onInput={(e) => setText(e.currentTarget.value)}
          placeholder="APA 7 for all references. Keep your section under 600 words. Send things to review by Thursday evening so I can merge on Friday." />
        <ErrorBox error={s.error} />
        <div class="row-between">
          <div class="row">
            <button type="submit" class="btn btn-primary btn-md" disabled={s.busy || !dirty}>Save guidelines</button>
            {dirty && <span class="xsmall warn-text">Unsaved changes</span>}
          </div>
          <span class="muted xsmall">{text.length.toLocaleString()} / 20,000</span>
        </div>
      </form>
    </section>
  )
}

function Members(props: { snap: Snapshot; keys: ProjectKeys | null; pmAuthorId: string; onPmAuthor: (id: string) => void; onChanged: () => void }) {
  const { snap } = props
  const [claims, setClaims] = useState<Map<string, MemberKey> | null>(null)
  const loadClaims = () => listMemberKeys(snap.project.id).then(setClaims, () => setClaims(new Map()))
  useEffect(() => { loadClaims() }, [snap.project.id, snap.members.map((m) => m.id).join()])
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [isPm, setIsPm] = useState(false)
  const s = useSaver()
  const pmMembers = snap.members.filter((m) => m.is_pm)

  return (
    <section class="panel">
      <div class="stack-sm">
        <h2 class="eyebrow">Members</h2>
        <span class="muted small">
          Members pick their name once from the group link and choose a 4-digit PIN; that device stays signed in, and the PIN lets them sign in on their other devices. Nobody else can take a name that's set up. Reset clears both if someone is locked out or forgets their PIN. PMs never appear in the picker; each PM logs in here with their own superuser account, added in the instance dashboard.
        </span>
      </div>
      <div class="list">
        {snap.members.map((m) => <MemberRow key={m.id} snap={snap} m={m} claim={claims ? claims.get(m.id) ?? null : undefined} aiKey={props.keys?.ai_key ?? ''} onClaimsChanged={loadClaims} onChanged={props.onChanged} />)}
        {snap.members.length === 0 && <span class="muted small">No members yet.</span>}
      </div>

      <form
        class="stack"
        style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}
        onSubmit={async (e) => {
          e.preventDefault()
          if (await s.run(() => createMember(snap.project.id, { name: name.trim(), role: role.trim(), is_pm: isPm }), `${name.trim()} added`)) {
            setName('')
            setRole('')
            setIsPm(false)
            props.onChanged()
          }
        }}
      >
        <h3 class="field-label">Add a member</h3>
        <div class="row" style={{ alignItems: 'flex-end' }}>
          <div class="grow" style={{ minWidth: '160px' }}><Field label="Name">{(id) => <input id={id} class="input" required maxLength={100} value={name} onInput={(e) => setName(e.currentTarget.value)} />}</Field></div>
          <div class="grow" style={{ minWidth: '160px' }}><Field label="Role in the group">{(id) => <input id={id} class="input" maxLength={200} value={role} placeholder="Research" onInput={(e) => setRole(e.currentTarget.value)} />}</Field></div>
          <label class="check" style={{ marginBottom: '10px' }}><input type="checkbox" checked={isPm} onChange={(e) => setIsPm(e.currentTarget.checked)} /> PM</label>
          <button type="submit" class="btn btn-primary btn-md" disabled={s.busy || !name.trim()}>Add</button>
        </div>
        <ErrorBox error={s.error} />
      </form>

      {pmMembers.length > 1 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          <Field label="On this device, notes you write are posted as" help="Saved in this browser only, so each PM can pick their own name.">
            {(id) => (
              <select id={id} class="select" style={{ maxWidth: '280px' }} value={props.pmAuthorId} onChange={(e) => props.onPmAuthor(e.currentTarget.value)}>
                {pmMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            )}
          </Field>
        </div>
      )}
    </section>
  )
}

function MemberRow(props: { snap: Snapshot; m: Member; claim: MemberKey | null | undefined; aiKey: string; onClaimsChanged: () => void; onChanged: () => void }) {
  const { m, snap, claim } = props
  const [confirmReset, setConfirmReset] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(m.name)
  const [role, setRole] = useState(m.role)
  const [isPm, setIsPm] = useState(m.is_pm)
  const [confirm, setConfirm] = useState(false)
  const s = useSaver()
  const owned = snap.tasks.filter((t) => t.owner === m.id).length

  if (editing) {
    return (
      <form
        class="list-item stack"
        style={{ alignItems: 'stretch' }}
        onSubmit={async (e) => {
          e.preventDefault()
          if (await s.run(() => updateMember(m.id, { name: name.trim(), role: role.trim(), is_pm: isPm }), 'Member saved')) {
            setEditing(false)
            props.onChanged()
          }
        }}
      >
        <div class="row" style={{ alignItems: 'flex-end' }}>
          <div class="grow" style={{ minWidth: '160px' }}><Field label="Name">{(id) => <input id={id} class="input" required maxLength={100} value={name} onInput={(e) => setName(e.currentTarget.value)} data-autofocus />}</Field></div>
          <div class="grow" style={{ minWidth: '160px' }}><Field label="Role in the group">{(id) => <input id={id} class="input" maxLength={200} value={role} onInput={(e) => setRole(e.currentTarget.value)} />}</Field></div>
          <label class="check" style={{ marginBottom: '10px' }}><input type="checkbox" checked={isPm} onChange={(e) => setIsPm(e.currentTarget.checked)} /> PM</label>
        </div>
        <ErrorBox error={s.error} />
        <div class="row">
          <button type="submit" class="btn btn-primary btn-sm" disabled={s.busy || !name.trim()}>Save</button>
          <button type="button" class="btn btn-soft btn-sm" onClick={() => { setEditing(false); setName(m.name); setRole(m.role); setIsPm(m.is_pm) }}>Cancel</button>
        </div>
      </form>
    )
  }

  return (
    <div class="list-item" style={{ alignItems: 'center' }}>
      <div class="row grow" style={{ flexWrap: 'nowrap' }}>
        <Avatar snap={snap} memberId={m.id} size={28} />
        <div class="stack-sm grow" style={{ gap: 0 }}>
          <span style={{ fontWeight: 500 }}>
            {m.name} {m.is_pm && <span class="tag-pm" style={{ marginLeft: '6px' }}>PM</span>}
          </span>
          <span class="muted xsmall">
            {[m.role, `${owned} ${owned === 1 ? 'task' : 'tasks'}`].filter(Boolean).join(' · ')}
            {!m.is_pm && claim !== undefined && <> · <span style={{ color: claim ? 'var(--accent-text)' : 'var(--muted)' }}>{claim ? (claim.has_pin ? 'Set up, has a PIN' : 'Set up, no PIN yet') : 'Not set up yet'}</span></>}
          </span>
        </div>
      </div>
      {confirmReset ? (
        <div class="row">
          <span class="xsmall warn-text">Sign {m.name} out everywhere? They pick their name again from the group link, or you send them a new personal link.</span>
          <button type="button" class="btn btn-danger btn-sm" disabled={s.busy} onClick={async () => { if (claim && await s.run(() => deleteMemberKey(claim.id), `${m.name} reset`)) { setConfirmReset(false); props.onClaimsChanged() } }}>Reset</button>
          <button type="button" class="btn btn-soft btn-sm" onClick={() => setConfirmReset(false)}>Cancel</button>
        </div>
      ) : !confirm ? (
        <div class="row">
          {!m.is_pm && claim !== undefined && (
            <button
              type="button"
              class="btn btn-soft btn-sm"
              title="Send this privately to the member: it signs a device in as them."
              onClick={async () => {
                let k = claim
                if (!k) {
                  const ok = await s.run(async () => { k = await createMemberKey(m.id) })
                  if (!ok || !k) return
                  props.onClaimsChanged()
                }
                const copied = await copyText(personalLink(snap.project.id, m.id, k.key, props.aiKey, backendUrl()))
                toast(copied ? `${m.name}'s personal link copied. Send it to them privately.` : "Couldn't copy the link.", !copied)
              }}
            >
              Copy personal link
            </button>
          )}
          {!m.is_pm && claim && <button type="button" class="btn btn-soft btn-sm" onClick={() => setConfirmReset(true)}>Reset</button>}
          <button type="button" class="btn btn-soft btn-sm" onClick={() => setEditing(true)}>Edit</button>
          <button type="button" class="btn btn-soft btn-sm" onClick={() => setConfirm(true)}>Remove</button>
        </div>
      ) : (
        <div class="row">
          <span class="xsmall warn-text">{owned ? `Remove ${m.name}? Their ${owned} ${owned === 1 ? 'task becomes' : 'tasks become'} unassigned.` : `Remove ${m.name}?`}</span>
          <button type="button" class="btn btn-danger btn-sm" disabled={s.busy} onClick={async () => { if (await s.run(() => deleteMember(m.id), `${m.name} removed`)) props.onChanged() }}>Remove</button>
          <button type="button" class="btn btn-soft btn-sm" onClick={() => setConfirm(false)}>Keep</button>
        </div>
      )}
      <ErrorBox error={s.error} />
    </div>
  )
}

function LinkRow(props: { label: string; help: string; url: string | null; copyLabel: string; onRegenerate: () => Promise<void>; regenerateWarning: string; onCopied?: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  return (
    <div class="stack">
      <div class="stack-sm">
        <h3 class="field-label">{props.label}</h3>
        <span class="muted small">{props.help}</span>
      </div>
      <div class="link-box">
        <code>{props.url ?? 'Loading…'}</code>
        <button type="button" class="btn btn-primary btn-sm" disabled={!props.url} onClick={async () => { const ok = await copyText(props.url!); if (ok) props.onCopied?.(); toast(ok ? 'Copied' : "Couldn't copy. Select the link and copy it by hand.", false) }}>
          {props.copyLabel}
        </button>
      </div>
      {!confirm ? (
        <div><button type="button" class="btn-text" style={{ color: 'var(--muted)' }} onClick={() => setConfirm(true)}>Make a new link</button></div>
      ) : (
        <div class="row">
          <span class="xsmall warn-text">{props.regenerateWarning}</span>
          <button type="button" class="btn btn-danger btn-sm" disabled={busy} onClick={async () => { setBusy(true); await props.onRegenerate(); setBusy(false); setConfirm(false) }}>Make a new link</button>
          <button type="button" class="btn btn-soft btn-sm" onClick={() => setConfirm(false)}>Cancel</button>
        </div>
      )}
    </div>
  )
}

function Links(props: { snap: Snapshot; keys: ProjectKeys | null; onKeys: (k: ProjectKeys) => void }) {
  const { keys, snap } = props
  const [error, setError] = useState<string | null>(null)
  const [locking, setLocking] = useState(false)
  const regen = (which: 'member_key' | 'ai_key') => async () => {
    if (!keys) return
    setError(null)
    try {
      props.onKeys(await regenerateKey(keys.id, which))
      toast('New link made. Share it with the group.')
    } catch (e) {
      setError((e as StoreError).message)
    }
  }
  return (
    <section class="panel">
      <h2 class="eyebrow">Links</h2>
      <LinkRow
        label="Group link"
        help="Post this in the group chat. Each member opens it once and picks their name; after that their device is signed in as them. On its own, the link only shows the names that are still free."
        url={keys ? groupLink(snap.project.id, keys.member_key, backendUrl()) : null}
        copyLabel="Copy group link"
        onCopied={() => markGroupLinkShared(snap.project.id)}
        onRegenerate={regen('member_key')}
        regenerateWarning="The old group link stops working. Members who already picked their name stay signed in."
      />
      <div class="row">
        <Toggle
          checked={!!keys?.claims_locked}
          disabled={!keys || locking}
          label="Lock the group link"
          accent
          onChange={async (v) => {
            if (!keys) return
            setLocking(true)
            setError(null)
            try {
              props.onKeys(await setClaimsLocked(keys.id, v))
              toast(v ? 'Group link locked. Nobody new can pick a name.' : 'Group link unlocked.')
            } catch (e) {
              setError((e as StoreError).message)
            }
            setLocking(false)
          }}
        />
        <span class="muted xsmall">Once everyone has picked their name. You can still send someone a personal link from Members.</span>
      </div>
      <div style={{ borderTop: '1px solid var(--border)' }} />
      <LinkRow
        label="AI link"
        help="Read only. Members get it when they pick their name, inside the AI setup prompt, so you rarely need to copy it yourself. It shows the whole project as one document, without any keys."
        url={keys ? aiLink(snap.project.id, keys.ai_key) : null}
        copyLabel="Copy AI link"
        onRegenerate={regen('ai_key')}
        regenerateWarning="Every member's AI loses access until they paste the AI setup prompt again (Set up my AI in their menu)."
      />
      <ErrorBox error={error} />
    </section>
  )
}

function DeleteProject(props: { snap: Snapshot; onDeleted: () => void }) {
  const [text, setText] = useState('')
  const s = useSaver()
  const name = props.snap.project.name
  return (
    <section class="panel" style={{ borderColor: 'var(--warn-border)' }}>
      <div class="stack-sm">
        <h2 class="eyebrow">Delete project</h2>
        <span class="muted small">Removes the project with all its members, tasks and notes. This can't be undone.</span>
      </div>
      <form class="row" style={{ alignItems: 'flex-end' }} onSubmit={async (e) => { e.preventDefault(); if (await s.run(() => deleteProject(props.snap.project.id), 'Project deleted')) props.onDeleted() }}>
        <div class="grow" style={{ minWidth: '220px' }}>
          <Field label={`Type the project name to confirm`}>{(id) => <input id={id} class="input" value={text} placeholder={name} onInput={(e) => setText(e.currentTarget.value)} />}</Field>
        </div>
        <button type="submit" class="btn btn-danger btn-md" disabled={s.busy || text.trim() !== name.trim()}>Delete project</button>
      </form>
      <ErrorBox error={s.error} />
    </section>
  )
}

function ChatUpdates(props: { snap: Snapshot; keys: ProjectKeys | null; onKeys: (k: ProjectKeys) => void }) {
  const { keys } = props
  const [url, setUrl] = useState(keys?.chat_webhook ?? '')
  const s = useSaver()
  useEffect(() => setUrl(keys?.chat_webhook ?? ''), [keys?.id, keys?.chat_webhook])
  const clean = url.trim()
  const valid = !clean || /^https?:\/\/\S+$/i.test(clean)
  // Teams Workflows addresses carry a signature (&sig=...) unless the workflow only accepts signed-in users,
  // in which case posting from SPMS fails with 401.
  const teamsUnsigned = /(powerplatform\.com|logic\.azure\.com|powerautomate)/i.test(clean) && !/[?&]sig=/i.test(clean)

  return (
    <section class="panel">
      <div class="stack-sm">
        <h2 class="eyebrow">Chat updates</h2>
        <span class="muted small">
          After a session on the board, "Update the group" posts one summary of your changes and what's due soon, instead of a message for every change.
          Add a webhook to post it straight into the chat; without one you can still copy it.
        </span>
      </div>
      <form
        class="stack"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!keys || !valid) return
          if (await s.run(async () => props.onKeys(await setChatWebhook(keys.id, clean)), clean ? 'Chat webhook saved' : 'Chat webhook removed')) setUrl(clean)
        }}
      >
        <Field label="Chat webhook address">
          {(id) => <input id={id} class="input" type="text" inputMode="url" maxLength={2000} placeholder="https://…" value={url} onInput={(e) => setUrl(e.currentTarget.value)} />}
        </Field>
        {!valid && <span class="xsmall warn-text">That doesn't look like a web address. It should start with https://</span>}
        {valid && teamsUnsigned && (
          <span class="xsmall warn-text">
            This Teams address has no signature (it should end with &amp;sig=...), so Teams will refuse posts from SPMS. Either the copy was cut short, or the workflow only accepts signed-in users: in Power Automate, open the workflow, click its first step, set "Who can trigger the flow?" to Anyone, save, and copy the address again.
          </span>
        )}
        <div class="row">
          <button type="submit" class="btn btn-primary btn-md" disabled={!keys || s.busy || !valid || clean === (keys?.chat_webhook ?? '')}>Save</button>
          <button
            type="button"
            class="btn btn-soft btn-md"
            disabled={!keys?.chat_webhook || s.busy}
            onClick={() => s.run(() => postToChat(props.snap.project.id, `SPMS is connected to this chat for ${props.snap.project.name}.\n\nThe PM's board updates will appear here.`), 'Test message sent')}
          >
            Send a test message
          </button>
        </div>
        <ErrorBox error={s.error} />
      </form>
      <details>
        <summary class="small" style={{ cursor: 'pointer' }}>Where do I get a webhook address?</summary>
        <div class="stack-sm small soft" style={{ marginTop: '10px' }}>
          <span><strong style={{ color: 'var(--text)', fontWeight: 500 }}>Teams:</strong> in the group chat, open the Workflows app (the ••• menu or Apps), pick the template that posts to a chat when a webhook request is received ("Send webhook alerts to a chat"), choose this chat, and copy the address it gives you. It must end with &amp;sig= and a long code; if it doesn't, open the workflow in Power Automate, click its first step, set "Who can trigger the flow?" to Anyone, save, and copy it again.</span>
          <span><strong style={{ color: 'var(--text)', fontWeight: 500 }}>Discord:</strong> Server settings, Integrations, Webhooks, New webhook, pick the channel, Copy webhook URL.</span>
          <span><strong style={{ color: 'var(--text)', fontWeight: 500 }}>Slack:</strong> create an incoming webhook for the channel and copy its URL.</span>
          <span class="muted xsmall">The address is stored with the project's private keys: members and AIs can't see it.</span>
        </div>
      </details>
    </section>
  )
}
