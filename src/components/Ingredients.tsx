import clsx from "clsx"

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
  /**
   * Which rows are ticked, and how to tick one.
   *
   * Held by <Recipe> rather than here, because this list is drawn **twice** —
   * in the flow of the page and again inside the bar pulled up over the steps —
   * and two copies of it disagreeing about what has already gone in the bowl is
   * worse than not being able to tick anything at all. Keys are stable across
   * both, since both are given the same array.
   */
  checked: string[]
  onToggle: (key: string) => void
  /**
   * The bar draws its own heading, and a second one directly beneath it would
   * repeat the word and the count in the space of two rows.
   */
  showHeading?: boolean
}

/** The key a row is ticked under. By position: a recipe may list a name twice. */
const rowKey = (ingredient: Ingredient, index: number) => `${ingredient.name}-${index}`

const Ingredients = ({
  ingredients,
  changes,
  removed = 0,
  checked,
  onToggle,
  showHeading = true,
}: IngredientsProps) => {
  const count = ingredients?.length ?? 0

  return (
    <div>
      {showHeading && (
        <SectionHeading meta={`${count} item${count === 1 ? "" : "s"}`}>Ingredients</SectionHeading>
      )}
      {/* The whole row toggles, not just the name: a single word is too small a
       *  target on a phone, and a <button> makes it keyboard-reachable too. */}
      {ingredients?.map((ingredient, index) => {
        const key = rowKey(ingredient, index)
        const isChecked = checked.includes(key)
        const change = changes?.[index]?.kind
        return (
          <button
            key={key}
            type='button'
            aria-pressed={isChecked}
            onClick={() => onToggle(key)}
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
