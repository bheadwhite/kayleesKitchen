import clsx from "clsx"

import { AddIcon, MinusIcon } from "components"
import { MAX_COVERS, MIN_COVERS } from "presenters/PlannerPresenter"

interface CoversStepperProps {
  value: number
  onChange: (next: number) => void
  /** What one step means, for the screen reader — "eating", "at the table". */
  noun?: string
  /** Larger, for the session header; the default suits a meal card. */
  size?: "sm" | "md"
  suffix?: string
  disabled?: boolean
}

/**
 * How many are eating.
 *
 * A stepper rather than a number field: this is touched with one thumb in a
 * kitchen, the range is one to twenty-four, and a keyboard over the whole screen
 * to change four to six is the wrong trade. **Stepping costs nothing** — the
 * scaling rules are cached per recipe and answer any number — so unlike the
 * chef's servings control there is no call behind a press and no reason to make
 * anyone confirm.
 */
const CoversStepper = ({
  value,
  onChange,
  noun = "eating",
  size = "md",
  suffix,
  disabled = false,
}: CoversStepperProps) => {
  const step = (delta: number) => onChange(Math.min(MAX_COVERS, Math.max(MIN_COVERS, value + delta)))
  const box = size === "md" ? "h-11 w-11" : "h-9 w-9"

  return (
    <div className='inline-flex items-center border border-steel bg-ground'>
      <button
        type='button'
        onClick={() => step(-1)}
        disabled={disabled || value <= MIN_COVERS}
        aria-label={`One fewer ${noun}`}
        className={clsx(
          box,
          "grid cursor-pointer touch-manipulation place-items-center text-steel-700",
          "transition-colors hover:bg-steel-100 disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent"
        )}>
        <MinusIcon className='h-4 w-4' />
      </button>

      <span
        className={clsx(
          "grid place-items-center border-x border-divider px-2 font-heading font-semibold tracking-[0.04em]",
          size === "md" ? "min-w-[42px] text-lg" : "min-w-[34px] text-base"
        )}>
        {value}
        {suffix && <span className='sr-only'> {suffix}</span>}
      </span>

      <button
        type='button'
        onClick={() => step(1)}
        disabled={disabled || value >= MAX_COVERS}
        aria-label={`One more ${noun}`}
        className={clsx(
          box,
          "grid cursor-pointer touch-manipulation place-items-center text-steel-700",
          "transition-colors hover:bg-steel-100 disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent"
        )}>
        <AddIcon className='h-4 w-4' />
      </button>
    </div>
  )
}

export default CoversStepper
