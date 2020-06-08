import React, { useState, useEffect } from "react"
import { TextField } from "components/finalForm"
import { Button } from "components"
import { Form } from "react-final-form"
import { toast } from "react-toastify"
import {
  addRecipe,
  updateRecipeById,
  uploadImageToRecipeId,
  getImageUrlByEmailId,
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
import { makeStyles } from "@material-ui/core"
import { AddIngredient, ListIngredients, ListDirections } from "components/NewRecipe"
import { shouldNotSubmitAndFocusInputs } from "components/NewRecipe/utils"
import { ImageUpload } from "components/ImageUpload"

const useStyles = makeStyles((theme) => ({
  submitContainer: {
    display: "flex",
    justifyContent: "flex-end",
    background: "rgba(0, 0, 0, 0.05)",
    padding: theme.spacing(2),
    marginTop: theme.spacing(2),
    marginBottom: 200,
  },
  select: {
    maxWidth: 400,
    background: "white",
  },
}))

const RecipeEditor = () => {
  const [, setIsSubmitting] = useState(false)
  const classes = useStyles()
  const [editMode, setEditMode] = useState(false)
  const controller = useRecipeController()
  const editSection = useEditSection()
  const editIngredient = useEditIngredient()
  const directions = useDirections()
  const ingredients = useIngredients()
  const user = useUser()
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

  console.log("edititem", editIngredient)

  useEffect(() => {
    return () => controller.newRecipe()
  }, [controller])

  const handleOnPulledRecipe = ({ value }) => {
    controller.onPulledRecipe(value)
    getImageUrlByEmailId(user.email, value.id)
      .then((url) => controller.setImageUrl(url))
      .catch((e) => console.log("error", e))
    setEditMode(true)
  }
  const handleCancelEditMode = () => {
    controller.newRecipe()
    setEditMode(false)
  }

  const onSubmit = async ({ directions, title }) => {
    const id = controller.getId()
    const dirs = directions.map((e) => {
      delete e.editStep
      return e
    })
    if (id.length > 0) {
      try {
        let response
        if (controller.getImageFile() != null) {
          const storage = await uploadImageToRecipeId(controller.getImageFile(), user.email, id)
          response = await storage.ref.getDownloadURL()
          await updateRecipeById(id, {
            title,
            ingredients,
            directions: dirs,
            contributor: user.displayName,
            image: response,
          })
        }
        await updateRecipeById(id, {
          title,
          ingredients,
          directions: dirs,
          contributor: user.displayName,
        })

        toast.success("Your recipe has been updated.")
      } catch (e) {
        console.log("error updating recipe", e)
      }
    } else {
      const recipeRef = await addRecipe({
        title,
        ingredients,
        directions: dirs,
        email: user.email,
        contributor: user.displayName,
      })

      await uploadImageToRecipeId(controller.getImageFile(), user.email, recipeRef.id)
      toast.success("Your recipe has been added.")
    }
    controller.newRecipe()
    setEditMode(false)
  }
  const validate = (values) => {
    const errors = {}
    if (values.title.length < 1) {
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
    console.log("init form: steps")
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
        console.log("values", JSON.stringify(values, undefined, 2))
        console.log("currentEdit", controller.getEditIngredient())
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
              {editMode && (
                <>
                  <Button onClick={handleCancelEditMode}>Cancel</Button>
                  <Button type='submit'>Update Recipe</Button>
                </>
              )}
              <Button type='submit' style={{ display: editMode ? "none" : "inline" }}>
                Submit Recipe
              </Button>
            </div>
          </form>
        )
      }}
    </Form>
  )
}

export default RecipeEditor
