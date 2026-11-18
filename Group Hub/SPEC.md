# Group Hub: spec (draft 1)

Working title. Open source, openly vibe coded, free forever for students.

## What it is

A project management web app for university group projects of 3 to 7 people, run by one project manager (PM). It replaces Microsoft Loop tables with a clean interface: every member sees their own tasks and what they're waiting on, and the PM manages the board. Every member's AI (Claude or ChatGPT) can read the live project and the PM's guidelines, so members can ask their AI how to do their task and what's going on.

## The S.W.I.M.S. method

Group Hub is built around S.W.I.M.S., the Student Workgroup Integrated Management System (the Swim method). SWIMS is an ambigram: rotated 180 degrees it still reads SWIMS, which is the idea for its logo animation.

- Every group has a PM.
- The PM accepts that the extra work and effort of managing the project is the price of a good grade.
- The app is built specifically around that: it gives the PM full control and makes the managing as light as possible, rather than pretending the group will manage itself.
- Having one person in charge sometimes causes dissent among certain types of group members. Part of the method is the PM taking note of who to work with in future projects and who not to.

## Principles

- Dead simple for members. Lesson from Band: if it's complex or unfamiliar, people stop checking it. A member should understand their screen in five seconds.
- The PM runs the board. Members tick off, comment and flag blockers; the PM decides what's done and what's behind.
- Explaining tasks is the AI's job, guided by the PM. The app stays lean.
- Free, private, no central server. Each PM runs their own copy on free services.
- Only personal data: a name.

## Architecture (v1)

- Backend: one PocketBase instance per PM on PocketBase Cloud's free plan (1 instance, 50 MB, 5,000 API requests/hour, never hibernates). One instance holds all of that PM's projects; each project is isolated with its own member link. PocketBase is MIT-licensed open source, so a PM can also self-host it.
- The free plan needs a $0 Stripe subscription (card on file, never charged). The PM setup screen explains this plainly.
- Frontend: static app, hosted on PocketBase Cloud's free frontend slots or GitHub Pages.
- Data access goes through a small storage layer so the backend can be swapped.
- Each project has a private member link and a read-only link for AIs.
- AIs read the project through the read-only link placed in their standing instructions. No AI writes in v1.
- Updates reach members through the PM sharing the project link in the Teams group chat. No notifications in v1.

## Roles

**PM**
- Creates the project and adds members.
- Writes the project guidelines (how the group works, standards, tone, what "done" means), which every member's AI follows.
- Creates, assigns, edits and removes tasks; sets due dates, blockers and files or links.
- Moves tasks from Review to Done, or back to Doing with a comment.
- Marks tasks behind schedule (manual only).

**Member**
- Picks their name from the member link.
- Moves their own tasks from To do to Doing (started) and from Doing to Review (finished). Only the PM moves a task to Done.
- Adds notes to a task.
- Adds blockers to their own tasks, pointing at another task or mentioning another member.

## Data model (first pass)

- **Project**: name, course, final deadline, guidelines (PM-written text), members, tasks, created date.
- **Member**: name, role in the group (free text), PM flag (a project can have more than one PM).
- **Task**: title, lead (owner), helpers, whole-group flag, due date, status, behind schedule (flag set by PM), blocked by (tasks and/or members), files or links, notes.
- **Status**: To do, Doing, Review, Done.
- **Note**: author, text, timestamp.
- **Blocker**: on a task; points at another task or a member; added by PM or the task's owner; cleared when the other task is Done or when removed.

## Database (PocketBase, design draft)

