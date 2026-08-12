import clsx from "clsx"
import { useEffect, type ReactNode } from "react"
import { createPortal } from "react-dom"

import Button from "./Button"
import { CloseIcon } from "./Icons"

interface DrawerProps {
  open: boolean
  onClose: () => void
  /** Names the panel — both the heading and its accessible name. */
  title: string
  /** A small mono note beside the title: a message count, a servings figure. */
  meta?: ReactNode
  /** Accessible name for the close button. Defaults to `Close {title}`. */
  closeLabel?: string
  /**
   * Element id to focus when the drawer opens. Opening one of these is always a
   * prelude to typing, so the cursor should already be in the box.
   */
  focusId?: string
  children: ReactNode
}

/**
 * A panel you pull out over the page from the right.
 *
 * Three details are load-bearing, and each was a bug first:
 *
 * - **It stays mounted and slides off-screen** rather than unmounting. A
 *   half-typed message is local state inside `children`, and closing the drawer
 *   must not be a way to lose it. A fixed box translated out of the viewport is
 *   excluded from the document's scrollable overflow, so this costs no stray
 *   horizontal scroll.
 * - **`invisible` when closed** keeps a stray Tab out of a panel nobody can see,
 *   and `aria-hidden` keeps it out of the accessibility tree entirely — which is
 *   what makes a plain role query the right test for "is this open".
 * - **The page behind must not scroll** under it. On a phone that reads as the
 *   thing you are reading wandering off while you type.
 */
const Drawer = ({
  open,
  onClose,
  title,
  meta,
  closeLabel,
  focusId,
  children,
}: DrawerProps) => {
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)

    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"

    // After paint, or the element is not there to take focus yet.
    const focus = setTimeout(() => {
      if (focusId) document.getElementById(focusId)?.focus()
    }, 0)

    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previous
      clearTimeout(focus)
    }
  }, [open, onClose, focusId])

  return createPortal(
    <>
      {open && (
        <div
          className='fixed inset-0 z-[48] bg-steel-900/50'
          onClick={onClose}
          aria-hidden='true'
        />
      )}

      <div
        role='dialog'
        aria-modal={open}
        aria-label={title}
        aria-hidden={!open}
        className={clsx(
          "fixed inset-y-0 right-0 z-[48] flex w-full flex-col border-l border-divider bg-ground",
          "pt-[var(--sai-top)] pb-[var(--sai-bottom)] shadow-[0_0_32px_rgba(43,43,45,0.22)]",
          "transition-transform duration-200 ease-out sm:max-w-[440px]",
          open ? "translate-x-0" : "invisible translate-x-full"
        )}>
        {/* Its own token, not the app's header height. It borrowed that for
         *  years because the two happened to match, and then the header was
         *  deleted — a drawer whose title row collapses to nothing is a long way
         *  from an obvious consequence of removing a wordmark. */}
        <div className='flex h-[var(--drawer-header-h)] shrink-0 items-center gap-2 border-b border-divider px-4'>
          <h2 className='flex-1 font-heading text-xl font-semibold tracking-[0.04em] uppercase'>
            {title}
          </h2>
          {meta != null && (
            <span className='font-mono text-[11px] tracking-[0.14em] text-muted uppercase'>
              {meta}
            </span>
          )}
          <Button icon variant='ghost' onClick={onClose} aria-label={closeLabel ?? `Close ${title}`}>
            <CloseIcon />
          </Button>
        </div>

        {children}
      </div>
    </>,
    document.body
  )
}

export default Drawer
