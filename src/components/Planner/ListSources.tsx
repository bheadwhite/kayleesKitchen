import clsx from "clsx"

import { CheckIcon, SectionHeading } from "components"

/** One recipe the list covers, as the row draws it. */
export interface ListSourceRow {
  id: string | null
  title: string
  /** Unticked lines crediting it. */
  lines: number
  /** Lines crediting it and nothing else — what dropping it would take off. */
  only: number
  dropped: boolean
}

interface ListSourcesProps {
  sources: ListSourceRow[]
  onDrop: (source: ListSourceRow) => void
  onRestore: (recipeId: string) => void
  disabled: boolean
}

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`

/**
 * What this list is for.
 *
 * A shopping list is read a week after it was built, in a shop, by somebody who
 * may not have planned any of it — and until now it said only *what* to buy,
 * never *why*. The credits were on each line, but scattered down forty rows,
 * which answers "why is this here" one line at a time and never answers "what
 * is this list actually covering".
 *
 * **The list is not a view of the week**, and that is deliberate (see the
 * planner section of CLAUDE.md): it is written down so it can be read in a shop
 * with the plan changing underneath. This row is the consequence made visible —
 * a meal unplanned yesterday is still on the list, still credited here, and
 * this is where somebody notices and takes it off.
 *
 * Dropping is immediate and adding is not, which is an honest asymmetry rather
 * than an oversight: taking lines off costs nothing, and putting them back
 * means asking the chef to work the amounts out again. So a restored recipe
 * says "Build to add" instead of quietly spending a call.
 */
const ListSources = ({ sources, onDrop, onRestore, disabled }: ListSourcesProps) => {
  if (sources.length === 0) return null

  const dropped = sources.filter((source) => source.dropped).length

  return (
    <div className='mb-4'>
      <SectionHeading meta={dropped > 0 ? `${dropped} off` : undefined}>
        What this list covers
      </SectionHeading>

      <ul className='mt-2 flex flex-wrap gap-1.5'>
        {sources.map((source) => {
          // Nothing to look up and nothing to rebuild from: a line written
          // before ids were recorded, or a recipe since deleted. It can still
          // be taken off — that is just deleting its lines — but it can never
          // come back, so it is not drawn as a switch.
          const canRestore = source.id != null

          return (
            <li key={source.id ?? source.title}>
              <button
                type='button'
                disabled={disabled || (source.dropped && !canRestore)}
                onClick={() =>
                  source.dropped
                    ? canRestore && onRestore(source.id as string)
                    : onDrop(source)
                }
                aria-pressed={!source.dropped}
                // "Drop", not "take off": a row's own × already reads "Take
                // foil off the list", and two controls that sound the same to
                // anyone not looking at the screen are two chances to press
                // the wrong one. This one drops a whole recipe.
                aria-label={
                  source.dropped
                    ? `Put ${source.title} back — Build to add its lines`
                    : `Drop ${source.title} from this list — ${plural(source.only, "line")} off`
                }
                className={clsx(
                  "flex cursor-pointer touch-manipulation items-center gap-1.5 border px-2.5 py-1.5",
                  "text-left text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                  source.dropped
                    ? "border-dashed border-divider text-muted hover:border-steel hover:text-steel-700"
                    : "border-steel bg-steel-100 text-steel-700 hover:bg-steel-200"
                )}>
                <span
                  className={clsx(
                    "grid h-[15px] w-[15px] shrink-0 place-items-center border",
                    source.dropped ? "border-divider" : "border-steel bg-steel text-ground"
                  )}>
                  {!source.dropped && <CheckIcon className='h-2.5 w-2.5' />}
                </span>
                <span className='max-w-[180px] truncate'>{source.title}</span>
                <span className='shrink-0 font-mono text-[10px] tracking-[0.1em] uppercase'>
                  {source.dropped ? "build to add" : source.lines}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {/* Said once, under the row, rather than on every chip that shares a
       *  line: the amount on a shared line is left exactly as it read, because
       *  there is no subtracting "1 cup" from "3 cups" when both are text. */}
      {sources.some((source) => source.dropped) && (
        <p className='mt-2 text-[12.5px] leading-snug text-muted'>
          Lines shared with a recipe still on the list keep the amount they had. Build the
          list to bring those back in line.
        </p>
      )}
    </div>
  )
}

export default ListSources
