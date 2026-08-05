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

  // With neither, the prompt is "photograph a home-cooked meal" — a stock photo
  // of nothing in particular. The function rejects it too; this just says so first.
  const canGenerate = presenter.getTitle().trim() !== "" || ingredients.length > 0

  /** Shared tail of both paths: stage the file, upload it, point the form at it. */
  const acceptImageFile = async (file: File, email: string) => {
    presenter.setImageFile(file)
    presenter.setRecipeImageIsLoading(true)
    const uploadedUrl = await uploadRecipeEditorImage(file, email)
    presenter.setImageUrl(uploadedUrl)
    change("image", uploadedUrl)
  }

  const onGenerate = async () => {
    if (user == null) return
    setIsGenerating(true)
    presenter.setRecipeImageIsLoading(true)
    try {
      const file = await generateRecipeImage({
        title: presenter.getTitle(),
        ingredients,
        directions: presenter.getDirections(),
      })
      await acceptImageFile(file, user.email)
    } catch (error) {
      presenter.setRecipeImageIsLoading(false)
      toast.error(error instanceof Error ? error.message : "Could not generate an image.")
    } finally {
      setIsGenerating(false)
    }
  }

  const onChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file == null || user == null) return

    try {
      await acceptImageFile(file, user.email)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload image.")
      presenter.setRecipeImageIsLoading(false)
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
              ? "Draw a picture of this recipe"
              : "Add a title or some ingredients first"
          }>
          <SparklesIcon />
          {isGenerating ? "Generating…" : "Generate"}
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
