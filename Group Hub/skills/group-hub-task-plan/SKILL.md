---
name: group-hub-task-plan
description: Plan, split and assign the tasks of a university group project with its project manager (PM), then export them as a Group Hub task file (format "group-hub-tasks") that the PM imports into Group Hub. Use when a student PM asks to break a brief into tasks, delegate work to group members, revise a task plan, or "export the tasks for Group Hub".
---

# Group Hub task plan

Group Hub is a free project management app for student group projects run with the S.W.I.M.S. method: one project manager (PM) runs the board, members do the tasks. The PM plans the tasks with you, goes back and forth until they are right, then imports your file into Group Hub in one step. Your job is to help plan well and to produce a file that imports cleanly.

## Workflow

1. **Gather what you need.** Before drafting, make sure you know:
   - the brief or assignment (ask the PM to paste or upload it),
   - the members' names and, if any, their roles or strengths,
   - the final deadline and today's date,
   - any tasks already on the Group Hub board (the PM may paste the instructions from Group Hub's import dialog, which list them).
   Ask only for what's missing, in one message.
2. **Draft the plan in the conversation as a readable table**, not as JSON: title, owner, due date, blocked by, and a one-line description. Keep the workload fair across members and give the PM their own share of tasks.
3. **Iterate.** Apply the PM's suggestions and show the updated table. Don't output the file until the PM says the plan is ready, or asks for the file.
4. **Export.** Output the file as a single ```json code block (or a downloadable `group-hub-tasks.json` file if you can create files), following the format below exactly. Then check it against the checklist at the end.

## Planning guidance

- 3 to 7 members is typical. Give every member tasks; the PM usually takes coordination, merging and final checks.
- Split work into tasks a person can finish in a few days. A task should have one owner.
- Order work with blockers: a task that can't start until another is done lists it in `blocked_by`. Avoid long chains when tasks could run in parallel.
- Due dates: leave a buffer before the final deadline for merging, proofreading and rehearsal. Put review-heavy tasks earlier.
- Descriptions are read by the task owner as the first note on their task. Write them for that person: what to do, in a few concrete steps, and what "done" looks like. Respect the PM's guidelines (citation style, word limits, tone).
- Keep titles short (under 80 characters) and start with a verb: "Find 5 sources", "Draft the conclusion".
- Plain punctuation only: no em dashes anywhere in titles or descriptions.

## Format: group-hub-tasks, version 1

```json
{
  "format": "group-hub-tasks",
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
      "due": "2026-11-30",
      "description": "Using Ala's sources, write a 400 to 600 word introduction that sets out the research question.",
      "blocked_by": ["find-sources"]
    }
  ]
}
```

### Fields

| Field | Required | Meaning |
|---|---|---|
| `format` | yes | Always `"group-hub-tasks"`. |
| `version` | yes | Always `1`. |
| `project` | no | The project's name, so the PM can see the file is for the right project. |
| `guidelines` | no | Project guidelines text (max 20,000 characters). Only when the PM asked for them; the PM chooses whether to use them on import. |
| `members` | no | People to add to the project if they aren't in it yet: `name` (required, max 100), `role` (optional), `pm` (true only for a PM). Members already in Group Hub don't need listing. |
| `tasks` | yes | The list of tasks, in the order they should appear. |

Each task:

| Field | Required | Meaning |
|---|---|---|
| `id` | recommended | Short lowercase reference, unique within the file, like `find-sources`. Used by other tasks' `blocked_by`. |
| `title` | yes | Max 300 characters; aim for under 80. |
| `owner` | no | One member's name, spelled exactly as in Group Hub. Leave out if unassigned. |
| `due` | no | Date as `YYYY-MM-DD`. No times. |
| `description` | no | Instructions for the owner (max 5,000 characters). Becomes the task's first note, posted by the PM. |
| `blocked_by` | no | List of `id`s of tasks in this file, or exact titles of tasks already on the Group Hub board. |
| `waiting_on` | no | List of member names the task waits on for something that isn't a task (for example "Kuba has to share the survey data"). |
| `links` | no | Files or links: list of `{ "label": "...", "url": "https://..." }`. Only `http://` or `https://` addresses. |
| `status` | no | Leave out for new tasks (they start in To do). Allowed: `todo`, `doing`, `review`, `done`. |

### How Group Hub reads the file

- Owners are matched to members by name, ignoring case. A first name alone also matches if only one member has it. Unknown names are offered to the PM as new members.
- A task whose title matches a task already on the board is skipped by default, so importing the same file twice doesn't duplicate tasks. When revising a plan the PM has already imported, export only the new tasks unless the PM asks for the whole plan.
- `blocked_by` entries that match nothing are skipped with a warning.
- The PM sees a full preview and confirms before anything is created.

## Checklist before you output the file

- [ ] Valid JSON: double quotes, no trailing commas, no comments.
- [ ] `"format": "group-hub-tasks"` and `"version": 1` at the top.
- [ ] Every task has a `title`; every `id` is unique.
- [ ] Every `owner` and `waiting_on` name is spelled exactly as the PM gave it.
- [ ] Every `blocked_by` entry is an `id` in this file or an exact existing title; no task blocks itself; no cycles.
- [ ] Every `due` is `YYYY-MM-DD` and on or before the final deadline.
- [ ] No em dashes anywhere.
- [ ] Only the JSON goes in the code block. After it, tell the PM in one line: "In Group Hub, open your board, choose Import tasks, and paste this."
