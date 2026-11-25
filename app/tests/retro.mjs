// Retrospective and archive: API checks against a LOCAL PocketBase. Never point this at your live instance.
// Start PocketBase with SPMS_TEST_CLOCK=1 so the reminder and the due date can be tested without waiting:
//   SPMS_TEST_CLOCK=1 npm run pb:dev
// Run:  npm run test:retro
//
// The privacy rules checked here: nobody (members or the PM) can read individual scores or reviewer identity
// through the API; each person gets only their own totals, only after the project is archived; anonymous
// comments carry no author; the PM can only read feedback about PMs (themselves).

import PocketBase from 'pocketbase'
import http from 'node:http'

const PB = process.env.PB_URL || 'http://127.0.0.1:8090'
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

// Stand-in for the group chat webhook.
const posted = []
const receiver = http.createServer((req, res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { posted.push(JSON.parse(b)) } catch { posted.push({ raw: b }) } res.writeHead(202); res.end() }) })
await new Promise((r) => receiver.listen(0, '127.0.0.1', r))
const webhook = `http://127.0.0.1:${receiver.address().port}/chat`

const pb = new PocketBase(PB)
pb.autoCancellation(false)
await pb.collection('_superusers').authWithPassword(EMAIL, PASSWORD)
const su = { 'Content-Type': 'application/json', Authorization: pb.authStore.token }
const json = { 'Content-Type': 'application/json' }
const day = (n) => new Date(Date.now() + n * 86400000).toISOString()

async function seed(label) {
  const project = await pb.collection('projects').create({ name: `${label} ${Date.now()}`, course: 'Testing', guidelines: 'Be kind.' })
  const keys = await pb.collection('project_keys').create({ project: project.id, chat_webhook: webhook })
  const m = {}
  for (const [n, is_pm] of [['Pat', true], ['Ala', false], ['Jimmy', false], ['Kim', false]]) {
    m[n] = (await pb.collection('members').create({ project: project.id, name: n, role: '', is_pm })).id
  }
  const key = {}
  for (const n of ['Ala', 'Jimmy', 'Kim']) {
    const r = await fetch(`${PB}/api/gh/claim/${project.id}`, { method: 'POST', headers: { ...json, 'X-Group-Key': keys.member_key }, body: JSON.stringify({ member: m[n], pin: '1357' }) })
    key[n] = (await r.json()).key
  }
  return { project, keys, m, key }
}

const { project, m, key } = await seed('Retro')
const as = (n) => ({ ...json, 'X-Member-Key': key[n] })
const t = {}
t.sources = (await pb.collection('tasks').create({ project: project.id, title: 'Find sources', owner: m.Ala, status: 'done' })).id
t.intro = (await pb.collection('tasks').create({ project: project.id, title: 'Write the intro', owner: m.Jimmy, helpers: [m.Kim], status: 'doing' })).id
t.slides = (await pb.collection('tasks').create({ project: project.id, title: 'Slides', owner: m.Kim, status: 'review' })).id
t.plan = (await pb.collection('tasks').create({ project: project.id, title: 'Plan', owner: m.Pat, status: 'todo' })).id
t.todo = (await pb.collection('tasks').create({ project: project.id, title: 'Book a room', mini: true, status: 'todo' })).id

const retroUrl = `${PB}/api/gh/retro/${project.id}`
const getRetro = (headers, q = '') => fetch(retroUrl + q, { headers })
const submit = (headers, reviews, extra = {}) => fetch(`${retroUrl}/submit`, { method: 'POST', headers, body: JSON.stringify({ reviews, ...extra }) })
const start = (headers, due) => fetch(`${retroUrl}/start`, { method: 'POST', headers, body: JSON.stringify({ due }) })

// ---------- before wrap-up ----------

check('retrospective is closed before wrap-up', (await (await getRetro(as('Ala'))).json()).phase === '')
check('nobody can submit before wrap-up', (await submit(as('Ala'), [])).status === 400)
check('a member cannot wrap up the project', (await start(as('Ala'), day(3))).status === 401)
check('a member cannot set closed_from', (await fetch(`${PB}/api/collections/tasks/records/${t.intro}`, { method: 'PATCH', headers: as('Jimmy'), body: JSON.stringify({ closed_from: 'doing' }) })).status !== 200)
check('due date has to be in the future', (await start(su, day(-1))).status === 400)

// ---------- wrap up ----------

