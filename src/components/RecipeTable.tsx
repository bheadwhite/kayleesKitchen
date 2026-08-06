import clsx from "clsx"
import { useMemo, useState } from "react"

import { ChevronRightIcon, PotIcon, SearchIcon, Stars, TagChip } from "components"
import { averageOf } from "./RecipeRating"
import type { Recipe } from "@/types"

type SortKey = "title" | "rating"

interface RecipeTableProps {
  recipes: Recipe[]
  /** `id` of the row to mark as current. */
  selectedId?: string | null
  onSelect: (recipe: Recipe) => void
  /** Seeds the search box — used when arriving from a cook on the profile page. */
  initialFilter?: string
  /**
   * Colour id per tag name, from `useTagLibrary`. Passed in rather than read
   * here so this stays a presentational component with no Firestore listener of
   * its own; a tag missing from the map just wears the default.
   */
  tagColors?: Record<string, string>
}

const matches = (recipe: Recipe, filter: string) =>
  `${recipe.title} ${recipe.contributor ?? ""} ${(recipe.tags ?? []).join(" ")}`
    .toLowerCase()
    .includes(filter)

const NEW_FOR_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Recipes written before `createdAt` existed have none, and a recipe saved a
 * moment ago has null until the server timestamp lands — both read as "not
 * new", which is the safe way round: a missing badge is invisible, a wrong one
 * is a lie about every recipe in the list.
 */
