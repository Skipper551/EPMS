// Seeds the demo project from the design screens into a local PocketBase (development only).
// Prints the member link and AI link. Usage: node scripts/seed-demo.mjs [appBaseUrl]
import PocketBase from 'pocketbase'

const url = process.env.PB_URL || 'http://127.0.0.1:8090'
const appBase = process.argv[2] || 'http://localhost:5173/'
const pb = new PocketBase(url)
pb.autoCancellation(false)
await pb.collection('_superusers').authWithPassword(process.env.PB_EMAIL || 'pm@example.com', process.env.PB_PASSWORD || 'devpassword123')

const day = (offset) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10) + ' 12:00:00.000Z'
}

const project = await pb.collection('projects').create({
  name: 'Innovation Management · Group 2',
  course: 'Innovation Management',
  final_deadline: day(24),
  chat_url: 'https://teams.microsoft.com/',
  guidelines: 'APA 7 for all references. Keep your section under 600 words. Send things to review by Thursday evening so I can merge on Friday.',
})
const keys = await pb.collection('project_keys').create({ project: project.id })

const m = {}
for (const [name, role, is_pm] of [['Malcolm', 'PM', true], ['Ala', 'Research', false], ['Jimmy', 'Writing', false], ['Ola', 'Slides', false], ['Kuba', 'Survey', false]]) {
  m[name] = (await pb.collection('members').create({ project: project.id, name, role, is_pm })).id
}

const t = {}
const task = async (title, owner, due, status, extra = {}) => {
  t[title] = (await pb.collection('tasks').create({ project: project.id, title, owner: m[owner], due_date: day(due), status, ...extra })).id
}
await task('Split the brief into tasks', 'Malcolm', -9, 'done')
await task('Write project guidelines', 'Malcolm', -8, 'done')
await task('Pick the case company', 'Kuba', -6, 'done')
await task('Find 5 sources', 'Ala', 2, 'review')
await task('Survey questions', 'Kuba', 3, 'review')
await task('Competitor research', 'Ola', 2, 'doing', { behind: true, behind_note: 'Need this by Thursday' })
await task('Format the references list', 'Jimmy', 8, 'doing', { links: [{ label: 'References.docx', url: 'https://example.com/references' }] })
await task('Interview two users', 'Ala', 9, 'doing', { helpers: [m.Kuba], blocked_reason: 'Waiting for interview slots from the company' })
await task('Write the introduction', 'Jimmy', 12, 'todo', { blocked_by_tasks: [t['Find 5 sources']], links: [{ label: 'Report draft', url: 'https://example.com/draft' }] })
await task('Build the slides', 'Ola', 19, 'todo', { blocked_by_tasks: [t['Write the introduction']], start_date: day(12) })
await task('Draft the conclusion', 'Jimmy', 16, 'todo', { start_date: day(-1) })
await task('Rehearse the presentation', 'Malcolm', 22, 'todo', { everyone: true })

for (const [i, [title, done]] of [['List every source cited in the draft', true], ['Check each one has a DOI or URL', true], ['Format them in APA 7', false], ['Sort alphabetically', false], ['Ask Ala to double-check', false]].entries()) {
  await pb.collection('subtasks').create({ task: t['Format the references list'], title, done, order: i + 1 })
}
await pb.collection('notes').create({ task: t['Format the references list'], author: m.Ala, text: 'I added the DOIs for my five sources at the bottom of the doc.' })

console.log('Project:', project.id)
console.log('Group link:', `${appBase}#p=${project.id}&key=${keys.member_key}`)
console.log('AI link:', `${url}/api/collections/projects/records/${project.id}?ai_key=${keys.ai_key}&expand=members_via_project,tasks_via_project,tasks_via_project.notes_via_task`)
