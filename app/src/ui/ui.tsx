// Shared building blocks: dialog, toasts, avatar, form fields, icons, project loader.

import type { ComponentChildren, JSX } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { signal } from '@preact/signals'
import type { Snapshot, Status } from '../data/types'
import { STATUS_LABEL } from '../data/types'
import { initial, memberColour, memberName } from '../lib/util'

// ---------- toasts ----------

interface Toast { id: number; text: string; warn: boolean }
const toasts = signal<Toast[]>([])
let toastId = 0

export function toast(text: string, warn = false): void {
  const id = ++toastId
  toasts.value = [...toasts.value, { id, text, warn }]
  setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), warn ? 6000 : 2600)
}

export function Toasts() {
  return (
    <div class="toasts" role="status" aria-live="polite">
      {toasts.value.map((t) => (
        <div key={t.id} class={t.warn ? 'toast toast-warn' : 'toast'}>{t.text}</div>
      ))}
    </div>
  )
}

// ---------- dialog ----------

export function Dialog(props: {
  title: string
  onClose: () => void
  children: ComponentChildren
  footer?: ComponentChildren
  wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const onClose = useRef(props.onClose)
  onClose.current = props.onClose

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    const first = ref.current?.querySelector<HTMLElement>('[data-autofocus]')
    ;(first ?? ref.current)?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose.current()
      if (e.key === 'Tab' && ref.current) {
        const items = [...ref.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
          (el) => !el.hasAttribute('disabled'),
        )
        if (!items.length) return
        const [a, b] = [items[0], items[items.length - 1]]
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus() }
        else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      before?.focus?.()
    }
  }, [])

  return (
    <div class="overlay" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <div ref={ref} class={props.wide ? 'dialog dialog-wide' : 'dialog'} role="dialog" aria-modal="true" aria-label={props.title} tabIndex={-1}>
        <div class="dialog-head">
          <h2>{props.title}</h2>
          <button type="button" class="icon-btn" onClick={props.onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div class="dialog-body">{props.children}</div>
        {props.footer && <div class="dialog-foot">{props.footer}</div>}
      </div>
    </div>
  )
}

// ---------- fields ----------

let fieldId = 0
export function useFieldId(): string {
  const id = useRef<string>()
  if (!id.current) id.current = `f${++fieldId}`
  return id.current
}

export function Field(props: { label: string; help?: string; class?: string; children: (id: string) => ComponentChildren }) {
  const id = useFieldId()
  return (
    <div class={`field ${props.class ?? ''}`}>
      <label class="field-label" for={id}>{props.label}</label>
      {props.children(id)}
      {props.help && <span class="field-help">{props.help}</span>}
    </div>
  )
}

export function ErrorBox(props: { error: string | null }) {
  return props.error ? <div class="error-box" role="alert">{props.error}</div> : null
}

export function Toggle(props: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; accent?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={props.checked} class={props.accent ? 'toggle toggle-accent' : 'toggle'} disabled={props.disabled} onClick={() => props.onChange(!props.checked)}>
      <span class="knob" aria-hidden="true" />
      {props.label}
    </button>
  )
}

// ---------- people and status ----------

export function Avatar(props: { snap: Snapshot; memberId: string; size?: number }) {
  const name = memberName(props.snap, props.memberId)
  const size = props.size ?? 22
  const style: JSX.CSSProperties = { background: memberColour(props.snap, props.memberId), width: size, height: size, fontSize: Math.round(size / 2) }
  return <span class="avatar" style={style} aria-hidden="true">{name ? initial(name) : '?'}</span>
}

export function StatusPill(props: { status: Status }) {
  return <span class={`pill pill-${props.status}`}>{STATUS_LABEL[props.status]}</span>
}

// ---------- icons ----------

export const ChevronIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="#9AA1AD" stroke-width="1.5" stroke-linecap="round" /></svg>
)

export const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
)

export const BlockedIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="#F2B880" stroke-width="1.5" /><path d="M5 8h6" stroke="#F2B880" stroke-width="1.5" stroke-linecap="round" /></svg>
)

export const SparkIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M9 2l1.6 4.4L15 8l-4.4 1.6L9 14l-1.6-4.4L3 8l4.4-1.6z" fill="none" stroke="#9AA1AD" stroke-width="1.4" stroke-linejoin="round" /></svg>
)

export function Loading(props: { text?: string }) {
  return <div class="loading">{props.text ?? 'Loading…'}</div>
}

/** Small line at the bottom of every page with the app version. */
export function VersionFooter() {
  return <footer class="version">EPMS v{__APP_VERSION__}{__APP_COMMIT__ ? ` · ${__APP_COMMIT__}` : ''}</footer>
}
