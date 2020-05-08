import React, { useState, useEffect } from "react"
import { TextField } from "components/finalForm"
import { Button } from "components"
import { Form } from "react-final-form"
import { toast } from "react-toastify"
import useDirections from "hooks/useDirections"
import useEditIngredient from "hooks/useEditIngredient"
import { addRecipe } from "fire/services"
import ReactSelect from "react-select"
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
  const editIngredient = useEditIngredient()
  const editSection = useEditSection()
  const directions = useDirections()
  const ingredients = useIngredients()
  const { user } = useAuth()
  const [myRecipes, setMyRecipes] = useState([])

  const handleRecipe = (value) => {
    console.log("handling my own recipe", value)
  }

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
          console.log(user.email)
          const recipes = await getRecipesByEmail(user.email)
          setMyRecipes(recipes.docs)
        } catch (e) {
          console.log("error pulling your recipes", e)
        }
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
              <ReactSelect
                onChange={handleRecipe}
                defaultValue=''
                className={classes.select}
                placeholder='edit one of your existing recipes...'
                styles={{ menuPortal: (base) => ({ ...base, zIndex: 999 }) }}
                menuPortalTarget={document.body}
                options={myRecipes.map((recipe, index) => {
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
                })}
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
