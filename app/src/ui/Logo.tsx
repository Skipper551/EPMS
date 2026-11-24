/** The SPMS mark: three group members joined together, the PM highlighted. Same drawing as public/favicon.svg, minus the dark tile. */
export function LogoMark(props: { size?: number }) {
  const size = props.size ?? 24
  return (
    <svg class="logo-mark" width={size} height={size} viewBox="4 4.5 24 23" aria-hidden="true" focusable="false">
      <path d="M16 10 L9 21.5 L23 21.5 Z" fill="none" stroke="#4A5568" stroke-width="2.6" stroke-linejoin="round" />
      <circle cx="9" cy="21.5" r="4.2" fill="#9CB4E0" />
      <circle cx="23" cy="21.5" r="4.2" fill="#9CB4E0" />
      <circle cx="16" cy="10" r="4.8" fill="#6CA0FF" />
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
