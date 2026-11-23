/// <reference path="../pb_data/types.d.ts" />
// EPMS: quick to-dos (tasks with mini = true). Members may add them (the tasks create rule only lets members
// create mini tasks); these hooks keep them small, cap the open ones at 30 per project, and limit what
// members can change. Ordinary tasks are untouched.

onRecordCreateRequest((e) => {
  if (!e.record.getBool("mini")) return e.next()
  const lib = require(`${__hooks}/epms/todos.js`)
  const su = e.hasSuperuserAuth()
  const who = su ? "" : lib.memberOf(e.app, e.requestInfo().headers["x_member_key"], e.record.getString("project"))
  if (!su && !who) throw new ForbiddenError("You don't have permission to do that.")
  lib.tidyNew(e.app, e.record, who)
  e.next()
}, "tasks")

onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  const before = e.record.original()
  if (!before.getBool("mini") && !e.record.getBool("mini")) return e.next()
  const lib = require(`${__hooks}/epms/todos.js`)
  const who = lib.memberOf(e.app, e.requestInfo().headers["x_member_key"], before.getString("project"))
  lib.checkMemberEdit(before, e.record, who)
  e.next()
}, "tasks")

// Lets the EPMS setup check see that this file is installed, and which version.
routerAdd("GET", "/api/gh/hooks/todos", (e) => e.json(200, { name: "todos", version: "2026-11-21" }))
