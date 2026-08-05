import { useRef, useState, type ChangeEvent } from "react"
import { useForm } from "react-final-form"
import { toast } from "react-toastify"

import { Button, Spinner } from "components"
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
      <div className='flex flex-wrap items-center gap-2'>
        <label htmlFor='icon-button-file'>
          {/* Matches <Button>'s touch sizing — it is a label, not a button, because
           *  it has to trigger the hidden file input. */}
          <span className='bg-brand-blue hover:bg-brand-blue/85 mt-1 inline-flex min-h-11 cursor-pointer touch-manipulation items-center rounded px-4 py-2 text-base font-medium text-white sm:min-h-[34px] sm:px-3 sm:py-1.5 sm:text-sm'>
            New Recipe Image
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
          {isGenerating ? "Generating…" : "Generate image"}
        </Button>

        {!isLoading && url != null && (
          <Button onClick={removeImage} danger>
            Delete image
          </Button>
        )}
      </div>
      <div>
        {url != null && (
          <img
            src={url}
            alt='recipe preview'
            style={{ display: isLoading ? "none" : "block" }}
            className='mt-1 h-auto max-w-[168px]'
            onLoad={() => presenter.setRecipeImageIsLoading(false)}
            onError={() => {
              // A dead URL would otherwise leave the spinner up forever, since
              // only `onLoad` clears it.
              presenter.setRecipeImageIsLoading(false)
              presenter.setImageUrl(null)
            }}
          />
        )}
      </div>
      {isLoading && <Spinner size={32} />}
    </div>
  )
}

export default ImageUpload
