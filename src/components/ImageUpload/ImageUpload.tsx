import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react"
import { useForm } from "react-final-form"
import { toast } from "react-toastify"

import { Button, DeleteIcon, ImageIcon, SparklesIcon, Spinner } from "components"
import { useSessionUser } from "contexts/AuthProvider"
import {
  useIngredients,
  useLoadingRecipeImage,
  useRecipeImageUrl,
  useRecipePresenter,
} from "contexts/RecipeProvider"
import { generateRecipeImage } from "@/ai/recipeImage"
import { uploadRecipeEditorImage } from "fire/services"
import { forgetCachedImage } from "@/pwa"

/**
 * How long the preview may sit undecoded before it counts as failed.
 *
 * Only `onLoad` clears the spinner, so a request that never resolves — the
 * worker handing back a truncated cache entry, a connection that stalls without
 * erroring — used to spin until the editor was abandoned. Generous, because
 * this is a phone on a kitchen connection fetching a photo, and the job is to
 * unstick a hang rather than to police a slow one.
 */
const PREVIEW_TIMEOUT_MS = 30_000

/**
 * One retry, and one only.
 *
 * The failure this exists for is a poisoned `CacheFirst` entry — an opaque 403
 * stored as if it were a picture (see `forgetCachedImage`). Evicting it and
 * asking again fixes that in a second; asking a third time would only be
 * hammering something genuinely broken.
 */
const PREVIEW_RETRIES = 1

