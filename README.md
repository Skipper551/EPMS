# EPMS

**Educational Project Management Software** (name work in progress, previously Group Hub).

Free, open-source project management for university group projects of 3 to 7 people. Built around the **Swim method** (Swim Education Project Management Method, name work in progress): every group has one project manager (PM) who runs the board, and everyone else just does their tasks.

It replaces shared tables in Loop or Excel with a calm, simple app: each member sees their own tasks and what they're waiting on, the PM manages the board, and every member's AI (Claude or ChatGPT) can read the live project and the PM's guidelines.

Free forever, private, no central server: each PM runs their own copy on free services, and the only personal data is a name.

## What it does

**For the PM**
- A board with To do, In progress, Review and Done, filtered by member
- Tasks with a lead, optional helpers, or the whole group; due dates, blockers, files and links, notes
- Approve finished work, or send it back with a comment; mark tasks behind schedule in one tap, with an optional note
- After a session on the board, post one summary of the changes to the group chat (Teams, Discord or Slack), or copy it
- Project guidelines that members and their AIs follow
- Import a whole task plan written with Claude, with a preview before anything is created
- Several PMs per project if needed

**For members**
- Open the group link once, pick your name, and that device stays signed in as you
- My tasks in due date order: start, send to review, add notes, flag blockers (a task, a person, or anything else)
- Break big tasks into subtasks, written by hand or worked out with your AI, and tick them off; the PM sees the percentage
- Since your last visit: what changed on your tasks while you were away
- Who is waiting on you, the group's progress, and the PM's guidelines
- A short first-visit tour and a one-time prompt that connects your AI to the project
- A button to the group chat, if the PM adds one

## How it works

```
 Members' browsers ──┐                       ┌── PM's browser (superuser login)
                     ├──>  PocketBase  <─────┤
 Members' AIs ───────┘     (free plan)       └── Static frontend (this repo's app/)
   (read-only AI link)
```

- **Backend:** one [PocketBase](https://pocketbase.io) instance per PM, on PocketBase Cloud's free plan or self-hosted. One instance holds all of that PM's projects.
- **Frontend:** a static app (HTML, JavaScript, CSS) that talks to the instance. Host it on a PocketBase Cloud frontend slot or GitHub Pages.
- **Access:** the PM logs in as the instance's superuser. Members have no accounts: the group link lets each member claim their name once, which gives their device a personal key. The server's access rules check that key on every request, so members can only act as themselves and only on their own tasks.
- **AIs:** each project has a read-only link that returns the whole project as one JSON document, which Claude's and ChatGPT's link readers can fetch.

The full design, data model and access rules are in [SPEC.md](SPEC.md).

## Repository layout

| Path | What it is |
|---|---|
| [`app/`](app) | The frontend (Vite, Preact, TypeScript). See [app/README.md](app/README.md) for development. |
| [`pb_schema.json`](pb_schema.json) | The PocketBase collections and access rules, ready to import. |
| [`pb_hooks/`](pb_hooks) | Server code for PocketBase: claiming a name (`claim.pb.js`), the activity log and chat updates (`events.pb.js`, with its helper `epms/events.js`), the subtask limit (`subtasks.pb.js`), and a Teams link preview test (`preview.pb.js`). |
| [`skills/epms-task-plan/`](skills/epms-task-plan) | A Claude skill for planning tasks with Claude and exporting them in EPMS's import format. |
| [`design/`](design) | Design references for the three main screens. |
| [`SPEC.md`](SPEC.md) | The product spec: method, principles, data model, access rules, decisions. |
| [`LICENSE`](LICENSE) | MIT licence. |

## Set up your own copy (PM)

1. **Create a PocketBase instance.** On [PocketBase Cloud](https://pocketbasecloud.com)'s free plan you get one instance with 50 MB and 5,000 requests an hour. The free plan asks for a card to start a 0 cost subscription through Stripe; it is never charged. You can also self-host PocketBase.
2. **Import the schema.** In the instance dashboard, go to Settings, Import collections, and paste [`pb_schema.json`](pb_schema.json).
3. **Add the hooks.** Add everything in [`pb_hooks/`](pb_hooks) to the instance, keeping the `epms` folder (on PocketBase Cloud, the instance's Code tab).
4. **Build the frontend** with your instance's address:
   ```bash
   cd app
   npm install
   VITE_PB_URL=https://your-instance.example.com npm run build
   ```
5. **Upload** the contents of `app/dist/` to a PocketBase Cloud frontend slot or GitHub Pages.
6. **Open `pm.html`** on your deployed address, log in with your superuser email and password, create a project, and post the group link in your group chat.

## Planning tasks with Claude

Install the skill (download it from the PM board's menu, or zip [`skills/epms-task-plan`](skills/epms-task-plan)) and plan the tasks with Claude. When the plan is ready, Claude exports a `epms-tasks` file; paste it into **Import tasks** on the board. Without the skill, use **Copy instructions for Claude** in the import dialog, which includes your project's members and deadline.

## Development

See [app/README.md](app/README.md): a local PocketBase with the schema and demo data, the dev server, and an end-to-end test that checks the access rules and the main flows in a real browser.

## Status

Early and openly vibe coded. Built and tested against a local PocketBase; first deployment on PocketBase Cloud is next.

## Licence

[MIT](LICENSE). Free to use, change and share, including for your own group's copy.
