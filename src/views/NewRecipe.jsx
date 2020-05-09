import React, { useState } from "react"
import { TextField } from "components/finalForm"
import { Button } from "components"
import { Form } from "react-final-form"
import { toast } from "react-toastify"
import { addRecipe } from "fire/services"
import ReactSelect from "react-select"
import useEditSection from "hooks/useEditSection"
import useIngredients from "hooks/useIngredients"
import useDirections from "hooks/useDirections"
import useEditIngredient from "hooks/useEditIngredient"
import { useRecipeController } from "controllers/RecipeController"
import { makeStyles } from "@material-ui/core"
import { AddIngredient, ListIngredients, ListDirections } from "components/NewRecipe"
import useUsersRecipes from "hooks/useUsersRecipes"

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

  const handleRecipe = (value) => {
    console.log("handling my own recipe", value)
  }

  const onSubmit = async ({ directions, title }) => {
    const dirs = directions.map((e) => {
      delete e.editStep
      return e
    })
    await addRecipe({ title, ingredients, directions: dirs })
    console.log("submitted")
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

  return (
    <Form
      onSubmit={onSubmit}
      validate={validate}
      initialValues={{
        name: editIngredient?.name ?? "",
        amount: editIngredient?.amount ?? "",
        directions,
        optional: editIngredient?.optional ?? false,
        unique: editIngredient?.unique ?? false,
        section: directions[editSection]?.sectionTitle ?? "",
        ...getSteps(),
      }}>
      {({ handleSubmit, values, errors, form: { reset } }) => {
        return (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const activeE = document.activeElement
              if (activeE.type === "text") {
                if (activeE.name.match(/name|amount/gi)) {
                  controller.addIngredient(values)
                  reset()
                  document.getElementById("nameInput").focus()
                  return
                } else if (activeE.name.match(/section/gi)) {
                  controller.updateSectionTitle(values.section)
                  return
                } else if (activeE.name.match(/nextStep/gi)) {
                  const name = activeE.name
                  const index = Number(activeE.name.slice(activeE.name.indexOf("-") + 1))
                  controller.addNewStep(index, values[name])
                  document.getElementById(name).focus()
                  return
                }
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
                onChange={handleRecipe}
                defaultValue=''
                className={classes.select}
                placeholder='edit one of your existing recipes...'
                styles={{ menuPortal: (base) => ({ ...base, zIndex: 999 }) }}
                menuPortalTarget={document.body}
                options={usersRecipes}
              />
              <TextField name='title' fullWidth label='Recipe Title' />
            </div>
            <ListIngredients />
            <AddIngredient />
            <ListDirections />
            <div className={classes.submitContainer}>
              <Button type='submit'>Submit Recipe</Button>
            </div>
          </form>
        )
      }}
    </Form>
  )
}

export default CreateNewRecipe
