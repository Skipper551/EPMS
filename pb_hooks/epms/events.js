// SPMS activity log helpers, loaded by events.pb.js with require().
// Not a hook file itself (no .pb.js), so PocketBase only runs it when required.

/** Who made this request: { member: member id or "", pm: true when the PM (superuser) did it }.
 *  The handler passes in what it read from the request (the request object isn't reachable from a required module). */
function actorOf(app, isSuperuser, memberKey) {
  if (isSuperuser) return { member: "", pm: true }
  const key = memberKey || ""
  if (key.length < 32) return { member: "", pm: false }
  try {
    const mk = app.findFirstRecordByFilter("member_keys", "key = {:k}", { k: key })
    return { member: mk.getString("member"), pm: false }
  } catch (_) {
    return { member: "", pm: false }
  }
}

/** The people a task concerns: its lead and helpers, minus whoever caused the event. */
function peopleOf(task, except) {
  const ids = [task.getString("owner")].concat(task.getStringSlice("helpers")).filter((id) => id && id !== except)
  return ids.filter((id, i) => ids.indexOf(id) === i)
}

/** Record one event. Never throws: a failed log entry must not break the change itself. */
function record(app, data) {
  try {
    const ev = new Record(app.findCollectionByNameOrId("events"))
    ev.set("project", data.project)
    ev.set("task", data.task || "")
    ev.set("kind", data.kind)
    ev.set("actor", data.actor || "")
    ev.set("by_pm", !!data.pm)
    ev.set("targets", data.targets || [])
    ev.set("text", (data.text || "").slice(0, 2000))
    app.save(ev)
  } catch (err) {
    console.log("SPMS: could not record event", data.kind, err)
  }
}

/** Events for a task update, comparing the values before and after. */
function taskChanged(app, before, after, who) {
  const base = { project: after.getString("project"), task: after.id, actor: who.member, pm: who.pm }
  const people = peopleOf(after, who.member)
  const was = before.getString("status")
  const now = after.getString("status")

  if (was !== now) {
    let kind = ""
    if (now === "doing" && was === "todo") kind = "started"
    else if (now === "review") kind = "submitted"
    else if (now === "done") kind = "approved"
    else if (now === "doing" && was === "review") kind = "sent_back"
    else kind = "moved"
    record(app, Object.assign({}, base, { kind: kind, targets: people, text: now }))

    // Finishing a task clears it as a blocker for the tasks waiting on it.
    if (now === "done") {
      const waiting = app.findRecordsByFilter("tasks", "blocked_by_tasks.id ?= {:id} && status != 'done'", "", 100, 0, { id: after.id })
      for (const w of waiting) {
        record(app, { project: base.project, task: w.id, kind: "unblocked", actor: who.member, pm: who.pm, targets: peopleOf(w, ""), text: after.getString("title") })
      }
    }
  }

  if (!before.getBool("behind") && after.getBool("behind")) {
    record(app, Object.assign({}, base, { kind: "behind", targets: people, text: after.getString("behind_note") }))
  } else if (before.getBool("behind") && !after.getBool("behind")) {
    record(app, Object.assign({}, base, { kind: "on_schedule", targets: people }))
  }

  // Priority: tasks saved before priorities existed have "" (shown as normal), so "" and "normal" are the same.
  const prioBefore = before.getString("priority") || "normal"
  const prioAfter = after.getString("priority") || "normal"
  if (prioBefore !== prioAfter) {
    record(app, Object.assign({}, base, { kind: "priority", targets: people, text: prioAfter }))
  }

  const oldOwner = before.getString("owner")
  const newOwner = after.getString("owner")
  if (newOwner && newOwner !== oldOwner && newOwner !== who.member) {
    record(app, Object.assign({}, base, { kind: "assigned", targets: [newOwner] }))
  }
  const oldHelpers = before.getStringSlice("helpers")
  const added = after.getStringSlice("helpers").filter((id) => oldHelpers.indexOf(id) < 0 && id !== who.member)
  if (added.length) record(app, Object.assign({}, base, { kind: "helper_added", targets: added }))

  const reasonBefore = before.getString("blocked_reason")
  const reasonAfter = after.getString("blocked_reason")
  const blockersBefore = before.getStringSlice("blocked_by_tasks").length + before.getStringSlice("blocked_by_members").length
  const blockersAfter = after.getStringSlice("blocked_by_tasks").length + after.getStringSlice("blocked_by_members").length
  if ((reasonAfter && reasonAfter !== reasonBefore) || blockersAfter > blockersBefore) {
    record(app, Object.assign({}, base, { kind: "blocked", targets: people, text: reasonAfter }))
  }
}

module.exports = { actorOf, peopleOf, record, taskChanged }
