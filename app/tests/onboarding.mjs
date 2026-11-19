// Onboarding check for the shared EPMS site (a build without VITE_PB_URL) against a brand-new PocketBase.
// Never point this at your live instance: it installs collections and creates a project.
//
// Needs:
//   - a fresh local PocketBase with a superuser and the hooks:
//       .pb/pocketbase superuser upsert fresh@example.com freshpassword123 --dir .pb/fresh --migrationsDir .pb/no-migrations
//       .pb/pocketbase serve --http 127.0.0.1:8091 --dir .pb/fresh --migrationsDir .pb/no-migrations --hooksDir ../pb_hooks
//   - the app without a default instance:  npx vite --port 5174   (with VITE_PB_URL unset)
// Run: node tests/onboarding.mjs

import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const APP = process.env.APP_SHARED_URL || 'http://localhost:5174/'
const PB = process.env.PB_FRESH_URL || '127.0.0.1:8091'
const EMAIL = process.env.PB_FRESH_EMAIL || 'fresh@example.com'
const PASSWORD = process.env.PB_FRESH_PASSWORD || 'freshpassword123'
if (!/127\.0\.0\.1|localhost/.test(PB)) {
  console.error('Refusing to run against a non-local PocketBase:', PB)
  process.exit(1)
}

let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail && !ok ? `: ${detail}` : ''}`)
  if (!ok) failures++
}

const browser = await chromium.launch()
const errors = []
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] })
const p = await ctx.newPage()
p.on('pageerror', (e) => errors.push(e.message))

await p.goto(APP)
await p.waitForSelector('text=Welcome to EPMS')
await p.click('a:has-text("Set up EPMS")')
await p.waitForSelector('h1:text-is("Set up EPMS for your group")')
check('start guide opens', true)
await p.click('text=I have an instance: log in')
await p.waitForSelector('text=Log in to your board')
check('login asks for the address', (await p.getByLabel('Your PocketBase address').inputValue()) === '')
await p.getByLabel('Your PocketBase address').fill('127.0.0.1:9')
await p.getByLabel('Superuser email').fill(EMAIL)
await p.getByLabel('Superuser password').fill(PASSWORD)
await p.click('button[type=submit]')
await p.waitForSelector('.error-box')
check('wrong address explained', (await p.locator('.error-box').innerText()).includes("There's no PocketBase instance"))
await p.getByLabel('Your PocketBase address').fill(PB)
await p.click('button[type=submit]')
await p.locator('text=Finish setting up your instance').or(p.locator('h1:text-is("Board")')).or(p.locator('text=Set up your first project')).first().waitFor()
if (await p.locator('text=Install collections').count()) {
  await p.click('text=Install collections')
  // With the hooks already in place, finishing the collections completes setup and EPMS moves on by itself.
  await p.locator('text=Your instance has every collection').or(p.locator('text=Set up your first project')).first().waitFor()
  check('collections install in one click', true)
}
if (await p.locator('text=Finish setting up your instance').count()) {
  await p.locator('button:has-text("Go to my board")').or(p.locator('button:has-text("Continue without hooks for now")')).first().click()
}
if (await p.locator('text=Set up your first project').count()) {
  await p.getByLabel('Project name').fill('Onboarding test')
  await p.getByLabel('Your name').fill('Pat')
  await p.getByLabel('Group members').fill('Ala, Research\nJimmy')
  await p.click('button:has-text("Create project")')
}
await p.waitForSelector('section[aria-label="Getting started"]')
check('checklist appears for a new project', true)
await p.locator('section[aria-label="Getting started"] >> button:has-text("Copy group link")').click()
await p.waitForTimeout(300)
const link = await p.evaluate(() => navigator.clipboard.readText())
check('group link carries the instance', /&pb=http%3A%2F%2F127\.0\.0\.1%3A\d+/.test(link), link)

const m = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
m.on('pageerror', (e) => errors.push(e.message))
await m.goto(link)
await m.waitForSelector('text=Which one is you?')
await m.click('[role=radio]:has-text("Ala")')
await m.fill('#pin', '2580')
await m.click('text=Skip the intro, go to my tasks')
await m.waitForSelector('h1:text-is("My tasks")')
check("member joins on the PM's instance through the shared site", (await m.locator('header').innerText()).includes('Hello Ala'))
await m.reload()
await m.waitForSelector('h1:text-is("My tasks")')
check('member stays signed in after reload', true)

await browser.close()
check('no script errors', errors.length === 0, errors.join(' | '))
console.log(failures ? `\n${failures} failed` : '\nAll passed')
process.exit(failures ? 1 : 0)
