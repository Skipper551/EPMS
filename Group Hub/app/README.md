# Group Hub frontend

Static web app for Group Hub (see `../SPEC.md`). Vite + Preact + TypeScript, talking to one PocketBase instance with the PocketBase JS SDK. No server of its own, nothing that can bill.

- `index.html` is the member page, opened from the member link.
- `pm.html` is the project manager (PM) page, reached only by logging in as a superuser of the instance.

## Run it locally

```bash
npm install
```

Start a local PocketBase with the schema imported (downloads PocketBase 0.41.1 into `.pb/` on first run; never touches your live instance):

```bash
npm run pb:dev
```

In a second terminal, seed the demo project from the design screens (prints its member link and AI link):

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

`dist/` is the whole app: plain HTML, JavaScript, CSS, fonts and the Claude skill zip, with relative paths, so it works from any folder. Upload the contents of `dist/` to a PocketBase Cloud frontend slot or GitHub Pages.

The instance address is baked in at build time. It defaults to the address in `src/config.ts`; another PM builds their own copy with:

```bash
VITE_PB_URL=https://their-instance.example.com npm run build
```

## How it fits together

- `src/data/store.ts` is the only file that talks to PocketBase. Replace it to swap the backend.
- One request loads a whole project (the same expand the AI link uses). Pages refresh when they come back into view, after every action, and every 60 seconds while visible, which keeps well under the free plan's 5,000 requests an hour.
- Member link: `index.html#p=<project id>&key=<member key>&ai=<AI key>`. Everything after `#` stays in the browser and never reaches a server or its logs. The member key goes on every request as `X-Member-Key`. The AI key is there so the member's AI setup prompt can include the read-only AI link, since members can't read `project_keys`.
- The browser remembers which name a member picked, per project, in localStorage, plus the projects opened on that device.
- PMs are member rows with `is_pm` set. They can own tasks and write notes, but never appear in the name picker. A project can have several PMs; each logs in with their own superuser account.

## Importing tasks from Claude

The PM board has **Import tasks**. Plan the tasks with Claude, then paste Claude's `group-hub-tasks` JSON (or upload the file). Group Hub shows a preview, matches owners by name, offers to add new members, skips tasks already on the board, links blockers, and adds each description as the task's first note.

The format and planning workflow live in the Claude skill at `../skills/group-hub-task-plan/SKILL.md`. After editing it, rebuild the downloadable zip:

```bash
npm run skill
```

## Tests

`tests/e2e.mjs` checks the access rules and drives the member page, the PM board and the import in a real browser, against the local instance only. It needs Playwright:

```bash
npm i -D playwright && npx playwright install chromium
```

```bash
npm run test:e2e
```
