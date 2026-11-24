// Which PocketBase instance SPMS talks to.
//
// The shared SPMS site has no built-in instance: the PM enters their own address when they log in, and group and
// personal links carry it (after #) so members' browsers know where to connect. A PM who builds their own copy can
// set VITE_PB_URL (see .env.example) to give it a default address instead.
export const DEFAULT_PB_URL: string = cleanUrl((import.meta.env.VITE_PB_URL as string | undefined) ?? '')

/** "my-instance.pocketbasecloud.com/" → "https://my-instance.pocketbasecloud.com", "127.0.0.1:8090" → "http://127.0.0.1:8090" ('' stays ''). */
export function cleanUrl(u: string): string {
  const v = u.trim().replace(/\/+$/, '').replace(/\/_\/?$/, '')
  if (!v) return ''
  if (/^https?:\/\//i.test(v)) return v
  // Someone running PocketBase on their own computer or local network uses plain http.
  const local = /^(localhost|127\.|10\.|192\.168\.|\[?::1)/i.test(v)
  return `${local ? 'http' : 'https'}://${v}`
}

// How often an open page refreshes the project while visible (the free plan allows 5,000 requests an hour).
export const REFRESH_MS = 60_000
