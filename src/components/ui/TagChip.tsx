import clsx from "clsx"
import type { ReactNode } from "react"

import { chipStyle } from "@/tagColors"

interface TagChipProps {
  name: string
  /** Colour id from `src/tagColors.ts`. Unknown or missing falls back to steel. */
  color?: string | null
  /** Trailing mark — the × on a removable chip. */
  children?: ReactNode
  /** Drawn as an outline instead of a fill: "available", not "applied". */
  muted?: boolean
  size?: "sm" | "md"
  onClick?: () => void
  /** Required with `onClick` — the visible text is lowercase, the label is not. */
  label?: string
  /** Toggle state, for chips that turn a filter on and off. */
  pressed?: boolean
  className?: string
}

/**
 * One tag, everywhere it appears: the list rows, the recipe page, the editor,
 * the manager.
 *
 * The colour arrives as an inline style rather than a class because it is a
 * runtime value — Tailwind builds its stylesheet by scanning source text, so a
 * class assembled from a tag's colour id would simply not exist.
 */
const TagChip = ({
  name,
  color,
  children,
  muted = false,
  size = "md",
  onClick,
  label,
  pressed,
  className,
}: TagChipProps) => {
  const classes = clsx(
    "inline-flex shrink-0 items-center gap-1 border font-mono tracking-[0.12em] uppercase",
    size === "sm" ? "h-[19px] px-1.5 text-[9.5px]" : "h-7 px-2 text-[11px]",
    onClick != null && "cursor-pointer",
    className
  )

  // Muted drops the fill but keeps the tag's own ink, so the colour still
  // identifies it while the chip reads as an offer rather than a statement.
  const style = muted
    ? { ...chipStyle(color), backgroundColor: "transparent" }
    : chipStyle(color)

  if (onClick == null) {
    return (
      <span className={classes} style={style}>
        {name}
        {children}
      </span>
    )
  }

  return (
    <button
      type='button'
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={classes}
      style={style}>
      {name}
      {children}
    </button>
  )
}

export default TagChip
