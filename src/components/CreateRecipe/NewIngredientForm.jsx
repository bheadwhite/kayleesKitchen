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
    display: "flex",
    alignItems: "center",
    "& svg": {
      cursor: "pointer",
    },
    "& button": {
      padding: 0,
    },
  },
  emptySpace: {
    height: 30,
  },
}))

let initState = { name: "", amount: "", optional: false, unique: false }

const NewIngredientForm = () => {
  const classes = useStyles()
  const [editItem, setEditItem] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [directions, setDirections] = useState([])
  const [ingredients, setIngredients] = useState([])
  const [toggleNewSection, setToggleNewSection] = useState(false)

  const onSubmit = (values) => {
    console.log(values)
  }
  const validate = () => {
    const errors = {}
    return errors
  }

  const handleAddNewIngredient = ({ name, amount, optional, unique }, cb) => {
    if (name.length > 0) {
      setIngredients((a) => [...a, { name, amount, optional, special: unique }])
      cb()
    }
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

  const handleSection = (name, cb) => {
    if (name.length < 1) return
    const clone = Array.from(directions)
    clone.push([
      { type: "section", text: name },
      { type: "addNextStep", text: "add new step" },
    ])
    setDirections(clone)
    handleToggleNewSection()
    cb()
  }
  const handleToggleNewSection = () => setToggleNewSection((a) => !a)

  const handleNewStep = (nextStep, index, cb) => {
    if (nextStep?.length == null && nextStep?.length < 1) return
    const clonedSection = Array.from(directions[index])
    const clonedDir = Array.from(directions)

    clonedSection.splice(clonedSection.length - 1, 0, { type: "step", text: nextStep })
    clonedDir.splice(index, 1, clonedSection)

    setDirections(clonedDir)
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
        nextStep: "",
      }}>
      {({ handleSubmit, values, errors, form: { initialize } }) => {
        console.log("finalform values", JSON.stringify(values, undefined, 2))
        initState = { ...initState, ...values }

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

                    <Button
                      onClick={() => setEditItem(() => ({ ...e, position: i }))}
                      style={{ marginLeft: "1rem" }}>
                      <Edit />
                    </Button>
                    <Button onClick={() => deleteIngredient(i)}>
                      <Delete />
                    </Button>
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
                  handleAddNewIngredient(values, () => initialize(initState))
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
              directions.map((sectionArray, index) =>
                sectionArray.map((direction, i) => {
                  const isSection = direction.type === "section"
                  const isStep = direction.type === "step"
                  const isAddNextStep = direction.type === "addNextStep"
                  if (isSection) {
                    return <div key={direction.type + i}>Section: {direction.text}</div>
                  } else if (isStep) {
                    return <div key={direction.type + i}>Step: {direction.text}</div>
                  } else if (isAddNextStep) {
                    return (
                      <div key={direction.type + i}>
                        <TextField
                          name={`nextStep-${index}`}
                          fullWidth={false}
                          placeholder='type next step'
                        />
                        <Button
                          onClick={() => {
                            handleNewStep(values[`nextStep-${index}`], index, () =>
                              initialize(initState)
                            )
                          }}>
                          Add Step
                        </Button>
                      </div>
                    )
                  } else {
                    return null
                  }
                })
              )
            ) : (
              <div>--</div>
            )}
            {toggleNewSection ? (
              <div>
                <TextField name='section' placeholder='New Section Name' value={values.section} />
                <Button
                  onClick={() => {
                    handleSection(values.section, () => initialize(initState))
                  }}>
                  Add
                </Button>
              </div>
            ) : (
              <Button onClick={handleToggleNewSection}>Add New Section</Button>
            )}
            {isSubmitting && <div>submitting</div>}
          </form>
        )
      }}
    </Form>
  )
}

export default NewIngredientForm
