# Contributing to EPMS

Thanks for helping. EPMS is a free project management app for university group projects, built around the Swim method: one PM runs the board and everyone else does their tasks. Read [SPEC.md](SPEC.md) first; it explains the method, the data model and why things are the way they are.

By taking part you agree to the [code of conduct](CODE_OF_CONDUCT.md). Report security problems privately, as described in [SECURITY.md](SECURITY.md).

## Ways to help

- **Report a bug or suggest a feature** with the issue templates. Include the version from the bottom of the page.
- **Improve the app, hooks or skill** with a pull request. For anything bigger than a small fix, open an issue first so we can agree on the approach.
- **Improve the docs**: README, SPEC, this guide, or the setup guide in the app.

## Ground rules

These keep EPMS what it is. Pull requests that break them won't be merged.

1. **Free forever.** No paid services, and nothing that can bill. Everything must run on PocketBase's free tier and static hosting.
2. **Private by default.** The only personal data is a name. No tracking, analytics, emails or third-party calls with project data.
3. **Simple for members.** A member should understand their screen in five seconds. New features go to the PM first.
4. **One storage module.** Only `app/src/data/store.ts` talks to PocketBase, so the backend can be swapped.
5. **Explain schema and rule changes.** Any change to `pb_schema.json` or the access rules says why in the pull request, and comes with tests of who can and can't do what.
6. **Plain punctuation in the interface.** No em dashes in any text people see.

## Getting set up

Everything you need is in [app/README.md](app/README.md). In short:

```bash
cd app
npm install
npm run pb:dev
```

Then, in a second terminal:

```bash
cd app
VITE_PB_URL=http://127.0.0.1:8090 npm run dev
```

`npm run pb:dev` starts a local PocketBase with the schema and hooks. Never test against someone's live instance.

## Making a change

1. **Branch** from `main`.
2. **Keep it focused**: one feature or fix per pull request.
3. **Test it.** Run the end-to-end test, and add checks for what you changed:
   ```bash
   cd app
   npm run test:e2e
   ```
   Changes to setup or links should also pass `npm run test:onboarding` (see the top of `app/tests/onboarding.mjs`).
4. **Bump the version** in `app/package.json` and add an entry to [CHANGELOG.md](CHANGELOG.md): new features bump the middle number (`npm version minor`), fixes and small changes the last (`npm version patch`).
5. **Changed a hook?** Bump its version string in the hook file and in `app/src/lib/setup.ts`, so the setup check tells PMs to update.
6. **Changed the task file format?** Update the importer (`app/src/lib/importPlan.ts`), the skill (`skills/epms-task-plan/SKILL.md` and `example.json`) and the AI link's guide (`pb_hooks/ai.pb.js`) together, and run `npm run skill`.
7. **Open a pull request** and fill in the template.

## Code style

- TypeScript and Preact, no extra UI framework. Plain CSS with the colour tokens in `app/src/styles/app.css`.
- Real buttons and labels, keyboard friendly, usable on a phone.
- Messages say what happened and what to do next, in plain words.
- Comments explain why, not what.

## Licence

EPMS is MIT licensed. By contributing, you agree your work is released under the same [licence](LICENSE).
