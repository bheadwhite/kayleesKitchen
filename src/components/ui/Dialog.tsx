import { useEffect, type ReactNode } from "react"
import { createPortal } from "react-dom"

interface DialogProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  id?: string
  title?: string
}

/** Replaces MUI's <Dialog>: backdrop, Escape to close, rendered in a portal. */
const Dialog = ({ open, onClose, children, id, title }: DialogProps) => {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'
      onClick={onClose}>
      <div
        id={id}
        role='dialog'
        aria-modal='true'
        aria-label={title}
        className='max-h-full w-full max-w-md overflow-auto rounded bg-white shadow-xl'
        onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  )
}

export default Dialog
