import React from "react"
import { Subject } from "rxjs"

const default_editIngredient = { name: "", amount: "", optional: false, unique: false }

export default class RecipeController {
  id = ""
  title = ""
  imageUrl = null
  imageUrlSubject = new Subject()
  imageFile = null
  imageFileSubject = new Subject()
  directions = []
  ingredients = []
  directionsSubject = new Subject()
  ingredientsSubject = new Subject()
  editIngredient = default_editIngredient
  editIngredientSubject = new Subject()
  editSection = null
  editSectionSubject = new Subject()

  setTitle(title) {
    this.title = title
  }
  getTitle() {
    return this.title
  }
  newRecipe() {
    this.id = ""
    this.setTitle("")
    this.setImageUrl(null)
    this.setImageFile(null)
    this.setDirections([])
    this.setIngredients([])
    this.editSection = null
    this.editSectionSubject.next(null)
    this.editIngredient = default_editIngredient
    this.editIngredientSubject.next(null)
  }
  setImageUrl(url) {
    this.imageUrl = url
    this.imageUrlSubject.next(url)
  }
  setImageFile(file) {
    this.imageFile = file
    this.imageFileSubject.next(file)
  }
  getImageFile() {
    return this.imageFile
  }
  //ingredients
  getIngredients() {
    return this.ingredients.slice()
  }
  getEditIngredient() {
    return this.editIngredient
  }
  getId() {
    return this.id
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
  addIngredient({ name, amount, unique, optional }) {
    const clone = this.ingredients.slice()
    clone.push({ name, amount, unique, optional })
    this.setIngredients(clone)
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
  setEditSection(index) {
    this.editSection = index
    this.editSectionSubject.next(index)
  }
  deleteStep(sectionIndex, indexOfStep) {
    const clone = this.directions.slice()
    clone[sectionIndex].steps.splice(indexOfStep, 1)
    this.setDirections(clone)
  }
  moveStepUpOne(sectionIndex, indexOfStep) {
    if (indexOfStep === 0) return
    const clone = this.directions.slice()
    const [removedStep] = clone[sectionIndex].steps.splice(indexOfStep, 1)
    clone[sectionIndex].steps.splice(indexOfStep - 1, 0, removedStep)
    this.setDirections(clone)
  }
  moveStepDownOne(sectionIndex, indexOfStep) {
    if (indexOfStep === this.directions[sectionIndex].steps.length - 1) return
    const clone = this.directions.slice()
    const [removedStep] = clone[sectionIndex].steps.splice(indexOfStep, 1)
    clone[sectionIndex].steps.splice(indexOfStep + 1, 0, removedStep)
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
  updateSectionTitle(sectionTitle) {
    const clone = this.directions.slice()
    const index = this.editSection
    const steps = clone[index].steps
    clone.splice(index, 1, { sectionTitle, steps })
    this.setDirections(clone)
    this.editSection = null
    this.editSectionSubject.next(null)
  }

  setEditStep(sectionIndex, stepIndex) {
    const clone = this.getDirections()
    clone[sectionIndex].editStep = stepIndex
    this.setDirections(clone)
  }

  clearEditStep(sectionIndex) {
    const clone = this.getDirections()
    clone[sectionIndex].editStep = null
    this.setDirections(clone)
  }

  updateSectionStep(sectionIndex, values) {
    const clone = this.getDirections()
    const section = clone[sectionIndex]
    const stepIndex = section.editStep
    section.steps.splice(stepIndex, 1, values[`nextStep-${sectionIndex}`])
    section.editStep = null
    this.setDirections(clone)
  }
  onPulledRecipe(recipe) {
    const clonedDirs = recipe.directions.slice().map((section) => ({ ...section, editStep: null }))
    const ingredients = recipe.ingredients.slice()

    this.id = recipe.id
    this.setTitle(recipe.title)
    this.setDirections(clonedDirs)
    this.setIngredients(ingredients)
  }
}
const recipe = new RecipeController()
export const RecipeContext = React.createContext(recipe)
export const useRecipeController = () => React.useContext(RecipeContext)
