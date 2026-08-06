import clsx from "clsx"
import { useEffect, useState, type MouseEvent } from "react"

import type { RowChange } from "@/recipeDiff"

/** Long enough to reach with a thumb, short enough not to sit there armed. */
const OFFER_MS = 4000

const BASE =
  "inline-flex h-[17px] shrink-0 items-center border px-1 font-mono text-[9.5px] " +
  "leading-none tracking-[0.14em] uppercase"

interface ChangeMarkProps {
  change?: RowChange | "removed"
  /** Makes the mark pressable: tap it, then confirm, to put the line back. */
  onRevert?: () => void
  className?: string
}

/**
 * The little "new" / "changed" flag on a row that differs from the saved
 * recipe — and, where a revert is possible, the way back.
 *
 * Steel, not a new colour: this is information about the page, not a warning,
 * and the system keeps one accent. It is a label rather than a bare dot because
 * "changed" and "new" are different news — one of them means something you
 * wrote is gone.
 *
 * **Tap it and it offers "Revert"; tap that and it asks "Sure?" in the same
 * spot.** Two taps in one place, no dialog and no travel: the confirmation
 * lands under the finger that is already there, which is what makes it quick
 * enough to use on the phone this app is read from. It disarms itself after a
 * few seconds, so a stray tap does not leave a destructive button sitting under
 * the next one.
 */
const ChangeMark = ({ change = "same", onRevert, className }: ChangeMarkProps) => {
  const [stage, setStage] = useState<"mark" | "offer" | "confirm">("mark")

  useEffect(() => {
    if (stage === "mark") return
    const timer = setTimeout(() => setStage("mark"), OFFER_MS)
    return () => clearTimeout(timer)
  }, [stage])

  if (change === "same") return null

  const label = change === "added" ? "new" : change

  if (onRevert == null) {
    return (
      <span className={clsx(BASE, "border-steel-300 bg-steel-100 text-steel-700", className)}>
        {label}
      </span>
    )
  }

  // These marks sit inside rows that are themselves click-to-edit, so every
  // press here has to stop where it is.
  const press = (event: MouseEvent, next: () => void) => {
    event.preventDefault()
    event.stopPropagation()
    next()
  }

  if (stage === "mark") {
    return (
      <button
        type='button'
        onClick={(event) => press(event, () => setStage("offer"))}
        aria-label={`${label} — revert this line`}
        title={`${label} — tap to revert`}
        className={clsx(
          BASE,
          "cursor-pointer border-steel-300 bg-steel-100 text-steel-700 hover:bg-steel-200",
          className
        )}>
        {label}
      </button>
    )
  }

  const confirming = stage === "confirm"

  return (
    <button
      type='button'
      onClick={(event) =>
        press(event, () => {
          if (confirming) {
            onRevert()
            setStage("mark")
          } else {
            setStage("confirm")
          }
        })
      }
      aria-label={confirming ? "Confirm revert" : "Revert this line"}
      // Brick, not the page's ground: the row it sits on is already tinted
      // steel to say "changed", and a chip filled with something close to that
      // reads as part of the row rather than as a control that has appeared on
      // it. Different family, so the eye lands on it as a different object.
      className={clsx(
        BASE,
        "cursor-pointer",
        confirming
          ? "border-danger bg-danger text-ground"
          : "border-danger bg-danger-100 text-danger hover:bg-danger/15",
        className
      )}>
      {confirming ? "Sure?" : "Revert"}
    </button>
  )
}

export default ChangeMark
