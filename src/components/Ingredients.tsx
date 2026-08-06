import clsx from "clsx"
import { useState } from "react"

import { ChangeMark, SectionHeading } from "components"
import type { RowDiff } from "@/recipeDiff"
import type { Ingredient } from "@/types"

interface IngredientsProps {
  ingredients?: Ingredient[]
  /**
   * One entry per ingredient, when the list on screen is the chef's copy rather
   * than the filed recipe. Absent means "this is the recipe" — a list wearing a
   * flag on every row would be saying nothing.
   */
  changes?: RowDiff[]
  /** How many the filed recipe had that this copy does not. */
  removed?: number
}

const Ingredients = ({ ingredients, changes, removed = 0 }: IngredientsProps) => {
  const [checked, setChecked] = useState<string[]>([])

  const toggle = (key: string) =>
    setChecked((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key]
    )

  const count = ingredients?.length ?? 0

  return (
    <div>
      <SectionHeading meta={`${count} item${count === 1 ? "" : "s"}`}>Ingredients</SectionHeading>
      {/* The whole row toggles, not just the name: a single word is too small a
       *  target on a phone, and a <button> makes it keyboard-reachable too. */}
      {ingredients?.map((ingredient, index) => {
        const key = `${ingredient.name}-${index}`
        const isChecked = checked.includes(key)
        const change = changes?.[index]?.kind
        return (
          <button
            key={key}
            type='button'
            aria-pressed={isChecked}
            onClick={() => toggle(key)}
            className={clsx(
              "flex w-full cursor-pointer items-baseline gap-1.5 border-b border-ink/8 py-2.5 text-left",
              isChecked && "line-through opacity-45"
            )}>
            {/* `unique` used to be red and everything else green. This system is
             *  mono, so the mark is emphasis instead of hue: an unusual
             *  ingredient — the one worth a special trip — takes the accent. */}
            <span className={clsx("font-medium", ingredient.unique && "text-steel-700")}>
              {ingredient.name}
            </span>
            <span className='text-ink/70'>{`— ${ingredient.amount}`}</span>
            {ingredient.optional && <span className='text-sm text-muted'>(optional)</span>}
            {/* The mark is the fastest read of what the chef touched: on a
             *  scaled list it is the difference between "everything moved" and
             *  "only the flour did", and a summary sentence cannot say which
             *  line. Unpressable here — there is nothing to revert to on a copy
             *  you can drop whole. */}
            <ChangeMark change={change} className='ml-auto self-center' />
          </button>
        )
      })}

      {removed > 0 && (
        <p className='py-2.5 text-sm text-muted'>
          {removed} ingredient{removed === 1 ? "" : "s"} dropped from the original.
        </p>
      )}
    </div>
  )
}

export default Ingredients
