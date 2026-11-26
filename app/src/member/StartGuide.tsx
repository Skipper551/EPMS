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
    "How SPMS works: the app is a website with no data of its own. The project manager (me) runs a free PocketBase Cloud instance that holds the group's data. Members never log in; they open a group link and pick their name.",
    '',
    'Steps:',
    '1. Sign in at https://portal.pocketbasecloud.com with Google. A first project is made for me. No card is needed for the first 7 days.',
    '2. Open the project, go to the PocketBase tab, click New PocketBase, keep or type a name, click Create. It takes 30 to 60 seconds; a new address can take a few more minutes to answer.',
    "3. On the instance's Settings page, under Admin access, copy the admin email and generated password. That is my PM login. The address is https://NAME.pocketbasecloud.com.",
    `4. Open ${app}, paste the address and log in.`,
    "5. If SPMS says setup is needed: press Install collections, then Download the hooks and unzip. In the instance's Code tab, add every file to pb_hooks keeping the epms folder, Save and Deploy. Back in SPMS, press Check again.",
    '6. Before day 7, add a card on the Plan page. It starts a $0 Stripe subscription to keep bots out and is never charged. Without it the instance pauses (nothing is deleted) until I add one.',
    '7. Create my project, then follow the board checklist: members, guidelines, tasks, and share the group link in our chat.',
    '',
    "If I'm worried about the card: PocketBase Cloud is an independent host (not the PocketBase project), the card form is Stripe's, the free plan is never charged, and going over its limits pauses or slows the instance instead of billing. Source: https://pocketbasecloud.com/docs/platform/plans-and-billing/",
    '',
    "Start with step 1. Don't make up buttons or menus; if what I see doesn't match, ask me to describe it.",
  ].join('\n')
}

const CLAUDE_PATH = 'm4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z'
const OPENAI_PATH = 'M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z'

function Mark(props: { d: string; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style={{ flex: 'none' }}>
      <path d={props.d} fill={props.color ?? 'currentColor'} />
    </svg>
  )
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
    <div class="ai-setup">
      <span class="muted small">Set up with a guide:</span>
      <a class="ai-chip" href={`https://claude.ai/new?q=${q}`} target="_blank" rel="noopener noreferrer">
        <Mark d={CLAUDE_PATH} color="#D97757" />Claude
      </a>
      <a class="ai-chip" href={`https://chatgpt.com/?q=${q}`} target="_blank" rel="noopener noreferrer">
        <Mark d={OPENAI_PATH} />ChatGPT
      </a>
      <button type="button" class="ai-chip" onClick={copy} title="Copy the setup prompt to paste into any AI">{copied ? 'Copied' : 'Copy prompt'}</button>
    </div>
  )
}

const PORTAL = 'https://portal.pocketbasecloud.com'
const SRC = {
  billing: 'https://pocketbasecloud.com/docs/platform/plans-and-billing/',
  pricing: 'https://pocketbasecloud.com/pricing/',
  security: 'https://pocketbasecloud.com/security/',
  privacy: 'https://pocketbasecloud.com/privacy/',
  terms: 'https://pocketbasecloud.com/terms/',
  about: 'https://pocketbasecloud.com/about/',
  deploy: 'https://pocketbasecloud.com/docs/pocketbase/deploying-pocketbase/',
  manage: 'https://pocketbasecloud.com/docs/pocketbase/managing-your-instance/',
  pbRepo: 'https://github.com/pocketbase/pocketbase',
  pbSite: 'https://pocketbase.io',
}

function Ext(props: { href: string; children: any }) {
  return <a href={props.href} target="_blank" rel="noopener noreferrer">{props.children}</a>
}

function Code(props: { children: any }) {
  return <code style={{ fontFamily: 'var(--mono)', fontSize: '12px' }}>{props.children}</code>
}

function B(props: { children: any }) {
  return <strong style={{ color: 'var(--text)', fontWeight: 500 }}>{props.children}</strong>
}

