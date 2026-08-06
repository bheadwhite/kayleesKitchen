import clsx from "clsx"

import { AddIcon, Button, ChevronRightIcon, CloseIcon } from "components"
import CoversStepper from "./CoversStepper"
import { addDays, dayLabel, rangeOf, relativeDayLabel, todayISO } from "@/calendar"
import type { MealSlot, PlannedMeal } from "@/types"

/** Breakfast, lunch, dinner — the order a day happens in. */
export const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"]

interface AgendaProps {
  meals: PlannedMeal[]
  /** Weeks from this one. 0 is the seven days starting today. */
  weekOffset: number
  /** How many the session cooks for, so a meal can say it differs. */
  covers: number
  onPrevious: () => void
  onNext: () => void
  onThisWeek: () => void
  onAdd: (date: string, slot: MealSlot) => void
  onRemove: (meal: PlannedMeal) => void
  onOpen: (meal: PlannedMeal) => void
  onServes: (meal: PlannedMeal, serves: number) => void
}

interface MealCardProps {
  meal: PlannedMeal
  covers: number
  onRemove: () => void
  onOpen: () => void
  onServes: (serves: number) => void
}

const MealCard = ({ meal, covers, onRemove, onOpen, onServes }: MealCardProps) => {
  const serves = meal.serves ?? covers

  return (
    <div className='border border-steel bg-steel-100'>
      <div className='flex items-start gap-1'>
        <button
          type='button'
          onClick={onOpen}
          // Named explicitly: without this the button announces as its whole
          // contents — "Pancakes, Sam put this up" — which reads as a sentence
          // rather than as somewhere to go.
          aria-label={`Open ${meal.title}`}
          className='min-w-0 flex-1 cursor-pointer touch-manipulation px-3 py-2.5 text-left'>
          <span className='block truncate font-heading text-[17px] font-semibold'>
            {meal.title}
          </span>
          {meal.byName && (
            <span className='block truncate text-[13px] text-muted'>
              {meal.byName} put this up
            </span>
          )}
        </button>
        <Button
          variant='ghost'
          icon
          onClick={onRemove}
          aria-label={`Take ${meal.title} off ${meal.slot} on ${dayLabel(meal.date)}`}
          className='mt-1 mr-1 h-9 w-9 text-muted hover:text-ink'>
          <CloseIcon className='h-4 w-4' />
        </Button>
      </div>

      <div className='flex items-center gap-2 px-3 pb-2.5'>
        <CoversStepper
          value={serves}
          size='sm'
          onChange={(next) => onServes(next)}
          noun={`eating for ${meal.title}`}
        />
        {/* Whether this number is the session's or this meal's own is the
         *  difference between "changing the session moves it" and "it stays
         *  where I put it", which is worth a few words at the point of use. */}
        <span className='text-[13px] text-muted'>
          {meal.serves == null ? "eating · session default" : "eating · set for this meal"}
        </span>
      </div>
    </div>
  )
}

/**
 * The week, read downwards, one week at a time.
 *
 * A vertical run of days rather than a seven-column grid, because at phone width
 * a true calendar gives each recipe title about three characters. Paged by week
 * rather than scrolled endlessly, because a week is the unit people plan and
 * shop in — and because the query behind it has a floor, so paging back is the
 * only direction that costs a re-subscribe.
 */
const Agenda = ({
  meals,
  weekOffset,
  covers,
  onPrevious,
  onNext,
  onThisWeek,
  onAdd,
  onRemove,
  onOpen,
  onServes,
}: AgendaProps) => {
  const today = todayISO()
  const first = addDays(today, weekOffset * 7)
  const days = rangeOf(first, 7)

  return (
    <div>
      <div className='grid grid-cols-[52px_1fr_52px] items-center gap-2 border-b border-divider pb-3'>
        <Button icon onClick={onPrevious} aria-label='Previous week' className='mt-0 mr-0 w-[52px]'>
          <ChevronRightIcon className='h-5 w-5 rotate-180' />
        </Button>
        <div className='text-center'>
          <p className='font-heading text-[17px] font-semibold tracking-[0.1em] uppercase'>
            {weekOffset === 0 ? "This week" : weekOffset === 1 ? "Next week" : `Week of ${dayLabel(first)}`}
          </p>
          <p className='mt-1 font-mono text-[11px] tracking-[0.14em] text-muted uppercase'>
            {dayLabel(first)} – {dayLabel(days[6])}
          </p>
        </div>
        <Button icon onClick={onNext} aria-label='Next week' className='mt-0 mr-0 w-[52px]'>
          <ChevronRightIcon className='h-5 w-5' />
        </Button>
      </div>

      {weekOffset !== 0 && (
        <Button onClick={onThisWeek} className='mt-3 w-full border-dashed'>
          Back to this week
        </Button>
      )}

      {days.map((date) => {
        const onThisDay = meals.filter((meal) => meal.date === date)
        const isToday = date === today

        return (
          <section key={date} className='border-t border-divider pt-4 pb-1'>
            <div className='mb-2 flex items-baseline gap-2'>
              <h3
                className={clsx(
                  "font-heading text-[21px] font-semibold tracking-[0.06em] uppercase",
                  isToday && "text-steel-700"
                )}>
                {relativeDayLabel(date, today)}
              </h3>
              <span className='font-mono text-[11px] text-muted'>{dayLabel(date)}</span>
              <span className='flex-1' />
              <span className='font-mono text-[11px] text-muted'>
                {onThisDay.length === 0 ? "nothing yet" : `${onThisDay.length} planned`}
              </span>
            </div>

            {SLOTS.map((slot) => {
              const inSlot = onThisDay.filter((meal) => meal.slot === slot)
              return (
                <div key={slot} className='grid grid-cols-[62px_1fr] items-start gap-2 py-1'>
                  <span className='pt-3 font-mono text-[10px] tracking-[0.12em] text-muted uppercase'>
                    {slot}
                  </span>
                  <div className='min-w-0 space-y-1.5'>
                    {inSlot.map((meal) => (
                      <MealCard
                        key={meal.id}
                        meal={meal}
                        covers={covers}
                        onRemove={() => onRemove(meal)}
                        onOpen={() => onOpen(meal)}
                        onServes={(serves) => onServes(meal, serves)}
                      />
                    ))}
                    <button
                      type='button'
                      onClick={() => onAdd(date, slot)}
                      aria-label={
                        inSlot.length === 0
                          ? `Plan ${slot} for ${dayLabel(date)}`
                          : `Plan another ${slot} for ${dayLabel(date)}`
                      }
                      className={clsx(
                        "flex w-full cursor-pointer touch-manipulation items-center gap-1.5 border border-dashed border-divider px-3 text-left",
                        "text-muted transition-colors hover:border-steel hover:bg-steel-100 hover:text-steel-700",
                        inSlot.length === 0 ? "h-12 text-[15px]" : "h-9 text-[13px]"
                      )}>
                      <AddIcon className='h-4 w-4' />
                      {inSlot.length === 0 ? "Plan something" : "Add another"}
                    </button>
                  </div>
                </div>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}

export default Agenda
