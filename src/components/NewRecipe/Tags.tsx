import { useRef } from "react"
import { useForm, useFormState } from "react-final-form"

import { AddIcon, Button, CloseIcon, SectionHeading, TagChip } from "components"
import { TextField } from "components/finalForm"
import { useRecipePresenter, useTags } from "contexts/RecipeProvider"
import type { TagRecord } from "@/types"

interface TagsProps {
  /** Every tag in circulation, from `useTagLibrary` — the pick-list. */
  known?: TagRecord[]
}

/**
 * The recipe's labels — "salad", "mexican" — which are what the recipe list
 * filters on.
 *
 * Two ways in, and the order matters: the tags already in use come first as
 * one-tap chips, and typing a new one is underneath. A tag box that only takes
 * typing grows "mexican", "Mexican" and "mexican food" inside a week, and no
 * filter built on it means anything.
 *
 * There is no edit-in-place here on purpose: a tag is one short word, so
 * removing and re-adding it beats opening an editor for it — and renaming a tag
 * everywhere it is used is what the Tags tab is for.
 */
const Tags = ({ known = [] }: TagsProps) => {
  const presenter = useRecipePresenter()
  const tags = useTags()
  const { change } = useForm()
  const { values } = useFormState<{ tag?: string }>()
  const inputRef = useRef<HTMLDivElement>(null)

  const colorOf = (name: string) => known.find((tag) => tag.name === name)?.color
  // Offering a tag this recipe already wears would only invite a duplicate the
  // presenter then drops.
  const available = known.filter((tag) => !tags.includes(tag.name))

  const addTag = () => {
    presenter.addTag(values.tag ?? "")
    change("tag", "")
    inputRef.current?.querySelector("input")?.focus()
  }

  return (
    <div className='mt-6'>
      <SectionHeading meta={`${tags.length} tag${tags.length === 1 ? "" : "s"}`}>
        Tags
      </SectionHeading>

      {tags.length === 0 ? (
        <p className='py-3 text-muted'>No tags yet.</p>
      ) : (
        <ul className='flex flex-wrap gap-2 py-3'>
          {tags.map((tag) => (
            <li key={tag}>
              {/* The chip *is* the remove button — a tag has no other action,
               *  and a separate × beside it doubles the row height on a phone
               *  for no gain. */}
              <TagChip
                name={tag}
                color={colorOf(tag)}
                onClick={() => presenter.removeTag(tag)}
                label={`Remove tag: ${tag}`}>
                <CloseIcon className='h-3.5 w-3.5' />
              </TagChip>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 && (
        <div className='mb-3'>
          <p className='mb-1.5 font-mono text-[11px] tracking-[0.14em] text-muted uppercase'>
            Add an existing tag
          </p>
          <ul className='flex flex-wrap gap-2'>
            {available.map((tag) => (
              <li key={tag.name}>
                <TagChip
                  name={tag.name}
                  color={tag.color}
                  muted
                  onClick={() => presenter.addTag(tag.name)}
                  label={`Add tag: ${tag.name}`}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className='flex items-end gap-2'>
        <div className='min-w-0 flex-1'>
          <TextField
            id='tagInput'
            name='tag'
            placeholder='Or type a new one'
            fullWidth
            ref={inputRef}
            autoComplete='off'
          />
        </div>
        <Button variant='primary' icon onClick={addTag} aria-label='Add tag'>
          <AddIcon />
        </Button>
      </div>
    </div>
  )
}

export default Tags
