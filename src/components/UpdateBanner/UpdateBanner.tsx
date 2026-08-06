import { useEffect, useState } from "react"

import { Button } from "components"
import { applyUpdate, isUpdateAvailable } from "@/pwa"

/** How often to re-check while the app stays open. */
const POLL_MS = 15 * 60 * 1000

/**
 * Offers the new build when one has shipped.
 *
 * It **asks** rather than reloading on its own. The recipe editor holds unsaved
 * work — a page that swaps itself out mid-recipe to be helpful has destroyed
 * exactly the thing the user cared about. Once dismissed it stays gone for this
 * session; the next launch will offer it again.
 *
 * Checks on mount, whenever the tab comes back to the front (a phone resuming an
 * installed PWA is the case that matters), and on a slow interval for a session
 * left open all day.
 */
const UpdateBanner = () => {
  const [available, setAvailable] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      if (await isUpdateAvailable()) {
        if (!cancelled) setAvailable(true)
      }
    }

    void check()
    const timer = setInterval(() => void check(), POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === "visible") void check()
    }
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])

  if (!available || dismissed) return null

  return (
    <div
      role='status'
      // Above the fixed header (z-40) but below dialogs (z-50) — see the
      // z-index scale in index.css.
      className='fixed inset-x-0 top-0 z-45 border-b border-steel bg-steel-100 pt-[var(--sai-top)]'>
      <div className='mx-auto flex w-full max-w-[900px] items-center gap-3 px-4 py-2.5'>
        <span className='min-w-0 flex-1 text-sm'>A new version is ready.</span>
        <Button
          variant='primary'
          onClick={() => {
            setUpdating(true)
            void applyUpdate()
          }}
          disabled={updating}
          className='mt-0'>
          {updating ? "Updating…" : "Update"}
        </Button>
        <Button variant='ghost' onClick={() => setDismissed(true)} className='mt-0 mr-0'>
          Later
        </Button>
      </div>
    </div>
  )
}

export default UpdateBanner
