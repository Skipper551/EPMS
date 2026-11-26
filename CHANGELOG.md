# Changelog

SPMS uses version numbers like 0.6.1. Every pull request that changes the app bumps it:

- **New features** bump the middle number (0.5.0 to 0.6.0).
- **Fixes and small changes** bump the last number (0.6.0 to 0.6.1).
- It stays at 0.x until the first public launch, which will be 1.0.0.

The footer of every page shows the version and the commit it was built from, for example "SPMS v0.6.1 · ebbf81d".

## 0.16.3
- Board cards: the start and due dates no longer slide under the assignee's avatar on narrow cards. The avatars keep their size, and when the name and dates don't fit on one line the dates move to a second line.

## 0.16.2
- Board cards: the tags next to a task title (Everyone, Urgent, No lead, Behind) now stack in a column, with Everyone on top and the priority under it, instead of sitting side by side. On phones the side-by-side tags left long titles only a few letters wide.

## 0.16.1
- Setup guide: the Claude, ChatGPT and Copy prompt buttons are now small chips with the Claude and ChatGPT logos, placed above the first setup step.

## 0.16.0
- Setup guide: the "Set up SPMS for your group" page has Open in Claude and Open in ChatGPT buttons. Each opens a new chat already holding the setup steps, so the AI walks the PM through PocketBase Cloud, logging in, collections and hooks one step at a time. Copy the prompt pastes it anywhere else.

## 0.15.0
- Wrap up project: when the project is over, the PM chooses "Wrap up project" (project menu or Project settings) and sets a retrospective due date (3 days by default). Every open task is closed (the archive remembers which ones were still open), the board and project become read-only for everyone, and the group chat gets a message that the retrospective is open.
- Retrospective: everyone, the PM included, can review everyone else. Three scores from -2 to +2 (overall, quality of work, punctuality), with 0 meaning "not enough to say": you didn't work with them enough or see enough of their work. The quality step lists the person's tasks, each with a "Commend" button (with a small burst of confetti) for work that was really well done. PMs are also scored on organization, communication and fair task distribution. An optional comment is anonymous unless the reviewer chooses to show their name. Reviewing is optional (a skipped review counts as 0), everything is submitted once at the end, and it can't be changed afterwards. Drafts are kept on the device until then.
- Privacy: individual scores are never stored. Each submission is added straight into running totals per person, and anonymous comments are saved with no author and no timestamp. Members and the PM only ever get their own totals back, and only once the project is archived; the PM's app can only read feedback about PMs. None of the new collections can be read through the API.
- Ending: the retrospective ends as soon as everyone has submitted, or at the due date. A reminder goes to the group chat a day before, naming who hasn't finished, and a last message says the project is being archived.
- Archive: archived projects move to the bottom of the PM's project list with an "Archived" tag and stay open to every member. Each person sees their average scores with a fixed summary per score (for example "You were a bit behind schedule. You can improve next time."), how many teammates commended each of their tasks, the comments they got, and how the work was divided across the group.
- New hook file: `retro.pb.js` (with `epms/retro.js`, runs a check every 10 minutes). Hook updates: `todos.pb.js` (via `epms/todos.js`) and `ai.pb.js`. Collection update: `projects` gains `phase`, `retro_due`, `wrapped_at` and `archived_at`; `tasks` gains `closed_from`; `project_keys` gains `retro_reminded`; new `retro_submissions`, `retro_results` and `retro_comments`. The setup check asks live instances to upload the new hooks zip and update the collections.
- Tests: `npm run test:retro` checks the privacy rules, the read-only lock, the reminder and both ways of ending against a local PocketBase.

