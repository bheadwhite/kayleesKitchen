import React from "react"
import useDirections from "hooks/useDirections"
import { Button } from "components"
import { Edit, Delete } from "@material-ui/icons"
import { TextField } from "components/finalForm"
import { useFormState, useForm } from "react-final-form"
import { makeStyles } from "@material-ui/core"
import { useRecipeController } from "controllers/RecipeController"

const useStyles = makeStyles((theme) => ({
  directionsList: {
    "& svg": {
      cursor: "pointer",
    },
    "& button": {},
  },
}))

const ListDirections = () => {
  const directions = useDirections()
  const { values } = useFormState()
  const classes = useStyles()
  const { reset } = useForm()
  const controller = useRecipeController()

  const handleAddSection = () => {
    controller.addNewSection(values.section)
  }
  const handleEditSection = (index) => {
    controller.setEditSection(index)
  }
  const handleDeleteSection = (index) => {
    controller.deleteSection(index)
  }
  const updateSectionStep = (index) => {
    controller.updateSectionStep(index, values)
  }
  const clearEditStep = (index) => {
    controller.clearEditStep(index)
  }

  const handleNewStep = (index) => {
    controller.addNewStep(index, values[`nextStep-${index}`])
  }
  const handleEditStep = (sectionIndex, stepIndex) => {
    controller.setEditStep(sectionIndex, stepIndex)
  }
  const handleDeleteStep = (sectionIndex, stepIndex) => {
    controller.deleteStep(sectionIndex, stepIndex)
  }

  return (
    <>
      <div className={classes.directionsTitle}>Directions:</div>
      <div className={classes.directionsList}>
        {directions.length > 0 ? (
          directions.map(({ sectionTitle, steps, editStep }, index) => {
            return (
              <div
                key={`${sectionTitle}`}
                style={{
                  border: "1px solid black",
                  borderRadius: "4px",
                  marginBottom: "2rem",
                  padding: "1rem",
                }}>
                <div>
                  {sectionTitle}
                  <Button onClick={() => handleEditSection(index)} style={{ marginLeft: "1rem" }}>
                    <Edit />
                  </Button>
                  <Button onClick={() => handleDeleteSection(index)}>
                    <Delete />
                  </Button>
                </div>
                {steps.map((step, i) => {
                  return (
                    <div key={i}>
                      {step}
                      <Button
                        onClick={() => handleEditStep(index, i)}
                        style={{ marginLeft: "1rem" }}>
                        <Edit />
                      </Button>
                      <Button onClick={() => handleDeleteStep(index, i)}>
                        <Delete />
                      </Button>
                    </div>
                  )
                })}
                <TextField
                  name={`nextStep-${index}`}
                  fullWidth
                  placeholder='type next step'
                  value={values[`nextStep-${index}`] ?? ""}
                />
                {editStep == null ? (
                  <Button onClick={() => handleNewStep(index)}>Add Step</Button>
                ) : (
                  <>
                    <Button onClick={() => updateSectionStep(index)}>Update Step</Button>
                    <Button onClick={() => clearEditStep(index)}>Cancel</Button>
                  </>
                )}
              </div>
            )
          })
        ) : (
          <div> -- </div>
        )}
      </div>
      <TextField name='section' placeholder='New Section Name' value={values.section} />
      {false ? (
        <Button onClick={() => {}}>Update</Button>
      ) : (
        <Button onClick={handleAddSection}>Add</Button>
      )}
    </>
  )
}

export default ListDirections
