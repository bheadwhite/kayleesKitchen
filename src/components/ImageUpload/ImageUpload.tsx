import { useRef, type ChangeEvent } from "react"
import { useForm } from "react-final-form"
import { toast } from "react-toastify"

import { Button, Spinner } from "components"
import { useSessionUser } from "contexts/AuthProvider"
import {
  useLoadingRecipeImage,
  useRecipeImageUrl,
  useRecipePresenter,
} from "contexts/RecipeProvider"
import { uploadRecipeEditorImage } from "fire/services"

const ImageUpload = () => {
  const user = useSessionUser()
  const presenter = useRecipePresenter()
  const url = useRecipeImageUrl()
  const isLoading = useLoadingRecipeImage()
  const { change } = useForm()
  const inputRef = useRef<HTMLInputElement>(null)

  const onChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file == null || user == null) return

    presenter.setImageFile(file)
    presenter.setRecipeImageIsLoading(true)

    try {
      const uploadedUrl = await uploadRecipeEditorImage(file, user.email)
      presenter.setImageUrl(uploadedUrl)
      change("image", uploadedUrl)
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
      <label htmlFor='icon-button-file'>
        <span className='mt-1 mr-1 inline-flex cursor-pointer items-center rounded bg-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-blue/85'>
          New Recipe Image
        </span>
      </label>
      {!isLoading && url != null && (
        <Button onClick={removeImage} danger>
          Delete image
        </Button>
      )}
      <div>
        {url != null && (
          <img
            src={url}
            alt='recipe preview'
            style={{ display: isLoading ? "none" : "block" }}
            className='mt-1 max-w-[168px]'
            onLoad={() => presenter.setRecipeImageIsLoading(false)}
          />
        )}
      </div>
      {isLoading && <Spinner size={32} />}
    </div>
  )
}

export default ImageUpload
