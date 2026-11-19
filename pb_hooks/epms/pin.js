// EPMS member PINs, loaded with require() by claim.pb.js.
// A 4-digit PIN lets a member sign in on another device without the PM. Only a salted hash is stored,
// and 5 wrong tries lock that name for 15 minutes, which is what actually protects a 4-digit PIN.

const MAX_FAILS = 5
const LOCK_MINUTES = 15

function valid(pin) {
  return typeof pin === "string" && /^[0-9]{4}$/.test(pin)
}

function hash(salt, pin) {
  return $security.sha256("epms-pin:" + salt + ":" + pin)
}

/** Store a new PIN on a member_keys record (not saved here). */
function set(record, pin) {
  const salt = $security.randomString(24)
  record.set("pin_salt", salt)
  record.set("pin_hash", hash(salt, pin))
  record.set("pin_fails", 0)
  record.set("pin_locked_until", "")
}

function has(record) {
  return !!record.getString("pin_hash")
}

/** Minutes left on a lock, or 0. */
function lockedMinutes(record) {
  const until = record.getDateTime("pin_locked_until")
  if (until.isZero()) return 0
  const ms = until.time().unixMilli() - Date.now()
  return ms > 0 ? Math.ceil(ms / 60000) : 0
}

/**
 * Check a PIN and record the attempt. Saves the record.
 * Returns { ok: true } or { ok: false, locked: minutes, left: tries left }.
 */
function check(app, record, pin) {
  const locked = lockedMinutes(record)
  if (locked) return { ok: false, locked: locked, left: 0 }
  const good = valid(pin) && has(record) && $security.equal(hash(record.getString("pin_salt"), pin), record.getString("pin_hash"))
  if (good) {
    record.set("pin_fails", 0)
    record.set("pin_locked_until", "")
    app.save(record)
    return { ok: true }
  }
  const fails = record.getInt("pin_fails") + 1
  if (fails >= MAX_FAILS) {
    const until = new DateTime().add(LOCK_MINUTES * 60 * 1000 * 1000 * 1000)
    record.set("pin_fails", 0)
    record.set("pin_locked_until", until)
    app.save(record)
    return { ok: false, locked: LOCK_MINUTES, left: 0 }
  }
  record.set("pin_fails", fails)
  app.save(record)
  return { ok: false, locked: 0, left: MAX_FAILS - fails }
}

module.exports = { valid, set, has, check, lockedMinutes }
