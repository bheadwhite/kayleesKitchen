import React, { useState, useEffect, useRef } from "react"
import useDirections from "controllers/Recipe/useDirections"
import { Button } from "components"
import { Warning } from "@material-ui/icons"
import theme from "theme"
import { Dialog } from "@material-ui/core"
import { Edit, Delete, ArrowUpward, ArrowDownward } from "@material-ui/icons"
import { TextField } from "components/finalForm"
import { useFormState } from "react-final-form"
import { makeStyles } from "@material-ui/core"
import useRecipeController from "controllers/Recipe/useRecipeController"
import useEditSection from "controllers/Recipe/useEditSection"
import clsx from "clsx"

const useStyles = makeStyles((theme) => ({
  directionsList: {
    "& svg": {
      cursor: "pointer",
    },
  },
  container: {
    padding: theme.spacing(1.5),
  },
  sectionContainer: {
    border: "1px solid black",
    borderRadius: "4px",
    marginBottom: theme.spacing(2),
    padding: theme.spacing(3),
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
}))

const ListDirections = () => {
  const directions = useDirections()
  const { values } = useFormState()
  const classes = useStyles()
  const controller = useRecipeController()
  const _editSection = useEditSection()
  const stepRef = useRef()
  const sectionRef = useRef()
  const [newSection, setNewSection] = useState(false)
  const [confirmModal, setConfirmModal] = useState(false)
  const [deleteIndex, setDeleteIndex] = useState()

  useEffect(() => {
    if (
      _editSection >= 0 &&
      typeof _editSection === "number" &&
      newSection === false
    ) {
      toggleNewSection()
      setTimeout(() => {
        const ref = sectionRef.current.querySelector("input")
        if (ref.value === "") {
          ref.focus()
        }
      }, 0)
    } else if (_editSection == null && newSection === true) {
      toggleNewSection()
    }
  }, [_editSection, newSection])

  // sectionRef.current.querySelector("input").value = ""
  // sectionRef.current.querySelector("input").focus()
  const addSection = () => {
    controller.addNewSection("")
    setTimeout(() => {
      const list = document.getElementsByClassName("directions-list")[0]
      list.lastElementChild.querySelector("input").focus()
    }, 0)
  }
  const updateSection = () => controller.updateSectionTitle(values.section)
  const editSection = (index) => controller.setEditSection(index)
  const cancelEditSection = () => controller.setEditSection(null)
  const deleteSection = () => controller.deleteSection(deleteIndex)

  const newStep = (index) => {
    controller.addNewStep(index, values[`nextStep-${index}`])
    stepRef.current.querySelector("input").focus()
  }
  const cancelStep = (index) => controller.clearEditStep(index)
  const updateStep = (index) => {
    controller.updateSectionStep(index, values)
    stepRef.current.querySelector("input").focus()
  }
  const editStep = (sectionIndex, stepIndex) =>
    controller.setEditStep(sectionIndex, stepIndex)
  const deleteStep = (sectionIndex, stepIndex) =>
    controller.deleteStep(sectionIndex, stepIndex)
  const moveStepUp = (sectionIndex, stepIndex) =>
    controller.moveStepUpOne(sectionIndex, stepIndex)
  const moveStepDown = (sectionIndex, stepIndex) =>
    controller.moveStepDownOne(sectionIndex, stepIndex)

  const toggleNewSection = () => setNewSection((a) => !a)
  const toggleConfirmModal = () => setConfirmModal((a) => !a)

  const handleDeleteSection = (index) => {
    setDeleteIndex(index)
    toggleConfirmModal()
  }

  const confirmDeleteSection = () => {
    toggleConfirmModal()
    deleteSection()
    setDeleteIndex(null)
  }

  return (
    <>
      <div className={classes.directionsTitle}>Directions:</div>
      <div className={clsx(classes.directionsList, "directions-list")}>
        {directions.length > 0 ? (
          directions.map(
            ({ sectionTitle, steps, editStep: _editStep }, index) => {
              return (
                <div
                  key={`${sectionTitle}-${index}`}
                  className={classes.sectionContainer}>
                  <div className={classes.section}>
                    {sectionTitle === "" ? (
                      <span style={{ color: "lightgrey" }}>Section Title</span>
                    ) : (
                      sectionTitle
                    )}
                    <Button
                      onClick={() => editSection(index)}
                      style={{ marginLeft: "1rem" }}>
                      Edit Title
                    </Button>
                    <Button
                      onClick={() => handleDeleteSection(index)}
                      danger='true'>
                      Delete Section
                    </Button>
                  </div>
                  {steps.map((step, i) => {
                    return (
                      <div key={i}>
                        - {step}
                        <Button
                          onClick={() => editStep(index, i)}
                          style={{ marginLeft: "1rem" }}>
                          <Edit />
                        </Button>
                        <Button
                          onClick={() => deleteStep(index, i)}
                          danger='true'>
                          <Delete />
                        </Button>
                        <Button onClick={() => moveStepUp(index, i)}>
                          <ArrowUpward />
                        </Button>
                        <Button onClick={() => moveStepDown(index, i)}>
                          <ArrowDownward />
                        </Button>
                      </div>
                    )
                  })}
                  <div className={classes.nextStepFields}>
                    <TextField
                      id={`nextStep-${index}`}
                      name={`nextStep-${index}`}
                      fullWidth
                      placeholder='type next step'
                      ref={stepRef}
                      value={values[`nextStep-${index}`] ?? ""}
                    />
                    {_editStep == null ? (
                      <Button onClick={() => newStep(index)}>
                        <span id='add-step'>Add Step</span>
                      </Button>
                    ) : (
                      <>
                        <Button onClick={() => updateStep(index)}>
                          Update Step
                        </Button>
                        <Button onClick={() => cancelStep(index)}>
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )
            }
          )
        ) : (
          <div> -- </div>
        )}
      </div>
      {newSection ? (
        <>
          <TextField
            id='sectionInput'
            name='section'
            placeholder='New Section Title'
            ref={sectionRef}
            value={values.section}
          />
          {_editSection != null ? (
            <>
              <Button onClick={updateSection}>Update</Button>
              <Button onClick={cancelEditSection}>Cancel</Button>
            </>
          ) : (
            <>
              <Button onClick={addSection}>
                <span id='add-section'>Add</span>
              </Button>
              <Button onClick={toggleNewSection}>Cancel</Button>
            </>
          )}
        </>
      ) : (
        <Button onClick={addSection}>Add New Section</Button>
      )}
      <Dialog
        open={confirmModal}
        id='confirm-dialog'
        onClose={toggleConfirmModal}
        title='delete section?'>
        <div className={classes.container}>
          <Warning />
          <p>Are you sure you want to delete this section?</p>
          <Button
            style={{ marginRight: theme.spacing(1) }}
            onClick={toggleConfirmModal}>
            No
          </Button>
          <Button onClick={confirmDeleteSection}>Yes</Button>
        </div>
      </Dialog>
    </>
  )
}

export default ListDirections
