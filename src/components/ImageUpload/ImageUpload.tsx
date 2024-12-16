import { useRef } from "react";
import { Button } from "src/components";
import { uploadRecipeEditorImage } from "src/fire/services.ts";
import useUser from "src/controllers/Auth/useUser";
import useRecipeImageUrl from "src/controllers/Recipe/useRecipeImageUrl";
import useRecipeController from "src/controllers/Recipe/useRecipeController";
import { useForm } from "react-final-form";
import { CircularProgress } from "@material-ui/core";
import useLoadingRecipeImage from "src/controllers/Recipe/useLoadingRecipeImage";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";

const useStyles = makeStyles(() => ({
  deleteImageButton: {
    fontSize: "15px",
    padding: "8px 11px",
    background: "red",
    marginRight: "5px",
    marginTop: "5px",
    textTransform: "none",
    color: "white",
  },
}));

const ImageUpload = () => {
  const user = useUser();
  const { change } = useForm();
  const controller = useRecipeController();
  const url = useRecipeImageUrl();
  const imageInputRef: React.MutableRefObject<HTMLInputElement | null> =
    useRef(null);
  const isImageLoading = useLoadingRecipeImage();
  const classes = useStyles();

  const onChange = async (event) => {
    const file = await event.target.files[0];
    controller.setImageFile(file);
    controller.setRecipeImageIsLoading(true);
    uploadRecipeEditorImage(file, user.email)
      .then((e) => e.ref.getDownloadURL())
      .then((url) => {
        controller.setImageUrl(url);
        change("image", url);
        if (imageInputRef.current) {
          imageInputRef.current.value = "";
        }
      })
      .catch((e) => {
        toast.error(e.message);
        controller.setRecipeImageIsLoading(false);
        if (imageInputRef.current) {
          imageInputRef.current.value = "";
        }
      });
  };

  const removeImage = () => {
    change("image", null);
    controller.removeImage();
  };

  return (
    <div className="upload picture">
      <input
        ref={imageInputRef}
        color="primary"
        accept="image/*"
        type="file"
        onChange={onChange}
        id="icon-button-file"
        style={{ display: "none" }}
      />
      <label htmlFor="icon-button-file">
        <Button component="span" size="large" color="primary">
          New Recipe Image
        </Button>
      </label>
      {!isImageLoading && url != null && (
        <Button className={classes.deleteImageButton} onClick={removeImage}>
          Delete image
        </Button>
      )}
      <div>
        {url != null && (
          <img
            src={url}
            alt="recipe preview"
            style={{
              maxWidth: 168,
              display: isImageLoading ? "none" : "block",
              marginTop: 5,
            }}
            onLoad={() => controller.setRecipeImageIsLoading(false)}
          />
        )}
      </div>
      <div>{isImageLoading && <CircularProgress />}</div>
    </div>
  );
};

export default ImageUpload;
