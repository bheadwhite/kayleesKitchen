import { useRef, useState, type ChangeEvent } from "react"
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
        {url != null && (
          <img
            src={url}
            alt='recipe preview'
            style={{ display: isLoading ? "none" : "block" }}
            className='h-full w-full object-cover'
            onLoad={() => presenter.setRecipeImageIsLoading(false)}
            onError={() => {
              // A dead URL would otherwise leave the spinner up forever, since
              // only `onLoad` clears it.
              presenter.setRecipeImageIsLoading(false)
              presenter.setImageUrl(null)
            }}
          />
        )}
        {isLoading && <Spinner size={32} />}
        {!isLoading && url == null && (
          <span className='border border-divider bg-ground px-2.5 py-1.5 font-mono text-[11px] tracking-[0.1em] text-steel-700 uppercase'>
            photo · finished dish
          </span>
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
