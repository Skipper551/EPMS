// "Starting a group?": how a PM gets their own free EPMS backend, in plain words. Shown at #start.

export function StartGuide() {
  const steps = [
    {
      title: 'Create a free PocketBase Cloud account',
      body: (
        <>
          Go to <a href="https://pocketbasecloud.com" target="_blank" rel="noopener noreferrer">pocketbasecloud.com</a> and sign up. EPMS keeps your projects in
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
          Create an instance, open its dashboard, and set the superuser email and password when it asks. That account is your PM login for EPMS. Copy the instance's
          address too; it looks like <code style={{ fontFamily: 'var(--mono)', fontSize: '12px' }}>https://abc123.pocketbasecloud.com</code>.
        </>
      ),
    },
    {
      title: 'Log in to EPMS',
      body: (
        <>
          Paste the address and log in with the superuser email and password. EPMS checks your instance, sets up its collections with one click, and gives you the
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
      <header class="header"><a class="logo" href="./">EPMS</a></header>
      <main class="main-center">
        <div class="center-col" style={{ maxWidth: '680px' }}>
          <div class="stack-sm">
            <span class="muted small">For project managers</span>
            <h1 class="h1-xl">Set up EPMS for your group</h1>
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
          <p class="muted xsmall" style={{ margin: 0 }}>
            Prefer to run it yourself? PocketBase is free, open source software you can host anywhere; EPMS works with any PocketBase instance.
          </p>
        </div>
      </main>
    </div>
  )
}