/** "Is this safe?": what the card is for, what can cost money, who runs PocketBase Cloud, and how to leave. Every claim links to its source. */
function IsThisSafe() {
  return (
    <details class="safe-box">
      <summary>
        <span>Is this safe? What the card is for, what can cost money, and who runs it</span>
      </summary>
      <div class="safe-body small soft">
        <section>
          <h3>The card</h3>
          <p>
            You don't need a card for the first 7 days. To keep the free plan after that, PocketBase Cloud asks for one: it starts a subscription that costs $0,
            which is how they keep bots and abuse out. You are not charged. (<Ext href={SRC.billing}>Plans and billing</Ext>)
          </p>
          <p>
            The card form is Stripe's, the same payment company many online shops use. PocketBase Cloud keeps a Stripe customer id and subscription id and nothing
            else about your card. (<Ext href={SRC.security}>Security</Ext>)
          </p>
        </section>
        <section>
          <h3>What could cost money</h3>
          <p>
            Only a paid plan you pick yourself (they start at $10 a month). Going over the free limits doesn't bill you: past 5,000 requests an hour the instance
            answers "too many requests" until the next hour, and an instance over 50 MB is paused, with an email before anything is removed. A group project uses a
            small part of that. (<Ext href={SRC.pricing}>Pricing</Ext>, <Ext href={SRC.terms}>Terms</Ext>)
          </p>
        </section>
        <section>
          <h3>Who runs it</h3>
          <p>
            PocketBase Cloud is an independent hosting service run by a small team (founder Tom Nguyen). It is not part of the PocketBase project.
            (<Ext href={SRC.about}>About</Ext>, <Ext href={SRC.terms}>Terms</Ext>)
          </p>
          <p>
            What it hosts is PocketBase, free open source software under the MIT licence, public on GitHub since 2022 with over 60,000 stars.
            (<Ext href={SRC.pbRepo}>GitHub</Ext>, <Ext href={SRC.pbSite}>pocketbase.io</Ext>)
          </p>
          <p>
            It's a small service, not a big company: it has no SOC 2 or ISO 27001 certificate, and support is on Discord. That's fine for coursework; don't use it
            for anything sensitive. (<Ext href={SRC.security}>Security</Ext>, <Ext href={SRC.about}>About</Ext>)
          </p>
        </section>
        <section>
          <h3>What's stored, and where</h3>
          <p>
            Your instance holds only what you type into SPMS: project name and guidelines, members' names and roles, tasks, notes, activity, and retrospective totals and comments. Member PINs
            are stored hashed, never as typed. No student numbers, no member emails or passwords. Free instances run on Hetzner servers in Germany, Finland, the US or
            Singapore, served over HTTPS. They don't sell data. (<Ext href={SRC.security}>Security</Ext>, <Ext href={SRC.privacy}>Privacy</Ext>)
          </p>
        </section>
        <section>
          <h3>Leaving</h3>
          <p>
            Download everything at any time from <B>Settings, Backups</B> in the instance's dashboard. Delete the instance from its <B>Delete</B> page. Deleting your
            account is self-service in the portal and cancels the $0 subscription in the same step. (<Ext href={SRC.security}>Security</Ext>,{' '}
            <Ext href={SRC.manage}>Managing your instance</Ext>)
          </p>
        </section>
        <section>
          <h3>Good to know</h3>
          <p>
            An instance with no activity for 30 days is paused after email reminders and removed 15 days later; one click resumes it before then. If your group takes a
            long break, open SPMS once in a while or download a backup. The free plan has no automatic point-in-time backup. (<Ext href={SRC.pricing}>Pricing</Ext>)
          </p>
        </section>
      </div>
    </details>
  )
}

