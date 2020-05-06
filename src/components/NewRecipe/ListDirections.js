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
    "& button": {
      padding: 0,
    },
  },
}))

const ListDirections = () => {
  const directions = useDirections()
  const { values } = useFormState()
  const classes = useStyles()
  const { initialize, reset } = useForm()
  const controller = useRecipeController()

  const handleAddSection = () => {
    controller.addNewSection(values.section)
    reset()
  }

  console.log(directions)

  return (
    <>
      <div className={classes.directionsTitle}>Directions:</div>
      <div className={classes.directionsList}>
        {directions.length > 0 ? (
          directions.map(({ sectionTitle, steps }, index) => {
            return (
              <div key={`${sectionTitle}`}>
                <div>{sectionTitle}</div>
                {steps.map((step, i) => {
                  return <div key={i}>{step}</div>
                })}
                <TextField
                  name={`nextStep-${index}`}
                  fullWidth={false}
                  placeholder='type next step'
                  value={values[`nextStep-${index}`]}
                />
                <Button
                  onClick={() => {
                    // handleNewStep(values[`nextStep-${index}`], index, () => initialize(initState))
                  }}>
                  Add Step
                </Button>
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
