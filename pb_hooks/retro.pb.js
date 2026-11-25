/// <reference path="../pb_data/types.d.ts" />
// SPMS: wrapping up a project, the retrospective, and the read-only archive. The logic is in epms/retro.js.
//
//   POST /api/gh/retro/{project}/start   PM only: { due } closes open tasks and opens the retrospective
//   GET  /api/gh/retro/{project}         member key, or PM with ?as=<PM member>: where it stands, and once
//                                        archived, that person's own totals and comments (nobody else's)
//   POST /api/gh/retro/{project}/submit  member key, or PM with { as }: { reviews: [...] }, once, final
//
// A cron job sends the reminder a day before the due date and archives retrospectives whose time is up.
// Once a project is wrapped up, nobody (the PM included) can change its tasks, notes, subtasks, members or details.

routerAdd("POST", "/api/gh/retro/{project}/start", (e) => {
  const retro = require(`${__hooks}/epms/retro.js`)
  const body = e.requestInfo().body || {}
  return e.json(200, retro.start(e.app, e.request.pathValue("project"), String(body.due || "")))
}, $apis.requireSuperuserAuth())

routerAdd("GET", "/api/gh/retro/{project}", (e) => {
  const retro = require(`${__hooks}/epms/retro.js`)
  const projectId = e.request.pathValue("project")
  const who = retro.resolve(e.app, projectId, e.hasSuperuserAuth(), e.request.header.get("X-Member-Key"), e.request.url.query().get("as"))
  return e.json(200, retro.info(e.app, projectId, who))
})

routerAdd("POST", "/api/gh/retro/{project}/submit", (e) => {
  const retro = require(`${__hooks}/epms/retro.js`)
  const projectId = e.request.pathValue("project")
  const body = e.requestInfo().body || {}
  const who = retro.resolve(e.app, projectId, e.hasSuperuserAuth(), e.request.header.get("X-Member-Key"), body.as)
  return e.json(200, retro.submit(e.app, projectId, who, body.reviews))
})

cronAdd("spmsRetro", "*/10 * * * *", () => {
  require(`${__hooks}/epms/retro.js`).tick($app)
})

// PM only: run the same check now. A pretend clock (`at`) is honoured only on a test instance
// started with SPMS_TEST_CLOCK=1, never on a real one.
routerAdd("POST", "/api/gh/retro-check", (e) => {
  const body = e.requestInfo().body || {}
  const at = $os.getenv("SPMS_TEST_CLOCK") === "1" && body.at ? Date.parse(String(body.at)) : 0
  require(`${__hooks}/epms/retro.js`).tick(e.app, at || 0)
  return e.json(200, { ok: true })
}, $apis.requireSuperuserAuth())

// ---------- read-only once wrapped up ----------

onRecordCreateRequest((e) => {
  require(`${__hooks}/epms/retro.js`).guard(e.app, e.record.getString("project"))
  e.next()
}, "tasks", "members")

onRecordUpdateRequest((e) => {
  require(`${__hooks}/epms/retro.js`).guard(e.app, e.record.original().getString("project"))
  e.next()
}, "tasks", "members")

onRecordDeleteRequest((e) => {
  require(`${__hooks}/epms/retro.js`).guard(e.app, e.record.getString("project"))
  e.next()
}, "tasks", "members")

onRecordCreateRequest((e) => {
  const retro = require(`${__hooks}/epms/retro.js`)
  retro.guard(e.app, retro.projectOfTask(e.app, e.record.getString("task")))
  e.next()
}, "notes", "subtasks")

onRecordUpdateRequest((e) => {
  const retro = require(`${__hooks}/epms/retro.js`)
  retro.guard(e.app, retro.projectOfTask(e.app, e.record.original().getString("task")))
  e.next()
}, "notes", "subtasks")

onRecordDeleteRequest((e) => {
  const retro = require(`${__hooks}/epms/retro.js`)
  retro.guard(e.app, retro.projectOfTask(e.app, e.record.getString("task")))
  e.next()
}, "notes", "subtasks")

// Project details are locked too. Deleting the whole project still works.
onRecordUpdateRequest((e) => {
  require(`${__hooks}/epms/retro.js`).guard(e.app, e.record.id)
  e.next()
}, "projects")

// Lets the SPMS setup check see that this file is installed, and which version.
routerAdd("GET", "/api/gh/hooks/retro", (e) => e.json(200, { name: "retro", version: "2026-11-25" }))
