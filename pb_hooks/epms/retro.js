// SPMS retrospective and archive, loaded by retro.pb.js with require().
// Not a hook file itself (no .pb.js), so PocketBase only runs it when required.
//
// Lifecycle: the PM wraps up a project (open tasks are closed, phase = retro, retro_due set) -> members review
// each other -> the retrospective ends when everyone has submitted or at retro_due -> phase = archived (read-only).
//
// Privacy: individual scores are never stored. A submission adds its scores straight into one running total per
// reviewed member (retro_results), so there is nothing to trace back to a reviewer. retro_submissions only says
// who has submitted (the reminder lists who hasn't), never what. Comments carry an author only when the reviewer
// chose to show their name. None of these collections has an API rule: only these hooks read or write them, and
// a member only ever gets their own totals back, after the project is archived.

const SCORES = ["overall", "quality", "punctuality"]
/** Extra scores only for a member who is a PM. */
const PM_SCORES = ["organization", "communication", "fairness"]
const COMMENT_MAX = 2000
const DAY_MS = 24 * 60 * 60 * 1000

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function ms(dateString) {
  if (!dateString) return 0
  const t = Date.parse(String(dateString).replace(" ", "T"))
  return isNaN(t) ? 0 : t
}

function shortDate(dateString) {
  const t = ms(dateString)
  if (!t) return ""
  const d = new Date(t)
  return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()]
}

function pbDate(t) {
  return new Date(t).toISOString().replace("T", " ")
}

/** The member a personal key belongs to, if that member is in this project; otherwise "". */
function memberOf(app, memberKey, projectId) {
  const key = memberKey || ""
  if (key.length < 32) return ""
  try {
    const mk = app.findFirstRecordByFilter("member_keys", "key = {:k}", { k: key })
    const member = app.findRecordById("members", mk.getString("member"))
    return member.getString("project") === projectId ? member.id : ""
  } catch (_) {
    return ""
  }
}

/** Who is asking, as a member of this project. A member uses their personal key; the PM (superuser) names one of
 *  the project's PM members with `as`, and can never act as, or read the results of, anyone who isn't a PM. */
function resolve(app, projectId, isSuperuser, memberKey, as) {
  if (isSuperuser) {
    let m
    try {
      m = app.findRecordById("members", String(as || ""))
    } catch (_) {
      throw new BadRequestError("Pick which PM you are in Project settings first.")
    }
    if (m.getString("project") !== projectId || !m.getBool("is_pm")) throw new ForbiddenError("The PM can only act as a PM of this project.")
    return m.id
  }
  const id = memberOf(app, memberKey, projectId)
  if (!id) throw new NotFoundError("Not found.")
  return id
}

function project(app, projectId) {
  try {
    return app.findRecordById("projects", projectId)
  } catch (_) {
    throw new NotFoundError("Project not found.")
  }
}

/** "" while the project runs, "retro" during the retrospective, "archived" after. */
function phaseOf(app, projectId) {
  try {
    return app.findRecordById("projects", projectId).getString("phase")
  } catch (_) {
    return ""
  }
}

/** Refuse any change to a wrapped-up project's contents. */
function guard(app, projectId) {
  const phase = phaseOf(app, projectId)
  if (phase === "retro") throw new BadRequestError("This project is wrapped up: the retrospective is open and the board is read-only.")
  if (phase === "archived") throw new BadRequestError("This project is archived and read-only.")
}

function projectOfTask(app, taskId) {
  try {
    return app.findRecordById("tasks", taskId).getString("project")
  } catch (_) {
    return ""
  }
}

function keysOf(app, projectId) {
  try {
    return app.findFirstRecordByFilter("project_keys", "project = {:p}", { p: projectId })
  } catch (_) {
    return null
  }
}

/** Post to the group chat's webhook (the one the PM's chat updates use). Never throws; true when it was sent. */
function notify(app, projectId, text, data) {
  try {
    const keys = keysOf(app, projectId)
    const url = keys ? keys.getString("chat_webhook") : ""
    if (!url) return false
    require(`${__hooks}/epms/review.js`).post(url, text, Object.assign({ project: { id: projectId, name: project(app, projectId).getString("name") } }, data))
    return true
  } catch (err) {
    console.log("SPMS: retrospective message not sent:", String(err && err.message ? err.message : err).slice(0, 200))
    return false
  }
}

function membersOf(app, projectId) {
  return app.findRecordsByFilter("members", "project = {:p}", "created", 200, 0, { p: projectId })
}

function submittedIds(app, projectId) {
  return app.findRecordsByFilter("retro_submissions", "project = {:p}", "", 500, 0, { p: projectId }).map((s) => s.getString("reviewer"))
}

// ---------- wrap up ----------

