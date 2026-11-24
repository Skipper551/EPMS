/** The SPMS mark: a task card checked off a stack. Same drawing as public/favicon.svg, minus the dark tile. */
export function LogoMark(props: { size?: number }) {
  const size = props.size ?? 24
  return (
    <svg class="logo-mark" width={size} height={size} viewBox="4.5 4 23 23" aria-hidden="true" focusable="false">
      <rect x="10" y="5.5" width="16" height="16" rx="4" fill="none" stroke="#3A4558" stroke-width="2.2" />
      <rect x="6" y="10.5" width="16" height="16" rx="4" fill="#6CA0FF" />
      <path d="M10 18.6 l3 3 l5.4 -5.6" fill="none" stroke="#0F1115" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  )
}

/** Mark plus "SPMS" wordmark, used in every page header. Pass href to make it a link. */
export function Logo(props: { href?: string }) {
  const body = <><LogoMark />SPMS</>
  return props.href
    ? <a class="logo" href={props.href}>{body}</a>
    : <span class="logo">{body}</span>
}
