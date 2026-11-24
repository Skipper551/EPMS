# Security policy

SPMS holds group projects: names, tasks, notes and the keys that link members to them. If you find a way to read or change a project you shouldn't be able to, act as another member, or get at a PM's instance, please tell us privately first.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting: open the repository's **Security** tab and choose **Report a vulnerability**. Only the maintainer sees the report.

Please don't open a public issue, pull request or discussion about a vulnerability until it has been fixed.

A useful report says:
- what an attacker could do, and what they need first (a group link, a personal link, the AI link, nothing);
- the steps to reproduce it, against your own local PocketBase (see `app/README.md`), never someone else's instance;
- the SPMS version (bottom of every page) and PocketBase version.

You'll get a reply within a week. Once it's fixed, the fix is released in a new version and noted in `CHANGELOG.md`, with credit if you'd like it.

## Supported versions

Only the latest version on `main` (the shared site at https://skipper551.github.io/EPMS/) receives fixes. PMs running their own copy should update the app and their instance's collections and hooks when a security fix is released; the setup check after login flags outdated ones.

## What's in scope

- The access rules in `pb_schema.json` and the server hooks in `pb_hooks/`.
- The app in `app/`: links, keys, PINs, local storage, and anything that sends data somewhere.
- The task-plan skill in `skills/`, where it handles project data.

Out of scope: PocketBase itself (report to [PocketBase](https://github.com/pocketbase/pocketbase/security)), PocketBase Cloud, GitHub Pages, and attacks that need someone's unlocked device or superuser password.

## Known limits by design

These are documented in `SPEC.md` and aren't vulnerabilities on their own:
- Anyone holding a member's personal link acts as that member; the PM can reset it.
- A 4-digit PIN is protected by the 15 minute lock after 5 wrong tries, not by its length.
- Anyone holding the AI link can read the whole project, read only; the PM can make a new one.