/** The PM wraps up the project: close open tasks, open the retrospective until `dueIso`, tell the group chat. */
function start(app, projectId, dueIso) {
  const p = project(app, projectId)
  if (p.getString("phase")) throw new BadRequestError("This project is already wrapped up.")
  const now = Date.now()
  const due = ms(dueIso)
  if (!due || due < now + 60 * 60 * 1000) throw new BadRequestError("Pick a retrospective due date at least an hour from now.")
  if (due > now + 31 * DAY_MS) throw new BadRequestError("Pick a retrospective due date within a month.")

  let closed = 0
  app.runInTransaction((tx) => {
    const open = tx.findRecordsByFilter("tasks", "project = {:p} && status != 'done'", "", 1000, 0, { p: projectId })
    for (const t of open) {
      t.set("closed_from", t.getString("status"))
      t.set("status", "done")
      tx.save(t)
      closed++
    }
    const fresh = tx.findRecordById("projects", projectId)
    fresh.set("phase", "retro")
    fresh.set("retro_due", pbDate(due))
    fresh.set("wrapped_at", pbDate(now))
    tx.save(fresh)
    const keys = keysOf(tx, projectId)
    if (keys) {
      // A retrospective shorter than a day gets no separate reminder.
      keys.set("retro_reminded", due - now <= DAY_MS)
      tx.save(keys)
    }
  })

  const name = p.getString("name")
  const notified = notify(app, projectId,
    name + " is wrapped up. The retrospective is open until " + shortDate(pbDate(due)) + ": open SPMS to review your teammates. " +
    "Reviews are optional, you only ever see totals, and you choose whether your comments show your name.",
    { event: "retro_opened", due: new Date(due).toISOString() })
  return { closed: closed, notified: notified }
}

// ---------- review ----------

function score(v) {
  const n = Number(v === undefined || v === null || v === "" ? 0 : v)
  if (!isFinite(n) || Math.round(n) !== n || n < -2 || n > 2) throw new BadRequestError("Scores go from -2 to +2.")
  return n
}

function tasksOf(app, projectId, memberId) {
  return app.findRecordsByFilter("tasks", "project = {:p} && mini = false && (owner = {:m} || helpers.id ?= {:m})", "", 500, 0, { p: projectId, m: memberId })
}

/** Check one submission and turn it into clean reviews. Throws on anything off. */
function clean(app, projectId, reviewerId, reviews) {
  if (!Array.isArray(reviews)) throw new BadRequestError("Nothing to submit.")
  const members = {}
  for (const m of membersOf(app, projectId)) members[m.id] = m
  const seen = {}
  const out = []
  for (const r of reviews) {
    const id = String((r && r.member) || "")
    const m = members[id]
    if (!m) throw new BadRequestError("One of those people isn't in this project any more. Reload and try again.")
    if (id === reviewerId) throw new BadRequestError("You can't review yourself.")
    if (seen[id]) throw new BadRequestError("Each person can be reviewed once.")
    seen[id] = true
    const scores = {}
    for (const s of SCORES) scores[s] = score(r[s])
    if (m.getBool("is_pm")) for (const s of PM_SCORES) scores[s] = score(r[s])
    const allowed = {}
    for (const t of tasksOf(app, projectId, id)) allowed[t.id] = true
    const commends = []
    for (const t of Array.isArray(r.commends) ? r.commends : []) {
      const tid = String(t)
      if (!allowed[tid]) throw new BadRequestError("You can only commend tasks that person worked on.")
      if (commends.indexOf(tid) < 0) commends.push(tid)
    }
    const comment = String(r.comment || "").trim().slice(0, COMMENT_MAX)
    out.push({ member: id, scores: scores, commends: commends, comment: comment, anonymous: r.anonymous !== false })
  }
  return out
}

/** One reviewer's whole retrospective, in one go. Scores go straight into the totals; nothing can be edited later. */
function submit(app, projectId, reviewerId, reviews) {
  const p = project(app, projectId)
  if (p.getString("phase") !== "retro") throw new BadRequestError(p.getString("phase") === "archived" ? "The retrospective has ended." : "The retrospective hasn't started.")
  if (ms(p.getString("retro_due")) <= Date.now()) throw new BadRequestError("The retrospective has ended.")
  const items = clean(app, projectId, reviewerId, reviews)

  app.runInTransaction((tx) => {
    try {
      tx.findFirstRecordByFilter("retro_submissions", "reviewer = {:r}", { r: reviewerId })
      throw new BadRequestError("You've already submitted your reviews. They can't be changed.")
    } catch (err) {
      if (err instanceof BadRequestError) throw err
    }
    const sub = new Record(tx.findCollectionByNameOrId("retro_submissions"))
    sub.set("project", projectId)
    sub.set("reviewer", reviewerId)
    tx.save(sub)

    for (const it of items) {
      let row
      try {
        row = tx.findFirstRecordByFilter("retro_results", "member = {:m}", { m: it.member })
      } catch (_) {
        row = new Record(tx.findCollectionByNameOrId("retro_results"))
        row.set("project", projectId)
        row.set("member", it.member)
      }
      for (const s of Object.keys(it.scores)) row.set(s, row.getFloat(s) + it.scores[s])
      if (it.commends.length) {
        let counts = {}
        try {
          counts = JSON.parse(row.getString("commends") || "{}") || {}
        } catch (_) {
          counts = {}
        }
        for (const t of it.commends) counts[t] = (counts[t] || 0) + 1
        row.set("commends", counts)
      }
      tx.save(row)

      if (it.comment) {
        const c = new Record(tx.findCollectionByNameOrId("retro_comments"))
        c.set("project", projectId)
        c.set("member", it.member)
        c.set("author", it.anonymous ? "" : reviewerId)
        c.set("text", it.comment)
        tx.save(c)
      }
    }
  })

  // Ends early once everyone has submitted.
  const total = membersOf(app, projectId).length
  if (submittedIds(app, projectId).length >= total) archive(app, projectId, "everyone")
  return { ok: true }
}

