import clsx from "clsx"

interface SpinnerProps {
  className?: string
  /** Diameter in pixels. */
  size?: number
  label?: string
}

/**
 * Busy indicator. A hairline ring with one steel quadrant — thin enough to
 * belong among the drawn objects around it, where a heavy 4px ring read as a
 * foreign widget.
 */
const Spinner = ({ className, size = 40, label = "Loading" }: SpinnerProps) => (
  <span
    role='progressbar'
    aria-label={label}
    style={{ width: size, height: size }}
    className={clsx(
      "inline-block animate-spin rounded-full border-2 border-divider border-t-steel",
      className
    )}
  />
)

export default Spinner
