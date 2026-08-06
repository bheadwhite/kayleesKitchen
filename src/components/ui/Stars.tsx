import clsx from "clsx"

/**
 * A star, drawn twice: an outline for the empty half of the rating and a filled
 * one for the earned half.
 *
 * The system's icons are Lucide at stroke-width 1.5 and `fill="none"`, and this
 * is the one deliberate exception — a rating out of five that is all outlines is
 * unreadable at a glance, which is the only thing a rating is for. The stroke
 * weight matches the rest, so it still reads as the same hand.
 */
const Star = ({ filled, className }: { filled: boolean; className?: string }) => (
  <svg
    viewBox='0 0 24 24'
    width='1em'
    height='1em'
    fill={filled ? "currentColor" : "none"}
    stroke='currentColor'
    strokeWidth={1.5}
    strokeLinecap='round'
    strokeLinejoin='round'
    focusable='false'
    aria-hidden='true'
    className={clsx("inline-block h-[1.15em] w-[1.15em] shrink-0", className)}>
    <path d='M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.7-5.2-2.7-5.2 2.7 1-5.7L3.5 9.7l5.9-.9z' />
  </svg>
)

interface StarsProps {
  /** 0–5; halves are rounded to the nearest whole star for the fill. */
  value: number
  className?: string
}

/** Read-only rating, for a recipe's average. */
export const Stars = ({ value, className }: StarsProps) => (
  <span className={clsx("inline-flex items-center gap-0.5 text-steel", className)}>
    {[1, 2, 3, 4, 5].map((star) => (
      <Star key={star} filled={value >= star - 0.5} />
    ))}
  </span>
)

interface StarPickerProps {
  /** The rating this person has left, or null. */
  value: number | null
  onRate: (stars: number) => void
  disabled?: boolean
  className?: string
}

/**
 * The interactive version: five buttons, because a star rating is five discrete
 * choices and a slider or a drag would be neither on a phone with wet hands.
 */
export const StarPicker = ({ value, onRate, disabled = false, className }: StarPickerProps) => (
  <span className={clsx("inline-flex items-center gap-1", className)} role='group'>
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        type='button'
        disabled={disabled}
        onClick={() => onRate(star)}
        aria-label={`${star} star${star === 1 ? "" : "s"}`}
        aria-pressed={value === star}
        title={`${star} star${star === 1 ? "" : "s"}`}
        className={clsx(
          "flex h-11 w-9 cursor-pointer touch-manipulation items-center justify-center text-xl",
          "disabled:cursor-not-allowed disabled:opacity-45",
          value != null && star <= value ? "text-steel" : "text-muted hover:text-steel"
        )}>
        <Star filled={value != null && star <= value} />
      </button>
    ))}
  </span>
)

export default Stars
