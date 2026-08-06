import { useMemo, useState } from "react"

import { Button, Dialog, SearchIcon } from "components"
import { SLOTS } from "./Agenda"
import { dayLabel, rangeOf, relativeDayLabel, todayISO } from "@/calendar"
import type { MealSlot, Recipe } from "@/types"

/** How far ahead the slot picker offers. Two weeks, like the agenda. */
const DAYS_OFFERED = 14

export interface PlanTarget {
  date: string
  slot: MealSlot
}

interface PlanMealDialogProps {
  open: boolean
  onClose: () => void
  recipes: Recipe[]
  /**
   * The slot being filled — set when this was opened from the agenda, so the
   * dialog asks which recipe. Null when it was opened from a recipe, and the
   * question is which day instead.
   */
  target: PlanTarget | null
  /** The recipe being placed. Null when the agenda is asking for one. */
  recipe: Recipe | null
  onPlan: (date: string, slot: MealSlot, recipe: Recipe) => void
}

const matches = (recipe: Recipe, needle: string) =>
  `${recipe.title} ${recipe.contributor ?? ""}`.toLowerCase().includes(needle)

/**
 * Planning a meal, from either end.
 *
 * The agenda opens it on a day and a slot and asks which recipe; a recipe opens
 * it on a recipe and asks which day. **One component, because it is one
 * decision** — a pair of them would be two places for "what does planning a meal
 * write", and a change to one would silently apply to only one of the two ways
 * in. The same rule the editor's `?edit=` param follows.
 */
const PlanMealDialog = ({
  open,
  onClose,
  recipes,
  target,
  recipe,
  onPlan,
}: PlanMealDialogProps) => {
  const [filter, setFilter] = useState("")
  const today = todayISO()

  const listed = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    const named = recipes.filter((entry) => Boolean(entry.title))
    const sorted = [...named].sort((a, b) => a.title.localeCompare(b.title))
    return needle ? sorted.filter((entry) => matches(entry, needle)) : sorted
  }, [recipes, filter])

  const close = () => {
    setFilter("")
    onClose()
  }

  const plan = (date: string, slot: MealSlot, chosen: Recipe) => {
    onPlan(date, slot, chosen)
    close()
  }

  /* ---------------------------------------------------- which day and slot */

  if (recipe != null) {
    return (
      <Dialog open={open} onClose={close} title={`When are you cooking ${recipe.title}?`}>
        <ul className='-mx-1 max-h-[55vh] overflow-y-auto'>
          {rangeOf(today, DAYS_OFFERED).map((date) => (
            <li
              key={date}
              className='flex items-center gap-2 border-b border-divider px-1 py-1.5 last:border-b-0'>
              <span className='w-[104px] shrink-0 font-mono text-[10px] tracking-[0.14em] text-muted uppercase'>
                {relativeDayLabel(date, today)}
              </span>
              <div className='flex flex-1 gap-1'>
                {SLOTS.map((slot) => (
                  <Button
                    key={slot}
                    onClick={() => plan(date, slot, recipe)}
                    aria-label={`${slot} on ${dayLabel(date)}`}
                    className='mt-0 mr-0 min-h-9 flex-1 px-0 text-[11px] tracking-[0.06em]'>
                    {slot.slice(0, 3)}
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </Dialog>
    )
  }

  /* ------------------------------------------------------- which recipe */

  return (
    <Dialog
      open={open}
      onClose={close}
      title={
        target == null
          ? "Plan a meal"
          : `What's for ${target.slot} ${relativeDayLabel(target.date, today).toLowerCase()}?`
      }>
      <div className='relative'>
        <SearchIcon className='pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-steel' />
        <input
          type='search'
          autoFocus
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder='Search recipes'
          aria-label='Search recipes'
          className='h-11 w-full border border-divider bg-surface pr-3 pl-9 text-base hover:border-ink/45 focus-visible:border-steel focus-visible:outline-offset-0'
        />
      </div>

      {listed.length === 0 ? (
        <p className='py-8 text-center text-muted'>
          {recipes.length === 0 ? "No recipes yet." : `Nothing matches "${filter.trim()}".`}
        </p>
      ) : (
        <ul className='-mx-1 mt-2 max-h-[50vh] overflow-y-auto'>
          {listed.map((entry) => (
            <li key={entry.id} className='border-b border-divider last:border-b-0'>
              <button
                type='button'
                onClick={() => target != null && plan(target.date, target.slot, entry)}
                className='w-full cursor-pointer touch-manipulation px-1 py-2.5 text-left hover:bg-steel-100'>
                <span className='block truncate text-[15px]'>{entry.title}</span>
                {entry.contributor && (
                  <span className='block truncate font-mono text-[10px] tracking-[0.14em] text-muted uppercase'>
                    {entry.contributor}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}

export default PlanMealDialog
