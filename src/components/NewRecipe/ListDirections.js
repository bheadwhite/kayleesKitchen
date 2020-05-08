import React, { useState, useEffect } from "react"
import useDirections from "hooks/useDirections"
import { Button } from "components"
import { Warning } from "@material-ui/icons"
import theme from "theme"
import { Dialog } from "@material-ui/core"
import { Edit, Delete } from "@material-ui/icons"
import { TextField } from "components/finalForm"
import { useFormState } from "react-final-form"
import { makeStyles } from "@material-ui/core"
import { useRecipeController } from "controllers/RecipeController"
import useEditSection from "hooks/useEditSection"

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
  const [newSection, setNewSection] = useState(false)
  const [confirmModal, setConfirmModal] = useState(false)
  const [deleteIndex, setDeleteIndex] = useState()

  useEffect(() => {
    if (_editSection >= 0 && typeof _editSection === "number" && newSection === false) {
      toggleNewSection()
    } else if (_editSection == null && newSection === true) {
      toggleNewSection()
    }
  }, [_editSection, newSection])

  const addSection = () => controller.addNewSection("New Section")
  const updateSection = () => controller.updateSectionTitle(values.section)
  const editSection = (index) => controller.setEditSection(index)
  const cancelEditSection = () => controller.setEditSection(null)
  const deleteSection = () => controller.deleteSection(deleteIndex)

  const newStep = (index) => controller.addNewStep(index, values[`nextStep-${index}`])
  const cancelStep = (index) => controller.clearEditStep(index)
  const updateStep = (index) => controller.updateSectionStep(index, values)
  const editStep = (sectionIndex, stepIndex) => controller.setEditStep(sectionIndex, stepIndex)
  const deleteStep = (sectionIndex, stepIndex) => controller.deleteStep(sectionIndex, stepIndex)

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
      <div className={classes.directionsList}>
        {directions.length > 0 ? (
          directions.map(({ sectionTitle, steps, editStep: _editStep }, index) => {
            return (
              <div key={`${sectionTitle}-${index}`} className={classes.sectionContainer}>
                <div className={classes.section}>
                  {sectionTitle}
                  <Button onClick={() => editSection(index)} style={{ marginLeft: "1rem" }}>
                    <Edit />
                  </Button>
                  <Button onClick={() => handleDeleteSection(index)}>
                    <Delete />
                  </Button>
                </div>
                {steps.map((step, i) => {
                  return (
                    <div key={i}>
                      - {step}
                      <Button onClick={() => editStep(index, i)} style={{ marginLeft: "1rem" }}>
                        <Edit />
                      </Button>
                      <Button onClick={() => deleteStep(index, i)}>
                        <Delete />
                      </Button>
                    </div>
                  )
                })}
                <div className={classes.nextStepFields}>
                  <TextField
                    name={`nextStep-${index}`}
                    fullWidth
                    placeholder='type next step'
                    value={values[`nextStep-${index}`] ?? ""}
                  />
                  {_editStep == null ? (
                    <Button onClick={() => newStep(index)}>Add Step</Button>
                  ) : (
                    <>
                      <Button onClick={() => updateStep(index)}>Update Step</Button>
                      <Button onClick={() => cancelStep(index)}>Cancel</Button>
                    </>
                  )}
                </div>
              </div>
            )
          })
        ) : (
          <div> -- </div>
        )}
      </div>
      {newSection ? (
        <>
          <TextField name='section' placeholder='New Section Name' value={values.section} />
          {_editSection != null ? (
            <>
              <Button onClick={updateSection}>Update</Button>
              <Button onClick={cancelEditSection}>Cancel</Button>
            </>
          ) : (
            <>
              <Button onClick={addSection}>Add</Button>
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
          <Button style={{ marginRight: theme.spacing(1) }} onClick={toggleConfirmModal}>
            No
          </Button>
          <Button onClick={confirmDeleteSection}>Yes</Button>
        </div>
      </Dialog>
    </>
  )
}

export default ListDirections