## 0.14.0
- Task priority: every task is Low, Normal, High or Urgent. The PM sets it in the task editor, and the task's lead can change it from the task details (helpers can't). Normal shows nothing, so tags only appear on tasks that stand out: a solid orange "Urgent", an outlined "High" and a quiet "Low", on the board, My tasks, task details and the Group tab. Urgent cards on the board also get an orange edge.
- Sorting: board columns, My tasks and the Group tab's "Up next" put urgent and high tasks first, then sort by due date. My tasks' summary line says how many urgent tasks you have, for example "4 tasks · 1 urgent · next due Thu 26 Nov".
- Updates: changing a task's priority shows under "Since your last visit" for its lead and helpers ("Pat marked Find 5 sources urgent").
- Import: task files take an optional `"priority"` (`low`, `normal`, `high`, `urgent`); the import preview shows it, and the Claude instructions and the task plan skill explain when to use it. The AI link's guide tells members' AIs to work on urgent and high tasks first.
- Existing tasks keep working: tasks saved before this have no priority and count as Normal.
- Hook update: `events.pb.js` (via `epms/events.js`), `todos.pb.js` (via `epms/todos.js`, to-dos never have a priority) and `ai.pb.js`. Collection update: `tasks` gains `priority`, and the access rule lets only the lead (or the PM) change it. The setup check asks live instances to upload the new hooks zip and update the collections.

## 0.13.0
- Review alerts: the PM can add an optional webhook in Project settings and get a short message (the task, who sent it, the project) whenever a member sends a task to review. Moving a task to Review yourself doesn't send one. Works with Discord, Slack, Teams Workflows, or any address that takes a JSON post, and has a "Send a test message" button. At most one alert per task every 10 minutes, and a failed alert never stops the member's submit. The address is stored with the project's private keys, so members and AIs can't see it.
- Hook update: `events.pb.js` (new `epms/review.js` helper). Collection update: `project_keys` gains `review_webhook`. The setup check asks live instances to upload the new hooks zip and update the collections.

## 0.12.0
- Clearer task leads. Every task has one lead who is accountable for it, and the app now says so everywhere:
  - My tasks: tasks you lead get a solid "You lead" tag and a blue edge down the left side; tasks you help on get a "Helping" tag and say "Led by Ola, you're helping". Your own lead tasks list your helpers as "Kuba helps you".
  - Task details: a box at the top says who is accountable, for example "You lead this task. You are accountable for getting it done: you start it, keep your helpers in the loop and send it to review", or "Ola leads this task and is accountable for it. You are helping".
  - PM board: the lead's face has a blue ring and is shown first, with "Ola leads +2" beside it (the full list on hover). A task with helpers but no lead gets a "No lead" tag.
  - Group tab: each person shows how many tasks they lead, and tasks they only help on say "Helping Ola".
  - Chat summaries and the import preview say "Ala leads" or "Ala leads, with Kuba".
- Phones: the tags on a My tasks card (You lead, Helping, Behind, status) sit on their own line above the title, so the title keeps the full width.
- Frontend only, no hook or collection changes, nothing stored changes.

## 0.11.4
- Footer: every page now says "Have an idea? You can suggest it here", where "here" opens the Ideas category of the project's GitHub Discussions in a new tab. Frontend only.

## 0.11.3
- Phones: the PM board scrolls left and right like on a computer, one column per swipe, with the next column peeking in so you can see there is more. It snaps to each column and the rest of the page stays still.
- Phones: tidier header. The logo and project menu sit on one line, the views (Board, Task view, Group or My tasks, Group) become one full-width switch, and the PM's buttons form an even two by two grid with New task first. Every button is at least 44px tall for easy tapping. Computers and tablets look exactly as before. Frontend only, no hook or collection changes.

## 0.11.2
- New logo: three group members joined together, with the PM highlighted in the app's blue. Shown next to "SPMS" in every page header, as the browser tab icon, and as the home-screen icon on iPhone and iPad (`apple-touch-icon.png`). Frontend only, no hook or collection changes.

## 0.11.1
- Phones: the PM board shows one column again instead of four side by side, and the page no longer scrolls sideways (broken since the quick to-dos box arrived in 0.8.0).
- Phones: text boxes use 16px text, so iPhone Safari no longer zooms the page in when you tap into one. Frontend only, no hook or collection changes.

## 0.11.0
- Renamed to SPMS, the Student Project Management System (previously EPMS, Educational Project Management Software): page titles, headings, the member welcome, the AI link's guide, the Claude skill (now `spms-task-plan`, downloaded as `spms-task-plan.zip`), the hooks download (`spms-hooks.zip`) and the docs.
- Kept unchanged so nothing breaks: the task file formats (`epms-tasks`, `epms-subtasks`), the AI link's `epms_ai_guide` field, the PIN hash salt, saved browser settings (`epms:` keys), the hooks' `epms` folder, the GitHub repository and the shared site address (skipper551.github.io/EPMS).
- Hook update: `ai.pb.js` (its guide now names SPMS). No collection changes.

