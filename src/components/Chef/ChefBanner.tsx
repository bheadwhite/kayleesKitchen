import clsx from "clsx"
import { useEffect, useRef, useState } from "react"

import ChefVersions from "./ChefVersions"
import { UsersIcon } from "components"
import { useChefFork, useChefPresenter, useChefVariants } from "contexts/ChefProvider"

interface ChefBannerProps {
  /** True while the reader has flipped back to the recipe as filed. */
  showingOriginal: boolean
  onToggleOriginal: () => void
  /** Opens the chef's panel, which is where the servings control lives. */
  onOpenChef: () => void
}

/**
 * The strip that says the recipe underneath is a working copy.
 *
 * It exists because the fork is invisible otherwise: a doubled ingredient list
 * looks exactly like a recipe that was always written for eight, and someone
 * arriving at this page from a lock screen twenty minutes later has no way to
 * tell which they are reading. So it names the copy, says who it feeds, and
 * keeps the way back one tap away.
 *
 * **Show original swaps the whole page rather than annotating a line.** The
 * editor's press-and-hold peek answers "what did this row say before" for one
 * row; here the question is "is this still the recipe", and the answer is the
 * recipe. The copy is not thrown away by looking.
 *
 * It is rendered **twice**: a full card in the flow of the page, and a compact
 * bar fixed under the toolbar that takes over once the card has scrolled away.
 * The alternative — one `position: sticky` card that drops its summary when it
 * sticks — changes the height of an element that is still in the flow, so
 * everything below it jumps the moment you scroll past. Two elements, one of
 * them out of flow, and nothing moves.
 */
const ChefBanner = ({ showingOriginal, onToggleOriginal, onOpenChef }: ChefBannerProps) => {
  const chef = useChefPresenter()
  const fork = useChefFork()
  const variants = useChefVariants()
  const cardRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const [scrolledPast, setScrolledPast] = useState(false)

  useEffect(() => {
    const check = () => {
      const card = cardRef.current
      const bar = barRef.current
      if (card == null || bar == null) return
      // The bar is `fixed`, so its own top *is* the resolved offset under the
      // toolbar — safe-area inset included — without parsing a calc() over two
      // custom properties back out of the stylesheet.
      setScrolledPast(card.getBoundingClientRect().bottom < bar.getBoundingClientRect().top)
    }

    check()
    window.addEventListener("scroll", check, { passive: true })
    window.addEventListener("resize", check)
    return () => {
      window.removeEventListener("scroll", check)
      window.removeEventListener("resize", check)
    }
    // Re-measured when either changes: the summary and the versions row both
    // change the card's height, and the check is a comparison against it.
  }, [fork, variants.length])

  // Nothing to say when there is neither a copy on screen nor one to load.
  if (fork == null && variants.length === 0) return null

  const onCopy = fork != null && !showingOriginal
  const label = onCopy ? "The chef's copy" : "The recipe as filed"
  const serves = showingOriginal ? fork?.baseServes : fork?.serves
  const back = showingOriginal ? "Back to the copy" : "Show original"

  /* Tapping the yield opens the panel, because the stepper that changes it
   * lives there — the number is that control's own label. */
  const servesButton = (compact: boolean) => (
    <button
      type='button'
      onClick={onOpenChef}
      aria-label='Change how many this feeds'
      className={clsx(
        "inline-flex cursor-pointer items-center gap-1.5 border border-divider bg-ground tracking-[0.02em] hover:bg-ink/7",
        compact ? "h-7 px-2 text-[12.5px]" : "h-8 px-2.5 text-[13px]"
      )}>
      <UsersIcon />
      Feeds {serves}
    </button>
  )

  const originalButton = (
    <button
      type='button'
      onClick={onToggleOriginal}
      className='cursor-pointer font-mono text-[11px] tracking-[0.14em] text-steel-700 uppercase underline underline-offset-4'>
      {back}
    </button>
  )

  return (
    <>
      <div
        ref={cardRef}
        className={clsx(
          "mb-4 border p-3",
          onCopy ? "border-steel bg-steel-100" : "border-divider bg-surface"
        )}>
        <div className='flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5'>
          <span
            className={clsx(
              "font-mono text-[11px] tracking-[0.14em] uppercase",
              onCopy ? "text-steel-700" : "text-muted"
            )}>
            {label}
          </span>

          {fork != null && (
            <div className='flex items-center gap-2'>
              {servesButton(false)}
              {originalButton}
              {/* Reachable from the recipe, not only from inside the panel:
               *  "put it back the way it was" should not require opening a
               *  conversation to find. */}
              <button
                type='button'
                onClick={() => chef.discardFork()}
                className='cursor-pointer font-mono text-[11px] tracking-[0.14em] text-steel-700 uppercase underline underline-offset-4'>
                Discard
              </button>
            </div>
          )}
        </div>

        {/* The one thing that cannot fit in the bar, and the reason the card is
         *  worth its height: what the chef actually did, and the pan you now
         *  need. Read once at the top; the bar carries the rest down.
         *
         *  Kept — muted — while the original is showing rather than removed,
         *  because "Show original" is reachable from the bar halfway down the
         *  recipe, and dropping four lines out of a card above you shunts the
         *  step you were reading up the screen. Same text, same height, and it
         *  is still what your copy does. */}
        {fork != null && (
          <p className={clsx("mt-1.5 text-sm", showingOriginal && "text-muted")}>
            {fork.summary}
          </p>
        )}

        <ChefVersions />
      </div>

      {/* Kept mounted rather than conditionally rendered — the measurement above
       *  reads this element's own position to decide whether to show it, so it
       *  has to be laid out even while hidden. `aria-hidden` is what keeps its
       *  duplicate controls out of the accessibility tree while it is away, and
       *  `invisible` keeps them out of the tab order. */}
      <div
        ref={barRef}
        aria-hidden={!scrolledPast || fork == null}
        className={clsx(
          "fixed inset-x-0 z-30 border-b border-divider transition-opacity duration-150",
          "top-[calc(var(--header-h)+var(--sai-top))]",
          onCopy ? "bg-steel-100" : "bg-surface",
          // Only while a copy is loaded: with the recipe as filed on screen
          // there is no "which version am I reading" to answer.
          scrolledPast && fork != null ? "opacity-100" : "invisible opacity-0"
        )}>
        <div className='mx-auto flex h-11 w-full max-w-[900px] items-center gap-x-3 px-3 sm:px-2.5'>
          <span
            className={clsx(
              "min-w-0 flex-1 truncate font-mono text-[11px] tracking-[0.14em] uppercase",
              onCopy ? "text-steel-700" : "text-muted"
            )}>
            {label}
          </span>
          {fork != null && servesButton(true)}
          {fork != null && originalButton}
        </div>
      </div>
    </>
  )
}

export default ChefBanner
