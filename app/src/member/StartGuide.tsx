// "Starting a group?": how a PM gets their own free SPMS backend, in plain words. Shown at #start.

import { useState } from 'preact/hooks'
import { Logo } from '../ui/Logo'
import { copyText } from '../lib/util'

/** Prompt that lets Claude or ChatGPT walk a PM through setup step by step. Kept short enough to fit in a link. */
export function setupPrompt(): string {
  const app = new URL('./pm.html', location.href).href
  return [
    "I'm a student setting up SPMS (Student Project Management System) for my group project. Guide me through setup one step at a time: give me one step, wait until I say it's done or describe what I see, then give the next. Keep it short and plain, and help me fix anything that goes wrong.",
    '',
    'How SPMS works: the app is a website with no data of its own. The project manager (me) runs a free PocketBase instance that holds the group\'s data. Members never log in; they open a group link and pick their name.',
    '',
    'Steps:',
    '1. Sign up at https://pocketbasecloud.com.',
    '2. Start the free plan. It asks for a card to start a Stripe subscription that costs 0; the card is never charged. One instance, 50 MB, never sleeps.',
    "3. Create an instance, open its dashboard, and set the superuser email and password when asked. That account is my PM login. Copy the instance address (like https://abc123.pocketbasecloud.com).",
    `4. Open ${app}, paste the address and log in with the superuser email and password.`,
    '5. If SPMS says the instance needs setup: press Install collections. Then press Download the hooks, unzip the file, open the instance\'s Code tab (the pb_hooks folder) in PocketBase Cloud and upload every file, keeping the epms folder inside. The instance restarts by itself. Back in SPMS, press Check again.',
    '6. Create my project, then follow the checklist on the board: add the group members, write the guidelines, plan the tasks, and share the group link in our group chat. Chat updates to Teams, Discord or Slack are optional.',
    '',
    "Start with step 1. Don't make up buttons or menus; if what I see doesn't match, ask me to describe it.",
  ].join('\n')
}

function AskAi() {
  const [copied, setCopied] = useState(false)
  const prompt = setupPrompt()
  const q = encodeURIComponent(prompt)
  const copy = async () => {
    if (await copyText(prompt)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }
  return (
    <section class="panel stack-sm">
      <strong style={{ fontWeight: 600 }}>Want a guide while you do it?</strong>
      <span class="soft small">Open a chat that already knows these steps. It walks you through them one at a time and helps if something looks different.</span>
      <div class="row">
        <a class="btn btn-soft btn-md" href={`https://claude.ai/new?q=${q}`} target="_blank" rel="noopener noreferrer">Open in Claude</a>
        <a class="btn btn-soft btn-md" href={`https://chatgpt.com/?q=${q}`} target="_blank" rel="noopener noreferrer">Open in ChatGPT</a>
        <button type="button" class="btn btn-soft btn-md" onClick={copy}>{copied ? 'Copied' : 'Copy the prompt'}</button>
      </div>
    </section>
  )
}

export function StartGuide() {
  const steps = [
    {
      title: 'Create a free PocketBase Cloud account',
      body: (
        <>
          Go to <a href="https://pocketbasecloud.com" target="_blank" rel="noopener noreferrer">pocketbasecloud.com</a> and sign up. SPMS keeps your projects in
          your own PocketBase instance, so nobody else holds your group's data.
        </>
      ),
    },
    {
      title: 'Start the free plan',
      body: (
        <>
          The free plan asks for a card to start a subscription through Stripe that costs 0. The card is never charged. You get one instance with 50 MB, which is
          plenty for many group projects, and it never goes to sleep.
        </>
      ),
    },
    {
      title: 'Create your instance and its superuser',
      body: (
        <>
          Create an instance, open its dashboard, and set the superuser email and password when it asks. That account is your PM login for SPMS. Copy the instance's
          address too; it looks like <code style={{ fontFamily: 'var(--mono)', fontSize: '12px' }}>https://abc123.pocketbasecloud.com</code>.
        </>
      ),
    },
    {
      title: 'Log in to SPMS',
      body: (
        <>
          Paste the address and log in with the superuser email and password. SPMS checks your instance, sets up its collections with one click, and gives you the
          hook files to upload in the instance's Code tab.
        </>
      ),
    },
    {
      title: 'Create your project and share the group link',
      body: <>A short checklist on your board takes it from there: your group, the guidelines, the tasks, and the link for your group chat.</>,
    },
  ]

  return (
    <div class="app">
      <header class="header"><Logo href="./" /></header>
      <main class="main-center">
        <div class="center-col" style={{ maxWidth: '680px' }}>
          <div class="stack-sm">
            <span class="muted small">For project managers</span>
            <h1 class="h1-xl">Set up SPMS for your group</h1>
            <p class="muted" style={{ margin: 0 }}>
              Free, private, about 10 minutes. You run your own copy of the backend; this site is only the app, with no data of its own.
            </p>
          </div>
          <ol class="getting-started" style={{ gap: 0 }}>
            {steps.map((s, i) => (
              <li key={i} style={{ alignItems: 'flex-start' }}>
                <span class="gs-mark" aria-hidden="true">{i + 1}</span>
                <div class="grow stack-sm" style={{ gap: '4px' }}>
                  <strong style={{ fontWeight: 600 }}>{s.title}</strong>
                  <span class="soft small">{s.body}</span>
                </div>
              </li>
            ))}
          </ol>
          <div class="row">
            <a class="btn btn-primary btn-lg" href="./pm.html">I have an instance: log in</a>
            <a class="btn btn-soft btn-lg" href="https://pocketbasecloud.com" target="_blank" rel="noopener noreferrer">Open PocketBase Cloud</a>
          </div>
          <AskAi />
          <p class="muted xsmall" style={{ margin: 0 }}>
            Prefer to run it yourself? PocketBase is free, open source software you can host anywhere; SPMS works with any PocketBase instance.
          </p>
        </div>
      </main>
    </div>
  )
}
