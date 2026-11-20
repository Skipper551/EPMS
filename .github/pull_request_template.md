## What this changes

<!-- One or two sentences, and the issue it closes if there is one (Closes #123). -->

## Why

<!-- The problem it solves for PMs or members. -->

## Checklist

- [ ] Version bumped in `app/package.json` (features: minor, fixes: patch) and an entry added to `CHANGELOG.md`
- [ ] `npm run test:e2e` passes, with new checks for this change
- [ ] `npm run test:onboarding` passes, if setup, login or links changed
- [ ] Schema or access rule changes are explained below, with checks of who can and can't do what
- [ ] Hook changes bump the hook's version in the file and in `app/src/lib/setup.ts`
- [ ] Task file format changes update the importer, the skill and `pb_hooks/ai.pb.js` together
- [ ] No paid services, tracking or new personal data
- [ ] No em dashes in text people see
- [ ] Screenshots added for interface changes

## Schema, rules and hooks

<!-- What changed and why, or "None". -->

## Screenshots

<!-- Before and after, for anything people see. -->
