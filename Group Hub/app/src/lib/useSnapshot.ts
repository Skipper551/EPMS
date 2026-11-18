// Keeps one project loaded: on open, when the tab comes back into view, every REFRESH_MS while visible,
// and after every action (call reload). One request per refresh.

import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { REFRESH_MS } from '../config'
import { loadSnapshot, type StoreError } from '../data/store'
import type { Snapshot } from '../data/types'

export interface SnapshotState {
  snap: Snapshot | null
  error: StoreError | null
  reload: () => Promise<void>
  /** Apply a local change straight away, before the next reload confirms it. */
  patch: (fn: (s: Snapshot) => Snapshot) => void
}

export function useSnapshot(projectId: string | null): SnapshotState {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [error, setError] = useState<StoreError | null>(null)
  const current = useRef(projectId)
  current.current = projectId

  const reload = useCallback(async () => {
    const id = current.current
    if (!id) return
    try {
      const s = await loadSnapshot(id)
      if (current.current === id) {
        setSnap(s)
        setError(null)
      }
    } catch (e) {
      if (current.current === id) setError(e as StoreError)
    }
  }, [])

  useEffect(() => {
    setSnap(null)
    setError(null)
    if (!projectId) return
    reload()
    const timer = setInterval(() => document.visibilityState === 'visible' && reload(), REFRESH_MS)
    const onVisible = () => document.visibilityState === 'visible' && reload()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [projectId, reload])

  const patch = useCallback((fn: (s: Snapshot) => Snapshot) => setSnap((s) => (s ? fn(s) : s)), [])

  return { snap, error, reload, patch }
}
