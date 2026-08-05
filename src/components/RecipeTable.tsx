import clsx from "clsx"
import { useMemo, useState } from "react"

import { ChevronRightIcon, PotIcon, SearchIcon } from "components"
import type { Recipe } from "@/types"

interface RecipeTableProps {
  recipes: Recipe[]
  /** `id` of the row to mark as current. */
  selectedId?: string | null
  onSelect: (recipe: Recipe) => void
}

const matches = (recipe: Recipe, filter: string) =>
  `${recipe.title} ${recipe.contributor ?? ""}`.toLowerCase().includes(filter)

/** Two letters at most — three initials are unreadable in a 22px box. */
const initialsOf = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  return (words.length === 1 ? words[0].slice(0, 1) : words[0][0] + words[1][0]).toUpperCase()
}

/**
 * The recipe list: one row per recipe, each a framed thumbnail beside the title
 * and who contributed it.
 *
 * It was a <table> with clickable <tr>s. Rows here are real <button>s inside a
 * list, which is what they always behaved like — a table promised columns to
 * compare, and there were only ever two.
 */
const RecipeTable = ({ recipes, selectedId, onSelect }: RecipeTableProps) => {
  const [filter, setFilter] = useState("")
  // Thumbnails whose URL no longer resolves fall back to the placeholder box
  // instead of a broken-image icon, keeping row heights uniform.
  const [brokenImages, setBrokenImages] = useState<string[]>([])

  const sorted = useMemo(
    () =>
      recipes
        .filter((recipe) => Boolean(recipe.title))
        .sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase())),
    [recipes]
  )

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    return needle ? sorted.filter((recipe) => matches(recipe, needle)) : sorted
  }, [sorted, filter])

  return (
    <div className='w-full max-w-[720px]'>
      {/* Sticks just below the fixed toolbar — same height token, plus whatever
          notch inset the toolbar is sitting under — so the search stays
          reachable however far down the list you have scrolled. */}
      <div className='sticky top-[calc(var(--header-h)+var(--sai-top))] z-30 mb-1 bg-ground pt-1 pb-3'>
        <div className='relative'>
          <SearchIcon className='pointer-events-none absolute top-1/2 left-3.5 h-[17px] w-[17px] -translate-y-1/2 text-steel' />
          <input
            type='search'
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder='Search recipes and cooks'
            aria-label='Filter recipes'
            className='h-12 w-full border border-divider bg-surface pr-3 pl-10 text-base tracking-[0.01em] hover:border-ink/45 focus-visible:border-steel focus-visible:outline-offset-0'
          />
        </div>
        <div className='mt-2 flex items-baseline justify-between font-mono text-[11px] tracking-[0.14em] text-muted uppercase'>
          <span>Recipe · Contributed by</span>
          <span>
            {visible.length === sorted.length
              ? `${sorted.length} recipe${sorted.length === 1 ? "" : "s"}`
              : `${visible.length} of ${sorted.length}`}
          </span>
        </div>
      </div>

      <ul>
        {visible.map((recipe, index) => {
          const isSelected = selectedId != null && recipe.id === selectedId
          const hasImage =
            recipe.image != null &&
            recipe.image.length > 1 &&
            !brokenImages.includes(recipe.image)

          return (
            <li key={recipe.id ?? `${recipe.title}-${index}`}>
              <button
                type='button'
                aria-current={isSelected ? "true" : undefined}
                onClick={() => onSelect(recipe)}
                className={clsx(
                  "grid w-full cursor-pointer grid-cols-[76px_1fr_18px] items-center gap-4",
                  "border-t border-ink/12 py-3.5 text-left",
                  isSelected ? "bg-steel-100" : "hover:bg-ink/4"
                )}>
                {/* The framed thumbnail is the one blueprint object per row.
                    A square keeps every row exactly as tall as the next. */}
                <span className='blueprint block h-[76px] w-[76px] overflow-visible bg-surface'>
                  {hasImage ? (
                    <img
                      src={recipe.image}
                      alt=''
                      loading='lazy'
                      onError={() =>
                        setBrokenImages((current) =>
                          current.includes(recipe.image!) ? current : [...current, recipe.image!]
                        )
                      }
                      className='h-full w-full object-cover'
                    />
                  ) : (
                    // Inline SVG rather than a hosted placeholder file: nothing
                    // to upload, nothing to pay for, and it cannot 404 like the
                    // real thumbnails do.
                    <span
                      className='flex h-full w-full items-center justify-center text-steel-400'
                      aria-hidden='true'>
                      <PotIcon className='h-7 w-7' />
                    </span>
                  )}
                </span>

                <span className='min-w-0'>
                  <span className='mb-1.5 block font-heading text-xl leading-tight font-semibold break-words'>
                    {recipe.title}
                  </span>
                  {recipe.contributor && (
                    <span className='flex items-center gap-2'>
                      <span
                        aria-hidden='true'
                        className='flex h-[22px] w-[22px] shrink-0 items-center justify-center border border-steel font-heading text-[11px] font-semibold tracking-[0.04em] text-steel-700'>
                        {initialsOf(recipe.contributor)}
                      </span>
                      <span className='min-w-0 truncate text-sm text-ink/70'>
                        {recipe.contributor}
                      </span>
                    </span>
                  )}
                </span>

                <ChevronRightIcon className='h-4 w-4 text-muted' />
              </button>
            </li>
          )
        })}
      </ul>

      {visible.length === 0 && (
        <div className='border-t border-ink/12 px-2 py-14 text-center'>
          <p className='mb-2 font-heading text-2xl font-semibold'>
            {sorted.length === 0 ? "No recipes yet." : "Nothing matches"}
          </p>
          {sorted.length > 0 && (
            <p className='text-muted'>{`No recipes match "${filter.trim()}".`}</p>
          )}
        </div>
      )}
    </div>
  )
}

export default RecipeTable
