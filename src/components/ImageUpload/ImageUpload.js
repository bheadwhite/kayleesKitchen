import React from "react"
import { Button } from "components"
import { uploadRecipeEditorImage } from "fire/services"
import useRecipeImage from "hooks/useRecipeImage"
import useAuth from "hooks/useAuth"
import { useForm } from "react-final-form"
import { useRecipeController } from "controllers/RecipeController"

const ImageUpload = () => {
  const { user } = useAuth()
  const { change } = useForm()
  const controller = useRecipeController()
  const url = useRecipeImage()

  const onChange = async (e) => {
    const file = await e.target.files[0].arrayBuffer()
    uploadRecipeEditorImage(file, user.email)
      .then((e) => e.ref.getDownloadURL())
      .then((url) => {
        controller.setImage(url)
        change("image", url)
      })
      .catch((e) => console.log("error", e))
  }

  const removeImage = () => {
    change("image", null)
    controller.setImage(null)
  }

  return (
    <div className='upload picture'>
      <input
        color='primary'
        accept='image/*'
        type='file'
        onChange={onChange}
        id='icon-button-file'
        style={{ display: "none" }}
      />
      <label htmlFor='icon-button-file'>
        <Button component='span' size='large' color='primary'>
          Upload Image
        </Button>
        <Button onClick={removeImage} style={{ display: url == null && "none" }}>
          Cancel
        </Button>
      </label>
      <div>{url != null && <img src={url} alt='recipe preview' style={{ maxHeight: 200 }} />}</div>
    </div>
  )
}

export default ImageUpload
