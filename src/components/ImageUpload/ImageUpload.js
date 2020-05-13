import React from "react"
import { Button } from "components"
import { uploadRecipeEditorImage } from "fire/services"
<<<<<<< HEAD
import { useRecipeUrl, useAuth } from "hooks"
=======
import useRecipeImage from "hooks/useRecipeImage"
import useAuth from "hooks/useAuth"
>>>>>>> e1817b6d3287149157b802b110eaa410cae8ee76
import { useForm } from "react-final-form"
import { useRecipeController } from "controllers/RecipeController"

const ImageUpload = () => {
  const { user } = useAuth()
  const { change } = useForm()
  const controller = useRecipeController()
<<<<<<< HEAD
  const url = useRecipeUrl()

  const onChange = async (e) => {
    const file = await e.target.files[0]
    controller.setImageFile(file)
    uploadRecipeEditorImage(file, user.email)
      .then((e) => e.ref.getDownloadURL())
      .then((url) => {
        controller.setImageUrl(url)
=======
  const url = useRecipeImage()

  const onChange = async (e) => {
    const file = await e.target.files[0]
    controller.setImageBuffer(file)
    uploadRecipeEditorImage(file, user.email)
      .then((e) => e.ref.getDownloadURL())
      .then((url) => {
        controller.setImage(url)
>>>>>>> e1817b6d3287149157b802b110eaa410cae8ee76
        change("image", url)
      })
      .catch((e) => console.log("error", e))
  }

  const removeImage = () => {
    change("image", null)
<<<<<<< HEAD
    controller.setImageFile(null)
=======
    controller.setImage(null)
>>>>>>> e1817b6d3287149157b802b110eaa410cae8ee76
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
