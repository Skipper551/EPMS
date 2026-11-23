# Changelog

EPMS uses version numbers like 0.6.1. Every pull request that changes the app bumps it:

- **New features** bump the middle number (0.5.0 to 0.6.0).
- **Fixes and small changes** bump the last number (0.6.0 to 0.6.1).
- It stays at 0.x until the first public launch, which will be 1.0.0.

The footer of every page shows the version and the commit it was built from, for example "EPMS v0.6.1 · ebbf81d".

## 0.9.0
- Group tab: members can see where everyone is, with one card per person showing what they're working on, what's next, overdue, behind and blocked flags, what's waiting for review, steps ticked, and when they were last active. A name with open work and no activity for a week is highlighted. Tasks open read only, with notes. The PM gets the same view next to Board and Task view.

## 0.8.0
- Quick to-dos: small things anyone in the group can add, take and tick off, with no review, like booking a room or emailing the professor. They sit in a box beside the board and in the members' sidebar, and stay out of the plan, progress and updates. The PM can turn one into a full task. At most 30 open per project.
- Hooks: new `todos.pb.js`; `events.pb.js`, `subtasks.pb.js` and `ai.pb.js` updated. The setup check flags old copies.

## 0.7.1
- Guidelines can't be lost silently: after saving, EPMS checks the whole text was stored and says how much if not; unsaved changes are flagged, survive switching view or closing the tab, and leaving the page asks first.
- One subtask format everywhere: `{ "title": ... }` objects in the Paste from your AI placeholder, the import instructions and the task-plan skill, matching the AI link's guide. Plain strings still import.

## 0.7.0
- Task view for PMs: their own My tasks next to the Board (their tasks finish directly, no review), and "Viewing as" to preview any member's screen read only.

## 0.6.1 ([#9](https://github.com/Skipper551/EPMS/pull/9))
- The task-plan skill starts from the project's AI link, and asks for it if it hasn't been shared.
- "Copy instructions for Claude" includes the AI link.
- The footer shows the commit the site was built from; versions now follow pull requests.

## 0.6.0 ([#8](https://github.com/Skipper551/EPMS/pull/8))
- One shared EPMS site on GitHub Pages: PMs enter their PocketBase address at login, and links carry it.
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
- Renamed to EPMS and the Swim method; MIT licence; version in the footer.

## 0.1.0 ([#1](https://github.com/Skipper551/EPMS/pull/1))
- First version: PM board, member view, first visit and AI setup, task import from Claude.
