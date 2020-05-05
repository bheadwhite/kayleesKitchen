import React, { useState } from "react"
import { Edit, Delete, Warning } from "@material-ui/icons"
import { useNewRecipe } from "controllers/newRecipe"
import { Button } from "components"
import { Checkbox, TextField } from "components/finalForm"
import theme from "theme"
import { Dialog } from "@material-ui/core"
import { Form } from "react-final-form"
import { toast } from "react-toastify"
import { makeStyles } from "@material-ui/core"

const useStyles = makeStyles((theme) => ({
  title: {
    fontWeight: 700,
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
  emptySpace: {},
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
  ingredientsTitle: {
    fontWeight: 700,
  },
  container: {
    padding: theme.spacing(1.5),
  },
}))

const NewIngredientForm = () => {
  const classes = useStyles()
  const [editItem, setEditItem] = useState(null)
  const [editStepIndexItems, setEditStepIndexItems] = useState([])
  const [editSectionIndexItem, setEditSectionIndexItem] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [directions, setDirections] = useState([])
  const [indexToDelete, setIndexToDelete] = useState(null)
  const [ingredients, setIngredients] = useState([])
  const [toggleNewSection, setToggleNewSection] = useState(false)
  const [modal, setModal] = useState(false)
  const usedRecipe = useNewRecipe()

  const getInitSteps = () => {
    if (directions.length < 1) return { "nextStep-0": "" }
    const obj = {}
    let editStepIndex = 0
    for (let i = 0; i < directions.length; i++) {
      if (editStepIndexItems.length && editStepIndexItems[0].outerIndex === i) {
        obj[`nextStep-${i}`] = editStepIndexItems[editStepIndex].text
        editStepIndex++
      } else {
        obj[`nextStep-${i}`] = ""
      }
    }
    return obj
  }

  const initState = { name: "", amount: "", optional: false, unique: false, ...getInitSteps() }

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

  const handleUpdateSection = (value) => {
    const clonedDirections = directions.slice()
    clonedDirections[editSectionIndexItem.index][0].text = value
    setDirections(clonedDirections)
    setEditSectionIndexItem(null)
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
    // setEditStepIndexItems([])
    setDirections(clonedDir)
    cb()
  }
  const addStepIndexItem = (stepIndexItem) => {
    const clone = editStepIndexItems.slice()
    clone.push(stepIndexItem)

    clone.sort((a, b) => a.outerIndex - b.outerIndex)
    setEditStepIndexItems(clone)
  }
  const handleConfirmDeleteModal = () => setModal((a) => !a)

  const deleteDirection = (index, i) => {
    const clonedDirections = directions.slice()
    if (index == null && typeof indexToDelete === "number") {
      handleConfirmDeleteModal()
      clonedDirections.splice(indexToDelete, 1)
      setDirections(clonedDirections)
      setIndexToDelete(null)
    } else {
      clonedDirections[index].splice(i, 1)
    }
    setDirections(clonedDirections)
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
        section: editSectionIndexItem?.text ?? "",
        ...getInitSteps(),
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
            <div className={classes.directionsTitle}>Directions:</div>
            <div className={classes.directionsContainer}>
              {directions.length > 0 ? (
                directions.map((sectionArray, index) =>
                  sectionArray.map((direction, i) => {
                    const isSection = direction.type === "section"
                    const isStep = direction.type === "step"
                    const isAddNextStep = direction.type === "addNextStep"
                    const text = direction.text
                    if (isSection) {
                      return (
                        <div key={i} className={classes.section}>
                          {direction.text}
                          <Button
                            onClick={() => setEditSectionIndexItem(() => ({ text, index }))}
                            style={{ marginLeft: "1rem" }}>
                            <Edit />
                          </Button>
                          <Button
                            onClick={() => {
                              setIndexToDelete(index)
                              handleConfirmDeleteModal()
                            }}>
                            <Delete />
                          </Button>
                        </div>
                      )
                    } else if (isStep) {
                      return (
                        <div key={i} className={classes.step}>
                          - {direction.text}
                          <Button
                            onClick={() => addStepIndexItem({ text, outerIndex: index, index: i })}
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
                            value={values[`nextStep-${index}`]}
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
              {toggleNewSection || editSectionIndexItem != null ? (
                <React.Fragment>
                  <TextField name='section' placeholder='New Section Name' value={values.section} />
                  {editSectionIndexItem != null ? (
                    <Button
                      onClick={() => {
                        handleUpdateSection(values.section, () => initialize(initState))
                      }}>
                      Update
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        handleSection(values.section, () => initialize(initState))
                      }}>
                      Add
                    </Button>
                  )}
                  <Button onClick={handleToggleNewSection}>Cancel</Button>
                </React.Fragment>
              ) : (
                <Button onClick={handleToggleNewSection}>Add New Section</Button>
              )}
            </div>
            {isSubmitting && <div>submitting</div>}
            <Button>Submit Recipe</Button>
            <Dialog
              open={modal}
              id='confirm-dialog'
              onClose={handleConfirmDeleteModal}
              title='delete section?'>
              <div className={classes.container}>
                <Warning />
                <p>Are you sure you want to delete this section?</p>
                <Button
                  style={{ marginRight: theme.spacing(1) }}
                  onClick={handleConfirmDeleteModal}>
                  No
                </Button>
                <Button onClick={() => deleteDirection(null)}>Yes</Button>
              </div>
            </Dialog>
          </form>
        )
      }}
    </Form>
  )
}

export default NewIngredientForm
