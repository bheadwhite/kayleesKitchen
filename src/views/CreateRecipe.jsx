import React, { useState } from "react"
import { toast } from "react-toastify"
import { Button } from "components"
import { Edit, Delete } from "@material-ui/icons"
import { Form } from "react-final-form"
import { TextField, Checkbox } from "../components/finalForm"

const CreateRecipe = () => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ingredients, setIngredients] = useState([])
  const [directions, setDirections] = useState([])
  const [editItem, setEditItem] = useState(null)

  // const handleAddDirection = (values, type) => {
  //   const clone = values.directions.splice()
  //   clone.push({ type, text: "" })
  //   setDirections(clone)
  // }
  const handleAddNewIngredient = ({ name, amount, optional, unique }, cb) => {
    setIngredients((a) => [...a, { name, amount, optional, special: unique }])
    cb()
  }

  const onSubmit = (values) => {
    console.log(values)
  }

  const deleteIngredient = (index) => {
    const clone = Array.from(ingredients)
    clone.splice(index, 1)
    setIngredients(clone)
  }

  const updateIngredient = (values) => {
    const clone = Array.from(ingredients)
    clone.splice(editItem.position, 1, { ...values, special: values.unique })
    setEditItem(null)
    setIngredients(clone)
  }

  const validate = () => {
    const errors = {}
    return errors
  }

  return (
    <Form
      onSubmit={onSubmit}
      validate={validate}
      initialValues={{
        name: editItem?.name ?? "",
        amount: editItem?.amount ?? "",
        directions,
        optional: editItem?.optional ?? false,
        unique: editItem?.unique ?? false,
      }}>
      {({ handleSubmit, values, errors, form }) => {
        console.log("finalform values", JSON.stringify(values, undefined, 2))
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
            <div>Recipe Title:</div>
            <TextField name='title' />
            <div>
              Ingredients:
              {ingredients.map((e, i) => {
                return (
                  <div key={e.name + i + e.amount}>
                    <span
                      style={{
                        fontWeight: 500,
                        color: e.special ? "red" : "green",
                      }}>
                      {e.name}
                    </span>
                    <span>{` - ${e.amount}`}</span>
                    {e.optional && <span style={{ color: "rgba(0,0,0,0.4)" }}> (optional) </span>}
                    <Edit
                      style={{ cursor: "pointer" }}
                      onClick={() => setEditItem(() => ({ ...e, position: i }))}
                    />
                    <Delete style={{ cursor: "pointer" }} onClick={() => deleteIngredient(i)} />
                  </div>
                )
              })}
              <div>
                <TextField name='name' value={values.name} fullWidth={false} placeholder='Name' />
                <TextField
                  name='amount'
                  value={values.amount}
                  fullWidth={false}
                  placeholder='Amount'
                />
              </div>
              <label>optional:</label>
              <Checkbox name='optional' checked={values.optional} />
              <label>unique:</label>
              <Checkbox name='unique' checked={values.unique} />
              {editItem == null ? (
                <Button
                  onClick={() =>
                    handleAddNewIngredient(values, () => {
                      form.initialize({ name: "", amount: "", optional: false, unique: false })
                    })
                  }>
                  Add
                </Button>
              ) : (
                <>
                  <Button onClick={() => updateIngredient(values)}>UpdateItem</Button>
                  <Button onClick={() => setEditItem(null)}>Cancel</Button>
                </>
              )}
              {/* Directions: */}
              {/* <Button onClick={() => handleAddDirection(, "section")}>Add section</Button>
              <Button onClick={() => handleAddDirection(values, "step")}>Add step</Button> */}
              {/* {directions.map((direction, index) => {
                return (
                  <div key={direction.name}>
                    <TextField name='type' placeholder='type' />
                    <TextField name='text' placeholder='text' />
                  </div>
                )
              })} */}
            </div>
          </form>
        )
      }}
    </Form>
  )
}

export default CreateRecipe
