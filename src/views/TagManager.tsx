import clsx from "clsx"
import { useState } from "react"
import { toast } from "react-toastify"

import { Button, CheckIcon, CloseIcon, DeleteIcon, Dialog, SectionHeading, TagChip } from "components"
import useTagLibrary from "hooks/useTagLibrary"
import { deleteTag, renameTag, setTagColor } from "fire/services"
import { normaliseTag } from "presenters/RecipePresenter"
import { DEFAULT_TAG_COLOR, TAG_COLORS, colorFor } from "@/tagColors"
import type { TagRecord } from "@/types"

interface SwatchesProps {
  selected: string
  onPick: (colorId: string) => void
  labelFor: (color: string) => string
}

/** The whole palette, always visible: recolouring is one tap, not a menu. */
const Swatches = ({ selected, onPick, labelFor }: SwatchesProps) => (
  <div className='flex flex-wrap gap-1.5'>
    {TAG_COLORS.map((color) => {
      const isSelected = colorFor(selected).id === color.id
      return (
        <button
          key={color.id}
          type='button'
          onClick={() => onPick(color.id)}
          aria-label={labelFor(color.label)}
          aria-pressed={isSelected}
          title={color.label}
          className={clsx(
            "h-7 w-7 cursor-pointer border-2",
            isSelected ? "border-ink" : "border-transparent hover:border-ink/30"
          )}
          style={{ backgroundColor: color.bg, boxShadow: `inset 0 0 0 1px ${color.border}` }}
        />
      )
    })}
  </div>
)

interface TagRowProps {
  tag: TagRecord
  count: number
  onDelete: () => void
}

const TagRow = ({ tag, count, onDelete }: TagRowProps) => {
  // A tag in use cannot be deleted from here — see `deleteTag`. The button
  // stays visible and says why, rather than vanishing and leaving someone
  // hunting for it.
  const inUse = count > 0
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(tag.name)
  const [busy, setBusy] = useState(false)

  const commitRename = async () => {
    const next = normaliseTag(draft)
    setRenaming(false)
    if (next === "" || next === tag.name) return

    setBusy(true)
    try {
      // Every recipe wearing the old name is updated with it — see `renameTag`.
      await renameTag(tag.name, next, colorFor(tag.color).id)
      toast.success(`Renamed to "${next}".`)
    } catch (error) {
      setDraft(tag.name)
      toast.error(error instanceof Error ? error.message : "Could not rename that tag.")
    } finally {
      setBusy(false)
    }
  }

  const pickColor = async (colorId: string) => {
    try {
      await setTagColor(tag.name, colorId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save that colour.")
    }
  }

  return (
    <li className='border-b border-ink/10 py-3'>
      <div className='flex items-center gap-2'>
        {renaming ? (
          <>
            <input
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void commitRename()
                if (event.key === "Escape") {
                  setDraft(tag.name)
                  setRenaming(false)
                }
              }}
              aria-label={`Rename tag: ${tag.name}`}
              className='h-10 min-w-0 flex-1 border border-divider bg-surface px-2.5 text-base'
            />
            <Button icon variant='primary' onClick={() => void commitRename()} aria-label='Save tag name'>
              <CheckIcon />
            </Button>
            <Button
              icon
              onClick={() => {
                setDraft(tag.name)
                setRenaming(false)
              }}
              aria-label='Cancel renaming tag'>
              <CloseIcon />
            </Button>
          </>
        ) : (
          <>
            {/* Click-to-edit, like every other name in this app. */}
            <TagChip
              name={tag.name}
              color={tag.color}
              onClick={() => setRenaming(true)}
              label={`Rename tag: ${tag.name}`}
            />
            <span className='font-mono text-[11px] tracking-[0.14em] text-muted uppercase'>
              {count} recipe{count === 1 ? "" : "s"}
            </span>
            <span className='flex-1' />
            <Button
              variant='ghost'
              icon
              danger
              disabled={inUse}
              onClick={onDelete}
              aria-label={`Delete tag: ${tag.name}`}
              title={
                inUse
                  ? `Take "${tag.name}" off its ${count} recipe${count === 1 ? "" : "s"} first`
                  : `Delete tag: ${tag.name}`
              }>
              <DeleteIcon />
            </Button>
          </>
        )}
      </div>

      <div className={clsx("mt-2", busy && "opacity-50")}>
        <Swatches
          selected={tag.color}
          onPick={(colorId) => void pickColor(colorId)}
          labelFor={(color) => `${color} for ${tag.name}`}
        />
      </div>
    </li>
  )
}

/**
 * Where tags are managed: rename, recolour, remove.
 *
 * Adding one here is deliberately *not* offered. A tag with no recipe on it is
 * an empty filter, and the place you know you want one is the recipe you are
 * writing — so tags are born in the editor and only ever tidied here. What this
 * page owns is the part the editor cannot: the colour, and the rename or
 * deletion that has to reach every recipe already wearing the word.
 */
const TagManager = () => {
  const { tags, counts } = useTagLibrary()
  const [pendingDelete, setPendingDelete] = useState<TagRecord | null>(null)

  const confirmDelete = async () => {
    const tag = pendingDelete
    setPendingDelete(null)
    if (tag == null) return

    try {
      await deleteTag(tag.name)
      toast.success(`Deleted "${tag.name}".`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete that tag.")
    }
  }

  return (
    <div className='w-full max-w-[720px]'>
      <SectionHeading meta={`${tags.length} tag${tags.length === 1 ? "" : "s"}`}>
        Tags
      </SectionHeading>

      {tags.length === 0 ? (
        <div className='border-t border-ink/12 px-2 py-14 text-center'>
          <p className='mb-2 font-heading text-2xl font-semibold'>No tags yet.</p>
          <p className='text-muted'>
            Tags are added to a recipe in the editor. They show up here once one exists.
          </p>
        </div>
      ) : (
        <ul>
          {tags.map((tag) => (
            <TagRow
              key={tag.name}
              tag={tag}
              count={counts[tag.name] ?? 0}
              onDelete={() => setPendingDelete(tag)}
            />
          ))}
        </ul>
      )}

      <p className='mt-6 text-sm text-muted'>
        Every tag wears {DEFAULT_TAG_COLOR.label.toLowerCase()} until you pick a colour for it.
      </p>

      <Dialog
        open={pendingDelete != null}
        onClose={() => setPendingDelete(null)}
        title='Delete tag?'
        actions={
          <>
            <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button onClick={() => void confirmDelete()} variant='primary' danger>
              Delete tag
            </Button>
          </>
        }>
        {`"${pendingDelete?.name}" is not on any recipe, so nothing else changes. ` +
          "It can be typed again in the editor whenever you want it back."}
      </Dialog>
    </div>
  )
}

export default TagManager
