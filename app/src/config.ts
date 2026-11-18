// The PocketBase instance this copy of Group Hub talks to.
// Set VITE_PB_URL at build time (see .env.example) to point at a different instance.
export const PB_URL: string = (import.meta.env.VITE_PB_URL as string | undefined)?.replace(/\/+$/, '') ||
  'https://j4sam3zmm0y2s0q.pwz5.pocketbasecloud.com'

// How often an open page refreshes the project while visible (the free plan allows 5,000 requests an hour).
export const REFRESH_MS = 60_000
