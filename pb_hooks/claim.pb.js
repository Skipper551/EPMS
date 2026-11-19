/// <reference path="../pb_data/types.d.ts" />
// EPMS: claim your name once.
//
// The group link carries the project's group key (project_keys.member_key). It is only good for these two routes:
//   GET  /api/gh/join/{project}   list the members, which names are taken, and whether joining is locked
//   POST /api/gh/claim/{project}  take a name: creates that member's personal key (member_keys) and returns it
// Everything else (reading the project, moving tasks, notes) needs the personal key in X-Member-Key.
// PMs never appear here and can't be claimed. The PM resets a claim by deleting the member_keys row.
// Handlers can't share top-level helpers in PocketBase JS hooks, so each one repeats its checks.

routerAdd("GET", "/api/gh/join/{project}", (e) => {
  const projectId = e.request.pathValue("project")
  const groupKey = e.request.header.get("X-Group-Key") || ""
  let keys
  try {
    keys = $app.findFirstRecordByFilter("project_keys", "project = {:p}", { p: projectId })
  } catch (_) {
    throw new NotFoundError("This link doesn't work any more.")
  }
  if (!groupKey || groupKey.length < 32 || keys.getString("member_key") !== groupKey) {
    throw new NotFoundError("This link doesn't work any more.")
  }
  const project = $app.findRecordById("projects", projectId)
  const members = $app.findRecordsByFilter("members", "project = {:p}", "created", 200, 0, { p: projectId })
  const claimed = {}
  for (const r of $app.findRecordsByFilter("member_keys", "member.project = {:p}", "", 500, 0, { p: projectId })) {
    claimed[r.getString("member")] = { pin: !!r.getString("pin_hash") }
  }
  return e.json(200, {
    project: { id: project.id, name: project.getString("name") },
    locked: keys.getBool("claims_locked"),
    pms: members.filter((m) => m.getBool("is_pm")).map((m) => m.getString("name")),
    members: members
      .filter((m) => !m.getBool("is_pm"))
      .map((m) => ({ id: m.id, name: m.getString("name"), role: m.getString("role"), claimed: !!claimed[m.id], has_pin: !!(claimed[m.id] && claimed[m.id].pin) })),
  })
})

routerAdd("POST", "/api/gh/claim/{project}", (e) => {
  const projectId = e.request.pathValue("project")
  const groupKey = e.request.header.get("X-Group-Key") || ""
  const body = e.requestInfo().body || {}
  const memberId = String(body.member || "")
  const pin = String(body.pin || "")
  const pins = require(`${__hooks}/epms/pin.js`)
  let keys
  try {
    keys = $app.findFirstRecordByFilter("project_keys", "project = {:p}", { p: projectId })
  } catch (_) {
    throw new NotFoundError("This link doesn't work any more.")
  }
  if (!groupKey || groupKey.length < 32 || keys.getString("member_key") !== groupKey) {
    throw new NotFoundError("This link doesn't work any more.")
  }
  if (!pins.valid(pin)) throw new BadRequestError("Choose a 4-digit PIN.")
  if (keys.getBool("claims_locked")) {
    throw new ForbiddenError("The PM has locked this link. Ask them for your personal link.")
  }
  let member
  try {
    member = $app.findRecordById("members", memberId)
  } catch (_) {
    throw new BadRequestError("That name isn't in this project any more.")
  }
  if (member.getString("project") !== projectId || member.getBool("is_pm")) {
    throw new BadRequestError("That name isn't in this project any more.")
  }
  let taken = false
  try {
    $app.findFirstRecordByFilter("member_keys", "member = {:m}", { m: memberId })
    taken = true
  } catch (_) {
    taken = false
  }
  if (taken) {
    throw new BadRequestError(member.getString("name") + " is already set up. If that's you, pick your name and enter your PIN, or ask the PM to reset it.")
  }
  const record = new Record($app.findCollectionByNameOrId("member_keys"))
  record.set("member", memberId)
  record.set("key", $security.randomString(40))
  pins.set(record, pin)
  try {
    $app.save(record)
  } catch (_) {
    throw new BadRequestError(member.getString("name") + " was just taken. If that's you, ask the PM to reset it.")
  }
  return e.json(200, { member: memberId, key: record.getString("key"), ai_key: keys.getString("ai_key") })
})

