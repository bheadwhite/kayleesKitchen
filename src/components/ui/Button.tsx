import clsx from "clsx"
import { forwardRef, type ButtonHTMLAttributes } from "react"

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  danger?: boolean
}

/**
 * Replaces MUI's <Button>. Buttons default to `type="button"` so the many
 * icon buttons inside the recipe editor's <form> stop submitting it by accident.
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ danger = false, className, type = "button", children, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={clsx(
        "mt-1 mr-1 inline-flex cursor-pointer items-center justify-center gap-1 rounded px-3 py-1.5 text-sm font-medium text-white transition-colors",
        "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        danger
          ? "bg-brand-red hover:bg-brand-red/85 focus-visible:ring-brand-red"
          : "bg-brand-blue hover:bg-brand-blue/85 focus-visible:ring-brand-blue",
        className
      )}
      {...props}>
      {children}
    </button>
  )
)

Button.displayName = "Button"

export default Button
