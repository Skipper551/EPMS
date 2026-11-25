// SPMS quick to-dos helpers, loaded by todos.pb.js with require().
// A quick to-do is a task with mini = true: a small thing anyone in the group can add, take and tick off,
// with no review step. It has a title, an optional owner and nothing else.

const OPEN_LIMIT = 30

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

/** Fields a quick to-do never uses. They stay empty, whoever creates it. */
const UNUSED = ["helpers", "blocked_by_tasks", "blocked_by_members"]
const UNUSED_TEXT = ["start_date", "due_date", "priority", "behind_note", "blocked_reason"]

function tidyNew(app, r, who) {
  const title = r.getString("title").trim()
  if (!title) throw new BadRequestError("Give the to-do a title.")
  r.set("title", title)
  for (const f of UNUSED) r.set(f, [])
  for (const f of UNUSED_TEXT) r.set(f, "")
  r.set("everyone", false)
  r.set("behind", false)
  r.set("links", [])
  if (r.getString("status") !== "done") r.set("status", "todo")
  const owner = r.getString("owner")
  if (who && owner && owner !== who) throw new BadRequestError("You can add a to-do for yourself or leave it up for grabs.")
  if (owner) {
    try {
      const m = app.findRecordById("members", owner)
      if (m.getString("project") !== r.getString("project")) throw new Error("other project")
    } catch (_) {
      throw new BadRequestError("That person isn't in this project.")
    }
  }
  if (who) r.set("created_by", who)

  const open = app.findRecordsByFilter("tasks", "project = {:p} && mini = true && status != 'done'", "", OPEN_LIMIT + 1, 0, { p: r.getString("project") })
  if (open.length >= OPEN_LIMIT) {
    throw new BadRequestError("The group has " + OPEN_LIMIT + " open to-dos. Tick some off or remove them first.")
  }
}

/** What a member may change on a quick to-do: take it or let it go, tick it off or reopen it, rename their own. */
function checkMemberEdit(before, after, who) {
  if (!who) throw new ForbiddenError("You don't have permission to do that.")
  if (before.getBool("mini") !== after.getBool("mini")) throw new ForbiddenError("Only the PM can turn a to-do into a task.")

  const same = (f) => before.getString(f) === after.getString(f)
  const sameList = (f) => JSON.stringify(before.getStringSlice(f)) === JSON.stringify(after.getStringSlice(f))
  const fixed = ["project", "created_by", "start_date", "due_date", "priority", "behind_note", "blocked_reason", "links"]
  if (!fixed.every(same) || !UNUSED.every(sameList) || before.getBool("everyone") !== after.getBool("everyone") || before.getBool("behind") !== after.getBool("behind")) {
    throw new BadRequestError("A to-do only has a title, a person and a tick.")
  }

  const wasOwner = before.getString("owner")
  const owner = after.getString("owner")
  if (owner !== wasOwner) {
    const takes = !wasOwner && owner === who
    const letsGo = wasOwner === who && !owner
    if (!takes && !letsGo) throw new BadRequestError("You can take a to-do that's up for grabs, or let go of your own.")
  }

  const creator = before.getString("created_by")
  const mayManage = !wasOwner || wasOwner === who || creator === who

  if (!same("status")) {
    const s = after.getString("status")
    if (s !== "todo" && s !== "done") throw new BadRequestError("A to-do is either open or done.")
    if (!mayManage) throw new ForbiddenError("This to-do is someone else's. Ask them to tick it off.")
  }

  if (!same("title")) {
    if (creator !== who && wasOwner !== who) throw new ForbiddenError("Only whoever added or took this to-do can rename it.")
    const title = after.getString("title").trim()
    if (!title) throw new BadRequestError("Give the to-do a title.")
    after.set("title", title)
  }
}

module.exports = { memberOf, tidyNew, checkMemberEdit, OPEN_LIMIT }
