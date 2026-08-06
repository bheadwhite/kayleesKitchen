import { useState } from "react"

import { SectionHeading, TagChip } from "components"
import Ingredients from "./Ingredients"
import RecipeRating from "./RecipeRating"
import type { Recipe as RecipeType } from "@/types"

interface RecipeProps {
  recipe?: RecipeType | null
  /** Colour id per tag name — see the same prop on `RecipeTable`. */
  tagColors?: Record<string, string>
}

const Recipe = ({ recipe, tagColors = {} }: RecipeProps) => {
  // A stored image URL can stop resolving (deleted file, Storage billing off).
  // Drop the <img> rather than leaving a broken-image icon in the recipe.
  const [imageFailed, setImageFailed] = useState(false)

  if (recipe == null) return null

  const { ingredients, directions, image, contributor, title, tags } = recipe
  const stepCount = directions?.reduce((total, section) => total + section.steps.length, 0) ?? 0

  return (
    <div>
      {image != null && image.length > 1 && !imageFailed && (
        <div className='blueprint mb-5 aspect-[16/10] w-full bg-surface'>
          <img
            src={image}
            alt=''
            onError={() => setImageFailed(true)}
            className='h-full w-full object-cover'
          />
        </div>
      )}

      <h1 className='font-heading text-[34px] leading-[1.08] font-bold break-words'>{title}</h1>

      {/* The credit and the tags read as one row of the same object: both are
       *  what this recipe *is*, before anything about cooking it. */}
      <div className='mt-2 mb-1 flex flex-wrap items-center gap-2'>
        {contributor != null && contributor !== "" && (
          <p className='inline-flex h-8 items-center border border-divider bg-steel-100 px-2.5 text-[13px] tracking-[0.02em] text-steel-700'>
            From {contributor}
          </p>
        )}
        {(tags ?? []).map((tag) => (
          <TagChip key={tag} name={tag} color={tagColors[tag]} className='h-8 px-2.5' />
        ))}
      </div>

      <RecipeRating recipe={recipe} />

      <Ingredients ingredients={ingredients} />

      {directions != null && directions.length > 0 && (
        <>
          <SectionHeading meta={`${stepCount} step${stepCount === 1 ? "" : "s"}`}>
            Guide
          </SectionHeading>
          {directions.map((section, index) => (
            <div key={`${section.sectionTitle}-${index}`} className='pt-4'>
              {section.sectionTitle !== "" && (
                <h3 className='mb-1 font-heading text-lg font-semibold tracking-[0.06em] text-steel-700 uppercase'>
                  {section.sectionTitle}
                </h3>
              )}
              {section.steps.map((step, i) => (
                // The whole row toggles: cooking with one hand, the checkbox
                // alone is far too small a target.
                <label
                  key={i}
                  className='flex cursor-pointer items-start gap-3 border-t border-ink/10 py-3'>
                  <input
                    type='checkbox'
                    className='mt-1 h-[18px] w-[18px] shrink-0 cursor-pointer accent-steel'
                  />
                  {/* `pre-wrap`: a step is edited in a textarea, so any line
                   *  breaks in it were put there deliberately. */}
                  <span className='text-[16.5px] leading-relaxed whitespace-pre-wrap'>
                    {step}
                  </span>
                </label>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  )
}

export default Recipe
