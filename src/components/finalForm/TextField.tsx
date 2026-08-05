import clsx from "clsx"
import { forwardRef, type ChangeEvent, type InputHTMLAttributes } from "react"
import { useField, useForm } from "react-final-form"

export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "onChange"> {
  name: string
  label?: string
  fullWidth?: boolean
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void
}

/**
 * react-final-form <-> input bridge, previously wrapping MUI's TextField.
 *
 * The ref lands on the wrapper div, not the input: several callers do
 * `ref.current.querySelector("input").focus()`. The `id` lands on the input,
 * because `components/NewRecipe/utils.js` focuses fields by element id.
 */
const TextField = forwardRef<HTMLDivElement, TextFieldProps>(
  ({ name, label, fullWidth = false, className, value, onChange, id, ...props }, ref) => {
    const { change } = useForm()
    const {
      input,
      meta: { touched, error },
    } = useField(name, {
      subscription: { touched: true, error: true, value: true },
    })

    const showError = Boolean(touched && error)
    const errorId = `${id ?? name}-error`
    const handleChange =
      onChange ?? ((event: ChangeEvent<HTMLInputElement>) => change(name, event.target.value))

    return (
      <div
        ref={ref}
        className={clsx("my-1 flex flex-col", fullWidth ? "w-full" : "w-full max-w-[380px]")}>
        {label && (
          <label
            htmlFor={id ?? name}
            className='mb-1 font-mono text-[11px] tracking-[0.14em] text-muted uppercase'>
            {label}
          </label>
        )}
        <input
          id={id ?? name}
          name={name}
          type='text'
          autoComplete={name}
          value={(value as string | number | undefined) ?? (input.value as string) ?? ""}
          onChange={handleChange}
          onFocus={input.onFocus}
          onBlur={input.onBlur}
          aria-invalid={showError}
          aria-describedby={showError ? errorId : undefined}
          className={clsx(
            // 16px, not the system's 14px: anything smaller and iOS zooms the
            // whole page in when the field takes focus.
            "w-full border bg-surface px-3 py-2.5 text-base",
            "focus-visible:outline-offset-0",
            showError
              ? "border-danger focus-visible:outline-danger"
              : "border-divider hover:border-ink/45 focus-visible:border-steel",
            className
          )}
          {...props}
        />
        {showError && (
          <span id={errorId} role='alert' className='mt-1 text-sm text-danger'>
            {String(error)}
          </span>
        )}
      </div>
    )
  }
)

TextField.displayName = "TextField"

export default TextField
