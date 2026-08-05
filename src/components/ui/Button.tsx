import clsx from "clsx"
import { forwardRef, type ButtonHTMLAttributes } from "react"

export type ButtonVariant = "primary" | "secondary" | "ghost"

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * `secondary` by default — a hairline outline. The design system allows the
   * solid accent fill on *one* object per view, so `primary` is opt-in and
   * should stay rare: the page's single real commitment (Submit, Apply, Send).
   */
  variant?: ButtonVariant
  /** Marks an irreversible action. Composes with any variant. */
  danger?: boolean
  /** Square, text-free action — sized to a touch target, no label padding. */
  icon?: boolean
}

/**
 * Buttons default to `type="button"` so the many icon buttons inside the recipe
 * editor's <form> stop submitting it by accident.
 *
 * Square corners, hairline border, Barlow Condensed label in uppercase: in this
 * system a button is a drawn object, not a soft filled pill. Sizing is
 * mobile-first — 44x44 minimum, the smallest reliable touch target — shrinking
 * to a denser 34px at `sm:` where there is a pointer.
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      danger = false,
      icon = false,
      className,
      type = "button",
      children,
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      type={type}
      className={clsx(
        "mt-1 mr-1 inline-flex cursor-pointer touch-manipulation items-center justify-center gap-1.5",
        "border transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        // Uppercase condensed is the system's button voice. Tracking is what
        // keeps it readable once it is capitalised.
        "font-heading text-sm font-semibold tracking-[0.09em] uppercase",
        icon
          ? "h-11 w-11 p-0 sm:h-9 sm:w-9"
          : "min-h-11 px-4 py-2 sm:min-h-[34px] sm:px-3.5 sm:py-1.5",
        variant === "primary" &&
          (danger
            ? "border-danger bg-danger text-ground hover:bg-danger/85"
            : "border-steel bg-steel text-ground hover:bg-steel-600 active:bg-steel-700"),
        variant === "secondary" &&
          (danger
            ? "border-danger/40 text-danger hover:bg-danger-100"
            : "border-divider text-ink hover:bg-ink/7 active:bg-ink/12"),
        variant === "ghost" &&
          (danger
            ? "border-transparent text-danger hover:bg-danger-100"
            : "border-transparent text-steel-700 hover:bg-steel-100"),
        className
      )}
      {...props}>
      {children}
    </button>
  )
)

Button.displayName = "Button"

export default Button
