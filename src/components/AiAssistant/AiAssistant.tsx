import clsx from "clsx"
import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { toast } from "react-toastify"

import { Button, ChangeMark, CloseIcon, ImageIcon, SendIcon, Spinner } from "components"
import {
  useAiDraftPresenter,
  useAssistantStatus,
  useAssistantTurns,
  usePendingImages,
  useProposedDraft,
} from "contexts/AiDraftProvider"
import { useRecipePresenter } from "contexts/RecipeProvider"
import { MAX_IMAGES } from "@/ai/recipeAssistant"
import { describeChanges, diffRecipe, summariseChanges } from "@/recipeDiff"

/** Grouped in the order the recipe itself is written. */
const GROUPS = [
  { where: "title", label: "Title" },
  { where: "makes", label: "Makes" },
  { where: "ingredient", label: "Ingredients" },
  { where: "section", label: "Sections" },
  { where: "step", label: "Steps" },
  { where: "tag", label: "Tags" },
] as const

interface AiAssistantProps {
  /** Fired after a draft is applied — the drawer closes on it. */
  onApplied?: () => void
  /**
   * Every tag in circulation, from `useTagLibrary`. Passed in rather than read
   * here for the reason `<RecipeTable>` takes its colours as a prop: the editor
   * already holds this, and a second listener over every recipe is a real cost
   * on a screen that has one.
   */
  tagLibrary?: string[]
}

/**
 * The chef, as met inside the recipe editor. It proposes a complete draft;
 * nothing reaches `RecipePresenter` until "Apply to editor" is pressed.
 *
 * Laid out to fill whatever it is given — `<AssistantDrawer>` gives it the
 * height of the screen. The transcript is the only part that scrolls; the
 * composer stays pinned to the bottom, because a chat box that scrolls away
 * while you are reading the reply you want to respond to is a chat box you have
 * to hunt for.
 */
