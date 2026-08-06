import { useEffect, useState } from "react"

import { AddIcon, Button, MinusIcon, UsersIcon } from "components"
import {
  useBaseServes,
  useChefFork,
  useChefPresenter,
  useChefStatus,
  useRecipeYield,
} from "contexts/ChefProvider"

/** A household, not a banquet hall. Past this it is a catering question. */
const MIN = 1
const MAX = 50

/**
 * "Feed this many people."
 *
 * The control has two states, and the split is the honest one: a recipe does
 * not record how many it makes, so until the chef has read a yield out of it
 * there is no number for a stepper to count from — "double it" is a guess about
 * a quantity nobody has established. So the first state asks the one question
 * whose answer the second state needs, in one tap.
 *
 * Stepping does **not** send. Each send is a model call, and walking from four
 * to eight would otherwise be four of them; you set the number you want and
 * then commit it, which is also what makes "Scale to 8" honest about what
 * pressing it costs.
 */
const ServingsControl = () => {
  const chef = useChefPresenter()
  const baseServes = useBaseServes()
  const fork = useChefFork()
  const settled = useRecipeYield()
  const { isAsking } = useChefStatus()
  const servingSize = fork?.servingSize ?? settled?.servingSize

  /** What is on the plate right now — the copy's yield, or the recipe's own. */
  const current = fork?.serves ?? baseServes
  const [wanted, setWanted] = useState(current ?? MIN)

  // Follow the chef. After a scale lands the stepper should read the number it
  // arrived at, not the one you last pressed towards — and if the chef revised
  // its estimate mid-conversation, the stepper has to move with it.
  useEffect(() => {
    if (current != null) setWanted(current)
  }, [current])

  const doubleIt = (
    <Button onClick={() => void chef.double()} disabled={isAsking} className='mt-0 mr-0'>
      Double it
    </Button>
  )

  if (baseServes == null) {
    return (
      <div className='mx-4 mt-2 border border-divider bg-surface p-3'>
        <p className='text-sm text-muted'>
          This recipe doesn&rsquo;t say how many it feeds. Ask, and you can scale it from
          there.
        </p>
        {/* Doubling is offered here too, because it is the one scaling request
         *  that stands on its own: "twice the recipe" needs no yield to mean
         *  something, so making it wait behind the question would be asking for
         *  a model call to enable a model call. */}
        <div className='mt-2 flex flex-wrap items-center gap-2'>
          <Button onClick={() => void chef.askYield()} disabled={isAsking} className='mt-0 mr-0'>
            <UsersIcon />
            How many does this feed?
          </Button>
          {doubleIt}
        </div>
      </div>
    )
  }

  const step = (by: number) => setWanted((n) => Math.min(MAX, Math.max(MIN, n + by)))
  const changed = wanted !== current
  // Hidden once it would hand back what is already on screen — the same rule
  // "Scale to N" follows, for the same reason: a live button that spends a call
  // to change nothing.
  const offerDouble = baseServes * 2 <= MAX && fork?.serves !== baseServes * 2

  return (
    <div className='mx-4 mt-2 border border-divider bg-surface p-3'>
      <div className='font-mono text-[11px] tracking-[0.14em] text-muted uppercase'>
        Feeds
      </div>

      <div className='mt-1.5 flex flex-wrap items-center gap-2'>
        <div className='flex items-center border border-divider bg-ground'>
          <button
            type='button'
            onClick={() => step(-1)}
            disabled={wanted <= MIN}
            aria-label='One fewer person'
            className='flex h-11 w-11 cursor-pointer touch-manipulation items-center justify-center hover:bg-ink/7 disabled:cursor-default disabled:opacity-35'>
            <MinusIcon />
          </button>
          <span
            aria-live='polite'
            aria-label={`${wanted} people`}
            className='min-w-11 text-center font-heading text-2xl leading-none font-semibold tabular-nums'>
            {wanted}
          </span>
          <button
            type='button'
            onClick={() => step(1)}
            disabled={wanted >= MAX}
            aria-label='One more person'
            className='flex h-11 w-11 cursor-pointer touch-manipulation items-center justify-center hover:bg-ink/7 disabled:cursor-default disabled:opacity-35'>
            <AddIcon />
          </button>
        </div>

        {/* Four presses and a commit, or one tap. Doubling is far and away the
         *  scale people ask for, and walking the stepper to it every time is a
         *  chore the button exists to skip. */}
        {offerDouble && doubleIt}

        {/* Only once it would do something. A live button that means "ask again
         *  for exactly what you already have" spends a call to say nothing. */}
        {changed && (
          <Button
            onClick={() => void chef.scaleTo(wanted)}
            disabled={isAsking}
            variant='primary'
            className='mt-0 mr-0'>
            Scale to {wanted}
          </Button>
        )}
      </div>

      <p className='mt-1.5 text-xs text-muted'>
        {fork == null
          ? `The recipe as written feeds ${baseServes}.`
          : `Written for ${baseServes}; this version feeds ${fork.serves}.`}
        {/* One serving, so the count means something. It does not change with
         *  the stepper — scaling makes more servings, not bigger ones. */}
        {servingSize ? ` A serving is ${servingSize}.` : ""}
        {/* How the chef read it off the recipe. Costs nothing once the estimate
         *  is stored, and it is the difference between a number to argue with
         *  and a number to take on faith. */}
        {settled?.basis ? ` ${settled.basis}` : ""}
      </p>
    </div>
  )
}

export default ServingsControl
