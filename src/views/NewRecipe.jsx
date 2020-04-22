import React, { useState } from "react"
// import { makeStyles } from "@material-ui/core"
import { TextField } from "../components/finalForm"
import { NewIngredientForm } from "components/CreateRecipe"

// const useStyles = makeStyles((theme) => ({}))

const CreateRecipe = () => {
  // const classes = useStyles()

  // const handleAddDirection = (values, type) => {
  //   const clone = values.directions.splice()
  //   clone.push({ type, text: "" })
  //   setDirections(clone)
  // }

  return (
    <React.Fragment>
      <NewIngredientForm />
    </React.Fragment>
  )
}

export default CreateRecipe
