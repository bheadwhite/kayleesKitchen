import clsx from "clsx"
import {
  forwardRef,
  useLayoutEffect,
  useRef,
  type ChangeEvent,
  type TextareaHTMLAttributes,
} from "react"
import { useField, useForm } from "react-final-form"

export interface TextAreaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "onChange" | "rows"> {
  name: string
  label?: string
  fullWidth?: boolean
  /** Height before the content grows past it. */
  minRows?: number
  onChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void
}

/**
 * The multi-line sibling of `TextField`, for content long enough that a
 * single-line input would hide most of it behind a horizontal scroll.
 *
 * Same contract as `TextField`: the forwarded ref lands on the wrapper div (so
 * callers keep doing `ref.current.querySelector("textarea").focus()`), and `id`
 * lands on the control itself.
 *
 * It grows with its content rather than scrolling — a recipe step is read while
 * cooking, and a box that shows three of its seven lines is the thing being
 * complained about. `resize-none` because the height is ours to set; leaving the
 * grab handle in place would let a drag fight the next keystroke's re-measure.
 */
const TextArea = forwardRef<HTMLDivElement, TextAreaProps>(
  (
    { name, label, fullWidth = false, minRows = 2, className, value, onChange, id, ...props },
    ref
  ) => {
    const { change } = useForm()
    const {
      input,
      meta: { touched, error },
    } = useField(name, {
      subscription: { touched: true, error: true, value: true },
    })
    const areaRef = useRef<HTMLTextAreaElement>(null)

    const showError = Boolean(touched && error)
    const errorId = `${id ?? name}-error`
    const current = (value as string | undefined) ?? (input.value as string) ?? ""
    const handleChange =
      onChange ??
      ((event: ChangeEvent<HTMLTextAreaElement>) => change(name, event.target.value))

    // Re-measure on every value change, including the one that arrives with the
    // step being opened for editing — `auto` first, or the box can only ever
    // grow, never shrink back after a deletion.
    useLayoutEffect(() => {
      const area = areaRef.current
      if (area == null) return
      area.style.height = "auto"
      area.style.height = `${area.scrollHeight}px`
    }, [current])

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
        <textarea
          ref={areaRef}
          id={id ?? name}
          name={name}
          rows={minRows}
          value={current}
          onChange={handleChange}
          onFocus={input.onFocus}
          onBlur={input.onBlur}
          aria-invalid={showError}
          aria-describedby={showError ? errorId : undefined}
          className={clsx(
            // 16px, not the system's 14px: anything smaller and iOS zooms the
            // whole page in when the field takes focus.
            "w-full resize-none overflow-hidden border bg-surface px-3 py-2.5 text-base leading-relaxed",
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

TextArea.displayName = "TextArea"

export default TextArea
