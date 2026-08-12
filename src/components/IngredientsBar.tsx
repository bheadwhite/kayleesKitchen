import clsx from "clsx"
import { useEffect, useRef, useState, type RefObject } from "react"

import { ChevronUpIcon } from "components"
import Ingredients from "./Ingredients"
import type { RowDiff } from "@/recipeDiff"
import type { Ingredient } from "@/types"

interface IngredientsBarProps {
  ingredients: Ingredient[]
  /** Passed straight through, so a scaled copy is marked here as it is above. */
  changes?: RowDiff[]
  removed?: number
  checked: string[]
  onToggle: (key: string) => void
  /**
   * The ingredient list in the flow of the page. The bar measures against it,
   * because the question it answers — "how much of that was it?" — only exists
   * once the list itself has scrolled away.
   */
  listRef: RefObject<HTMLElement | null>
}

/** Where the sheet stops. Tall enough for most lists, short enough to read a step behind. */
const SHEET_MAX = "max-h-[min(55dvh,26rem)]"

/**
 * The ingredient list, reachable from the middle of the method.
 *
 * Reading a recipe on a phone is two things at once: you follow the steps, and
 * every few of them you need a quantity that is a screen and a half above you.
 * Scrolling up to fetch it costs your place in the method — you come back and
 * hunt for the step you were on. So the list comes to the step instead: a strip
 * on the bottom edge, where a thumb already is, that pulls the whole list up
 * over the steps and drops it again.
 *
 * Three decisions worth keeping:
 *
 * - **It is absent while the list is what you are reading.** The bar is a way to
 *   reach something you cannot see; drawn directly under the thing it opens, it
 *   is a control that does nothing, and it costs 44px of a phone permanently to
 *   do it. The line it appears at is **halfway down the readable area**, not the
 *   list's last row: waiting for the list to be gone *entirely* meant a recipe
 *   with the method filling the screen and one ingredient line still peeking out
 *   under the top bar had no bar — which is precisely the moment somebody wants
 *   one. Above the halfway line, less than half the screen can still be holding
 *   ingredients, so what you are reading is the method.
 * - **Nothing behind it is blocked.** No backdrop and no scroll lock, unlike
 *   <Drawer>: the step you are asking *about* is on the screen underneath, and
 *   dimming it or freezing it would defeat the point of not having scrolled away
 *   from it. Escape and a second tap on the handle are the ways out; scrolling
 *   back up to the list is a third, since finding it is the same as answering
 *   the question.
 * - **The rows are the same rows**, ticks included — see `checked` on
 *   <Ingredients>. A copy of the list that could not be ticked, or that
 *   disagreed with the one above about what had gone in already, would be a
 *   second list rather than the same one seen from further down.
 */
