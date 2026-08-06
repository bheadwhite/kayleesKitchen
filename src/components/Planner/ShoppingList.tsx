import clsx from "clsx"
import { useState } from "react"

import { AddIcon, Button, CheckIcon, CloseIcon, SectionHeading } from "components"
import { bySection } from "@/shoppingList"
import type { ShoppingItem } from "@/types"

interface ShoppingListProps {
  items: ShoppingItem[]
  onToggle: (item: ShoppingItem) => void
  onRemove: (item: ShoppingItem) => void
  onAdd: (name: string) => void
  onClearChecked: () => void
}

interface RowProps {
  item: ShoppingItem
  onToggle: () => void
  onRemove: () => void
}

const Row = ({ item, onToggle, onRemove }: RowProps) => (
  <li className='flex items-center gap-1 border-b border-divider last:border-b-0'>
    {/*
     * The whole row is the checkbox. In a shop this is tapped one-handed while
     * holding something, and a 20px box beside a line of text is the hardest
     * target in the app — so the target is the line.
     */}
    <button
      type='button'
      role='checkbox'
      aria-checked={item.checked}
      onClick={onToggle}
      className='flex min-h-12 flex-1 cursor-pointer touch-manipulation items-center gap-3 py-2 pl-1 text-left'>
      <span
        className={clsx(
          "flex h-[22px] w-[22px] shrink-0 items-center justify-center border transition-colors",
          item.checked ? "border-steel bg-steel text-ground" : "border-ink/45 bg-surface"
        )}>
        {item.checked && <CheckIcon className='h-3.5 w-3.5' />}
      </span>

      <span className='min-w-0 flex-1'>
        <span
          className={clsx(
            "block text-[15px] transition-colors",
            item.checked && "text-muted line-through"
          )}>
          {item.name}
          {item.amount && (
            <span className={clsx("ml-2", item.checked ? "text-muted" : "text-steel-700")}>
              {item.amount}
            </span>
          )}
        </span>
        {item.from.length > 0 && (
          <span className='block truncate font-mono text-[10px] tracking-[0.14em] text-muted uppercase'>
            {item.from.join(" · ")}
          </span>
        )}
      </span>
    </button>

    <Button
      variant='ghost'
      icon
      onClick={onRemove}
      aria-label={`Take ${item.name} off the list`}
      className='mt-0 mr-1 h-9 w-9 text-muted hover:text-ink'>
      <CloseIcon className='h-4 w-4' />
    </Button>
  </li>
)

/**
 * The list, walked in store order.
 *
 * Ticked rows settle to the bottom of their section rather than disappearing —
 * a tap in a shop is easily a mis-tap, and something that vanishes cannot be put
 * back by someone who did not see where it went.
 */
const ShoppingList = ({ items, onToggle, onRemove, onAdd, onClearChecked }: ShoppingListProps) => {
  const [draft, setDraft] = useState("")
  const sections = bySection(items)
  const left = items.filter((item) => !item.checked).length
  const ticked = items.length - left

  const add = () => {
    const name = draft.trim()
    if (name === "") return
    onAdd(name)
    setDraft("")
  }

  return (
    <div>
      {items.length === 0 ? (
        <div className='border-t border-ink/12 px-2 py-12 text-center'>
          <p className='mb-2 font-heading text-2xl font-semibold'>Nothing on the list.</p>
          <p className='text-muted'>
            Build it from what you have planned, or type something in below.
          </p>
        </div>
      ) : (
        sections.map((section) => (
          <div key={section.key}>
            <SectionHeading meta={`${section.items.filter((i) => !i.checked).length} left`}>
              {section.label}
            </SectionHeading>
            <ul>
              {section.items.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  onToggle={() => onToggle(item)}
                  onRemove={() => onRemove(item)}
                />
              ))}
            </ul>
          </div>
        ))
      )}

      {/* Milk, foil, paper towels — the things no recipe asked for. No amount
       *  and no section asked for either: someone typing this is in a hurry. */}
      <div className='mt-5 flex gap-1'>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") add()
          }}
          placeholder='Add something else'
          aria-label='Add an item to the list'
          className='h-11 min-w-0 flex-1 border border-divider bg-surface px-3 text-base hover:border-ink/45 focus-visible:border-steel focus-visible:outline-offset-0'
        />
        <Button icon onClick={add} disabled={draft.trim() === ""} aria-label='Add to the list'>
          <AddIcon />
        </Button>
      </div>

      {/* At the far end of the scroll, like Delete recipe in the editor: this is
       *  the one control here that throws something away. */}
      {ticked > 0 && (
        <div className='mt-10 border-t border-divider pt-4'>
          <Button danger onClick={onClearChecked}>
            Clear {ticked} ticked
          </Button>
        </div>
      )}
    </div>
  )
}

export default ShoppingList
