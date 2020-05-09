import React, { useState, useEffect } from "react"
import { TextField } from "components/finalForm"
import { Button } from "components"
import { Form } from "react-final-form"
import { toast } from "react-toastify"
import { addRecipe, updateRecipeById } from "fire/services"
import ReactSelect from "react-select"
import useEditSection from "hooks/useEditSection"
import useIngredients from "hooks/useIngredients"
import useDirections from "hooks/useDirections"
import useEditIngredient from "hooks/useEditIngredient"
import { useRecipeController } from "controllers/RecipeController"
import { makeStyles } from "@material-ui/core"
import { AddIngredient, ListIngredients, ListDirections } from "components/NewRecipe"
import useUsersRecipes from "hooks/useUsersRecipes"
import { shouldNotSubmitAndFocusInputs } from "components/NewRecipe/utils"

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

const CreateNewRecipe = () => {
  const [, setIsSubmitting] = useState(false)
  const classes = useStyles()
  const [editMode, setEditMode] = useState(false)
  const controller = useRecipeController()
  const editIngredient = useEditIngredient()
  const editSection = useEditSection()
  const directions = useDirections()
  const ingredients = useIngredients()
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
    //handle if editing existing
    if (id.length > 0) {
      try {
        await updateRecipeById(id, { title, ingredients, directions: dirs })
        toast.success("Your recipe has been updated.")
      } catch (e) {
        console.log("error updating recipe", e)
      }
    } else {
      await addRecipe({ title, ingredients, directions: dirs })
      toast.success("Your recipe has been added.")
    }
    controller.newRecipe()
    setEditMode(false)
  }
  const validate = () => {
    const errors = {}
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
    title: controller.getTitle() || "",
    name: editIngredient?.name ?? "",
    amount: editIngredient?.amount ?? "",
    directions,
    optional: editIngredient?.optional ?? false,
    unique: editIngredient?.unique ?? false,
    section: directions[editSection]?.sectionTitle ?? "",
    ...getSteps(),
  }

  return (
    <Form onSubmit={onSubmit} validate={validate} initialValues={defaultInitValues}>
      {({ handleSubmit, values, errors, form: { reset } }) => {
        // console.log("values", JSON.stringify(values, undefined, 2))
        return (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (shouldNotSubmitAndFocusInputs(values, controller)) {
                reset()
                return
              }
              const recipeErrors = Object.values(errors)
              setIsSubmitting(true)
              if (recipeErrors.length > 0) {
                recipeErrors.forEach((error) => {
                  setIsSubmitting(false)
                  toast.info(e)
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
              <TextField name='title' fullWidth label='Recipe Title' value={values.title} />
            </div>
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

export default CreateNewRecipe
