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
    const handleChange =
      onChange ?? ((event: ChangeEvent<HTMLInputElement>) => change(name, event.target.value))

    return (
      <div
        ref={ref}
        className={clsx("my-1 flex flex-col", fullWidth ? "w-full" : "w-full max-w-[380px]")}>
        {label && (
          <label htmlFor={id ?? name} className='mb-1 text-sm text-gray-700'>
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
          className={clsx(
            "w-full rounded border bg-white px-3 py-2.5 text-base outline-none",
            "focus:border-brand-blue focus:ring-1 focus:ring-brand-blue",
            showError ? "border-brand-red" : "border-brand-border",
            className
          )}
          {...props}
        />
      </div>
    )
  }
)

TextField.displayName = "TextField"

export default TextField
