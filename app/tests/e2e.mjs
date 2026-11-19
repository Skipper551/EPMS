// End-to-end check against a LOCAL PocketBase (npm run pb:dev) and the dev server
// (VITE_PB_URL=http://127.0.0.1:8090 npm run dev). Never point this at your live instance.
//
// Needs Playwright with Chromium:  npm i -D playwright && npx playwright install chromium
// Run:                             npm run test:e2e

import { createRequire } from 'node:module'
import PocketBase from 'pocketbase'
import http from 'node:http'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const PB = process.env.PB_URL || 'http://127.0.0.1:8090'
const APP = process.env.APP_URL || 'http://localhost:5173/'
const EMAIL = process.env.PB_EMAIL || 'pm@example.com'
const PASSWORD = process.env.PB_PASSWORD || 'devpassword123'

if (!/127\.0\.0\.1|localhost/.test(PB)) {
  console.error('Refusing to run against a non-local PocketBase:', PB)
  process.exit(1)
}

let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail && !ok ? `: ${detail}` : ''}`)
  if (!ok) failures++
}

// ---------- a stand-in for the Teams webhook ----------

const posted = []
const receiver = http.createServer((req, res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { posted.push(b); res.writeHead(202); res.end() }) })
await new Promise((r) => receiver.listen(0, '127.0.0.1', r))
const webhook = `http://127.0.0.1:${receiver.address().port}/teams`

// ---------- seed a fresh project ----------

const pb = new PocketBase(PB)
pb.autoCancellation(false)
await pb.collection('_superusers').authWithPassword(EMAIL, PASSWORD)
const day = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) + ' 12:00:00.000Z' }
const name = `E2E ${Date.now()}`
const project = await pb.collection('projects').create({ name, course: 'Testing', final_deadline: day(20), guidelines: 'Be kind.', chat_url: 'https://example.com/chat' })
const keys = await pb.collection('project_keys').create({ project: project.id, chat_webhook: webhook })
const m = {}
for (const [n, role, is_pm] of [['Pat', 'PM', true], ['Ala', 'Research', false], ['Jimmy', 'Writing', false]]) {
  m[n] = (await pb.collection('members').create({ project: project.id, name: n, role, is_pm })).id
}
const sources = await pb.collection('tasks').create({ project: project.id, title: 'Find sources', owner: m.Ala, due_date: day(2), status: 'review' })
const intro = await pb.collection('tasks').create({ project: project.id, title: 'Write the intro', owner: m.Jimmy, due_date: day(5), status: 'todo', blocked_by_tasks: [sources.id] })
await pb.collection('tasks').create({ project: project.id, title: 'Draft the conclusion', owner: m.Jimmy, due_date: day(8), status: 'todo' })
const pair = await pb.collection('tasks').create({ project: project.id, title: 'Interview users', owner: m.Ala, helpers: [m.Jimmy], due_date: day(6), status: 'todo' })
await pb.collection('tasks').create({ project: project.id, title: 'Rehearse', owner: m.Pat, everyone: true, due_date: day(15), status: 'todo' })
const groupLinkUrl = `${APP}#p=${project.id}&key=${keys.member_key}`

// ---------- access rules ----------

