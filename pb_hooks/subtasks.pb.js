/// <reference path="../pb_data/types.d.ts" />
// EPMS: subtasks stay a checklist, at most 30 per task.

onRecordCreateRequest((e) => {
  const taskId = e.record.getString("task")
  const existing = e.app.findRecordsByFilter("subtasks", "task = {:t}", "", 31, 0, { t: taskId })
  if (existing.length >= 30) {
    throw new BadRequestError("A task can have up to 30 subtasks. Split the task instead.")
  }
  e.next()
}, "subtasks")
