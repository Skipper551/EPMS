# EPMS frontend

Static web app for EPMS (see `../SPEC.md`). Vite + Preact + TypeScript, talking to one PocketBase instance with the PocketBase JS SDK. No server of its own, nothing that can bill.

- `index.html` is the member page, opened from the group link or a personal link.
- `pm.html` is the project manager (PM) page, reached only by logging in as a superuser of the instance.

## Run it locally

```bash
npm install
```

Start a local PocketBase with the schema imported (downloads PocketBase 0.41.1 into `.pb/` on first run; never touches your live instance):

```bash
npm run pb:dev
```

In a second terminal, seed the demo project from the design screens (prints its group link and AI link):

```bash
node scripts/seed-demo.mjs
```

Then run the app against the local instance:

```bash
VITE_PB_URL=http://127.0.0.1:8090 npm run dev
```

PM page: http://localhost:5173/pm.html, log in with `pm@example.com` / `devpassword123`.

## Build and deploy

```bash
npm run build
```

`dist/` is the whole app: plain HTML, JavaScript, CSS, fonts and the Claude skill zip, with relative paths, so it works from any folder. Upload the contents of `dist/` to a PocketBase Cloud frontend slot or GitHub Pages. The instance also needs the collections in `../pb_schema.json` and the files in `../pb_hooks/`, including its `epms` folder (PocketBase Cloud: the instance's Code tab).

A build without `VITE_PB_URL` is the shared site: the PM enters their instance address on the login screen, and links carry it after `#`. GitHub Actions publishes that build to GitHub Pages from `main` (`.github/workflows/pages.yml`; turn on Pages with Source: GitHub Actions in the repository settings). To give a copy a default instance instead:

```bash
VITE_PB_URL=https://their-instance.example.com npm run build
```

## Version

The version comes from `version` in `package.json`; the footer shows it with the short commit the build came from (`GITHUB_SHA` in GitHub Actions, otherwise `git rev-parse`). Every pull request that changes the app bumps it and adds an entry to `../CHANGELOG.md`: features bump the middle number (`npm version minor`), fixes the last (`npm version patch`).

## How it fits together

- `src/data/store.ts` is the only file that talks to PocketBase. Replace it to swap the backend.
- One request loads a whole project (the same expand the AI link uses). Pages refresh when they come back into view, after every action, and every 60 seconds while visible, which keeps well under the free plan's 5,000 requests an hour.
- Group link: `index.html#p=<project id>&key=<group key>`. The PM posts it in the group chat. It is only good for picking a name, through the routes in `../pb_hooks/claim.pb.js`.
- Picking a name creates that member's personal key. The device then uses the personal link `index.html#p=<project id>&m=<member id>&me=<personal key>&ai=<AI key>` and sends the personal key on every request as `X-Member-Key`. A name that's set up can't be picked again; the PM can reset it or send a personal link from Project settings, and lock the group link once everyone has joined.
- Everything after `#` stays in the browser and never reaches a server or its logs. The AI key is there for the member's AI setup prompt.
- The browser remembers which member it's signed in as, per project, in localStorage.
- PMs are member rows with `is_pm` set. They can own tasks and write notes, but never appear in the name picker. A project can have several PMs; each logs in with their own superuser account.

## Importing tasks from Claude

The PM board has **Import tasks**. Plan the tasks with Claude, then paste Claude's `epms-tasks` JSON (or upload the file). EPMS shows a preview, matches owners by name, offers to add new members, skips tasks already on the board, links blockers, and adds each description as the task's first note.

The format and planning workflow live in the Claude skill at `../skills/epms-task-plan/SKILL.md`. After editing it, rebuild the downloadable zip:

```bash
npm run skill
```

## Setup check and hook versions

After login, EPMS compares the instance with `../pb_schema.json` (bundled into the app) and asks each hook file for its version at `/api/gh/hooks/<name>`. Missing or older collections install in one click; missing or older hooks are offered as `public/epms-hooks.zip` (built by `npm run hooks`, and by every `npm run build`). When you change a hook file, bump its version string in the file and in `src/lib/setup.ts`, so PMs with the old copy are told to update.

## Tests

`tests/e2e.mjs` checks the access rules and drives the member page, the PM board and the import in a real browser, against the local instance only. It needs Playwright:

```bash
npm i -D playwright && npx playwright install chromium
```

```bash
npm run test:e2e
```

`tests/onboarding.mjs` checks the shared-site path end to end: start guide, login with an address, one-click collections, the Getting started checklist, and a member joining through a link that carries the instance. It needs a fresh local PocketBase and a build without `VITE_PB_URL`; the steps are at the top of the file.

```bash
npm run test:onboarding
```