const api = (path, init = {}) => fetch(`${PB}/api/collections/${path}`, init)
const json = { 'Content-Type': 'application/json' }
const claimApi = (member) => fetch(`${PB}/api/gh/claim/${project.id}`, { method: 'POST', headers: { ...json, 'X-Group-Key': keys.member_key }, body: JSON.stringify({ member }) })
check('AI link reads the project without keys', (await api(`projects/records/${project.id}?ai_key=${keys.ai_key}`)).status === 200)
check('missing key gets 404', (await api(`projects/records/${project.id}`)).status === 404)
check('group key alone reads nothing', (await api(`projects/records/${project.id}`, { headers: { 'X-Member-Key': keys.member_key } })).status === 404)
check('PM name cannot be claimed', (await claimApi(m.Pat)).status === 400)
const alaClaim = await (await claimApi(m.Ala)).json()
check('claiming returns a personal key and the AI key', alaClaim.key?.length === 40 && alaClaim.ai_key === keys.ai_key)
check('a taken name cannot be claimed again', (await claimApi(m.Ala)).status === 400)
const asAla = { ...json, 'X-Member-Key': alaClaim.key }
const patch = (id, body) => api(`tasks/records/${id}`, { method: 'PATCH', headers: asAla, body: JSON.stringify(body) })
check('member cannot mark Done', (await patch(sources.id, { status: 'done' })).status !== 200)
check('member cannot rename a task', (await patch(sources.id, { title: 'x' })).status !== 200)
check('member cannot change helpers', (await patch(pair.id, { helpers: [] })).status !== 200)
check('member cannot set everyone', (await patch(pair.id, { everyone: true })).status !== 200)
check("member cannot move someone else's task", (await patch(intro.id, { status: 'doing' })).status !== 200)
check('member cannot post a note as someone else', (await api('notes/records', { method: 'POST', headers: asAla, body: JSON.stringify({ task: sources.id, author: m.Jimmy, text: 'x' }) })).status !== 200)
check('member posts a note as themselves', (await api('notes/records', { method: 'POST', headers: asAla, body: JSON.stringify({ task: sources.id, author: m.Ala, text: 'Done, see doc.' }) })).status === 200)
const asMember = await api(`members/records/${m.Ala}`, { method: 'PATCH', headers: asAla, body: '{"is_pm":true}' })
check('member cannot set is_pm', asMember.status !== 200)
check('lead sets a start date', (await patch(pair.id, { start_date: day(3) })).status === 200)
await patch(pair.id, { start_date: '' })
check('member sets a custom blocker on their task', (await patch(sources.id, { blocked_reason: 'Library closed' })).status === 200)
check('member cannot set a behind note', (await patch(sources.id, { behind_note: 'x' })).status !== 200)
await patch(sources.id, { blocked_reason: '' })
check('members can read events but not write them', (await api('events/records', { method: 'POST', headers: asAla, body: JSON.stringify({ project: project.id, kind: 'approved' }) })).status !== 200)
const sub = await (await api('subtasks/records', { method: 'POST', headers: asAla, body: JSON.stringify({ task: pair.id, title: 'Book the room', order: 1 }) })).json()
check('lead adds a subtask', !!sub.id)
check("member cannot add subtasks to someone else's task", (await api('subtasks/records', { method: 'POST', headers: asAla, body: JSON.stringify({ task: intro.id, title: 'x' }) })).status !== 200)
await api(`subtasks/records/${sub.id}`, { method: 'DELETE', headers: asAla })
check('personal keys cannot be listed', ((await (await api('member_keys/records', { headers: asAla })).json()).items ?? []).length === 0)

// ---------- browser ----------

const browser = await chromium.launch()
const errors = []
const watch = (page) => {
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()))
}