// ---------- end ----------

/** Close the retrospective and archive the project. Does nothing unless the retrospective is open. */
function archive(app, projectId, why) {
  let changed = false
  app.runInTransaction((tx) => {
    const p = tx.findRecordById("projects", projectId)
    if (p.getString("phase") !== "retro") return
    p.set("phase", "archived")
    p.set("archived_at", pbDate(Date.now()))
    tx.save(p)
    changed = true
  })
  if (!changed) return false
  const name = project(app, projectId).getString("name")
  const lead = why === "everyone" ? "Everyone has finished the retrospective for " + name + "." : "The retrospective for " + name + " has closed."
  notify(app, projectId, lead + " The project is being archived: it's now read-only. Open SPMS to see your feedback and how the work was divided.", { event: "project_archived" })
  return true
}

/** The 24 hour reminder, naming who hasn't submitted yet. */
function remind(app, projectId) {
  const keys = keysOf(app, projectId)
  if (!keys || keys.getBool("retro_reminded")) return
  keys.set("retro_reminded", true)
  app.save(keys)
  const done = submittedIds(app, projectId)
  const left = membersOf(app, projectId).filter((m) => done.indexOf(m.id) < 0).map((m) => m.getString("name"))
  if (!left.length) return
  const p = project(app, projectId)
  notify(app, projectId,
    "One day left for the " + p.getString("name") + " retrospective (until " + shortDate(p.getString("retro_due")) + "). Still to do: " + left.join(", ") + ".",
    { event: "retro_reminder", pending: left })
}

/** Run from cron: send due reminders and close retrospectives whose time is up. `now` is for tests. */
function tick(app, now) {
  const open = app.findRecordsByFilter("projects", "phase = 'retro'", "", 500, 0)
  now = now || Date.now()
  for (const p of open) {
    try {
      const due = ms(p.getString("retro_due"))
      if (!due || due <= now) archive(app, p.id, "time")
      else if (due - now <= DAY_MS) remind(app, p.id)
    } catch (err) {
      console.log("SPMS: retrospective check failed for a project:", String(err && err.message ? err.message : err).slice(0, 200))
    }
  }
}

// ---------- reading ----------

/** Where the retrospective stands, for one member. Their own totals only, and only once the project is archived. */
function info(app, projectId, memberId) {
  const p = project(app, projectId)
  const members = membersOf(app, projectId)
  const done = submittedIds(app, projectId)
  const out = {
    phase: p.getString("phase"),
    due: p.getString("retro_due"),
    member: memberId,
    submitted: done.indexOf(memberId) >= 0,
    done: done.length,
    total: members.length,
    results: null,
  }
  if (out.phase !== "archived") return out

  const me = members.filter((m) => m.id === memberId)[0]
  const teammates = members.length - 1
  const isPm = !!(me && me.getBool("is_pm"))
  let row = null
  try {
    row = app.findFirstRecordByFilter("retro_results", "member = {:m}", { m: memberId })
  } catch (_) {
    row = null
  }
  const averages = {}
  for (const s of SCORES.concat(isPm ? PM_SCORES : [])) {
    const sum = row ? row.getFloat(s) : 0
    averages[s] = teammates > 0 ? Math.round((sum / teammates) * 100) / 100 : 0
  }
  let counts = {}
  try {
    counts = row ? JSON.parse(row.getString("commends") || "{}") || {} : {}
  } catch (_) {
    counts = {}
  }
  const names = {}
  for (const m of members) names[m.id] = m.getString("name")
  // Sorted by their random ids, so the order says nothing about who wrote what or when.
  const comments = app.findRecordsByFilter("retro_comments", "member = {:m}", "id", 200, 0, { m: memberId }).map((c) => {
    const author = c.getString("author")
    return { text: c.getString("text"), author: author ? names[author] || "A former member" : "" }
  })
  out.results = {
    is_pm: isPm,
    teammates: teammates,
    reviewed_by: done.filter((id) => id !== memberId).length,
    averages: averages,
    commends: Object.keys(counts).map((t) => ({ task: t, count: counts[t] })),
    comments: comments,
  }
  return out
}

module.exports = { SCORES, PM_SCORES, resolve, phaseOf, guard, projectOfTask, start, submit, archive, remind, tick, info }
