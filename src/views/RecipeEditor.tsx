import React, { useState, useEffect } from "react"
import { TextField } from "components/finalForm"
import { Button } from "components"
import { Form } from "react-final-form"
import { toast } from "react-toastify"
import { Warning } from "@material-ui/icons"
import theme from "theme"
import {
  addRecipe,
  updateRecipeById,
  uploadImageToRecipeId,
  getImageUrlByEmailId,
  deleteRecipeById,
} from "fire/services"
import ReactSelect from "react-select"
import {
  useEditSection,
  useIngredients,
  useDirections,
  useUser,
  useUsersRecipes,
  useEditIngredient,
} from "hooks"
import { useRecipeController } from "controllers/RecipeController"
import { makeStyles, Dialog } from "@material-ui/core"
import { AddIngredient, ListIngredients, ListDirections } from "components/NewRecipe"
import { shouldNotSubmitAndFocusInputs } from "components/NewRecipe/utils"
import { ImageUpload } from "components/ImageUpload"
import { CircularProgress } from "@material-ui/core"

const useStyles = makeStyles((theme) => ({
  container: {
    padding: theme.spacing(1.5),
  },
  submitContainer: {
    display: "flex",
    justifyContent: "flex-end",
    background: "rgba(0, 0, 0, 0.05)",
    padding: theme.spacing(2),
    marginTop: theme.spacing(2),
  },
  select: {
    maxWidth: 400,
    background: "white",
    marginBottom: ".3rem",
  },
  delete: {
    marginTop: 80,
    marginBottom: 200,
  },
}))