export function StartGuide() {
  const steps = [
    {
      title: 'Sign in to PocketBase Cloud with Google',
      body: (
        <>
          <p>
            Go to <Ext href={PORTAL}>portal.pocketbasecloud.com</Ext> and sign in with your Google account. A first project is created for you, so you land on the{' '}
            <B>Projects</B> page.
          </p>
          <p>No card yet: the free plan starts with 7 days without one. You'll add it in step 5, and it's never charged.</p>
        </>
      ),
    },
    {
      title: 'Create your instance',
      body: (
        <>
          <p>
            Open your project, click the <B>PocketBase</B> tab, then <B>New PocketBase</B>. Keep the name it suggests or type your own, such as{' '}
            <Code>brand-report</Code>; it becomes your address. Leave <B>Advanced Configuration</B> alone and click <B>Create</B>.
          </p>
          <p>
            It takes 30 to 60 seconds. Done when the status reads <B>running</B>. Your address is <Code>https://NAME.pocketbasecloud.com</Code>. A brand-new address can
            take a few more minutes to open while its certificate is issued; that's normal.
          </p>
        </>
      ),
    },
    {
      title: 'Copy your PM login',
      body: (
        <>
          <p>
            Open the instance's <B>Settings</B> page. Under <B>Admin access</B> you'll find an email (your Google email) and a generated password. That pair is your PM
            login for SPMS. To pick your own password, use <B>Reset Password</B> there (12 to 20 characters).
          </p>
        </>
      ),
    },
    {
      title: 'Log in to SPMS and finish setup',
      body: (
        <>
          <p>
            Open <a href="./pm.html">the PM login</a>, paste the address, email and password. SPMS checks your instance and shows a setup card the first time:
          </p>
          <ol class="sub-steps">
            <li>Press <B>Install collections</B>.</li>
            <li>Press <B>Download the hooks</B> and unzip the file.</li>
            <li>
              In PocketBase Cloud, open the instance's <B>Code</B> tab. Add every file to the <Code>pb_hooks</Code> folder, keeping the <Code>epms</Code> folder inside,
              then <B>Save</B> and <B>Deploy</B>.
            </li>
            <li>Back in SPMS, press <B>Check again</B>. Done when every line reads Installed.</li>
          </ol>
          <p>
            Seeing "There's no PocketBase instance at..."? A brand-new address can take a few minutes to start answering. Wait, then check the name matches the address
            on the instance's page in the portal.
          </p>
        </>
      ),
    },
    {
      title: 'Add a card before day 7',
      body: (
        <>
          <p>
            In the portal, open the <B>Plan</B> page and add a card. It starts a $0 Stripe subscription to keep bots out; you are not charged. If you forget, nothing is
            deleted: the instance pauses until you add one, then restarts by itself, usually within the hour.
          </p>
        </>
      ),
    },
    {
      title: 'Create your project and share the group link',
      body: <p>A short checklist on your board takes it from there: your group, the guidelines, the tasks, and the link for your group chat.</p>,
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
              Free, private, about 10 minutes. You run your own copy of the backend on PocketBase Cloud's free plan; this site is only the app, with no data of its own.
            </p>
          </div>
          <AskAi />
          <IsThisSafe />
          <ol class="getting-started start-steps" style={{ gap: 0 }}>
            {steps.map((s, i) => (
              <li key={i} style={{ alignItems: 'flex-start' }}>
                <span class="gs-mark" aria-hidden="true">{i + 1}</span>
                <div class="grow stack-sm" style={{ gap: '4px', minWidth: 0 }}>
                  <strong style={{ fontWeight: 600 }}>{s.title}</strong>
                  <div class="soft small step-body">{s.body}</div>
                </div>
              </li>
            ))}
          </ol>
          <div class="row">
            <a class="btn btn-primary btn-lg" href="./pm.html">I have an instance: log in</a>
            <a class="btn btn-soft btn-lg" href={PORTAL} target="_blank" rel="noopener noreferrer">Open PocketBase Cloud</a>
          </div>
          <p class="muted xsmall" style={{ margin: 0 }}>
            Prefer to run it yourself? PocketBase is free, open source software you can host anywhere; SPMS works with any PocketBase instance.
          </p>
        </div>
      </main>
    </div>
  )
}
