import React, { useState } from "react"
import { toast } from "react-toastify"
import { Button } from "components"
import { Form } from "react-final-form"
import { TextField } from "../components/finalForm"
{
  /** a recipe is composed of ingredients, title, contributor, usersVoted array(calculating score), and directions,
   * ingredients: array,
   * {
   *  name: string, name of ingredient
   *  amount: string, the amount you need of the ingredient for recipe
   *  special: boolean, usually this ingredient can be found in stock in my pantry
   *  optional: boolean, recipe can be made with/without it
   *  substitutions: array, other ingredients this ingredient can be substituted for.
   * }
   * directions: array of objects to create recipe
   * {
   *  type: section | step
   *       steps are listed with a checkbox
   *       sections are a new header title
   *  text: what will be printed to the dom
   * }
   **/
}

const CreateRecipe = () => {
  const [ingredients, setIngredients] = useState([])
  const [directions, setDirections] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = (values) => {
    console.log(values)
  }

  const validate = () => {
    const errors = {}
    return errors
  }
  return (
    <Form onSubmit={onSubmit} validate={validate}>
      {({ handleSubmit, values, errors, submitting }) => {
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
            <TextField name='title' />
            <div>
              Ingredients:
              {ingredients.map((ingredient, index) => {
                return (
                  <div key={ingredient.name}>
                    <TextField name='ingredients[index][ingredient[name]]' placeholder='Name' />
                    <TextField name='ingredients[index][ingredient[amount]]' placeholder='Amount' />
                  </div>
                )
              })}
              {directions.map((direction, index) => {
                return (
                  <div key={direction.name}>
                    <TextField name='directions[index][direction[type]]' placeholder='type' />
                    <TextField name='directions[index][direction[text]]' placeholder='text' />
                  </div>
                )
              })}
              <Button type='submit'>Submit</Button>
            </div>
          </form>
        )
      }}
    </Form>
  )
}

export default CreateRecipe
