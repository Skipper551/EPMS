# EPMS

**Educational Project Management Software** (name work in progress, previously Group Hub).

Free, open-source project management for university group projects of 3 to 7 people. Built around the **Swim method** (Swim Education Project Management Method, name work in progress): every group has one project manager (PM) who runs the board, and everyone else just does their tasks.

It replaces shared tables in Loop or Excel with a calm, simple app: each member sees their own tasks and what they're waiting on, the PM manages the board, and every member's AI (Claude or ChatGPT) can read the live project and the PM's guidelines.

Free forever, private, no central server: each PM runs their own copy on free services, and the only personal data is a name.

## What it does

**For the PM**
- A board with To do, In progress, Review and Done, filtered by member
- Task view: your own tasks as the PM, the way members see theirs, and a read-only preview of any member's screen
- Tasks with a lead, optional helpers, or the whole group; start and due dates, blockers, files and links, notes
- Approve finished work, or send it back with a comment; mark tasks behind schedule in one tap, with an optional note
- After a session on the board, post one summary of the changes to the group chat (Teams, Discord or Slack), or copy it
- Project guidelines that members and their AIs follow
- Import a whole task plan written with Claude, with a preview before anything is created
- Several PMs per project if needed

**For members**
- Open the group link once, pick your name and choose a 4-digit PIN; that device stays signed in as you, and the PIN signs you in on your other devices
- My tasks in due date order: start, send to review, add notes, flag blockers (a task, a person, or anything else)
- Tasks that haven't started yet wait under Coming up; the lead can set when they'll start
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
- **Frontend:** a static app (HTML, JavaScript, CSS). One shared copy is published on GitHub Pages and works with any PM's instance; anyone can also host their own copy.
- **Access:** the PM logs in as the instance's superuser. Members have no accounts: the group link lets each member claim their name once, which gives their device a personal key. The server's access rules check that key on every request, so members can only act as themselves and only on their own tasks.
- **AIs:** each project has a read-only link that returns the whole project as one JSON document, which Claude's and ChatGPT's link readers can fetch.

The full design, data model and access rules are in [SPEC.md](SPEC.md).

## Repository layout

| Path | What it is |
|---|---|
| [`app/`](app) | The frontend (Vite, Preact, TypeScript). See [app/README.md](app/README.md) for development. |
| [`pb_schema.json`](pb_schema.json) | The PocketBase collections and access rules, ready to import. |
| [`pb_hooks/`](pb_hooks) | Server code for PocketBase: claiming a name (`claim.pb.js`), the activity log and chat updates (`events.pb.js`, with its helper `epms/events.js`), the subtask limit (`subtasks.pb.js`), the guide added to the AI link (`ai.pb.js`), and a Teams link preview test (`preview.pb.js`). |
| [`skills/epms-task-plan/`](skills/epms-task-plan) | A Claude skill for planning tasks with Claude and exporting them in EPMS's import format. |
| [`design/`](design) | Design references for the three main screens. |
| [`SPEC.md`](SPEC.md) | The product spec: method, principles, data model, access rules, decisions. |
| [`CHANGELOG.md`](CHANGELOG.md) | What changed in each version, with its pull request. |
| [`LICENSE`](LICENSE) | MIT licence. |
| [`.github/workflows/pages.yml`](.github/workflows/pages.yml) | Publishes the shared site to GitHub Pages on every push to `main`. |

## Start a group (PM)

Open the shared EPMS site, **https://skipper551.github.io/EPMS/**, and choose **Set up EPMS**. In short:

1. **Create a free PocketBase instance** on [PocketBase Cloud](https://pocketbasecloud.com): one instance, 50 MB, 5,000 requests an hour. The free plan asks for a card to start a subscription that costs 0 through Stripe; it is never charged. You can also self-host PocketBase.
2. **Set its superuser** email and password in the instance dashboard, and copy the instance's address.
3. **Log in to EPMS** with the address, email and password. EPMS checks your instance:
   - **Collections:** installed or updated in one click.
   - **Hooks:** download them from the setup check and upload them in the instance's Code tab, keeping the `epms` folder. PocketBase only accepts hook files through its dashboard. **Check setup** in the project menu re-runs the check any time, for example after an EPMS update.
4. **Create your project.** A Getting started checklist on the board walks you through adding your group, writing the guidelines, planning the tasks and sharing the group link.

The shared site is only the app: it holds no data and has no server. Your projects live in your own instance, and group and personal links carry its address after `#`, so members' browsers know where to connect.

**Prefer your own copy of the app?** Build it with your instance as the default, then upload `app/dist/` anywhere static (a PocketBase Cloud frontend slot, GitHub Pages):

```bash
cd app
npm install
VITE_PB_URL=https://your-instance.example.com npm run build
```

## Planning tasks with Claude

Install the skill (download it from the PM board's menu, or zip [`skills/epms-task-plan`](skills/epms-task-plan)) and plan the tasks with Claude. It starts from your project's AI link (Project settings, Links) and asks for it if you haven't shared it, so member names, existing tasks and dates match the board. When the plan is ready, Claude exports a `epms-tasks` file; paste it into **Import tasks** on the board. Without the skill, use **Copy instructions for Claude** in the import dialog, which includes your project's members and deadline.

## Development

See [app/README.md](app/README.md): a local PocketBase with the schema and demo data, the dev server, and an end-to-end test that checks the access rules and the main flows in a real browser.

## Status

Early and openly vibe coded. Built and tested against a local PocketBase; first deployment on PocketBase Cloud is next.

## Licence

[MIT](LICENSE). Free to use, change and share, including for your own group's copy.