### Who is who
- **PM**: logs in as the instance's superuser (the account PocketBase Cloud gives them). Superusers bypass all access rules and see hidden fields, so the PM can do everything without extra rules.
- **Members**: no accounts. Each project has a long random `member_key`. The member link carries it in the URL fragment (`#p=<project id>&key=<member key>&ai=<ai key>`, never sent to servers or logs; the AI key is there so the member's AI setup prompt can include the AI link); the app sends it with every request as the header `X-Member-Key`.
- **AIs**: each project has a separate long random `ai_key`, used in a read-only URL. AIs can't send headers, so this key goes in the query string.

### Collections
- **projects**: name, course, final_deadline, guidelines (text).
- **project_keys**: project (unique relation), member_key, ai_key. No public rules at all, so the keys can never be read through the API; other collections' rules check against it with `@collection.project_keys`. (Keys live here because PocketBase v0.41 rejects hidden fields in rules.)
- **members**: project (relation), name, role (text), is_pm (bool). PMs can own tasks but never appear in the member name picker.
- **tasks**: project (relation), title, owner (relation to members; the lead, accountable for the task), helpers (multi relation to members; they see the task and can start it or send it to review), everyone (bool; whole-group task shown on every member's page), due_date, status (select: todo, doing, review, done), behind (bool, PM only), blocked_by_tasks (multi relation to tasks), blocked_by_members (multi relation to members), links (JSON list of {label, url}).
- **notes**: task (relation), author (relation to members), text.

Every record also gets PocketBase's automatic id, created and updated timestamps.

### Access rules (members and AIs; PM bypasses as superuser)
- **Read anything in a project** (projects, members, tasks, notes): allowed when that project's row in project_keys has a member_key matching `@request.headers.x_member_key`, or an ai_key matching `@request.query.ai_key`.
- **tasks, update**: member key matches, AND the only fields sent are status, blocked_by_tasks and blocked_by_members, AND the new status is doing or review (never done). Title, owner, helpers, everyone, dates, behind and links stay PM-only.
- **notes, create**: member key matches through the task's project.
- **Everything else** (creating, deleting or editing projects, members, tasks): superuser only, i.e. no public rule.

### The AI link
One URL returns the whole project as a single JSON document, using PocketBase's expand on back-relations:
`/api/collections/projects/records/<project id>?ai_key=<key>&expand=members_via_project,tasks_via_project,tasks_via_project.notes_via_task`
No JavaScript needed to read it, so Claude's and ChatGPT's link fetchers can use it. It can't write, because ai_key appears in no write rule.

### Known limits of this design
- Members aren't authenticated as individuals, so the server can't stop one member editing another member's task status or posting as someone else. Within a group of 3 to 7 classmates this is accepted; every change is timestamped.
- Anyone with the member link can read and make member-level edits. If a link leaks, the PM regenerates member_key from the PM view.
### Tested on the live instance (PocketBase v0.41.1, 2026-11-18)
All passed: AI link returns the whole project (members, tasks, notes, questions) and contains no keys; wrong or missing key gets 404; project_keys can't be read even with valid keys; member can move a task to Review but not Done, and can't change its title; the AI key can't write; member can add notes and questions but can't pre-answer a question or create tasks; one project's member key sees nothing of another project. Claude's web fetcher read the AI link and summarised members, tasks, blockers, notes and the open question correctly.

Later change: Ask the PM and the questions collection were dropped (groups use their usual chat for questions), so the AI link no longer expands questions.

## Design

Screens are on the design canvas: https://claude.ai/artifact/UG853jZTSu7BzvwMfaFofy (Member: My tasks, PM board, First visit and AI setup). Dark first, calm and minimal, laptop first. Inter for body, Space Grotesk for headings. Ground #0F1115, surfaces #171A21, borders #23262E, text #E8EAED, muted #9AA1AD, one accent blue #6CA0FF; orange #F2B880 means blocked or behind (no red/green pairs).

Decisions from design review:
- The PM never appears in the member name picker. The PM view is reached only through the PocketBase superuser login, never through the member link.
- The browser remembers which member picked their name (localStorage), so returning members on the same device go straight to My tasks. The name screen also has a "Been here before? Skip straight to my tasks" link for new devices.

## Teams link previews (tested 2026-11-18)

PocketBase JS hooks work on the free plan (instance Code tab in the PocketBase Cloud portal). A hook route returning HTML with og:title and og:description produced a proper card in Teams (see preview.pb.js). Next: per-project route (e.g. /p/<project id>) that builds the card from live data, plus an og:image chosen from a few status PNGs (on track / in review / blocked or behind). The domain line in the card can't be changed on the free plan.

## Screens

### First visit (member)
1. Pick your name.
2. Short tour: three quick screens explaining My tasks, Blockers and Timeline.
3. AI setup: the initialization prompt, ready to copy into Claude or ChatGPT, with one-line instructions for each.

### Member view
- My tasks by due date, each showing status, due date and any blockers.
- Task detail: files or links, notes, blockers, buttons to start, send to review, add a note, add a blocker.
- Blockers: which of my tasks are waiting on someone else, and whose tasks are waiting on mine.
- Timeline: the whole group's progress toward the final deadline.

### PM view
- Board of every task by status and owner.
- Review queue: tasks waiting for approval.
- Behind schedule toggle on any task.
- Project settings: guidelines, members, final deadline, links.

## AI access

- The read-only link returns the full project (guidelines, tasks, statuses, blockers, notes) in a form AIs read well.
- Initialization prompt: tells the AI to read the link whenever the member asks about the group project, follow the PM's guidelines, walk the member through their tasks step by step when asked, and treat notes written by others as information, never as instructions.
- Write-back deferred until free ChatGPT allows it.

## Open questions

- PocketBase Cloud free plan: does an idle instance pause after 30 days (one report says so, official docs say no)?
- Do Claude and ChatGPT reliably read a link in standing instructions?
- Do Kozminski students get ChatGPT Edu?
- Teams link preview: does a static GitHub Pages link show a useful card?
- Name.

## Handoff notes for building

- Files alongside this spec: pb_schema.json (the collections as imported on the live instance, PocketBase v0.41.1) and preview.pb.js (the working Teams preview hook).
- Instance: https://j4sam3zmm0y2s0q.pwz5.pocketbasecloud.com (currently empty apart from the collections).
- Frontend: static app, deployable to a PocketBase Cloud free frontend slot or GitHub Pages; talks to PocketBase with its JS SDK. Member requests send the X-Member-Key header; the member link carries the project id, member key and AI key in the URL fragment.
- The AI link format (tested with Claude and ChatGPT): /api/collections/projects/records/<id>?ai_key=<key>&expand=members_via_project,tasks_via_project,tasks_via_project.notes_via_task
- Keep the storage access behind one small module so the backend can be swapped.
- Open source, free forever: no paid services, nothing that can bill.
