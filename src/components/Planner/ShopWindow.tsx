import clsx from "clsx"

import { Button, Spinner } from "components"
import { addDays, rangeOf, todayISO } from "@/calendar"
import { HORIZON_DAYS } from "presenters/PlannerPresenter"
import type { PlannedMeal } from "@/types"

interface ShopWindowProps {
  meals: PlannedMeal[]
  picked: string[]
  onToggleDay: (date: string) => void
  onPickDays: (dates: string[]) => void
  onBuild: () => void
  isBuilding: boolean
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const sameDays = (a: string[], b: string[]) =>
  a.length === b.length && a.every((day) => b.includes(day))

/**
 * Which days the next build covers.
 *
 * Days are **picked**, not a rolling "next N" — because the run people shop for
 * is rarely a prefix. You shop Thursday for the weekend, or for the four nights
 * somebody is actually home. The presets cover the common runs so the usual case
 * is still one tap.
 *
 * The button says how many meals it is about to read, because the build is the
 * one recurring model call in the app and a control that will not say what it
 * costs gets pressed twice.
 */
const ShopWindow = ({
  meals,
  picked,
  onToggleDay,
  onPickDays,
  onBuild,
  isBuilding,
}: ShopWindowProps) => {
  const today = todayISO()
  const horizon = rangeOf(today, HORIZON_DAYS)
  const plannedOn = (date: string) => meals.some((meal) => meal.date === date)
  const covered = meals.filter((meal) => picked.includes(meal.date)).length

  const presets: Array<[string, string[]]> = [
    ["Next 3 days", horizon.slice(0, 3)],
    ["Next 5 days", horizon.slice(0, 5)],
    ["This week", horizon.slice(0, 7)],
    ["Next week", horizon.slice(7, 14)],
    ["Planned only", horizon.filter(plannedOn)],
  ]

  return (
    <div>
      <div className='mb-2 flex items-baseline justify-between gap-3'>
        <p className='font-mono text-[12px] font-semibold tracking-[0.14em] uppercase'>
          Shopping for
        </p>
        <p className='font-mono text-[11px] text-muted'>
          {picked.length === 0
            ? "no days picked"
            : `${picked.length} day${picked.length === 1 ? "" : "s"} · ${covered} meal${covered === 1 ? "" : "s"}`}
        </p>
      </div>

      {/* One scrolling row rather than a wrapping block: fourteen chips over
       *  three lines would push the button that acts on them off the screen. */}
      <div className='overflow-x-auto pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
        <div className='flex w-max gap-1.5'>
          {horizon.map((date) => {
            const on = picked.includes(date)
            const day = new Date(`${date}T00:00:00`).getDay()
            return (
              <button
                key={date}
                type='button'
                onClick={() => onToggleDay(date)}
                aria-pressed={on}
                aria-label={`${DOW[day]} ${date.slice(8)}${plannedOn(date) ? ", has meals planned" : ""}`}
                className={clsx(
                  "flex h-[68px] w-[54px] shrink-0 cursor-pointer touch-manipulation flex-col items-center justify-center gap-0.5 border transition-colors",
                  on
                    ? "border-steel-900 bg-steel-900 text-ground"
                    : "border-divider text-muted hover:border-steel hover:bg-steel-100"
                )}>
                <span className='font-mono text-[10px] tracking-[0.1em] uppercase'>
                  {DOW[day]}
                </span>
                <span className='font-heading text-[17px] font-semibold'>
                  {Number(date.slice(8))}
                </span>
                {/* A dot for a day with something on it — the difference
                 *  between picking a useful run and picking an empty one. */}
                <span className='grid h-1.5 place-items-center'>
                  {plannedOn(date) && (
                    <span className={clsx("h-1.5 w-1.5", on ? "bg-steel-300" : "bg-steel")} />
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className='overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
        <div className='flex w-max gap-1.5'>
          {presets.map(([label, days]) => {
            const on = days.length > 0 && sameDays(days, picked)
            return (
              <Button
                key={label}
                onClick={() => onPickDays(days)}
                aria-pressed={on}
                className={clsx(
                  "mt-0 mr-0 shrink-0 whitespace-nowrap",
                  on && "border-steel bg-steel-100 text-steel-700"
                )}>
                {label}
              </Button>
            )
          })}
        </div>
      </div>

      <Button
        variant='primary'
        onClick={onBuild}
        disabled={isBuilding || picked.length === 0 || covered === 0}
        className='mt-0 mr-0 h-[52px] w-full'>
        {isBuilding && <Spinner size={16} />}
        {isBuilding
          ? "Chef is writing it up"
          : picked.length === 0
            ? "Pick some days"
            : `Write up ${covered} meal${covered === 1 ? "" : "s"}`}
      </Button>

      <p className='mt-2 text-[13px] leading-snug text-muted'>
        {picked.length === 0
          ? "Pick at least one day above."
          : covered === 0
            ? "Nothing planned on those days — plan a meal, or pick others."
            : "Everything gets scaled to however many are eating, then merged and sorted by aisle. Anything already ticked stays as you left it."}
      </p>
    </div>
  )
}

export default ShopWindow