// Member (the context stays open for a second visit at the end)
let memberPage
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await ctx.newPage()
  watch(page)
  let allKeyed = true
  page.on('request', (r) => {
    if (!r.url().startsWith(PB)) return
    const h = r.headers()
    const ok = r.url().includes('/api/gh/join/') || r.url().includes('/api/gh/claim/') ? !!h['x-group-key'] && !h['x-member-key'] : !!h['x-member-key'] && !h['x-group-key']
    if (!ok) allKeyed = false
  })
  await page.goto(groupLinkUrl)
  await page.waitForSelector('text=Which one is you?')
  const names = await page.locator('[role=radio]').allInnerTexts()
  check('name picker hides the PM', !names.some((n) => n.startsWith('Pat')) && names.length === 2, names.join())
  check('claimed name is shown as taken', await page.locator('[role=radio]:has-text("Ala")').isDisabled())
  await page.click('[role=radio]:has-text("Jimmy")')
  await page.click('text=Continue')
  await page.click('text=Got it')
  await page.click('text=Copy instructions')
  const prompt = await page.evaluate(() => navigator.clipboard.readText())
  check('AI prompt has the real AI link', prompt.includes(`records/${project.id}?ai_key=${keys.ai_key}`))
  await page.click('text=Go to my tasks')
  await page.waitForSelector('h1:text-is("My tasks")')
  check('group chat button links to the chat', (await page.locator('header a:has-text("Open group chat")').getAttribute('href')) === 'https://example.com/chat')
  check('blocked task shows its blocker', (await page.locator('article', { hasText: 'Write the intro' }).locator('.blocked-box').count()) === 1)
  const card = page.locator('article', { hasText: 'Draft the conclusion' })
  await card.locator('button:has-text("Start")').click()
  await card.locator('button:has-text("Send to review")').click()
  await page.waitForTimeout(400)
  check('member moves a task to Review', (await card.locator('.pill').innerText()) === 'Review')
  const helping = page.locator('article', { hasText: 'Interview users' })
  check('helper sees the task and can start it', (await helping.innerText()).includes('Helping Ala') && (await helping.locator('button:has-text("Start")').count()) === 1)
  const group = page.locator('article', { hasText: 'Rehearse' })
  check('whole-group task shows, only the lead moves it', (await group.innerText()).includes('Whole group, led by Pat') && (await group.locator('button:has-text("Start")').count()) === 0)
  await page.reload()
  await page.waitForSelector('h1:text-is("My tasks")')
  check('name remembered after reload', true)
  check('address bar holds the personal link', page.url().includes('&me='))
  await page.click('header .select-btn')
  await page.click('role=menuitem[name="Copy my personal link"]')
  const personal = await page.evaluate(() => navigator.clipboard.readText())
  await page.goto(groupLinkUrl)
  await page.waitForSelector('h1:text-is("My tasks")')
  check('group link on a set-up device goes straight to My tasks', true)

  // Someone else on another device can't take Jimmy, but Jimmy's personal link works there.
  const other = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const p2 = await other.newPage()
  watch(p2)
  await p2.goto(groupLinkUrl)
  await p2.waitForSelector('text=Which one is you?')
  check('Jimmy is taken on another device', await p2.locator('[role=radio]:has-text("Jimmy")').isDisabled())
  await p2.goto(personal)
  await p2.waitForSelector('h1:text-is("My tasks")')
  check('personal link signs in on a new device', (await p2.locator('header').innerText()).includes('Hello Jimmy'))
  await other.close()
  check('join requests send the group key, everything else the personal key', allKeyed)
  const interview = page.locator('article', { hasText: 'Interview users' })
  await interview.locator('button:has-text("I\'m blocked")').click()
  await page.getByLabel('Something else').fill('Waiting for interview slots')
  await page.click('role=dialog >> button:has-text("Save")')
  await page.waitForTimeout(400)
  check('custom blocker shows on the task', (await interview.locator('.blocked-box').innerText()).includes('Waiting for interview slots'))
  // Start dates: the lead pushes a task into Coming up.
  await page.locator('article', { hasText: 'Write the intro' }).locator('h2 button').click()
  await page.getByLabel("I'll start on").fill(day(4).slice(0, 10))
  await page.click('role=dialog >> button:has-text("Save")')
  await page.waitForTimeout(500)
  await page.click('role=dialog >> [aria-label=Close]')
  check('future start moves the task to Coming up', (await page.locator('section[aria-label="Coming up"] >> text=Write the intro').count()) === 1)
  await page.locator('article', { hasText: 'Write the intro' }).locator('h2 button').click()
  await page.getByLabel("I'll start on").fill('')
  await page.click('role=dialog >> button:has-text("Save")')
  await page.waitForTimeout(500)
  await page.click('role=dialog >> [aria-label=Close]')
  check('clearing the start brings it back', (await page.locator('section[aria-label="Coming up"]').count()) === 0)
  await page.locator('article', { hasText: 'Interview users' }).locator('h2 button').click()
  check('helpers cannot change the start date', (await page.getByLabel("I'll start on").count()) === 0)
  await page.click('role=dialog >> [aria-label=Close]')

  // Subtasks: written by hand on one task, pasted from the AI on another.
  const draft = page.locator('article', { hasText: 'Write the intro' })
  await draft.locator('button:has-text("Break it into subtasks")').click()
  await page.fill('#subtasks-write', '- Read the brief again\n- Outline in 5 bullets\n- Write the first draft')
  await page.click('role=dialog >> button:has-text("Add subtasks")')
  await page.waitForSelector('role=dialog >> text=Subtasks')
  await page.locator('role=dialog >> .subtask-list input[type=checkbox]').first().check()
  await page.waitForTimeout(500)
  await page.keyboard.press('Escape')
  check('subtask progress shows on the card', (await draft.locator('.subtask-progress').innerText()).replace(/\s+/g, ' ').includes('1 of 3 subtasks 33%'))
  await page.locator('article', { hasText: 'Interview users' }).locator('h2 button').click()
  await page.click('role=dialog >> text=Add several at once, or paste from your AI')
  await page.click('role=tab[name="Paste from your AI"]')
  await page.fill('#subtasks-paste', 'Here you go:\n```json\n{ "format": "epms-subtasks", "version": 1, "task": "Interview users", "subtasks": [{ "title": "Write 6 questions" }, { "title": "Book two slots" }] }\n```')
  check('AI subtasks preview', (await page.locator('ol[aria-label="Preview"] li').count()) === 2)
  await page.click('role=dialog >> button:has-text("Add subtasks")')
  await page.waitForSelector('role=dialog >> text=Write 6 questions')
  await page.keyboard.press('Escape')
  memberPage = page
}

