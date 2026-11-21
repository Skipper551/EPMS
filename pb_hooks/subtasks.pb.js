/// <reference path="../pb_data/types.d.ts" />
// EPMS: subtasks stay a checklist, at most 30 per task, and only on real tasks (not quick to-dos).

onRecordCreateRequest((e) => {
  const taskId = e.record.getString("task")
  let mini = false
  try {
    mini = e.app.findRecordById("tasks", taskId).getBool("mini")
  } catch (_) {
    // A missing task is reported by the normal validation.
  }
  if (mini) throw new BadRequestError("Quick to-dos don't have subtasks. Ask the PM to make it a full task.")
  const existing = e.app.findRecordsByFilter("subtasks", "task = {:t}", "", 31, 0, { t: taskId })
  if (existing.length >= 30) {
    throw new BadRequestError("A task can have up to 30 subtasks. Split the task instead.")
  }
  e.next()
}, "subtasks")

// Lets the EPMS setup check see that this file is installed, and which version.
routerAdd("GET", "/api/gh/hooks/subtasks", (e) => e.json(200, { name: "subtasks", version: "2026-11-21" }))
