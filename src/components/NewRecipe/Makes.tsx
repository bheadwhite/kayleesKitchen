import clsx from "clsx"

import { ChangeMark, SectionHeading } from "components"
import { useRecipePresenter, useServes, useServingSize } from "contexts/RecipeProvider"

interface MakesProps {
  /** Marked when the saved recipe said something different. */
  changed?: boolean
}

/**
 * How much the recipe makes: how many it feeds, and what one serving is.
 *
 * **Authored, and that is the point.** The chef already estimates a yield on
 * the recipe page and caches it under `recipes/{id}/chef/yield`, but an
 * estimate is what you fall back on when the recipe does not say. This is the
 * recipe saying. When both exist the authored one wins, and it costs no model
 * call to read.
 *
 * Two fields rather than one, because the count alone is unreadable for
 * anything portioned: "serves 18" tells nobody whether a tray of brownies is
 * one square each or three. Both are optional — plenty of recipes genuinely do
 * not say, and an empty field is an honest answer that the chef's estimate can
 * still cover.
 *
 * Not react-final-form fields: they live on the presenter like the tags and the
 * ingredients do, because the chef proposes them and applying a draft has to be
 * able to move them without going through the form.
 */
const Makes = ({ changed = false }: MakesProps) => {
  const presenter = useRecipePresenter()
  const serves = useServes()
  const servingSize = useServingSize()

  const field =
    "h-11 w-full border border-divider bg-surface px-3 text-base " +
    "hover:border-ink/45 focus-visible:border-steel focus-visible:outline-offset-0"

  return (
    <>
      <SectionHeading>
        <span className='flex items-center gap-2'>
          Makes
          {changed && <ChangeMark change='changed' />}
        </span>
      </SectionHeading>

      <div className='mt-2 grid grid-cols-[112px_1fr] gap-2'>
        <input
          type='number'
          inputMode='numeric'
          min={1}
          // An empty box is "not said", which is a different thing from zero —
          // the presenter turns both into null, so this only has to render it.
          value={serves ?? ""}
          onChange={(event) =>
            presenter.setServes(event.target.value === "" ? null : Number(event.target.value))
          }
          placeholder='Serves'
          aria-label='How many the recipe feeds'
          className={clsx(field, "text-center")}
        />
        <input
          value={servingSize ?? ""}
          onChange={(event) => presenter.setServingSize(event.target.value)}
          placeholder='One serving is… (2 cookies, 1½ cups)'
          aria-label='What one serving is'
          className={field}
        />
      </div>
      <p className='mt-1.5 text-[12.5px] leading-snug text-muted'>
        Leave these blank and the chef works out a figure when someone asks. What you put
        here wins over that.
      </p>
    </>
  )
}

export default Makes
