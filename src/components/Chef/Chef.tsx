import clsx from "clsx"
import { useEffect, useRef, useState } from "react"
import { toast } from "react-toastify"

import ServingsControl from "./ServingsControl"
import { Button, CheckIcon, SendIcon, Spinner } from "components"
import { useSessionUser } from "contexts/AuthProvider"
import {
  useChefFork,
  useChefPresenter,
  useChefSaveStatus,
  useChefStatus,
  useChefTurns,
  useSavedAs,
} from "contexts/ChefProvider"

/**
 * Openers. Not a menu of everything the chef does — the questions worth one tap
 * when you are standing over a recipe with nothing typed yet.
 *
 * "How many does this feed?" is deliberately **not** here: the servings control
 * below already asks exactly that, and offering the same question twice on one
 * screen makes the reader stop to work out whether the two buttons differ.
 */
const OPENERS = [
  "What can I substitute here?",
  "Can I make any of this ahead?",
  "What should I watch out for?",
]

/**
 * The conversation with the chef, for a recipe you are reading.
 *
 * The sibling of `<AiAssistant>`, and deliberately not the same component: that
 * one proposes a draft you apply to an editor you own, this one hands back a
 * working copy of a recipe you may not own and never writes anything. Sharing
 * them would mean one component that is careful about a baseline half the time.
 *
 * Laid out to fill whatever height it is given. The transcript is the only part
 * that scrolls; the servings control and the composer stay pinned, because the
 * two things you reach for repeatedly should not scroll away.
 */
const Chef = () => {
  const chef = useChefPresenter()
  const user = useSessionUser()
  const turns = useChefTurns()
  const fork = useChefFork()
  const savedAs = useSavedAs()
  const { isAsking } = useChefStatus()
  const { isSaving } = useChefSaveStatus()

  const [text, setText] = useState("")
  const transcriptRef = useRef<HTMLDivElement>(null)

  // Keep the newest turn in view as the conversation grows.
  useEffect(() => {
    const el = transcriptRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [turns.length, isAsking])

  const ask = async (message: string) => {
    try {
      await chef.send(message)
    } catch (error) {
      throw error instanceof Error ? error : new Error("The chef could not answer.")
    }
  }

  const onSend = async () => {
    const message = text
    setText("")
    try {
      await ask(message)
    } catch (error) {
      setText(message) // Put it back so the question is not lost.
      toast.error(error instanceof Error ? error.message : "The chef could not answer.")
    }
  }

  const onOpener = async (message: string) => {
    try {
      await ask(message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The chef could not answer.")
    }
  }

  const onSave = async () => {
    try {
      await chef.saveFork(user?.email ?? null)
      toast.success("Kept. You can load it again without asking.")
    } catch {
      toast.error("Could not keep that version.")
    }
  }

  const canSend = !isAsking && text.trim() !== ""

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <div
        ref={transcriptRef}
        className='min-h-0 flex-1 overflow-y-auto px-4 py-2'
        aria-live='polite'
        aria-label='Conversation with the chef'>
        {turns.length === 0 && (
          <div className='py-2 text-sm text-muted'>
            <p>
              Ask about this recipe — how many it feeds, what you can swap, whether it
              keeps. If the answer changes the recipe, you get a copy to cook from and the
              original stays exactly as it is.
            </p>
            <ul className='mt-3 flex flex-col items-start gap-2'>
              {OPENERS.map((opener) => (
                <li key={opener}>
                  <button
                    type='button'
                    onClick={() => void onOpener(opener)}
                    disabled={isAsking}
                    className='cursor-pointer border border-divider px-3 py-1.5 text-left text-[15px] text-ink hover:bg-ink/7 disabled:cursor-default disabled:opacity-50'>
                    {opener}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {turns.map((turn, index) => (
          <div
            key={index}
            className={clsx("my-2 flex", turn.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={clsx(
                "max-w-[86%] border border-divider px-3 py-2.5 text-[15px] leading-snug",
                turn.role === "user" ? "bg-steel text-ground" : "bg-ground"
              )}>
              <span className='break-words whitespace-pre-wrap'>{turn.text}</span>
            </div>
          </div>
        ))}

        {isAsking && (
          <div className='flex items-center gap-2 py-2 text-sm text-muted'>
            <Spinner size={18} />
            Thinking it through…
          </div>
        )}
      </div>

      {/* What the chef last did to the recipe. The marked-up recipe behind this
       *  panel shows *which* lines moved; this says why, and names the thing a
       *  list of changed quantities cannot — the pan it has outgrown, the
       *  seasoning that was not doubled. */}
      {fork != null && (
        <div className='mx-4 mt-2 border border-steel bg-steel-100 p-3'>
          <div className='flex items-center justify-between gap-2'>
            <span className='font-mono text-[11px] tracking-[0.14em] text-steel-700 uppercase'>
              Your copy · feeds {fork.serves}
            </span>
            <button
              type='button'
              onClick={() => chef.discardFork()}
              className='cursor-pointer font-mono text-[11px] tracking-[0.14em] text-steel-700 uppercase underline underline-offset-4'>
              Discard
            </button>
          </div>
          <p className='mt-1.5 text-sm'>{fork.summary}</p>

          {/* Keeping a copy is the difference between asking "double it" once
           *  and asking it every Thanksgiving. One tap, named by the chef —
           *  a copy you have to stop and title is a copy nobody keeps. */}
          {savedAs == null ? (
            <Button
              onClick={() => void onSave()}
              disabled={isSaving}
              className='mt-2 mr-0'>
              Keep this as &ldquo;{fork.label}&rdquo;
            </Button>
          ) : (
            <p className='mt-2 flex items-center gap-1.5 text-sm text-steel-700'>
              <CheckIcon />
              Kept as &ldquo;{fork.label}&rdquo; — it will be here next time.
            </p>
          )}
        </div>
      )}

      <ServingsControl />

      <div className='mt-2 flex flex-wrap items-end gap-2 border-t border-divider px-4 pt-3 pb-1'>
        <textarea
          id='chef-message'
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter is a newline — the convention every chat
            // box uses, and the opposite of the recipe's own step boxes, where
            // Enter belongs to the text.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              if (canSend) void onSend()
            }
          }}
          rows={2}
          placeholder='Ask the chef about this recipe…'
          aria-label='Ask the chef'
          className='min-w-0 flex-1 basis-full border border-divider bg-surface px-3 py-2 text-base hover:border-ink/45 focus-visible:border-steel focus-visible:outline-offset-0 sm:basis-0'
        />

        <Button onClick={() => void onSend()} disabled={!canSend} variant='primary'>
          <SendIcon />
          Ask
        </Button>
      </div>
    </div>
  )
}

export default Chef
