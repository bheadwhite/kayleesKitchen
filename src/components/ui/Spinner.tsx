import clsx from "clsx"

interface SpinnerProps {
  className?: string
  /** Diameter in pixels. Matches MUI's CircularProgress default of 40. */
  size?: number
  label?: string
}

/** Replaces MUI's <CircularProgress />. */
const Spinner = ({ className, size = 40, label = "Loading" }: SpinnerProps) => (
  <span
    role='progressbar'
    aria-label={label}
    style={{ width: size, height: size }}
    className={clsx(
      "inline-block animate-spin rounded-full border-4 border-brand-border border-t-brand-blue",
      className
    )}
  />
)

export default Spinner
