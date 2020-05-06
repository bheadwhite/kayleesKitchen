import React from "react"
import { Subject } from "rxjs"

const default_editIngredient = { name: "", amount: "", optional: false, unique: false }

export default class RecipeController {
  title = ""
  directions = []
  ingredients = [
    { name: "testing1", amount: "1 cup", optional: false, unique: false },
    { name: "testing2", amount: "1 cup", optional: false, unique: false },
    { name: "testing3", amount: "1 cup", optional: false, unique: false },
  ]
  directionsSubject = new Subject()
  ingredientsSubject = new Subject()

  editSteps = []
  editStepsSubject = new Subject()
  editIngredient = default_editIngredient
  editIngredientSubject = new Subject()
  editSection = ""
  editSectionSubject = new Subject()

  setTitle(title) {
    this.title = title
  }
  //ingredients
  getIngredients() {
    return this.ingredients.slice()
  }
  getEditIngredient() {
    return this.editIngredient
  }
  setIngredients(ingredients) {
    this.ingredients = ingredients
    this.ingredientsSubject.next(ingredients)
  }
  setEditIngredient(ingredient) {
    this.editIngredient = ingredient
    this.editIngredientSubject.next(ingredient)
  }
  deleteIngredient(index) {
    const clone = this.ingredients.slice()
    clone.splice(index, 1)
    this.setIngredients(clone)
  }
  addIngredient({ name, amount }) {
    const clone = this.ingredients.slice()
    clone.push({ name, amount })
    this.setIngredients(clone)
    this.resetEditIngredient()
  }
  updateIngredient({ name, amount, ...props }) {
    const clone = this.ingredients.slice()
    const index = clone.findIndex((e) => e.name === this.editIngredient.name)
    clone.splice(index, 1, { name, amount, optional: props["optional"], unique: props["unique"] })
    this.resetEditIngredient()
    this.setIngredients(clone)
  }
  resetEditIngredient() {
    this.editIngredient = default_editIngredient
    this.editIngredientSubject.next(default_editIngredient)
  }
  // directions
  getDirections() {
    return this.directions.slice()
  }

  getEditSteps() {
    return this.editSteps.slice()
  }

  setDirections(directions) {
    this.directions = directions
    this.directionsSubject.next(directions)
  }
  deleteStep(sectionIndex, indexOfStep) {
    const clone = this.directions.slice()
    clone[sectionIndex].steps.splice(indexOfStep, 1)
    this.setDirections(clone)
  }
  deleteSection(sectionIndex) {
    const clone = this.directions.slice()
    clone.splice(sectionIndex, 1)
    this.setDirections(clone)
  }
  addNewStep(sectionIndex, stepText) {
    const clone = this.directions.slice()
    clone[sectionIndex].steps.push(stepText)
    this.setDirections(clone)
  }
  addNewSection(sectionTitle) {
    const clone = this.directions.slice()
    clone.push({ sectionTitle, steps: [] })
    this.setDirections(clone)
  }
  updateSectionTitle(index, sectionTitle) {
    const clone = this.directions.slice()
    const steps = clone[index].steps
    clone.splice(index, 1, { sectionTitle, ...steps })
    this.setDirections(clone)
  }

  updateStep(sectionIndex, stepIndex, stepText) {
    const clone = this.directions.slice()
    clone[sectionIndex].steps.splice(stepIndex, 1, stepText)
    this.setDirections(clone)
  }
  // onStepChanged
  // onDirectionsChanged
  // onSectionChanged
}

const recipe = new RecipeController()
export const RecipeContext = React.createContext(recipe)
export const useRecipeController = () => React.useContext(RecipeContext)
