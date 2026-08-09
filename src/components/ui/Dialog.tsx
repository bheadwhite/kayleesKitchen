import { useEffect, type ReactNode } from "react"
import { createPortal } from "react-dom"

import Button from "./Button"
import { CloseIcon } from "./Icons"

interface DialogProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  id?: string
  title?: string
  /** Accessible name for the close button. Defaults to `Close {title}`. */
  closeLabel?: string
  /** Buttons for the footer row, right-aligned. Least destructive first. */
  actions?: ReactNode
}

/**
 * A modal at the top of the z-scale: backdrop, Escape to close, in a portal.
 *
 * `title` is rendered — it is the dialog's heading *and* its accessible name,
 * so passing one and then repeating it inside `children` duplicates it for a
 * screen reader.
 *
 * **Every dialog carries a close button**, the same one `<Drawer>` has. The two
 * ways out this had before were tapping the backdrop and pressing Escape:
 * one is invisible and the other does not exist on a phone, which left the
 * session sheet and the meal picker — the two dialogs that are a screen of
 * content rather than a question with buttons under it — with no exit anybody
 * could see. On the confirm dialogs it duplicates Cancel, which is fine: it
 * agrees with it, and both do the safe thing.
 *
 * The header and the footer are pinned and only the middle scrolls. A × that
 * scrolls off the top of a long sheet is the same problem again, one screen
 * further down.
 */
const Dialog = ({
  open,
  onClose,
  children,
  id,
  title,
  closeLabel,
  actions,
}: DialogProps) => {
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
        className='flex max-h-full w-full max-w-[440px] flex-col border border-divider bg-ground shadow-[0_12px_32px_rgba(43,43,45,0.22)]'
        onClick={(e) => e.stopPropagation()}>
        {/* Pinned, so the way out stays reachable from the bottom of a long
         *  sheet. `items-start` keeps the × level with the first line of a
         *  title that wraps rather than centred against two of them. */}
        <div className='flex shrink-0 items-start gap-2 p-4 pb-0'>
          {title ? (
            <h2 id={titleId} className='min-w-0 flex-1 font-heading text-xl font-semibold'>
              {title}
            </h2>
          ) : (
            <span className='flex-1' />
          )}
          <Button
            icon
            variant='ghost'
            onClick={onClose}
            aria-label={closeLabel ?? (title ? `Close ${title}` : "Close")}
            className='mt-0 mr-0 shrink-0'>
            <CloseIcon />
          </Button>
        </div>
        <div className='min-h-0 flex-1 overflow-auto px-4 pt-3 pb-4 text-sm text-ink/85'>
          {children}
        </div>
        {actions && (
          <div className='flex shrink-0 justify-end gap-2 px-4 pb-4'>{actions}</div>
        )}
      </div>
    </div>,
    document.body
  )
}

export default Dialog
