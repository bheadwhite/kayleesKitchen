import clsx from "clsx"
import type { InputHTMLAttributes } from "react"
import { useField, useForm } from "react-final-form"

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "onChange" | "type"> {
  name: string
  label?: string
}

/** react-final-form <-> checkbox bridge, previously wrapping MUI's Checkbox. */
const Checkbox = ({ name, label, checked, className, ...props }: CheckboxProps) => {
  const { change } = useForm()
  const { input } = useField(name, {
    subscription: { touched: true, error: true, value: true },
  })

  return (
    <label className='mr-3 inline-flex min-h-11 cursor-pointer items-center gap-2 text-base sm:min-h-0 sm:gap-1.5 sm:text-sm'>
      <input
        id={name}
        name={name}
        type='checkbox'
        checked={checked ?? Boolean(input.value)}
        onChange={(event) => change(name, event.target.checked)}
        onFocus={input.onFocus}
        onBlur={input.onBlur}
        className={clsx(
          "h-5 w-5 shrink-0 cursor-pointer accent-steel sm:h-4 sm:w-4",
          className
        )}
        {...props}
      />
      {label && <span>{label}</span>}
    </label>
  )
}

export default Checkbox
