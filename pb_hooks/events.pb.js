/// <reference path="../pb_data/types.d.ts" />
// EPMS: activity log. Records what changed, who it concerns and who did it, in the events collection.
// Members see the events about them under "Since your last visit"; the PM's chat summary is built from them.
// Only these hooks write events: the collection has no create, update or delete rules.

onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/epms/events.js`)
  const who = lib.actorOf(e.app, e.hasSuperuserAuth(), e.requestInfo().headers["x_member_key"])
  e.next()
  const t = e.record
  lib.record(e.app, { project: t.getString("project"), task: t.id, kind: "created", actor: who.member, pm: who.pm, targets: lib.peopleOf(t, who.member) })
  if (t.getBool("behind")) {
    lib.record(e.app, { project: t.getString("project"), task: t.id, kind: "behind", actor: who.member, pm: who.pm, targets: lib.peopleOf(t, who.member), text: t.getString("behind_note") })
  }
}, "tasks")

onRecordUpdateRequest((e) => {
  const lib = require(`${__hooks}/epms/events.js`)
  const who = lib.actorOf(e.app, e.hasSuperuserAuth(), e.requestInfo().headers["x_member_key"])
  const before = e.record.original().clone()
  e.next()
  lib.taskChanged(e.app, before, e.record, who)
}, "tasks")

onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/epms/events.js`)
  const who = lib.actorOf(e.app, e.hasSuperuserAuth(), e.requestInfo().headers["x_member_key"])
  e.next()
  const n = e.record
  try {
    const task = e.app.findRecordById("tasks", n.getString("task"))
    const author = n.getString("author")
    lib.record(e.app, {
      project: task.getString("project"), task: task.id, kind: "note", actor: author, pm: who.pm,
      targets: lib.peopleOf(task, author), text: n.getString("text"),
    })
  } catch (err) {
    console.log("EPMS: could not record note event", err)
  }
}, "notes")

// Post the PM's update to the group chat through the project's chat webhook
// (Teams Workflows, Discord or Slack). The browser can't post there itself, so the server does.
routerAdd("POST", "/api/gh/chat/{project}", (e) => {
  const projectId = e.request.pathValue("project")
  const text = String((e.requestInfo().body || {}).text || "").trim()
  if (!text) throw new BadRequestError("The update is empty.")
  let keys
  try {
    keys = e.app.findFirstRecordByFilter("project_keys", "project = {:p}", { p: projectId })
  } catch (_) {
    throw new NotFoundError("Project not found.")
  }
  const url = keys.getString("chat_webhook")
  if (!url) throw new BadRequestError("Add a chat webhook in Project settings first.")

  let payload
  if (/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(url)) {
    payload = { content: text.slice(0, 1990) }
  } else if (/^https:\/\/hooks\.slack\.com\//.test(url)) {
    payload = { text: text }
  } else {
    // Teams Workflows ("Send webhook alerts to a chat") expects an Adaptive Card.
    payload = {
      type: "message",
      attachments: [{
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: text.split("\n\n").map((block, i) => ({ type: "TextBlock", text: block, wrap: true, weight: i === 0 ? "Bolder" : "Default" })),
        },
      }],
    }
  }

  let res
  try {
    res = $http.send({ url: url, method: "POST", body: JSON.stringify(payload), headers: { "content-type": "application/json" }, timeout: 20 })
  } catch (err) {
    throw new BadRequestError("Couldn't reach the chat. Check the webhook address in Project settings.")
  }
  const isTeams = /(powerplatform\.com|logic\.azure\.com|powerautomate)/i.test(url)
  if (isTeams && (res.statusCode === 401 || res.statusCode === 403)) {
    throw new BadRequestError("Teams refused the post (error " + res.statusCode + "): the workflow only accepts signed-in users. In Power Automate, open the workflow, click its first step, set \"Who can trigger the flow?\" to Anyone, save, and copy the new address (it ends with &sig=...).")
  }
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new BadRequestError("The chat didn't accept the update (error " + res.statusCode + "). Check the webhook address in Project settings.")
  }
  keys.set("last_summary_at", new DateTime())
  e.app.save(keys)
  return e.json(200, { ok: true })
}, $apis.requireSuperuserAuth())