const ImageUpload = () => {
  const user = useSessionUser()
  const presenter = useRecipePresenter()
  const url = useRecipeImageUrl()
  const isLoading = useLoadingRecipeImage()
  const ingredients = useIngredients()
  const { change } = useForm()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  /**
   * Monotonic ticket for the newest image request.
   *
   * Generation takes tens of seconds, and nothing stops someone picking a photo
   * from the file picker while it runs — the picker is never disabled. Whichever
   * upload resolved last used to win, so a generation started first could land
   * *after* the picked file and silently replace it.
   */
  const requestRef = useRef(0)

  /* ------------------------------------------------------ showing the photo */

  /**
   * The last hop, and until recently the only silent one: the callable
   * succeeds, the upload succeeds, and then the `<img>` either fails to decode
   * or never fires `onLoad` at all — and the editor said nothing either way.
   * `attempt` bumps to force a refetch past the caches; `failedUrl` is the URL
   * that gave up, so the frame can say so instead of quietly emptying itself.
   */
  const [attempt, setAttempt] = useState(0)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)

  // A different picture is a fresh start — including a *regenerated* one, whose
  // URL differs only by the cache-buster.
  useEffect(() => {
    setAttempt(0)
    setFailedUrl(null)
  }, [url])

  /**
   * The retry carries its own parameter rather than reusing the staged URL: the
   * browser's image cache has to be stepped past as well as the worker's, and
   * `url` itself must stay exactly what was uploaded, since that is the string
   * an update writes to the recipe.
   */
  const src =
    url == null || attempt === 0
      ? url
      : `${url}${url.includes("?") ? "&" : "?"}retry=${attempt}`

  const broken = url != null && failedUrl === url

  const previewFailed = useCallback(() => {
    if (url == null || src == null) return
    // Evicted whether or not that is what went wrong — a URL nothing is showing
    // any more has no business being kept, and this is the only place that can
    // tell the worker its copy does not decode.
    void forgetCachedImage(src)
    if (attempt < PREVIEW_RETRIES) {
      setAttempt(attempt + 1)
      return
    }
    // The file, if there is one, stays on the presenter: "Save recipe" uploads
    // `getImageFile()`, so a preview that will not draw must not cost the photo
    // itself. Clearing the URL here — which is what this used to do — also
    // meant an update saving `image: null` over a picture that was fine.
    presenter.setRecipeImageIsLoading(false)
    setFailedUrl(url)
  }, [attempt, presenter, src, url])

  // Nothing else can catch a request that resolves neither way.
  useEffect(() => {
    if (src == null || src === loadedSrc || broken) return
    const timer = setTimeout(previewFailed, PREVIEW_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [broken, loadedSrc, previewFailed, src])

  // With neither, the prompt is "photograph a home-cooked meal" — a stock photo
  // of nothing in particular. The function rejects it too; this just says so first.
  const canGenerate = presenter.getTitle().trim() !== "" || ingredients.length > 0

  /** Shared tail of both paths: stage the file, upload it, point the form at it. */
  const acceptImageFile = async (file: File, email: string, ticket: number) => {
    // Checked on the way in as well as after the upload: `setImageFile` is what
    // "Save recipe" actually uploads, so a superseded generation landing here
    // would save a picture the editor is not even showing.
    if (requestRef.current !== ticket) return
    presenter.setImageFile(file)
    presenter.setRecipeImageIsLoading(true)
    const uploadedUrl = await uploadRecipeEditorImage(file, email)
    // A newer image was chosen while this one uploaded — that one owns the
    // editor now, and writing this URL would quietly undo their choice.
    if (requestRef.current !== ticket) return
    presenter.setImageUrl(uploadedUrl)
    change("image", uploadedUrl)
  }

  const onGenerate = async () => {
    if (user == null) return
    const ticket = (requestRef.current += 1)
    setIsGenerating(true)
    presenter.setRecipeImageIsLoading(true)

    let file: File
    try {
      file = await generateRecipeImage({
        title: presenter.getTitle(),
        ingredients,
        directions: presenter.getDirections(),
      })
    } catch (error) {
      if (requestRef.current === ticket) presenter.setRecipeImageIsLoading(false)
      toast.error(error instanceof Error ? error.message : "Could not generate an image.")
      setIsGenerating(false)
      return
    }
    setIsGenerating(false)

    try {
      await acceptImageFile(file, user.email, ticket)
    } catch {
      // The picture exists and took half a minute to make. Only the *preview*
      // upload failed, so keep it on the presenter: "Save recipe" uploads
      // `getImageFile()` itself, and the image survives. Discarding it here
      // meant paying for a second generation to recover from a blip.
      if (requestRef.current === ticket) presenter.setRecipeImageIsLoading(false)
      toast.error("Image generated, but the preview could not be uploaded. Saving will keep it.")
    }
  }

  const onChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file == null || user == null) return
    const ticket = (requestRef.current += 1)

    try {
      await acceptImageFile(file, user.email, ticket)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload image.")
      if (requestRef.current === ticket) presenter.setRecipeImageIsLoading(false)
    } finally {
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const removeImage = () => {
    change("image", null)
    presenter.removeImage()
  }

  return (
    <div className='upload picture'>
      <input
        ref={inputRef}
        accept='image/*'
        type='file'
        onChange={onChange}
        id='icon-button-file'
        className='hidden'
      />
      {/* The photo frame: a 16/10 blueprint plate, empty until there is an
       *  image. Reserving the space stops the whole form jumping when one
       *  arrives, and it reads as "a picture goes here" while empty. */}
      <div className='blueprint mt-2 flex aspect-[16/10] w-full max-w-[420px] items-center justify-center bg-surface'>
        {src != null && !broken && (
          <img
            src={src}
            alt='recipe preview'
            style={{ display: isLoading ? "none" : "block" }}
            className='h-full w-full object-cover'
            onLoad={() => {
              setLoadedSrc(src)
              presenter.setRecipeImageIsLoading(false)
            }}
            onError={previewFailed}
          />
        )}
        {isLoading && <Spinner size={32} />}
        {!isLoading && url == null && (
          <span className='border border-divider bg-ground px-2.5 py-1.5 font-mono text-[11px] tracking-[0.1em] text-steel-700 uppercase'>
            photo · finished dish
          </span>
        )}
        {/* Said outright, and said differently depending on what is true. A
         *  picture that exists but will not draw is not the same news as no
         *  picture, and the empty plate above says the second — which is how a
         *  generated photo could disappear with nothing shown and nothing
         *  logged. */}
        {!isLoading && broken && (
          <p className='max-w-[280px] px-3 text-center text-[13px] leading-snug text-muted'>
            <span className='block font-heading text-[15px] font-semibold text-ink'>
              Preview didn't load
            </span>
            {presenter.getImageFile() != null
              ? "The photo is still attached — saving keeps it. Regenerate for a different one."
              : "The picture is still on the recipe. Try again, or replace the photo."}
          </p>
        )}
      </div>

      <div className='mt-2 flex flex-wrap items-center gap-2'>
        <label htmlFor='icon-button-file'>
          {/* Matches <Button>'s look and touch sizing — it is a label, not a
           *  button, because it has to trigger the hidden file input. */}
          <span className='mt-1 mr-1 inline-flex min-h-11 cursor-pointer touch-manipulation items-center gap-1.5 border border-divider px-4 py-2 font-heading text-sm font-semibold tracking-[0.09em] uppercase hover:bg-ink/7 sm:min-h-[34px] sm:px-3.5 sm:py-1.5'>
            <ImageIcon />
            {url == null ? "Add photo" : "Replace photo"}
          </span>
        </label>

        {/* Google's image model via Vertex AI — Claude cannot generate images. */}
        <Button
          onClick={() => void onGenerate()}
          disabled={isGenerating || !canGenerate}
          title={
            canGenerate
              ? url == null
                ? "Draw a picture of this recipe"
                : "Draw a different picture — the current one is replaced"
              : "Add a title or some ingredients first"
          }>
          <SparklesIcon />
          {/* The model gives a different picture every run, so a second press
           *  is a normal thing to want. Saying "Regenerate" is what makes that
           *  legible — "Generate" beside a finished photo reads as spent. */}
          {isGenerating ? "Generating…" : url == null ? "Generate" : "Regenerate"}
        </Button>

        {!isLoading && url != null && (
          <Button onClick={removeImage} danger aria-label='Delete image' icon>
            <DeleteIcon />
          </Button>
        )}
      </div>
    </div>
  )
}

export default ImageUpload
