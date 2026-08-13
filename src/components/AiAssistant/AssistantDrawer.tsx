import clsx from "clsx"
import { useState } from "react"

import AiAssistant from "./AiAssistant"
import { ChefHatIcon, Drawer, Spinner } from "components"
import {
  useAssistantStatus,
  useAssistantTurns,
  useProposedDraft,
} from "contexts/AiDraftProvider"

/**
 * The chef, in a drawer you pull out over the editor.
 *
 * **The same chef as the one on the recipe page**, deliberately: one helper who
 * knows about cooking, met in two places. What differs is what it can reach —
 * here it proposes a draft for an editor you own, there it hands back a copy of
 * a recipe you are only reading — and that difference belongs to the situation,
 * not to two personalities with two names.
 *
 * It used to be a panel at the bottom of the form, which put a conversation
 * about the whole recipe below every part of it: you scrolled past the thing
 * you wanted to talk about to reach the box, then scrolled back to see what
 * changed. Over the top, the recipe stays where it was.
 *
 * The panel mechanics — kept mounted, slid off-screen, page locked behind it —
 * live in `<Drawer>`, shared with the recipe page's.
 */
interface AssistantDrawerProps {
  /** The household's tag vocabulary, handed straight to `<AiAssistant>`. */
  tagLibrary?: string[]
  /** Every title in the recipe box, handed on the same way. */
  recipeTitles?: string[]
  /** Colour per tag name, so the category chips are the ones people know. */
  tagColors?: Record<string, string>
}

const AssistantDrawer = ({ tagLibrary, recipeTitles, tagColors }: AssistantDrawerProps) => {
  const [open, setOpen] = useState(false)
  const turns = useAssistantTurns()
  const proposedDraft = useProposedDraft()
  const { isAsking } = useAssistantStatus()

  return (
    <>
      {/* Sits above the save bar rather than in it: that row is already four
       *  controls wide on a phone, and this one opens a conversation rather
       *  than doing something to the recipe. */}
      <button
        type='button'
        onClick={() => setOpen(true)}
        aria-label='Open the chef'
        className={clsx(
          "fixed right-3 z-40 flex h-12 cursor-pointer touch-manipulation items-center gap-2",
          "bottom-[calc(var(--navbar-h)+var(--editor-actions-h)+var(--sai-bottom)+0.75rem)]",
          "border border-steel bg-steel px-4 text-ground shadow-[0_4px_14px_rgba(43,43,45,0.2)]",
          "font-heading text-sm font-semibold tracking-[0.09em] uppercase hover:bg-steel-600",
          open && "invisible"
        )}>
        {isAsking ? <Spinner size={18} /> : <ChefHatIcon />}
        Chef
        {/* A draft waiting to be applied is the one thing that needs saying from
         *  out here — with the panel closed there is nothing else to show it. */}
        {proposedDraft != null && (
          <span className='ml-0.5 flex h-5 min-w-5 items-center justify-center border border-ground bg-ground px-1 font-mono text-[10px] text-steel-700'>
            1
          </span>
        )}
      </button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title='Chef'
        closeLabel='Close chef'
        focusId='assistant-message'
        meta={
          turns.length > 0
            ? `${turns.length} message${turns.length === 1 ? "" : "s"}`
            : undefined
        }>
        <AiAssistant
          onApplied={() => setOpen(false)}
          tagLibrary={tagLibrary}
          recipeTitles={recipeTitles}
          tagColors={tagColors}
        />
      </Drawer>
    </>
  )
}

export default AssistantDrawer
