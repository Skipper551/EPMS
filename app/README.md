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

The instance address is baked in at build time. It defaults to the address in `src/config.ts`; another PM builds their own copy with:

```bash
VITE_PB_URL=https://their-instance.example.com npm run build
```

## Version

The version at the bottom of every page comes from `version` in `package.json`. Bump it before each release, for example with `npm version patch` (0.1.0 to 0.1.1) or `npm version minor` (0.1.0 to 0.2.0).

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

## Tests

`tests/e2e.mjs` checks the access rules and drives the member page, the PM board and the import in a real browser, against the local instance only. It needs Playwright:

```bash
npm i -D playwright && npx playwright install chromium
```

```bash
npm run test:e2e
```