const isNew = (recipe: Recipe, now: number) =>
  recipe.createdAt != null && now - recipe.createdAt.getTime() < NEW_FOR_MS

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
const RecipeTable = ({
  recipes,
  selectedId,
  onSelect,
  initialFilter = "",
  tagColors = {},
}: RecipeTableProps) => {
  // Seeded, not controlled: after the first render the box belongs to whoever
  // is typing in it.
  const [filter, setFilter] = useState(initialFilter)
  // One tag at a time. Stacking them narrows to nothing fast on a list this
  // size, and "tap another to switch" needs no explaining.
  const [tag, setTag] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>("title")
  // Thumbnails whose URL no longer resolves fall back to the placeholder box
  // instead of a broken-image icon, keeping row heights uniform.
  const [brokenImages, setBrokenImages] = useState<string[]>([])

  // One clock reading for the whole list, refreshed only when the list itself
  // changes — reading it per row lets two recipes saved in the same second land
  // on opposite sides of the cutoff. A badge going stale while the page sits
  // open is not worth a timer.
  const now = useMemo(() => Date.now(), [recipes])

  const byTitle = (a: Recipe, b: Recipe) =>
    a.title.toLowerCase().localeCompare(b.title.toLowerCase())

  const sorted = useMemo(() => {
    const listed = recipes.filter((recipe) => Boolean(recipe.title))
    if (sort === "title") return listed.sort(byTitle)

    // Best first, then the most-rated of a tie, then alphabetical. Unrated
    // recipes go last rather than counting as zero — nobody has said they are
    // bad, only that nobody has said anything.
    return listed.sort((a, b) => {
      const [left, right] = [averageOf(a), averageOf(b)]
      if (left == null && right == null) return byTitle(a, b)
      if (left == null) return 1
      if (right == null) return -1
      if (left !== right) return right - left
      const votes = (b.ratingCount ?? 0) - (a.ratingCount ?? 0)
      return votes !== 0 ? votes : byTitle(a, b)
    })
  }, [recipes, sort])

  // Every tag in the list, so the row of chips is the vocabulary that actually
  // exists rather than one carried over from deleted recipes.
  const allTags = useMemo(
    () => Array.from(new Set(sorted.flatMap((recipe) => recipe.tags ?? []))).sort(),
    [sorted]
  )

  // A tag that stops existing — renamed, or its last recipe deleted — must not
  // leave the list filtered to nothing with no way back.
  const activeTag = tag != null && allTags.includes(tag) ? tag : null

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    const byTag =
      activeTag == null ? sorted : sorted.filter((r) => (r.tags ?? []).includes(activeTag))
    return needle ? byTag.filter((recipe) => matches(recipe, needle)) : byTag
  }, [sorted, filter, activeTag])

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
            placeholder='Search recipes, cooks and tags'
            aria-label='Filter recipes'
            className='h-12 w-full border border-divider bg-surface pr-3 pl-10 text-base tracking-[0.01em] hover:border-ink/45 focus-visible:border-steel focus-visible:outline-offset-0'
          />
        </div>

        {/* One scrolling row, not a wrapping block: the bar is sticky, and a
            dozen tags wrapping to four lines would eat the list underneath it.
            `-mx-` + `px-` so the row bleeds to the edges as it scrolls while
            the chips still line up with the column. */}
        {allTags.length > 0 && (
          <div className='-mx-4 mt-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
            <div className='flex w-max gap-2'>
              {allTags.map((name) => {
                const isActive = activeTag === name
                return (
                  <TagChip
                    key={name}
                    name={name}
                    color={tagColors[name]}
                    // Unpicked chips are outlines, the picked one is filled —
                    // the same colour either way, so a tag is recognisable
                    // before you touch it and unmistakable after.
                    muted={!isActive}
                    pressed={isActive}
                    onClick={() => setTag(isActive ? null : name)}
                    label={isActive ? `Clear tag filter: ${name}` : `Filter by tag: ${name}`}
                    className={clsx(isActive && "ring-1 ring-ink/25")}
                  />
                )
              })}
            </div>
          </div>
        )}

        <div className='mt-2 flex items-baseline justify-between gap-2 font-mono text-[11px] tracking-[0.14em] text-muted uppercase'>
          {/* The column label doubles as the sort control: it already said what
           *  the list is ordered by, so pressing it to change that needs no new
           *  furniture in a bar that has to stay one line tall. */}
          <span className='flex items-baseline gap-2'>
            <button
              type='button'
              onClick={() => setSort("title")}
              aria-pressed={sort === "title"}
              className={clsx(
                "cursor-pointer tracking-[0.14em] uppercase",
                sort === "title" ? "text-ink underline underline-offset-4" : "hover:text-ink"
              )}>
              A–Z
            </button>
            <span aria-hidden='true'>·</span>
            <button
              type='button'
              onClick={() => setSort("rating")}
              aria-pressed={sort === "rating"}
              className={clsx(
                "cursor-pointer tracking-[0.14em] uppercase",
                sort === "rating" ? "text-ink underline underline-offset-4" : "hover:text-ink"
              )}>
              Top rated
            </button>
          </span>
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
                      src={recipe.image ?? undefined}
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
                    {/* Sits inside the title so it flows with a wrapped one
                     *  instead of stranding itself on a line of its own. */}
                    {isNew(recipe, now) && (
                      <span className='ml-2 inline-block border border-steel bg-steel-100 px-1.5 align-[3px] font-mono text-[10px] leading-[1.6] font-semibold tracking-[0.14em] text-steel-700 uppercase'>
                        New
                      </span>
                    )}
                  </span>
                  {/* Only when someone has actually rated it: five empty stars
                   *  on every row is noise that says nothing. */}
                  {averageOf(recipe) != null && (
                    <span className='mb-1 flex items-center gap-1.5'>
                      <Stars value={averageOf(recipe) ?? 0} className='text-[13px]' />
                      <span className='font-mono text-[10px] tracking-[0.12em] text-muted'>
                        {(averageOf(recipe) ?? 0).toFixed(1)} ({recipe.ratingCount})
                      </span>
                    </span>
                  )}

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

                  {/* Small, and only the first few: the row is a title and who
                   *  cooked it, and a recipe wearing six tags must not push
                   *  that off the screen. The rest are one tap away. */}
                  {(recipe.tags ?? []).length > 0 && (
                    <span className='mt-1.5 flex flex-wrap items-center gap-1'>
                      {(recipe.tags ?? []).slice(0, 3).map((tag) => (
                        <TagChip key={tag} name={tag} color={tagColors[tag]} size='sm' />
                      ))}
                      {(recipe.tags ?? []).length > 3 && (
                        <span className='font-mono text-[9.5px] tracking-[0.12em] text-muted'>
                          +{(recipe.tags ?? []).length - 3}
                        </span>
                      )}
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
            <p className='text-muted'>
              {filter.trim() === ""
                ? `Nothing is tagged "${activeTag}".`
                : `No recipes match "${filter.trim()}"${
                    activeTag != null ? ` in "${activeTag}"` : ""
                  }.`}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default RecipeTable
