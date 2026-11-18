// End-to-end check against a LOCAL PocketBase (npm run pb:dev) and the dev server
// (VITE_PB_URL=http://127.0.0.1:8090 npm run dev). Never point this at your live instance.
//
// Needs Playwright with Chromium:  npm i -D playwright && npx playwright install chromium
// Run:                             npm run test:e2e

import { createRequire } from 'node:module'
import PocketBase from 'pocketbase'

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

// ---------- seed a fresh project ----------

const pb = new PocketBase(PB)
pb.autoCancellation(false)
await pb.collection('_superusers').authWithPassword(EMAIL, PASSWORD)
const day = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) + ' 12:00:00.000Z' }
const name = `E2E ${Date.now()}`
const project = await pb.collection('projects').create({ name, course: 'Testing', final_deadline: day(20), guidelines: 'Be kind.', chat_url: 'https://example.com/chat' })
const keys = await pb.collection('project_keys').create({ project: project.id })
const m = {}
for (const [n, role, is_pm] of [['Pat', 'PM', true], ['Ala', 'Research', false], ['Jimmy', 'Writing', false]]) {
  m[n] = (await pb.collection('members').create({ project: project.id, name: n, role, is_pm })).id
}
const sources = await pb.collection('tasks').create({ project: project.id, title: 'Find sources', owner: m.Ala, due_date: day(2), status: 'review' })
await pb.collection('tasks').create({ project: project.id, title: 'Write the intro', owner: m.Jimmy, due_date: day(5), status: 'todo', blocked_by_tasks: [sources.id] })
await pb.collection('tasks').create({ project: project.id, title: 'Draft the conclusion', owner: m.Jimmy, due_date: day(8), status: 'todo' })
const pair = await pb.collection('tasks').create({ project: project.id, title: 'Interview users', owner: m.Ala, helpers: [m.Jimmy], due_date: day(6), status: 'todo' })
await pb.collection('tasks').create({ project: project.id, title: 'Rehearse', owner: m.Pat, everyone: true, due_date: day(15), status: 'todo' })
const memberLink = `${APP}#p=${project.id}&key=${keys.member_key}&ai=${keys.ai_key}`

// ---------- access rules ----------

const api = (path, init = {}) => fetch(`${PB}/api/collections/${path}`, init)
check('AI link reads the project without keys', (await api(`projects/records/${project.id}?ai_key=${keys.ai_key}`)).status === 200)
check('missing key gets 404', (await api(`projects/records/${project.id}`)).status === 404)
const patch = (id, body) => api(`tasks/records/${id}`, { method: 'PATCH', headers: { 'X-Member-Key': keys.member_key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
check('member cannot mark Done', (await patch(sources.id, { status: 'done' })).status !== 200)
check('member cannot rename a task', (await patch(sources.id, { title: 'x' })).status !== 200)
check('member cannot change helpers', (await patch(pair.id, { helpers: [] })).status !== 200)
check('member cannot set everyone', (await patch(pair.id, { everyone: true })).status !== 200)
const asMember = await api(`members/records/${m.Ala}`, { method: 'PATCH', headers: { 'X-Member-Key': keys.member_key, 'Content-Type': 'application/json' }, body: '{"is_pm":true}' })
check('member cannot set is_pm', asMember.status !== 200)

// ---------- browser ----------

const browser = await chromium.launch()
const errors = []
const watch = (page) => {
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()))
}

// Member
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await ctx.newPage()
  watch(page)
  let allKeyed = true
  page.on('request', (r) => { if (r.url().startsWith(PB) && !r.headers()['x-member-key']) allKeyed = false })
  await page.goto(memberLink)
  await page.waitForSelector('text=Which one is you?')
  const names = await page.locator('[role=radio]').allInnerTexts()
  check('name picker hides the PM', !names.some((n) => n.startsWith('Pat')) && names.length === 2, names.join())
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
  check('every member request sent X-Member-Key', allKeyed)
  await ctx.close()
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
  await page.click('button:has-text("Send back to Doing")')
  await page.waitForTimeout(500)
  check('send back returns to Doing', (await page.locator('section[aria-label="Doing"] >> text=Draft the conclusion').count()) === 1)

  // Import
  await page.click('header >> text=Import tasks')
  await page.fill('#import-text', 'Here you go:\n```json\n' + JSON.stringify({
    format: 'group-hub-tasks', version: 1,
    tasks: [
      { id: 'a', title: 'Collect data', owner: 'ala', due: day(6).slice(0, 10), description: 'Steps here.' },
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
  check('import skips duplicates', (await page.locator('article h3:text-is("Write the intro")').count()) === 1)
  await ctx.close()
}

await browser.close()
check('no console errors', errors.length === 0, errors.join(' | '))

await pb.collection('projects').delete(project.id)
console.log(failures ? `\n${failures} failed` : '\nAll passed')
process.exit(failures ? 1 : 0)
