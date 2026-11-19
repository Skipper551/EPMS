# Changelog

EPMS uses version numbers like 0.6.1. Every pull request that changes the app bumps it:

- **New features** bump the middle number (0.5.0 to 0.6.0).
- **Fixes and small changes** bump the last number (0.6.0 to 0.6.1).
- It stays at 0.x until the first public launch, which will be 1.0.0.

The footer of every page shows the version and the commit it was built from, for example "EPMS v0.6.1 · ebbf81d".

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