// The project's current AI key, for a member signed in with their personal key.
// Lets a member's device pick up a new AI link after the PM makes one.
routerAdd("GET", "/api/gh/ai/{project}", (e) => {
  const projectId = e.request.pathValue("project")
  const personalKey = e.request.header.get("X-Member-Key") || ""
  let mk
  try {
    if (personalKey.length < 32) throw new Error("short")
    mk = $app.findFirstRecordByFilter("member_keys", "key = {:k} && member.project = {:p}", { k: personalKey, p: projectId })
  } catch (_) {
    throw new NotFoundError("Not found.")
  }
  const keys = $app.findFirstRecordByFilter("project_keys", "project = {:p}", { p: projectId })
  return e.json(200, { ai_key: keys.getString("ai_key"), has_pin: !!mk.getString("pin_hash") })
})

// Sign in on another device: pick your (already set up) name on the group link and enter your PIN.
// Works even when the PM has locked the group link, since this person already joined.
routerAdd("POST", "/api/gh/signin/{project}", (e) => {
  const projectId = e.request.pathValue("project")
  const groupKey = e.request.header.get("X-Group-Key") || ""
  const body = e.requestInfo().body || {}
  const memberId = String(body.member || "")
  const pin = String(body.pin || "")
  const pins = require(`${__hooks}/epms/pin.js`)
  let keys
  try {
    keys = $app.findFirstRecordByFilter("project_keys", "project = {:p}", { p: projectId })
  } catch (_) {
    throw new NotFoundError("This link doesn't work any more.")
  }
  if (!groupKey || groupKey.length < 32 || keys.getString("member_key") !== groupKey) {
    throw new NotFoundError("This link doesn't work any more.")
  }
  let mk
  try {
    mk = $app.findFirstRecordByFilter("member_keys", "member = {:m} && member.project = {:p}", { m: memberId, p: projectId })
  } catch (_) {
    throw new BadRequestError("That name isn't set up yet. Pick it and choose a PIN to join.")
  }
  if (!pins.has(mk)) {
    throw new BadRequestError("This name has no PIN yet. Open EPMS on the device you joined with to set one, or ask the PM for your personal link.")
  }
  const result = pins.check($app, mk, pin)
  if (!result.ok) {
    if (result.locked) throw new TooManyRequestsError("Too many wrong PINs. Try again in " + result.locked + " minutes, or ask the PM for your personal link.")
    throw new BadRequestError("That PIN isn't right. " + result.left + (result.left === 1 ? " try" : " tries") + " left before a 15 minute pause.")
  }
  return e.json(200, { member: memberId, key: mk.getString("key"), ai_key: keys.getString("ai_key") })
})

// Set or change your PIN while signed in (members who joined before PINs existed, or anyone changing theirs).
routerAdd("POST", "/api/gh/pin/{project}", (e) => {
  const projectId = e.request.pathValue("project")
  const personalKey = e.request.header.get("X-Member-Key") || ""
  const pin = String((e.requestInfo().body || {}).pin || "")
  const pins = require(`${__hooks}/epms/pin.js`)
  if (!pins.valid(pin)) throw new BadRequestError("Choose a 4-digit PIN.")
  let mk
  try {
    if (personalKey.length < 32) throw new Error("short")
    mk = $app.findFirstRecordByFilter("member_keys", "key = {:k} && member.project = {:p}", { k: personalKey, p: projectId })
  } catch (_) {
    throw new NotFoundError("Not found.")
  }
  pins.set(mk, pin)
  $app.save(mk)
  return e.json(200, { ok: true })
})

// Lets the EPMS setup check see that this file is installed, and which version.
routerAdd("GET", "/api/gh/hooks/claim", (e) => e.json(200, { name: "claim", version: "2026-11-19" }))
