import React, { useState } from "react"
import { Edit, Delete } from "@material-ui/icons"
import { Button } from "components"
import { Checkbox, TextField } from "components/finalForm"
import { Form } from "react-final-form"
import { toast } from "react-toastify"
import { makeStyles } from "@material-ui/core"

const useStyles = makeStyles((theme) => ({
  recipeName: {
    fontWeight: 500,
  },
  optional: { color: "rgba(0,0,0,0.4)" },
  ingredient: {
    "& svg": {
      cursor: "pointer",
    },
  },
  emptySpace: {
    height: 30,
  },
}))

const initState = { name: "", amount: "", optional: false, unique: false }

const NewIngredientForm = () => {
  const classes = useStyles()
  const [editItem, setEditItem] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [directions, setDirections] = useState([])
  const [ingredients, setIngredients] = useState([])

  const onSubmit = (values) => {
    console.log(values)
  }
  const validate = () => {
    const errors = {}
    return errors
  }

  const handleAddNewIngredient = ({ name, amount, optional, unique }, cb) => {
    setIngredients((a) => [...a, { name, amount, optional, special: unique }])
    cb()
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

  const handleNewSection = (name, cb) => {
    const clone = Array.from(directions)
    clone.push({ type: "section", text: name })
    clone.push({ type: "step", text: "" })
    setDirections(clone)
    cb()
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
        section: "",
      }}>
      {({ handleSubmit, values, errors, form: { initialize } }) => {
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
            title:
            <div>
              <TextField name='title' />
            </div>
            Ingredients:
            {ingredients.length > 0 ? (
              ingredients.map((e, i) => {
                return (
                  <div key={e.name + i + e.amount} className={classes.ingredient}>
                    <span
                      className={classes.recipeName}
                      style={{ color: e.special ? "red" : "green" }}>
                      {e.name}
                    </span>
                    <span>{` - ${e.amount}`}</span>
                    {e.optional && <span className={classes.optional}> (optional) </span>}
                    <Edit onClick={() => setEditItem(() => ({ ...e, position: i }))} />
                    <Delete onClick={() => deleteIngredient(i)} />
                  </div>
                )
              })
            ) : (
              <div className={classes.emptySpace}></div>
            )}
            <div>
              <div>Add Ingredient:</div>
              <TextField name='name' value={values.name} fullWidth={false} placeholder='Name' />
              <TextField
                name='amount'
                value={values.amount}
                fullWidth={false}
                placeholder='Amount'
              />
            </div>
            <Checkbox name='optional' checked={values.optional} label='optional' />
            <Checkbox name='unique' checked={values.unique} label='unique' />
            {editItem == null ? (
              <Button
                onClick={() => {
                  const { title } = values
                  handleAddNewIngredient(values, () => initialize({ ...initState, title }))
                }}>
                Add
              </Button>
            ) : (
              <React.Fragment>
                <Button onClick={() => updateIngredient(values)}>UpdateItem</Button>
                <Button onClick={() => setEditItem(null)}>Cancel</Button>
              </React.Fragment>
            )}
            <div>Directions:</div>
            {directions.length > 0 ? (
              directions.map((direction, index) => {
                if (direction.type === "section") {
                  return <div>{direction.text}</div>
                } else {
                  return (
                    <div key={direction.name}>
                      <TextField name='nextStep' placeholder='add new step' />
                    </div>
                  )
                }
              })
            ) : (
              <div>--</div>
            )}
            <TextField name='section' placeholder='section' value={values.section} />
            <Button
              onClick={() => {
                const { title, directions } = values
                handleNewSection(values.section, () =>
                  initialize({ ...initState, title, section: "" })
                )
              }}>
              Add New Section
            </Button>
          </form>
        )
      }}
    </Form>
  )
}

export default NewIngredientForm
