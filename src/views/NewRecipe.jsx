import React, { useState, useEffect } from "react"
import { TextField } from "components/finalForm"
import { Button } from "components"
import { Form } from "react-final-form"
import { toast } from "react-toastify"
import useDirections from "hooks/useDirections"
import useEditIngredient from "hooks/useEditIngredient"
import { addRecipe } from "fire/services"
import useEditSection from "hooks/useEditSection"
import useIngredients from "hooks/useIngredients"
import { makeStyles } from "@material-ui/core"
import { AddIngredient, ListIngredients, ListDirections } from "components/NewRecipe"
import useAuth from "hooks/useAuth"
import { getRecipe, getRecipesByEmail } from "fire/services"

const useStyles = makeStyles((theme) => ({
  submitContainer: {
    display: "flex",
    justifyContent: "flex-end",
    background: "rgba(0, 0, 0, 0.05)",
    padding: theme.spacing(2),
    marginTop: theme.spacing(2),
  },
}))

const CreateNewRecipe = () => {
  const [, setIsSubmitting] = useState(false)
  const classes = useStyles()
  const editIngredient = useEditIngredient()
  const editSection = useEditSection()
  const directions = useDirections()
  const ingredients = useIngredients()
  const { user } = useAuth()

  const onSubmit = ({ directions, title }) => {
    const dirs = directions.map((e) => {
      delete e.editStep
      return e
    })
    addRecipe({ title, ingredients, directions: dirs }).then((e) => console.log("ok"))
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

  useEffect(() => {
    ;(async () => {
      if (user != null) {
        try {
          const recipes = await getRecipesByEmail(user.email)
          recipes.docs.forEach((e) => {
            console.log(e)
          })
        } catch (e) {}
      }
    })()
  }, [user])

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
      {({ handleSubmit, values, errors }) => {
        return (
          <form
            onSubmit={(e) => {
              e.preventDefault()
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