// PM
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  watch(page)
  await page.goto(`${APP}pm.html`)
  await page.fill('input[type=email]', EMAIL)
  await page.fill('input[type=password]', PASSWORD)
  await page.click('button[type=submit]')
  await page.waitForSelector('h1:text-is("Board")')
  await page.click('header .select-btn')
  await page.locator('role=menuitem', { hasText: name }).click()
  await page.waitForSelector('section[aria-label="Review"] >> text=Draft the conclusion')
  await page.locator('article', { hasText: 'Find sources' }).locator('button:has-text("Approve")').click()
  await page.waitForTimeout(500)
  check('approve moves to Done', (await page.locator('section[aria-label="Done"] >> text=Find sources').count()) === 1)
  check('blocker clears when the blocking task is Done', (await page.locator('article', { hasText: 'Write the intro' }).locator('.tcard-blocked').count()) === 0)
  await page.locator('article', { hasText: 'Draft the conclusion' }).locator('button:has-text("Send back")').click()
  await page.fill('role=dialog >> textarea', 'Shorter, please.')
  await page.click('button:has-text("Send back to In progress")')
  await page.waitForTimeout(500)
  check('send back returns to In progress', (await page.locator('section[aria-label="In progress"] >> text=Draft the conclusion').count()) === 1)

  check('PM sees subtask progress on the board', (await page.locator('article', { hasText: 'Write the intro' }).locator('.subtask-progress').innerText()).replace(/\s+/g, ' ').includes('1 of 3 subtasks 33%'))
  check('custom blocker shows on the board', (await page.locator('article', { hasText: 'Interview users' }).innerText()).includes('Blocked: Waiting for interview slots'))

  // One-tap Behind, then one chat update for the whole session
  await page.locator('article', { hasText: 'Write the intro' }).locator('button:has-text("Mark behind")').click()
  await page.fill('role=dialog >> input', 'Need this by Thursday')
  await page.click('role=dialog >> button:has-text("Mark behind")')
  await page.waitForTimeout(600)
  check('Behind tag and note on the card', (await page.locator('article', { hasText: 'Write the intro' }).innerText()).includes('Behind: Need this by Thursday'))
  await page.reload()
  await page.waitForSelector('text=since the last chat update')
  check('board reminds the PM to update the group', true)
  await page.click('button:has-text("Update the group")')
  const draft = await page.locator('#update-text').inputValue()
  check('summary lists approved, sent back and behind', draft.includes('Approved\n- Find sources') && draft.includes('Sent back for changes\n- Draft the conclusion') && draft.includes('Write the intro (Jimmy): Need this by Thursday'), draft)
  await page.click('button:has-text("Post to chat")')
  await page.waitForSelector('role=dialog', { state: 'detached' })
  check('one update posted to the chat as a Teams card', posted.length === 1 && posted[0].includes('AdaptiveCard') && posted[0].includes('Behind schedule'))
  await page.waitForTimeout(400)
  check('reminder clears after posting', (await page.locator('text=since the last chat update').count()) === 0)

  // The member's second visit shows what changed while they were away.
  await memberPage.reload()
  await memberPage.waitForSelector('text=Since your last visit')
  const since = await memberPage.locator('section[aria-label="Since your last visit"]').innerText()
  check('member sees behind with the note since their last visit', since.includes('marked Write the intro behind schedule: "Need this by Thursday"'), since)
  check('tab title counts the updates', /^\(\d+\) /.test(await memberPage.title()))

  // Reset and lock
  await page.click('header >> text=Project settings')
  await page.waitForSelector('text=Set up')
  const jimmyRow = page.locator('.list-item', { hasText: 'Jimmy' })
  await jimmyRow.locator('button:has-text("Reset")').click()
  await jimmyRow.locator('button.btn-danger:has-text("Reset")').click()
  await page.waitForTimeout(500)
  check('reset frees the name', (await (await fetch(`${PB}/api/gh/join/${project.id}`, { headers: { 'X-Group-Key': keys.member_key } })).json()).members.find((x) => x.name === 'Jimmy').claimed === false)
  await page.click('role=switch[name="Lock the group link"]')
  await page.waitForTimeout(400)
  check('locked group link refuses claims', (await claimApi(m.Jimmy)).status === 403)
  await page.click('header >> text=Back to board')

  // Import
  await page.click('header >> text=Import tasks')
  await page.fill('#import-text', 'Here you go:\n```json\n' + JSON.stringify({
    format: 'epms-tasks', version: 1,
    tasks: [
      { id: 'a', title: 'Collect data', owner: 'ala', due: day(6).slice(0, 10), description: 'Steps here.', subtasks: ['Export the survey', 'Clean it'] },
      { id: 'b', title: 'Make charts', owner: 'Newbie', blocked_by: ['a'] },
      { title: 'Write the intro', owner: 'Jimmy' },
    ],
  }) + '\n```')
  await page.click('button:has-text("Preview")')
  await page.click('button:has-text("Import 2 tasks")')
  await page.waitForSelector('role=dialog', { state: 'detached' })
  await page.waitForTimeout(400)
  const charts = await page.locator('article', { hasText: 'Make charts' }).innerText()
  check('import creates tasks, members and blockers', charts.includes('Newbie') && charts.includes('Blocked by Collect data'), charts)
  check('import adds subtasks', (await page.locator('article', { hasText: 'Collect data' }).locator('.subtask-progress').innerText()).includes('0 of 2 subtasks'))
  check('import skips duplicates', (await page.locator('article h3:text-is("Write the intro")').count()) === 1)
  await ctx.close()
}

await browser.close()
receiver.close()
check('no console errors', errors.length === 0, errors.join(' | '))

await pb.collection('projects').delete(project.id)
console.log(failures ? `\n${failures} failed` : '\nAll passed')
process.exit(failures ? 1 : 0)
