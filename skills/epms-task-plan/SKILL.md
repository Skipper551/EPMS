---
name: epms-task-plan
description: Plan, split and assign the tasks of a university group project with its project manager (PM), then export them as an EPMS task file (format "epms-tasks") that the PM imports into EPMS. Always starts from the project's AI link (asks the PM for it if it hasn't been shared) so names, existing tasks and dates match the board. Use when a student PM asks to break a brief into tasks, delegate work to group members, revise a task plan, or "export the tasks for EPMS".
---

# EPMS task plan

EPMS (Educational Project Management Software) is a free project management app for student group projects run with the Swim method: one project manager (PM) runs the board, members do the tasks. The PM plans the tasks with you, goes back and forth until they are right, then imports your file into EPMS in one step. Your job is to help plan well and to produce a file that imports cleanly.

## Workflow

1. **Read the project's AI link first.** It is the source of truth for the file: exact member names (and who is a PM), tasks already on the board, the final deadline, the PM's guidelines and existing subtasks.
   - If the PM hasn't shared it in this conversation, ask for it before planning: "Please paste your project's AI link. In EPMS, open Project settings, Links, Copy AI link." It looks like `https://<instance>/api/collections/projects/records/<id>?ai_key=...&expand=...`. The instructions from EPMS's import dialog (Copy instructions for Claude) include it too.
   - Fetch it and read the JSON: `name`, `final_deadline` and `guidelines` on the project; `expand.members_via_project` (use these `name`s exactly as owners; `is_pm` marks the PM); `expand.tasks_via_project` (existing tasks: reuse their exact titles in `blocked_by`, and don't plan duplicates, since EPMS skips tasks whose title is already on the board).
   - If you can't open links, ask the PM to paste the link's JSON contents instead, or to paste the import dialog's instructions, which list the members, deadline and existing tasks.
   - Don't guess member names. A name that doesn't match exactly turns into a new member on import.
2. **Gather the rest.** The brief or assignment (ask the PM to paste or upload it), anything the link doesn't say about members' strengths, and today's date. Ask only for what's missing, in one message.
3. **Draft the plan in the conversation as a readable table**, not as JSON: title, owner, due date, blocked by, and a one-line description. Keep the workload fair across members and give the PM their own share of tasks.
4. **Iterate.** Apply the PM's suggestions and show the updated table. Don't output the file until the PM says the plan is ready, or asks for the file.
5. **Export.** Before writing it, re-read the AI link if you can, in case the board changed while you planned. Output the file as a single ```json code block (or a downloadable `epms-tasks.json` file if you can create files), following the format below exactly. Then check it against the checklist at the end.

## Planning guidance

- 3 to 7 members is typical. Give every member tasks; the PM usually takes coordination, merging and final checks.
- Split work into tasks a person can finish in a few days. Every task has one lead (`owner`), the person accountable for it.
- Collaborative work: when two or three people genuinely have to do something together (an interview pair, co-writing a section), give it a lead and list the others in `helpers`. Prefer splitting into separate tasks when the work can be divided; shared tasks without one accountable person tend to stall.
- Whole-group work (rehearsing the presentation, everyone reading the final draft, a group meeting): set `"everyone": true` with a lead, usually the PM, and no helpers.
- Order work with blockers: a task that can't start until another is done lists it in `blocked_by`. Avoid long chains when tasks could run in parallel.
- Start dates: give each task a `start` so members know when to begin, not only when to finish. Tasks that wait on others start when those are due.
- Due dates: leave a buffer before the final deadline for merging, proofreading and rehearsal. Put review-heavy tasks earlier.
- Descriptions are read by the task owner as the first note on their task. Write them for that person: what to do, in a few concrete steps, and what "done" looks like. Respect the PM's guidelines (citation style, word limits, tone).
- For bigger tasks, add `subtasks`: short steps the owner can tick off in one sitting each. Members can also add their own later, with their AI or by hand.
- Keep titles short (under 80 characters) and start with a verb: "Find 5 sources", "Draft the conclusion".
- Plain punctuation only: no em dashes anywhere in titles or descriptions.

## Format: epms-tasks, version 1

```json
{
  "format": "epms-tasks",
  "version": 1,
  "project": "Innovation Management · Group 2",
  "guidelines": "Optional. Only include if the PM asked you to write the project guidelines.",
  "members": [
    { "name": "Ala", "role": "Research" },
    { "name": "Malcolm", "role": "PM", "pm": true }
  ],
  "tasks": [
    {
      "id": "find-sources",
      "title": "Find 5 sources",
      "owner": "Ala",
      "start": "2026-11-16",
      "due": "2026-11-20",
      "description": "Find five peer-reviewed sources on open innovation in mid-sized firms. Save each in the shared References doc in APA 7 with its DOI. Done when all five are in the doc with a one-line summary each.",
      "blocked_by": [],
      "waiting_on": [],
      "links": [{ "label": "References doc", "url": "https://example.com/references" }]
    },
    {
      "id": "write-intro",
      "title": "Write the introduction",
      "owner": "Jimmy",
      "start": "2026-11-21",
      "due": "2026-11-30",
      "description": "Using Ala's sources, write a 400 to 600 word introduction that sets out the research question.",
      "blocked_by": ["find-sources"],
      "subtasks": [
        { "title": "Re-read the brief and the sources" },
        { "title": "Outline the argument in 5 bullet points" },
        { "title": "Write the first draft" },
        { "title": "Ask Ala to read it" },
        { "title": "Edit to under 600 words" }
      ]
    },
    {
      "id": "interviews",
      "title": "Interview two users",
      "owner": "Ala",
      "helpers": ["Kuba"],
      "due": "2026-11-27",
      "description": "Ala leads and takes notes, Kuba asks the questions. Done when both interview notes are in the shared folder."
    },
    {
      "id": "rehearse",
      "title": "Rehearse the presentation",
      "owner": "Malcolm",
      "everyone": true,
      "due": "2026-12-10",
      "description": "Full run-through with slides, timed. Everyone presents their own part.",
      "blocked_by": ["write-intro"]
    }
  ]
}
```

### Fields

| Field | Required | Meaning |
|---|---|---|
| `format` | yes | Always `"epms-tasks"`. |
| `version` | yes | Always `1`. |
| `project` | no | The project's name, so the PM can see the file is for the right project. |
| `guidelines` | no | Project guidelines text (max 20,000 characters). Only when the PM asked for them; the PM chooses whether to use them on import. |
| `members` | no | People to add to the project if they aren't in it yet: `name` (required, max 100), `role` (optional), `pm` (true only for a PM). Members already in EPMS don't need listing. |
| `tasks` | yes | The list of tasks, in the order they should appear. |

Each task:

| Field | Required | Meaning |
|---|---|---|
| `id` | recommended | Short lowercase reference, unique within the file, like `find-sources`. Used by other tasks' `blocked_by`. |
| `title` | yes | Max 300 characters; aim for under 80. |
| `owner` | no | The lead: one member's name, spelled exactly as in EPMS, accountable for the task. Leave out if unassigned. |
| `helpers` | no | Other members working on the task with the lead. They see it on their page and can start it or send it to review. |
| `everyone` | no | `true` for a whole-group task: it shows on every member's page. Give it a lead and no helpers. |
| `start` | no | When work should begin, as `YYYY-MM-DD`. Stagger starts around blockers: a task should start when the work it's blocked by is due. The task's lead can move it later. |
| `due` | no | Date as `YYYY-MM-DD`. No times. |
| `description` | no | Instructions for the owner (max 5,000 characters). Becomes the task's first note, posted by the PM. |
| `blocked_by` | no | List of `id`s of tasks in this file, or exact titles of tasks already on the EPMS board. |
| `waiting_on` | no | List of member names the task waits on for something that isn't a task (for example "Kuba has to share the survey data"). |
| `subtasks` | no | A checklist of short steps for the owner, in the order to do them, at most 30: a list of `{ "title": "..." }` objects, the same shape as the `epms-subtasks` format members' AIs use. The owner ticks them off in EPMS and the PM sees the percentage. Use it for bigger tasks; small ones don't need it. |
| `blocked_reason` | no | A short note for anything else the task waits on that isn't a task or a member, like "Waiting for the professor's feedback". |
| `links` | no | Files or links: list of `{ "label": "...", "url": "https://..." }`. Only `http://` or `https://` addresses. |
| `status` | no | Leave out for new tasks (they start in To do). Allowed: `todo`, `doing`, `review`, `done`. |

#### Subtasks added later

Members can break their own tasks into subtasks later with their own AI, using a separate format that their AI learns from the project's AI link (`epms_ai_guide`): one JSON block `{ "format": "epms-subtasks", "version": 1, "task": "<task title>", "subtasks": [{ "title": "<short step>" }] }`, pasted into the task with Add subtasks. If the PM asks you for subtasks for a task that is already on the board, give them in that format instead of a new task file.

## How EPMS reads the file

- Owners are matched to members by name, ignoring case. A first name alone also matches if only one member has it. Unknown names are offered to the PM as new members.
- A task whose title matches a task already on the board is skipped by default, so importing the same file twice doesn't duplicate tasks. When revising a plan the PM has already imported, export only the new tasks unless the PM asks for the whole plan.
- `blocked_by` entries that match nothing are skipped with a warning.
- The PM sees a full preview and confirms before anything is created.

## Checklist before you output the file

- [ ] Valid JSON: double quotes, no trailing commas, no comments.
- [ ] `"format": "epms-tasks"` and `"version": 1` at the top.
- [ ] Every task has a `title`; every `id` is unique.
- [ ] Every `owner`, `helpers` and `waiting_on` name matches a member in the AI link exactly (or is a new person listed in `members`); the lead isn't also listed as a helper.
- [ ] No task repeats the title of a task already on the board, unless the PM asked to replace it.
- [ ] `everyone` tasks have a lead and no helpers.
- [ ] Every `blocked_by` entry is an `id` in this file or an exact existing title; no task blocks itself; no cycles.
- [ ] Every `start` and `due` is `YYYY-MM-DD`, each `start` is on or before its `due`, and every `due` is on or before the final deadline.
- [ ] No em dashes anywhere.
- [ ] Only the JSON goes in the code block. After it, tell the PM in one line: "In EPMS, open your board, choose Import tasks, and paste this."