const AiAssistant = ({ onApplied, tagLibrary = [] }: AiAssistantProps) => {
  const assistant = useAiDraftPresenter()
  const recipe = useRecipePresenter()
  const turns = useAssistantTurns()
  const pendingImages = usePendingImages()
  const proposedDraft = useProposedDraft()
  const { isAsking } = useAssistantStatus()

  const [text, setText] = useState("")
  const [showDetails, setShowDetails] = useState(false)
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
      // "per conversation", not "at a time": earlier photos are re-sent with
      // every later turn, so they are still using up the budget.
      toast.info(
        `Only ${MAX_IMAGES} photos per conversation — skipped ${rejected.join(", ")}.`
      )
    }
    // Reset so picking the same file twice still fires a change event.
    event.target.value = ""
  }

  const onSend = async () => {
    const message = text
    setText("")
    try {
      await assistant.send(
        message,
        {
          title: recipe.getTitle(),
          ingredients: recipe.getIngredients(),
          directions: recipe.getDirections(),
          // Sent so the chef can keep what is already there and add to it,
          // rather than proposing a set that silently drops half of them.
          tags: recipe.getTags(),
          // Same reason: a figure already in the editor may be one the cook set
          // deliberately, and the chef is told not to overwrite it unasked.
          serves: recipe.getServes(),
          servingSize: recipe.getServingSize(),
        },
        tagLibrary
      )
    } catch (error) {
      setText(message) // Put it back so the message is not lost.
      toast.error(error instanceof Error ? error.message : "The chef could not respond.")
    }
  }

  const onApply = () => {
    if (proposedDraft == null) return
    recipe.loadRecipe(
      {
        ...proposedDraft,
        // `loadRecipe` reads `id` off the argument; keep the editor's own.
        id: recipe.getId() ?? undefined,
        // `loadRecipe` replaces everything it is handed, so a draft that
        // somehow arrived without tags must fall back to the ones already on
        // the recipe — applying must never be a way to lose them silently.
        tags: proposedDraft.tags ?? recipe.getTags(),
        // Null from the chef means "I could not tell", not "take it off" — the
        // schema says so and the prompt says so — so the editor's own figure
        // stands. It also has to match what the summary above claimed: the diff
        // falls back the same way, and an apply that cleared a number the
        // summary had just reported as unchanged is the worst of both.
        // Clearing it is done by emptying the field, which is unambiguous.
        serves: proposedDraft.serves ?? recipe.getServes() ?? undefined,
        servingSize: proposedDraft.servingSize ?? recipe.getServingSize() ?? undefined,
      },
      // A draft is a pile of unsaved edits, not the saved recipe: leaving the
      // baseline where it is makes every line the chef touched show up as
      // changed, which is the point of looking at it before pressing Update.
      { asSaved: false }
    )
    assistant.clearProposedDraft()
    // Out of the way: the reason to apply a draft is to look at what it did,
    // and the marked-up editor is behind this panel.
    onApplied?.()
    toast.success("Draft applied — changed lines are marked.")
  }

  /**
   * The draft against the editor as it stands. The photo is held level on both
   * sides because the chef does not propose one, and a summary announcing it
   * would be describing the apply rather than the draft. **Tags are not held
   * level any more** — the chef proposes those now, and a tag added or dropped
   * is exactly the kind of change someone accepts without noticing, so it has
   * to appear in the summary like any other line — and neither is the yield,
   * for the same reason.
   */
  const sides =
    proposedDraft == null
      ? null
      : ([
          {
            title: recipe.getTitle(),
            serves: recipe.getServes(),
            servingSize: recipe.getServingSize(),
            ingredients: recipe.getIngredients(),
            directions: recipe.getDirections(),
            tags: recipe.getTags(),
            hasImage: false,
          },
          {
            title: proposedDraft.title,
            ingredients: proposedDraft.ingredients,
            directions: proposedDraft.directions,
            tags: proposedDraft.tags ?? recipe.getTags(),
            serves: proposedDraft.serves ?? recipe.getServes(),
            servingSize: proposedDraft.servingSize ?? recipe.getServingSize(),
            hasImage: false,
          },
        ] as const)

  const summary = sides == null ? [] : summariseChanges(diffRecipe(sides[0], sides[1]))
  const details = sides == null ? [] : describeChanges(sides[0], sides[1])

  const canSend = !isAsking && (text.trim() !== "" || pendingImages.length > 0)

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <div
        ref={transcriptRef}
        className='min-h-0 flex-1 overflow-y-auto px-4 py-2'
        aria-live='polite'
        aria-label='Conversation with the chef'>
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
        <div className='mx-4 mt-2 border border-steel bg-steel-100 p-3'>
          <div className='font-mono text-[11px] tracking-[0.14em] text-steel-700 uppercase'>
            Proposed draft
          </div>

          <p className='mt-1 font-heading text-lg leading-tight font-semibold break-words'>
            {proposedDraft.title || "Untitled"}
          </p>

          {/* What would *change*, not what the draft contains: "12 ingredients"
           *  is equally true of a draft that touched one of them and one that
           *  replaced the lot, and those are not the same decision. */}
          {summary.length === 0 ? (
            <p className='my-2 text-sm text-muted'>
              Nothing in the editor would change.
            </p>
          ) : (
            <>
              <ul className='my-2 text-sm'>
                {summary.map((line) => (
                  <li key={line} className='flex gap-2'>
                    <span aria-hidden='true' className='text-steel'>
                      ·
                    </span>
                    {line}
                  </li>
                ))}
              </ul>

              <button
                type='button'
                onClick={() => setShowDetails((shown) => !shown)}
                aria-expanded={showDetails}
                className='cursor-pointer font-mono text-[11px] tracking-[0.14em] text-steel-700 uppercase underline underline-offset-4'>
                {showDetails ? "Hide the lines" : "See what changed"}
              </button>

              {/* The lines themselves. Capped and scrollable: a draft that
               *  rewrites the whole recipe would otherwise push the message box
               *  off the bottom of the drawer. */}
              {showDetails && (
                <div className='mt-2 max-h-[38dvh] overflow-y-auto border-t border-steel-300 pt-2'>
                  {GROUPS.map(({ where, label }) => {
                    const lines = details.filter((line) => line.where === where)
                    if (lines.length === 0) return null

                    return (
                      <div key={where} className='mb-2'>
                        <div className='font-mono text-[10px] tracking-[0.14em] text-muted uppercase'>
                          {label}
                        </div>
                        <ul>
                          {lines.map((line, index) => (
                            <li key={index} className='mt-1 flex items-start gap-2'>
                              <ChangeMark change={line.kind} className='mt-0.5' />
                              <div className='min-w-0 flex-1 text-sm break-words'>
                                {/* The line being replaced above the one
                                 *  replacing it: an amount that went from 1 cup
                                 *  to 2 is the whole question, and a count
                                 *  cannot answer it. */}
                                {line.before != null && (
                                  <p className='text-muted line-through'>{line.before}</p>
                                )}
                                {line.after != null && <p>{line.after}</p>}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          <p className='mt-2 mb-2 text-xs text-muted'>
            Applying replaces the title, ingredients, and directions in the editor, and marks
            every line it touched. Nothing is saved until you press Update.
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
        <ul className='mx-4 mt-2 flex flex-wrap gap-2' aria-label='Attached photos'>
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

      <div className='mt-2 flex flex-wrap items-end gap-2 border-t border-divider px-4 pt-3 pb-1'>
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
          id='assistant-message'
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter is a newline — the convention every chat
            // box uses, and the opposite of the recipe's own step boxes, where
            // Enter belongs to the text.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              if (canSend) void onSend()
            }
          }}
          rows={2}
          placeholder='Describe a recipe, paste a link, or ask for a change…'
          aria-label='Message the chef'
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
