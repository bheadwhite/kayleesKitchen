import { useEffect, type ReactNode } from "react"
import { createPortal } from "react-dom"

interface DialogProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  id?: string
  title?: string
  /** Buttons for the footer row, right-aligned. Least destructive first. */
  actions?: ReactNode
}

/**
 * A modal at the top of the z-scale: backdrop, Escape to close, in a portal.
 *
 * `title` is rendered — it is the dialog's heading *and* its accessible name,
 * so passing one and then repeating it inside `children` duplicates it for a
 * screen reader.
 */
const Dialog = ({ open, onClose, children, id, title, actions }: DialogProps) => {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const titleId = title ? `${id ?? "dialog"}-title` : undefined

  return createPortal(
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-steel-900/50 p-4'
      onClick={onClose}>
      <div
        id={id}
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        aria-label={titleId ? undefined : title}
        className='flex max-h-full w-full max-w-[440px] flex-col gap-3 overflow-auto border border-divider bg-ground p-4 shadow-[0_12px_32px_rgba(43,43,45,0.22)]'
        onClick={(e) => e.stopPropagation()}>
        {title && (
          <h2 id={titleId} className='font-heading text-xl font-semibold'>
            {title}
          </h2>
        )}
        <div className='text-sm text-ink/85'>{children}</div>
        {actions && <div className='mt-1 flex justify-end gap-2'>{actions}</div>}
      </div>
    </div>,
    document.body
  )
}

export default Dialog