const started = await start(su, day(3))
const startBody = await started.json()
check('PM wraps up the project', started.status === 200, JSON.stringify(startBody))
check('open tasks are closed at wrap-up (including quick to-dos)', startBody.closed === 4, String(startBody.closed))
check('wrap-up message goes to the group chat', posted.some((p) => p.event === 'retro_opened'))
const closedIntro = await pb.collection('tasks').getOne(t.intro)
check('closed task remembers what it was', closedIntro.status === 'done' && closedIntro.closed_from === 'doing')
check('finished task is left alone', (await pb.collection('tasks').getOne(t.sources)).closed_from === '')
check('cannot wrap up twice', (await start(su, day(3))).status === 400)

// ---------- read-only ----------

check('member cannot move a task once wrapped up', (await fetch(`${PB}/api/collections/tasks/records/${t.intro}`, { method: 'PATCH', headers: as('Jimmy'), body: JSON.stringify({ status: 'review' }) })).status === 400)
check('member cannot add a note once wrapped up', (await fetch(`${PB}/api/collections/notes/records`, { method: 'POST', headers: as('Jimmy'), body: JSON.stringify({ task: t.intro, author: m.Jimmy, text: 'hi' }) })).status === 400)
check('PM cannot add a task once wrapped up', (await fetch(`${PB}/api/collections/tasks/records`, { method: 'POST', headers: su, body: JSON.stringify({ project: project.id, title: 'x', status: 'todo' }) })).status === 400)
check('PM cannot edit the project once wrapped up', (await fetch(`${PB}/api/collections/projects/records/${project.id}`, { method: 'PATCH', headers: su, body: JSON.stringify({ name: 'x' }) })).status === 400)
check('PM cannot remove a member once wrapped up', (await fetch(`${PB}/api/collections/members/records/${m.Kim}`, { method: 'DELETE', headers: su })).status === 400)
check('members still read the project', (await fetch(`${PB}/api/collections/projects/records/${project.id}`, { headers: as('Kim') })).status === 200)

// ---------- reviewing ----------

const r = (member, o = {}) => ({ member, overall: 0, quality: 0, punctuality: 0, commends: [], comment: '', anonymous: true, ...o })
check('cannot review yourself', (await submit(as('Ala'), [r(m.Ala)])).status === 400)
check('scores stop at +2', (await submit(as('Ala'), [r(m.Jimmy, { overall: 3 })])).status === 400)
check("cannot commend a task the person didn't work on", (await submit(as('Ala'), [r(m.Jimmy, { commends: [t.slides] })])).status === 400)
check('nothing was saved by the refused tries', (await (await getRetro(as('Ala'))).json()).submitted === false)

const alaReviews = [
  r(m.Jimmy, { overall: 2, quality: 1, punctuality: -2, commends: [t.intro], comment: 'Great intro, a bit late.', anonymous: true }),
  r(m.Kim, { overall: 1, quality: 2, punctuality: 1, commends: [t.intro, t.slides], comment: 'Lovely slides.', anonymous: false }),
  r(m.Pat, { overall: 1, quality: 1, punctuality: 2, organization: 2, communication: -1, fairness: 1 }),
]
check('Ala submits', (await submit(as('Ala'), alaReviews)).status === 200)
check('a second submission is refused', (await submit(as('Ala'), [r(m.Jimmy, { overall: -2 })])).status === 400)
const during = await (await getRetro(as('Ala'))).json()
check('no results while the retrospective is open', during.results === null && during.submitted === true && during.done === 1 && during.total === 4)

// The PM acts only as a PM member.
check('PM cannot submit as a non-PM member', (await submit(su, [r(m.Jimmy)], { as: m.Ala })).status === 403)
check('PM cannot read as a non-PM member', (await getRetro(su, `?as=${m.Jimmy}`)).status === 403)
check('PM submits as themselves', (await submit(su, [r(m.Jimmy, { overall: 1, quality: 1, punctuality: 1 }), r(m.Kim, { overall: 2 }), r(m.Ala, { overall: 2, quality: 2 })], { as: m.Pat })).status === 200)
check('Jimmy submits', (await submit(as('Jimmy'), [r(m.Kim, { overall: 1, commends: [t.slides] }), r(m.Pat, { overall: 2, organization: 1 })])).status === 200)

// ---------- nothing private reachable through the API ----------

for (const c of ['retro_results', 'retro_comments', 'retro_submissions']) {
  check(`members cannot list ${c}`, (await fetch(`${PB}/api/collections/${c}/records`, { headers: as('Jimmy') })).status !== 200)
  check(`AI link cannot list ${c}`, (await fetch(`${PB}/api/collections/${c}/records?ai_key=x`)).status !== 200)
}
const results = await pb.collection('retro_results').getFullList({ filter: `project = "${project.id}"` })
check('stored totals carry no reviewer', results.every((row) => !('reviewer' in row) && !('author' in row)))
const storedComments = await pb.collection('retro_comments').getFullList({ filter: `project = "${project.id}"` })
check('anonymous comment is stored without an author', storedComments.find((c) => c.text.startsWith('Great intro')).author === '')
check('stored comments have no timestamps', storedComments.every((c) => !c.created))

