# Changelog

SPMS uses version numbers like 0.6.1. Every pull request that changes the app bumps it:

- **New features** bump the middle number (0.5.0 to 0.6.0).
- **Fixes and small changes** bump the last number (0.6.0 to 0.6.1).
- It stays at 0.x until the first public launch, which will be 1.0.0.

The footer of every page shows the version and the commit it was built from, for example "SPMS v0.6.1 · ebbf81d".

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