const IngredientsBar = ({
  ingredients,
  changes,
  removed = 0,
  checked,
  onToggle,
  listRef,
}: IngredientsBarProps) => {
  const [open, setOpen] = useState(false)
  const [pastList, setPastList] = useState(false)
  const topMarkerRef = useRef<HTMLDivElement>(null)
  const bottomMarkerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const check = () => {
      const list = listRef.current
      const top = topMarkerRef.current
      const bottom = bottomMarkerRef.current
      if (list == null || top == null || bottom == null) return
      // The markers are `fixed` at the two edges of the part of the page a
      // person can actually read — under the recipe's sticky action row, above
      // this bar and the nav bar — so their own positions *are* those offsets,
      // safe-area insets included, without parsing a `calc()` over four custom
      // properties back out of the stylesheet. Neither is transformed, so
      // neither moves when this bar slides away.
      const halfway = (top.getBoundingClientRect().top + bottom.getBoundingClientRect().top) / 2
      setPastList(list.getBoundingClientRect().bottom < halfway)
    }

    check()
    window.addEventListener("scroll", check, { passive: true })
    window.addEventListener("resize", check)
    return () => {
      window.removeEventListener("scroll", check)
      window.removeEventListener("resize", check)
    }
    // The list's height moves with its contents, and the check is a comparison
    // against where it ends.
  }, [listRef, ingredients])

  // Scrolling back to the list answers the question the sheet was opened to
  // answer, and leaving it up would then cover the list with itself.
  useEffect(() => {
    if (!pastList) setOpen(false)
  }, [pastList])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open])

  const count = ingredients.length

  return (
    <>
      {/* The two edges of what a person can read: under the recipe's sticky
       *  action row, and above this bar and the nav bar under it. Zero-height,
       *  no background, no pointer target — they exist only to be measured, and
       *  they read `--chrome-top` so the readable area keeps meaning the same
       *  thing whatever is or is not pinned above them. */}
      <div
        ref={topMarkerRef}
        aria-hidden='true'
        className='pointer-events-none fixed inset-x-0 top-[calc(var(--chrome-top)+var(--recipe-actions-h))] h-0'
      />
      <div
        ref={bottomMarkerRef}
        aria-hidden='true'
        className='pointer-events-none fixed inset-x-0 bottom-[calc(var(--navbar-h)+var(--sai-bottom)+var(--ingredients-bar-h))] h-0'
      />

      {/* Stacked on the nav bar exactly as the editor's save bar is. Sliding it
       *  down puts it behind that bar rather than over it — same z value, later
       *  in the document — and a `fixed` box outside the viewport adds nothing
       *  to the page's scrollable overflow. */}
      <div
        // Kept mounted, because the measurement above is a comparison against
        // where this sits. `aria-hidden` is what keeps a handle nobody can see
        // out of the accessibility tree, and `invisible` out of the tab order.
        aria-hidden={!pastList}
        className={clsx(
          "fixed inset-x-0 bottom-[calc(var(--navbar-h)+var(--sai-bottom))] z-40",
          "shadow-[0_-6px_20px_rgba(29,31,32,0.10)] ease-out",
          // `visibility` rides along in the transition for the same reason it
          // does on the panel below: it steps at the end of the duration, so the
          // bar is still drawn while it slides away rather than blinking out.
          "transition-[transform,visibility] duration-200",
          pastList ? "translate-y-0" : "invisible translate-y-full"
        )}>
        {/* `visibility` is in the transition on purpose: it steps at the end of
         *  the duration rather than the start, so the rows are still drawn while
         *  the panel collapses instead of blinking out of an empty box. Closed,
         *  it keeps a stray Tab out of a list nobody can see. */}
        <div
          id='ingredients-bar-sheet'
          aria-hidden={!open}
          className={clsx(
            "overflow-hidden border-t border-divider bg-ground",
            "transition-[max-height,visibility] duration-200 ease-out",
            open ? SHEET_MAX : "invisible max-h-0"
          )}>
          {/* `overscroll-contain`: reaching the end of a long ingredient list
           *  must not start scrolling the recipe underneath it. */}
          <div
            className={clsx(
              "mx-auto w-full max-w-[900px] overflow-y-auto overscroll-contain px-3 pt-1 pb-3 sm:px-2.5",
              SHEET_MAX
            )}>
            {/* The rows exist only once the bar is reachable. They are a second
             *  copy of a list already on the page, and one mounted behind every
             *  recipe nobody scrolls is a duplicate for find-in-page to turn up
             *  and for nothing to read. Nothing is lost by dropping them: the
             *  ticks are held by <Recipe>, not here. */}
            {pastList && (
              <Ingredients
                ingredients={ingredients}
                changes={changes}
                removed={removed}
                checked={checked}
                onToggle={onToggle}
                showHeading={false}
              />
            )}
          </div>
        </div>

        <div className='border-t border-divider bg-surface'>
          <button
            type='button'
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            aria-controls='ingredients-bar-sheet'
            className='mx-auto flex h-[var(--ingredients-bar-h)] w-full max-w-[900px] cursor-pointer items-center gap-2 px-3 text-left hover:bg-steel-100 sm:px-2.5'>
            <ChevronUpIcon
              className={clsx("transition-transform duration-200", open && "rotate-180")}
            />
            <span className='flex-1 font-mono text-[13px] font-semibold tracking-[0.16em] uppercase'>
              Ingredients
            </span>
            <span className='font-mono text-xs text-muted'>
              {count} item{count === 1 ? "" : "s"}
            </span>
          </button>
        </div>
      </div>
    </>
  )
}

export default IngredientsBar
