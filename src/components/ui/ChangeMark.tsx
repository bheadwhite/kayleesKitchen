import clsx from "clsx"

import type { RowChange } from "@/recipeDiff"

interface ChangeMarkProps {
  change?: RowChange | "removed"
  className?: string
}

/**
 * The little "new" / "changed" flag on a row that differs from the saved
 * recipe.
 *
 * Steel, not a new colour: this is information about the page, not a warning,
 * and the system keeps one accent. It is a label rather than a bare dot because
 * "changed" and "new" are different news — one of them means something you
 * wrote is gone.
 */
const ChangeMark = ({ change = "same", className }: ChangeMarkProps) => {
  if (change === "same") return null

  return (
    <span
      className={clsx(
        "inline-flex h-[17px] shrink-0 items-center border border-steel-300 bg-steel-100 px-1",
        "font-mono text-[9.5px] leading-none tracking-[0.14em] text-steel-700 uppercase",
        className
      )}>
      {change === "added" ? "new" : change}
    </span>
  )
}

export default ChangeMark
