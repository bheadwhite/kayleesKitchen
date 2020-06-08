import React, { useEffect, useState } from "react"
import { Button } from "components"
import { uploadRecipeEditorImage } from "fire/services"
import { useRecipeUrl, useUser } from "hooks"
import { useForm } from "react-final-form"
import { useRecipeController } from "controllers/RecipeController"
import { CircularProgress } from "@material-ui/core"

const ImageUpload = () => {
  const user = useUser()
  const { change } = useForm()
  const controller = useRecipeController()
  const url = useRecipeUrl()
  const [loadingUrl, setLoadingUrl] = useState(true)
  const [loaded, setLoaded] = useState(false)

  const onChange = async (e) => {
    const file = await e.target.files[0]
    controller.setImageFile(file)
    uploadRecipeEditorImage(file, user.email)
      .then((e) => e.ref.getDownloadURL())
      .then((url) => {
        controller.setImageUrl(url)
        change("image", url)
      })
      .catch((e) => console.log("error", e))
  }

  const removeImage = () => {
    change("image", null)
    controller.setImageFile(null)
    controller.setImageUrl(null)
  }

  useEffect(() => {
    if (url !== loadingUrl) {
      setLoadingUrl(url)
      setLoaded(false)
    }
    if (url == null && !loaded) {
      setLoaded(true)
    }
  }, [url, loaded, loadingUrl])

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
      </label>
      <Button onClick={removeImage} style={{ display: url == null && "none" }}>
        Cancel
      </Button>
      <div>
        {url != null && (
          <img
            src={url}
            alt='recipe preview'
            style={{ maxHeight: 200, display: loaded ? "block" : "none" }}
            onLoad={() => setLoaded(true)}
          />
        )}
      </div>
      <div>{!loaded && <CircularProgress />}</div>
    </div>
  )
}

export default ImageUpload
