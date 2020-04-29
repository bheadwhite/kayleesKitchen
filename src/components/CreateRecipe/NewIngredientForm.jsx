import React, { useState } from "react"
import { Edit, Delete } from "@material-ui/icons"
import { Button } from "components"
import { Checkbox, TextField } from "components/finalForm"
import { Form } from "react-final-form"
import { toast } from "react-toastify"
import { makeStyles } from "@material-ui/core"

const useStyles = makeStyles((theme) => ({
  title: {
    fontWeight: 700,
  },
  recipeName: {
    fontWeight: 500,
    marginRight: theme.spacing(1),
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
  directionsContainer: {
    "& svg": {
      cursor: "pointer",
    },
    "& button": {
      padding: 0,
    },
  },
  directionsTitle: {
    fontWeight: 700,
  },
  emptySpace: {
    height: 30,
  },
  section: {
    fontWeight: 600,
    color: "blue",
  },
  nextStepFields: {
    display: "flex",
    alignItems: "center",
    "& > div": {
      marginRight: theme.spacing(1),
    },
  },
  addSectionFields: {
    display: "flex",
    alignItems: "center",
    "& > div": {
      marginRight: theme.spacing(1),
    },
  },
  addIngredientFields: {
    display: "flex",
    alignItems: "center",
    "& > div": {
      marginRight: theme.spacing(1),
    },
  },
  ingredientsTitle: {
    fontWeight: 700,
  },
  addIngredientContainer: {
    background: "rgba(0, 0, 0, 0.05)",
    padding: theme.spacing(1),
  },
  ingredientsList: {
    padding: theme.spacing(1),
  },
}))

let initState = { name: "", amount: "", optional: false, unique: false }

const NewIngredientForm = () => {
  const classes = useStyles()
  const [editItem, setEditItem] = useState(null)
  const [editDirectionItem, setEditDirectionItem] = useState(null)
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

  const deleteDirection = (index, i) => {
    console.log("deleting directionnn", index, i)
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
            <div className={classes.title}>Title:</div>
            <div>
              <TextField name='title' />
            </div>
            <div className={classes.ingredientsTitle}>Ingredients:</div>
            <div className={classes.ingredientsList}>
              {ingredients.length > 0 ? (
                ingredients.map((e, i) => {
                  return (
                    <div key={e.name + i + e.amount} className={classes.ingredient}>
                      <span
                        className={classes.recipeName}
                        style={{ color: e.special ? "red" : "green" }}>
                        {`${e.name} `}
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
            </div>
            <div className={classes.addIngredientContainer}>
              <div>Add Ingredient:</div>
              <div>
                <Checkbox name='optional' checked={values.optional} label='optional' />
                <Checkbox name='unique' checked={values.unique} label='unique' />
              </div>
              <div className={classes.addIngredientFields}>
                <TextField name='name' value={values.name} fullWidth={false} placeholder='Name' />
                <TextField
                  name='amount'
                  value={values.amount}
                  fullWidth={false}
                  placeholder='Amount'
                />
                {editItem == null ? (
                  <Button
                    onClick={() => {
                      handleAddNewIngredient(values, () => initialize(initState))
                    }}>
                    Add Ingredient
                  </Button>
                ) : (
                  <React.Fragment>
                    <Button onClick={() => updateIngredient(values)}>UpdateItem</Button>
                    <Button onClick={() => setEditItem(null)}>Cancel</Button>
                  </React.Fragment>
                )}
              </div>
            </div>
            <div className={classes.directionsTitle}>Directions:</div>
            <div className={classes.directionsContainer}>
              {directions.length > 0 ? (
                directions.map((sectionArray, index) =>
                  sectionArray.map((direction, i) => {
                    const isSection = direction.type === "section"
                    const isStep = direction.type === "step"
                    const isAddNextStep = direction.type === "addNextStep"
                    if (isSection) {
                      return (
                        <div key={i} className={classes.section}>
                          {direction.text}
                          <Button
                            onClick={() =>
                              setEditDirectionItem(() => ({ ...direction, position: i }))
                            }
                            style={{ marginLeft: "1rem" }}>
                            <Edit />
                          </Button>
                          <Button onClick={() => deleteDirection(index, i)}>
                            <Delete />
                          </Button>
                        </div>
                      )
                    } else if (isStep) {
                      return (
                        <div key={i} className={classes.step}>
                          - {direction.text}
                          <Button
                            onClick={() =>
                              setEditDirectionItem(() => ({ ...direction, position: i }))
                            }
                            style={{ marginLeft: "1rem" }}>
                            <Edit />
                          </Button>
                          <Button onClick={() => deleteDirection(index, i)}>
                            <Delete />
                          </Button>
                        </div>
                      )
                    } else if (isAddNextStep) {
                      return (
                        <div key={i} className={classes.nextStepFields}>
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
            </div>
            <div className={classes.addSectionFields}>
              {toggleNewSection ? (
                <React.Fragment>
                  <TextField name='section' placeholder='New Section Name' value={values.section} />
                  <Button
                    onClick={() => {
                      handleSection(values.section, () => initialize(initState))
                    }}>
                    Add
                  </Button>
                  <Button onClick={handleToggleNewSection}>Cancel</Button>
                </React.Fragment>
              ) : (
                <Button onClick={handleToggleNewSection}>Add New Section</Button>
              )}
            </div>
            {isSubmitting && <div>submitting</div>}
          </form>
        )
      }}
    </Form>
  )
}

export default NewIngredientForm
