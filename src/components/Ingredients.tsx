import clsx from "clsx"
import { useState } from "react"

import { SectionHeading } from "components"
import type { Ingredient } from "@/types"

interface IngredientsProps {
  ingredients?: Ingredient[]
}

const Ingredients = ({ ingredients }: IngredientsProps) => {
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
          </button>
        )
      })}
    </div>
  )
}

export default Ingredients
