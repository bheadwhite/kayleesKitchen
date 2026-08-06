import clsx from "clsx"
import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { toast } from "react-toastify"

import { Button, CloseIcon, ImageIcon, SectionHeading, SendIcon, Spinner } from "components"
import {
  useAiDraftPresenter,
  useAssistantStatus,
  useAssistantTurns,
  usePendingImages,
  useProposedDraft,
} from "contexts/AiDraftProvider"
import { useRecipePresenter } from "contexts/RecipeProvider"
import { MAX_IMAGES } from "@/ai/recipeAssistant"
import type { RecipeDraft } from "@/types"

const countSteps = (draft: RecipeDraft) =>
  draft.directions.reduce((total, section) => total + section.steps.length, 0)

/**
 * Chat panel for the recipe editor. The assistant proposes a complete draft;
 * nothing reaches `RecipePresenter` until "Apply to editor" is pressed.
 */
const AiAssistant = () => {
  const assistant = useAiDraftPresenter()
  const recipe = useRecipePresenter()
  const turns = useAssistantTurns()
  const pendingImages = usePendingImages()
  const proposedDraft = useProposedDraft()
  const { isAsking } = useAssistantStatus()

  const [text, setText] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)

  // Keep the newest turn in view as the conversation grows.
  useEffect(() => {
    const el = transcriptRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [turns.length, isAsking])

  const onPickImages = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    const rejected = assistant.attachImages(files)
    if (rejected.length > 0) {
      toast.info(`Only ${MAX_IMAGES} photos at a time — skipped ${rejected.join(", ")}.`)
    }
    // Reset so picking the same file twice still fires a change event.
    event.target.value = ""
  }

  const onSend = async () => {
    const message = text
    setText("")
    try {
      await assistant.send(message, {
        title: recipe.getTitle(),
        ingredients: recipe.getIngredients(),
        directions: recipe.getDirections(),
      })
    } catch (error) {
      setText(message) // Put it back so the message is not lost.
      toast.error(error instanceof Error ? error.message : "The assistant could not respond.")
    }
  }

  const onApply = () => {
    if (proposedDraft == null) return
    recipe.loadRecipe({
      ...proposedDraft,
      // `loadRecipe` reads `id` off the argument; keep the editor's own.
      id: recipe.getId() ?? undefined,
    })
    assistant.clearProposedDraft()
    toast.success("Draft applied to the editor.")
  }

  const canSend = !isAsking && (text.trim() !== "" || pendingImages.length > 0)

  return (
    <div>
      <SectionHeading meta={turns.length > 0 ? `${turns.length} messages` : undefined}>
        Recipe assistant
      </SectionHeading>

      <div
        ref={transcriptRef}
        className='max-h-[320px] overflow-y-auto py-2'
        aria-live='polite'
        aria-label='Assistant conversation'>
        {turns.length === 0 && (
          <div className='py-2 text-sm text-muted'>
            <p>You can:</p>
            <ul className='mt-1 list-disc pl-5'>
              <li>add photos of a recipe card and have them typed up</li>
              <li>paste a link to a recipe</li>
              <li>
                describe one to write from scratch — &ldquo;a weeknight chicken and orzo
                thing&rdquo;
              </li>
              <li>ask for a change — &ldquo;double everything&rdquo;</li>
            </ul>
            <p className='mt-1'>
              Instagram and Facebook links usually sit behind a login — a screenshot works
              better for those.
            </p>
          </div>
        )}

        {turns.map((turn, index) => (
          <div
            key={index}
            className={clsx("my-2 flex", turn.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={clsx(
                "max-w-[86%] border border-divider px-3 py-2.5 text-[15px] leading-snug",
                turn.role === "user" ? "bg-steel text-ground" : "bg-ground"
              )}>
              {turn.role === "user" && turn.images.length > 0 && (
                <div className='mb-1 text-xs opacity-80'>
                  {turn.images.length} photo{turn.images.length === 1 ? "" : "s"} attached
                </div>
              )}
              <span className='break-words whitespace-pre-wrap'>{turn.text}</span>
            </div>
          </div>
        ))}

        {isAsking && (
          <div className='flex items-center gap-2 py-2 text-sm text-muted'>
            <Spinner size={18} />
            Reading…
          </div>
        )}
      </div>

      {proposedDraft != null && (
        <div className='mt-2 border border-steel bg-steel-100 p-3'>
          <div className='font-mono text-[11px] tracking-[0.14em] text-steel-700 uppercase'>
            Proposed draft
          </div>
          <dl className='my-2 text-sm'>
            <div className='flex gap-2'>
              <dt className='text-muted'>Title</dt>
              <dd className='font-medium'>{proposedDraft.title || "—"}</dd>
            </div>
            <div className='flex gap-2'>
              <dt className='text-muted'>Ingredients</dt>
              <dd className='font-medium'>{proposedDraft.ingredients.length}</dd>
            </div>
            <div className='flex gap-2'>
              <dt className='text-muted'>Directions</dt>
              <dd className='font-medium'>
                {proposedDraft.directions.length} section
                {proposedDraft.directions.length === 1 ? "" : "s"}, {countSteps(proposedDraft)}{" "}
                step{countSteps(proposedDraft) === 1 ? "" : "s"}
              </dd>
            </div>
          </dl>
          <p className='mb-2 text-xs text-muted'>
            Applying replaces the title, ingredients, and directions in the editor.
          </p>
          <div className='flex flex-wrap gap-2 max-sm:[&>button]:mr-0'>
            <Button onClick={onApply} variant='primary'>
              Apply to editor
            </Button>
            <Button onClick={() => assistant.clearProposedDraft()}>Discard</Button>
          </div>
        </div>
      )}

      {pendingImages.length > 0 && (
        <ul className='mt-2 flex flex-wrap gap-2' aria-label='Attached photos'>
          {pendingImages.map((image) => (
            <li key={image.id} className='relative'>
              <img
                src={image.previewUrl}
                alt={image.file.name}
                className='h-16 w-16 border border-divider object-cover'
              />
              <button
                type='button'
                onClick={() => assistant.removeImage(image.id)}
                aria-label={`Remove ${image.file.name}`}
                className='absolute -top-2 -right-2 flex h-6 w-6 cursor-pointer items-center justify-center border border-divider bg-ground text-ink hover:text-danger'>
                <CloseIcon className='h-3.5 w-3.5' />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className='mt-2 flex flex-wrap items-end gap-2'>
        <input
          ref={fileInputRef}
          type='file'
          // `image/*`, not the four formats Claude takes: an iPhone shooting in
          // High Efficiency produces HEIC, and the downscale step re-encodes
          // whatever the browser can decode to JPEG before it is sent.
          accept='image/*'
          multiple
          onChange={onPickImages}
          id='assistant-images'
          className='hidden'
        />
        <label htmlFor='assistant-images' className='basis-full sm:basis-auto'>
          <span className='mt-1 inline-flex min-h-11 w-full cursor-pointer touch-manipulation items-center justify-center gap-1.5 border border-divider px-4 py-2 font-heading text-sm font-semibold tracking-[0.09em] uppercase hover:bg-ink/7 sm:min-h-[34px] sm:w-auto sm:px-3.5 sm:py-1.5'>
            <ImageIcon />
            Add photos
          </span>
        </label>

        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends; Shift+Enter is a newline. This textarea lives inside
            // the editor's <form>, so a bare Enter would otherwise submit it.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              if (canSend) void onSend()
            }
          }}
          rows={2}
          placeholder='Describe a recipe, paste a link, or ask for a change…'
          aria-label='Message the recipe assistant'
          className='min-w-0 flex-1 basis-full border border-divider bg-surface px-3 py-2 text-base hover:border-ink/45 focus-visible:border-steel focus-visible:outline-offset-0 sm:basis-0'
        />

        <Button onClick={() => void onSend()} disabled={!canSend} variant='primary'>
          <SendIcon />
          Send
        </Button>
      </div>
    </div>
  )
}

export default AiAssistant