// ---------- ends early once everyone has submitted ----------

check('Kim submits last', (await submit(as('Kim'), [r(m.Jimmy, { overall: -1, punctuality: -1 })])).status === 200)
check('project is archived once everyone has submitted', (await pb.collection('projects').getOne(project.id)).phase === 'archived')
check('archive message goes to the group chat', posted.some((p) => p.event === 'project_archived'))

// ---------- what each person sees ----------

const jimmy = await (await getRetro(as('Jimmy'))).json()
const res = jimmy.results
check('Jimmy gets results once archived', !!res)
// Teammates are Pat, Ala, Kim: overall 2 + 1 + -1 = 2, over 3 teammates.
check('averages count every teammate, a skipped review as 0', res.averages.overall === 0.67 && res.averages.punctuality === -0.67, JSON.stringify(res.averages))
check('non-PM gets no PM scores', !('organization' in res.averages))
check('commend counts per task', res.commends.find((c) => c.task === t.intro)?.count === 1)
check('anonymous comment shows no author', res.comments.length === 1 && res.comments[0].author === '')
const raw = JSON.stringify(jimmy)
check("Jimmy's results never name a reviewer", !raw.includes(m.Ala) && !raw.includes('"Ala"') && !raw.includes(m.Kim) && !raw.includes(m.Pat))
check("Jimmy's results hold only Jimmy's feedback", !raw.includes('Lovely slides'))

const kim = (await (await getRetro(as('Kim'))).json()).results
check('named comment shows its author', kim.comments.some((c) => c.text === 'Lovely slides.' && c.author === 'Ala'))
check('a task is counted once per reviewer who commended it', kim.commends.find((c) => c.task === t.intro)?.count === 1 && kim.commends.find((c) => c.task === t.slides)?.count === 2)

const pat = (await (await getRetro(su, `?as=${m.Pat}`)).json()).results
check('PM gets their own results with the PM scores', pat && pat.averages.organization === 1 && pat.averages.communication === -0.33, JSON.stringify(pat?.averages))
check('PM still cannot read anyone else', (await getRetro(su, `?as=${m.Kim}`)).status === 403)
check('no reviews after the end', (await submit(as('Ala'), [])).status === 400)
check('archived project stays read-only', (await fetch(`${PB}/api/collections/tasks/records/${t.plan}`, { method: 'PATCH', headers: su, body: JSON.stringify({ title: 'y' }) })).status === 400)

// ---------- reminder and due date (needs SPMS_TEST_CLOCK=1) ----------

const second = await seed('Retro clock')
await fetch(`${PB}/api/gh/retro/${second.project.id}/start`, { method: 'POST', headers: su, body: JSON.stringify({ due: day(3) }) })
await fetch(`${PB}/api/gh/retro/${second.project.id}/submit`, { method: 'POST', headers: { ...json, 'X-Member-Key': second.key.Ala }, body: JSON.stringify({ reviews: [] }) })
const tick = (at) => fetch(`${PB}/api/gh/retro-check`, { method: 'POST', headers: su, body: JSON.stringify({ at }) })
check('members cannot run the check', (await fetch(`${PB}/api/gh/retro-check`, { method: 'POST', headers: { ...json, 'X-Member-Key': second.key.Ala } })).status === 401)
posted.length = 0
await tick(day(1))
check('no reminder two days out', !posted.some((p) => p.event === 'retro_reminder'))
await tick(day(2.5))
const reminder = posted.find((p) => p.event === 'retro_reminder')
if (!reminder) console.log('     (is PocketBase running with SPMS_TEST_CLOCK=1?)')
check('reminder a day before lists who has not submitted', !!reminder && reminder.pending.join() === 'Pat,Jimmy,Kim', JSON.stringify(reminder))
await tick(day(2.6))
check('reminder is sent once', posted.filter((p) => p.event === 'retro_reminder').length === 1)
await tick(day(3.1))
check('retrospective closes at the due date', (await pb.collection('projects').getOne(second.project.id)).phase === 'archived')
check('archive message when time runs out', posted.some((p) => p.event === 'project_archived'))

await pb.collection('projects').delete(project.id)
await pb.collection('projects').delete(second.project.id)
check('an archived project can still be deleted', true)

receiver.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nAll retrospective checks passed')
process.exit(failures ? 1 : 0)
