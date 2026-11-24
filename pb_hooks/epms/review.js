// SPMS review alerts, loaded by events.pb.js with require().
// When a member sends a task to review, post a short message to the PM's review webhook (project_keys.review_webhook).
// Not a hook file itself (no .pb.js), so PocketBase only runs it when required.

// One alert per task in this window, so sending a task back and forth can't flood the channel.
const QUIET_MS = 10 * 60 * 1000

/** The body to POST for this webhook address: Discord, Slack, Teams Workflows, or plain JSON for anything else. */
function payloadFor(url, text, data) {
  if (/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(url)) {
    // allowed_mentions: a task title like "@everyone" must not ping the server.
    return { content: text.slice(0, 1990), allowed_mentions: { parse: [] } }
  }
  if (/^https:\/\/hooks\.slack\.com\//.test(url)) {
    return { text: text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") }
  }
  if (/(powerplatform\.com|logic\.azure\.com|powerautomate)/i.test(url)) {
    return {
      type: "message",
      attachments: [{
        contentType: "application/vnd.microsoft.card.adaptive",
        content: { $schema: "http://adaptivecards.io/schemas/adaptive-card.json", type: "AdaptiveCard", version: "1.4", body: [{ type: "TextBlock", text: text, wrap: true }] },
      }],
    }
  }
  return Object.assign({ text: text }, data)
}

/** POST one message. Throws on a network error or a non-2xx answer; the message never includes the address. */
function post(url, text, data) {
  const res = $http.send({ url: url, method: "POST", body: JSON.stringify(payloadFor(url, text, data)), headers: { "content-type": "application/json" }, timeout: 5 })
  if (res.statusCode < 200 || res.statusCode >= 300) throw new Error("webhook answered " + res.statusCode)
}

/** The review webhook for a project, or "". */
function urlFor(app, projectId) {
  try {
    return app.findFirstRecordByFilter("project_keys", "project = {:p}", { p: projectId }).getString("review_webhook")
  } catch (_) {
    return ""
  }
}

function nameOf(app, collection, id, fallback) {
  try {
    return app.findRecordById(collection, id).getString("name") || fallback
  } catch (_) {
    return fallback
  }
}

/** A member sent this task to review. Never throws: a failed alert must not break the submit. */
function submitted(app, task, memberId) {
  try {
    const projectId = task.getString("project")
    const url = urlFor(app, projectId)
    if (!url) return
    const key = "spms:review-alert:" + task.id
    const last = app.store().get(key)
    if (last && Date.now() - last < QUIET_MS) return
    app.store().set(key, Date.now())
    const member = nameOf(app, "members", memberId, "A member")
    const project = nameOf(app, "projects", projectId, "your project")
    const title = task.getString("title")
    post(url, member + " sent \"" + title + "\" to review in " + project + ".", {
      event: "task_submitted",
      task: { id: task.id, title: title },
      member: { id: memberId, name: member },
      project: { id: projectId, name: project },
    })
  } catch (err) {
    // Log the reason only: the address is a secret (Discord and Slack put the token in it).
    console.log("SPMS: review alert not sent:", String(err && err.message ? err.message : err).slice(0, 200))
  }
}

module.exports = { payloadFor, post, urlFor, submitted }
