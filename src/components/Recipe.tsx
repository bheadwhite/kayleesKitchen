import Ingredients from "./Ingredients"
import type { Recipe as RecipeType } from "@/types"

interface RecipeProps {
  recipe?: RecipeType | null
}

const Recipe = ({ recipe }: RecipeProps) => {
  if (recipe == null) return null

  const { ingredients, directions, image, contributor, title } = recipe

  return (
    <div>
      <h1 className='text-3xl font-semibold max-sm:text-[25px]'>{title}</h1>
      {image != null && image.length > 1 && (
        <div className='flex items-center justify-center'>
          <img src={image} alt='recipe preview' className='max-h-[200px]' />
        </div>
      )}
      {contributor != null && <p className='text-sm text-gray-600'>Contributed by: {contributor}</p>}

      <Ingredients ingredients={ingredients} />

      {directions?.map((section, index) => (
        <div key={`${section.sectionTitle}-${index}`}>
          <h3 className='mt-4 font-semibold text-brand-blue'>{section.sectionTitle}</h3>
          {section.steps.map((step, i) => (
            <label key={i} className='flex cursor-pointer items-start gap-2 py-0.5'>
              <input type='checkbox' className='mt-1 cursor-pointer accent-brand-blue' />
              <span>{step}</span>
            </label>
          ))}
        </div>
      ))}
    </div>
  )
}

export default Recipe