## 0.10.0
- Take back from review: the lead or a helper can pull a task back from Review to In progress until the PM approves it, from the task card or the task's details. It shows in "Since your last visit" as taken back, not as sent back by the PM.
- The AI instructions are always one click away: "Show my AI instructions" under My tasks (as well as Set up my AI in the menu), and PMs get their own copy from Task view. Frontend only, no hook or collection changes.

## 0.9.1
- The `app` folder builds on its own, so PocketBase Cloud frontends that build from the repository work again. The setup check's schema now comes from a committed copy in `app/src/generated/`, which every full-repository build refreshes, and the hooks and skill zips fall back to their committed copies.

## 0.9.0
- Group tab: members can see where everyone is, with one card per person showing what they're working on, what's next, overdue, behind and blocked flags, what's waiting for review, steps ticked, and when they were last active. A name with open work and no activity for a week is highlighted. Tasks open read only, with notes. The PM gets the same view next to Board and Task view.

## 0.8.0
- Quick to-dos: small things anyone in the group can add, take and tick off, with no review, like booking a room or emailing the professor. They sit in a box beside the board and in the members' sidebar, and stay out of the plan, progress and updates. The PM can turn one into a full task. At most 30 open per project.
- Hooks: new `todos.pb.js`; `events.pb.js`, `subtasks.pb.js` and `ai.pb.js` updated. The setup check flags old copies.

## 0.7.1
- Guidelines can't be lost silently: after saving, SPMS checks the whole text was stored and says how much if not; unsaved changes are flagged, survive switching view or closing the tab, and leaving the page asks first.
- One subtask format everywhere: `{ "title": ... }` objects in the Paste from your AI placeholder, the import instructions and the task-plan skill, matching the AI link's guide. Plain strings still import.

## 0.7.0
- Task view for PMs: their own My tasks next to the Board (their tasks finish directly, no review), and "Viewing as" to preview any member's screen read only.

## 0.6.1 ([#9](https://github.com/Skipper551/EPMS/pull/9))
- The task-plan skill starts from the project's AI link, and asks for it if it hasn't been shared.
- "Copy instructions for Claude" includes the AI link.
- The footer shows the commit the site was built from; versions now follow pull requests.

## 0.6.0 ([#8](https://github.com/Skipper551/EPMS/pull/8))
- One shared SPMS site on GitHub Pages: PMs enter their PocketBase address at login, and links carry it.
- Setup check after login: one-click collections, hooks download with steps, version checks.
- Getting started checklist on new boards, and a start page with a setup guide.
- Chat updates list what's due in the next 3 days.

## 0.5.0 ([#7](https://github.com/Skipper551/EPMS/pull/7))
- 4-digit PINs: sign in on another device without the PM.

## 0.4.1 ([#6](https://github.com/Skipper551/EPMS/pull/6))
- Clearer help for Teams webhook addresses without a signature.
- The AI link carries a guide, including the subtask format.

## 0.4.0 ([#5](https://github.com/Skipper551/EPMS/pull/5))
- Subtasks, written by hand or with your AI, with progress on cards.
- Task start dates, set by the PM or the task's lead; Coming up section.

## 0.3.1 ([#4](https://github.com/Skipper551/EPMS/pull/4))
- The Doing column is called In progress.

## 0.3.0 ([#3](https://github.com/Skipper551/EPMS/pull/3))
- Custom blockers, activity log, Since your last visit, one-tap Behind, chat updates to Teams, Discord or Slack.
- Many blockers show as a count that expands.

## 0.2.0 ([#2](https://github.com/Skipper551/EPMS/pull/2))
- Claim your name once with personal links; access rules check who you are.
- Lead, helpers and whole-group tasks; optional group chat link.
- Renamed to SPMS and the Swim method; MIT licence; version in the footer.

## 0.1.0 ([#1](https://github.com/Skipper551/EPMS/pull/1))
- First version: PM board, member view, first visit and AI setup, task import from Claude.
