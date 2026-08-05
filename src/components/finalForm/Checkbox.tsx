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
    <label className='mr-3 inline-flex cursor-pointer items-center gap-1.5 text-sm'>
      <input
        id={name}
        name={name}
        type='checkbox'
        checked={checked ?? Boolean(input.value)}
        onChange={(event) => change(name, event.target.checked)}
        onFocus={input.onFocus}
        onBlur={input.onBlur}
        className={clsx("h-4 w-4 cursor-pointer accent-brand-blue", className)}
        {...props}
      />
      {label && <span>{label}</span>}
    </label>
  )
}

export default Checkbox
