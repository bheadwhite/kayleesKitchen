import { useEffect, useRef, useState } from "react"

/** Long enough not to fire on a tap, short enough to feel like a press. */
const HOLD_MS = 300

/**
 * Press and hold to see what a line used to say.
 *
 * A "changed" flag tells you where to look but not whether the change was the
 * one you wanted, and the answer is one line of text that has nowhere to live —
 * showing both versions at once doubles the height of every edited row, and a
 * dialog to read six words is worse than not knowing. Under a finger it costs
 * no layout at all, and it goes away when you let go.
 *
 * The rows this sits on are click-to-edit buttons, so the hold must not also
 * open the editor: `onClickCapture` swallows the click that ends a hold. The
 * flag clears on the next press rather than on a timer, so a hold that ends
 * outside the element cannot leave it armed.
 *
 * Callers add `select-none` themselves — a long press on a phone otherwise
 * raises the selection magnifier over the very text being peeked at.
 */
const usePeek = (available: boolean) => {
  const [peeking, setPeeking] = useState(false)
  const held = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stop = () => {
    if (timer.current != null) clearTimeout(timer.current)
    timer.current = null
    setPeeking(false)
  }

  useEffect(() => stop, [])

  if (!available) return { peeking: false, handlers: {} }

  return {
    peeking,
    handlers: {
      onPointerDown: () => {
        held.current = false
        timer.current = setTimeout(() => {
          held.current = true
          setPeeking(true)
        }, HOLD_MS)
      },
      onPointerUp: stop,
      onPointerLeave: stop,
      onPointerCancel: stop,
      onClickCapture: (event: { preventDefault: () => void; stopPropagation: () => void }) => {
        if (!held.current) return
        held.current = false
        event.preventDefault()
        event.stopPropagation()
      },
    },
  }
}

export default usePeek