const RecipeEditor = () => {
  const [, setIsSubmitting] = useState(false)
  const classes = useStyles()
  const [editMode, setEditMode] = useState(false)
  const controller = useRecipeController()
  const [confirmModal, setConfirmModal] = useState(false)
  const editSection = useEditSection()
  useEditIngredient()
  const directions = useDirections()
  const ingredients = useIngredients()
  const user = useUser()
  const [loading, setLoading] = useState(false)
  const usersRecipes = useUsersRecipes().map((recipe) => {
    const data = recipe.data()
    if (data != null) {
      data.id = recipe.id
      return {
        label: data.title,
        value: data,
      }
    } else {
      return null
    }
  })

  useEffect(() => {
    return () => controller.newRecipe()
  }, [controller])

  const handleOnPulledRecipe = ({ value }) => {
    controller.onPulledRecipe(value)
    if (value.image != null && value.image.length > 0) {
      getImageUrlByEmailId(user.email, value.id)
        .then((url) => controller.setImageUrl(url))
        .catch((e) => console.log("error", e))
    } else {
      controller.setImageUrl(undefined)
    }
    setEditMode(true)
  }
  const handleCancelEditMode = () => {
    controller.newRecipe()
    setEditMode(false)
  }

  const toggleConfirmModal = () => setConfirmModal((a) => !a)

  const handleDelete = () =>
    deleteRecipeById(controller.getId()).then(() => {
      toast.success("Recipe has been deleted.")
      controller.newRecipe()
      setEditMode(false)
    })
  const confirmDeleteRecipe = () => {
    toggleConfirmModal()
    handleDelete()
  }

  const onSubmit = async ({ directions, title }) => {
    try {
      const id = controller.getId()
      const storage =
        controller.getImageFile() != null
          ? await uploadImageToRecipeId(controller.getImageFile(), user.email, id)
          : null
      const imgUrl = storage != null ? await storage.ref.getDownloadURL() : ""
      const dirs = directions.map((e) => {
        delete e.editStep
        return e
      })

      if (id.length > 0) {
        if (imgUrl.length > 0) {
          await updateRecipeById(id, {
            title,
            ingredients,
            directions: dirs,
            contributor: user.displayName,
            image: imgUrl,
          })
        } else {
          await updateRecipeById(id, {
            title,
            ingredients,
            directions: dirs,
            contributor: user.displayName,
          })
        }
        toast.success("Your recipe has been updated.")
      } else {
        const recipeRef = await addRecipe({
          title,
          ingredients,
          directions: dirs,
          email: user.email,
          contributor: user.displayName,
          image: imgUrl,
        })
        if (controller.getImageFile() != null) {
          await uploadImageToRecipeId(controller.getImageFile(), user.email, recipeRef.id)
        }
        toast.success("Your recipe has been added.")
      }
      setTimeout(() => {
        if (editMode) {
          setEditMode(false)
        }
        controller.newRecipe()
        setLoading(false)
      }, 1000)
    } catch (e) {
      toast.error(e)
      setLoading(false)
    }
  }
  const validate = (values) => {
    const errors = {}
    if (values.title.ength < 1) {
      errors.title = "A recipe title is required."
    }
    if (ingredients.length < 1) {
      errors.ingredients = "Please submit at least one ingredient."
    }
    if (values.directions.length < 1) {
      errors.directions = "At least one direction is required."
    }
    return errors
  }

  const getSteps = () => {
    const steps = {}
    directions.forEach((section, i) => {
      if (section.editStep != null) {
        steps[`nextStep-${i}`] = section.steps[section.editStep]
      }
    })
    return steps
  }

  const defaultInitValues = {
    title: controller?.getTitle() || "",
    image: controller?.getImageFile() || "",
    name: controller.getEditIngredient()?.name ?? "",
    amount: controller.getEditIngredient()?.amount ?? "",
    directions,
    optional: controller.getEditIngredient()?.optional ?? false,
    unique: controller.getEditIngredient()?.unique ?? false,
    section: directions[editSection]?.sectionTitle ?? "",
    ...getSteps(),
  }

  return (
    <Form
      onSubmit={onSubmit}
      validate={validate}
      initialValues={defaultInitValues}
      destroyOnUnregister={true}>
      {({ handleSubmit, values, errors, form: { change } }) => {
        return (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (shouldNotSubmitAndFocusInputs(values, controller, change)) {
                return
              }
              const recipeErrors = Object.values(errors)
              setIsSubmitting(true)
              if (recipeErrors.length > 0) {
                recipeErrors.forEach((error) => {
                  setIsSubmitting(false)
                  toast.info(error)
                })
              } else {
                setLoading(true)
                handleSubmit(values)
              }
            }}>
            <div>
              <ReactSelect
                onChange={handleOnPulledRecipe}
                defaultValue=''
                value={editMode ? values.title : ""}
                className={classes.select}
                placeholder='edit one of your existing recipes...'
                styles={{ menuPortal: (base) => ({ ...base, zIndex: 999 }) }}
                menuPortalTarget={document.body}
                options={usersRecipes}
              />
              <TextField
                name='title'
                fullWidth
                label='Recipe Title'
                value={values.title}
                onChange={(e) => {
                  change("title", e.target.value)
                  controller.setTitle(e.target.value)
                }}
              />
            </div>
            <ImageUpload />
            <ListIngredients />
            <AddIngredient />
            <ListDirections />
            <div className={classes.submitContainer}>
              {editMode && !loading && <Button onClick={handleCancelEditMode}>Cancel</Button>}
              <Button type='submit' style={{ display: loading ? "none" : "block" }}>
                {editMode ? "Update Recipe" : "Submit Recipe"}
              </Button>
              {loading && <CircularProgress />}
            </div>
            <div className={classes.delete}>
              {editMode && (
                <Button onClick={toggleConfirmModal} danger='true'>
                  Delete
                </Button>
              )}
            </div>
            <Dialog
              open={confirmModal}
              id='confirm-dialog'
              onClose={toggleConfirmModal}
              title='delete section?'>
              <div className={classes.container}>
                <Warning />
                <p>Are you sure you want to delete this Recipe?</p>
                <Button style={{ marginRight: theme.spacing(1) }} onClick={toggleConfirmModal}>
                  No
                </Button>
                <Button onClick={confirmDeleteRecipe}>Yes</Button>
              </div>
            </Dialog>
          </form>
        )
      }}
    </Form>
  )
}

export default RecipeEditor