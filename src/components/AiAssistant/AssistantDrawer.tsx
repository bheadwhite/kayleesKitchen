import clsx from "clsx"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

import AiAssistant from "./AiAssistant"
import { Button, CloseIcon, SparklesIcon, Spinner } from "components"
import {
  useAssistantStatus,
  useAssistantTurns,
  useProposedDraft,
} from "contexts/AiDraftProvider"

/**
 * The recipe assistant, in a drawer you pull out over the editor.
 *
 * It used to be a panel at the bottom of the form, which put a conversation
 * about the whole recipe below every part of it: you scrolled past the thing
 * you wanted to talk about to reach the box, then scrolled back to see what
 * changed. Over the top, the recipe stays where it was.
 *
 * The panel is **kept mounted** and slid off-screen rather than unmounted — a
 * half-typed message is local state, and closing the drawer must not be a way
 * to lose it. A fixed box translated out of the viewport is excluded from the
 * document's scrollable overflow, so this costs no stray horizontal scroll.
 */
const AssistantDrawer = () => {
  const [open, setOpen] = useState(false)
  const turns = useAssistantTurns()
  const proposedDraft = useProposedDraft()
  const { isAsking } = useAssistantStatus()

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)

    // The page behind must not scroll under the drawer — on a phone that reads
    // as the recipe wandering off while you type.
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"

    // Straight into the message box: opening this is always a prelude to
    // typing. After paint, or the element is not there to take focus yet.
    const focus = setTimeout(() => document.getElementById("assistant-message")?.focus(), 0)

    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previous
      clearTimeout(focus)
    }
  }, [open])

  const drawer = (
    <>
      {open && (
        <div
          className='fixed inset-0 z-[48] bg-steel-900/50'
          onClick={() => setOpen(false)}
          aria-hidden='true'
        />
      )}

      <div
        role='dialog'
        aria-modal={open}
        aria-label='Recipe assistant'
        aria-hidden={!open}
        className={clsx(
          "fixed inset-y-0 right-0 z-[48] flex w-full flex-col border-l border-divider bg-ground",
          "pt-[var(--sai-top)] pb-[var(--sai-bottom)] shadow-[0_0_32px_rgba(43,43,45,0.22)]",
          "transition-transform duration-200 ease-out sm:max-w-[440px]",
          // `invisible` when closed keeps a stray Tab out of a panel nobody can
          // see. It costs the slide-*out* animation, which nobody was watching.
          open ? "translate-x-0" : "invisible translate-x-full"
        )}>
        <div className='flex h-[var(--header-h)] shrink-0 items-center gap-2 border-b border-divider px-4'>
          <h2 className='flex-1 font-heading text-xl font-semibold tracking-[0.04em] uppercase'>
            Recipe assistant
          </h2>
          {turns.length > 0 && (
            <span className='font-mono text-[11px] tracking-[0.14em] text-muted uppercase'>
              {turns.length} message{turns.length === 1 ? "" : "s"}
            </span>
          )}
          <Button icon variant='ghost' onClick={() => setOpen(false)} aria-label='Close assistant'>
            <CloseIcon />
          </Button>
        </div>

        <AiAssistant onApplied={() => setOpen(false)} />
      </div>
    </>
  )

  return (
    <>
      {/* Sits above the save bar rather than in it: that row is already four
       *  controls wide on a phone, and this one opens a conversation rather
       *  than doing something to the recipe. */}
      <button
        type='button'
        onClick={() => setOpen(true)}
        aria-label='Open the recipe assistant'
        className={clsx(
          "fixed right-3 z-40 flex h-12 cursor-pointer touch-manipulation items-center gap-2",
          "bottom-[calc(var(--navbar-h)+var(--editor-actions-h)+var(--sai-bottom)+0.75rem)]",
          "border border-steel bg-steel px-4 text-ground shadow-[0_4px_14px_rgba(43,43,45,0.2)]",
          "font-heading text-sm font-semibold tracking-[0.09em] uppercase hover:bg-steel-600",
          open && "invisible"
        )}>
        {isAsking ? <Spinner size={18} /> : <SparklesIcon />}
        Assistant
        {/* A draft waiting to be applied is the one thing that needs saying from
         *  out here — with the panel closed there is nothing else to show it. */}
        {proposedDraft != null && (
          <span className='ml-0.5 flex h-5 min-w-5 items-center justify-center border border-ground bg-ground px-1 font-mono text-[10px] text-steel-700'>
            1
          </span>
        )}
      </button>

      {createPortal(drawer, document.body)}
    </>
  )
}

export default AssistantDrawer
