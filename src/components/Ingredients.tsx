import clsx from "clsx"
import { useState } from "react"

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

  return (
    <div>
      <h3 className='mt-4 mb-1 text-lg font-medium'>Ingredients</h3>
      {ingredients?.map((ingredient, index) => {
        const key = `${ingredient.name}-${index}`
        return (
          <div key={key} className={clsx(checked.includes(key) && "line-through")}>
            <span
              className={clsx(
                "cursor-pointer font-medium",
                ingredient.unique ? "text-brand-red" : "text-brand-green"
              )}
              onClick={() => toggle(key)}>
              {ingredient.name}
            </span>
            <span>{` - ${ingredient.amount}`}</span>
            {ingredient.optional && <span className='text-brand-muted'> (optional) </span>}
          </div>
        )
      })}
    </div>
  )
}

export default Ingredients
