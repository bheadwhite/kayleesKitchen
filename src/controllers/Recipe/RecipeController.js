import StatefulSubject from "utils/StatefulSubject"

const default_editIngredient = {
  name: "",
  amount: "",
  optional: false,
  unique: false,
}

export default class RecipeController {
  id = ""
  title = ""
  directions = new StatefulSubject([])
  ingredients = new StatefulSubject([])
  imageUrl = new StatefulSubject(null)
  imageFile = new StatefulSubject(null)
  editIngredient = new StatefulSubject(default_editIngredient)
  editSection = new StatefulSubject(null)
  loadingRecipeImage = new StatefulSubject(false)

  setTitle(title) {
    this.title = title
  }

  setImageFile(file) {
    this.loadingRecipeImage.next(true)
    this.imageFile.next(file)
  }

  setImageUrl(url) {
    this.imageUrl.next(url)
  }

  setRecipeImageIsLoading(bool) {
    this.loadingRecipeImage.next(bool)
  }

  setEditIngredient(ingredient) {
    this.editIngredient.next(ingredient)
  }

  getDirections() {
    return this.directions.getState()
  }

  getIngredients() {
    return this.ingredients.getState()
  }

  getImageUrl() {
    return this.imageUrl.getState()
  }

  getImageFile() {
    return this.imageFile.getState()
  }

  getEditIngredient() {
    return this.editIngredient.getState()
  }

  getEditSection() {
    return this.editSection.getState()
  }

  //this needs to have a better name
  generateNewRecipe() {
    this.id = ""
    this.title = ""
    this.imageUrl.next(null)
    this.imageFile.next(null)
    this.directions.next([])
    this.ingredients.next([])
    this.editSection.next(null)
    this.editIngredient.next(default_editIngredient)
  }

  deleteIngredient(index) {
    const clone = this.getIngredients().slice()
    clone.splice(index, 1)
    this.ingredients.next(clone)
  }

  addIngredient({ name, amount, unique, optional }) {
    const clone = this.getIngredients().slice()
    clone.push({ name, amount, unique, optional })
    this.ingredients.next(clone)
  }

  updateIngredient({ name, amount, ...props }) {
    const clone = this.getIngredients().slice()
    const index = clone.findIndex(
      (e) => e.name === this.editIngredient.getState().name
    )
    clone.splice(index, 1, {
      name,
      amount,
      optional: props["optional"],
      unique: props["unique"],
    })
    this.resetEditIngredient()
    this.ingredients.next(clone)
  }

  resetEditIngredient() {
    this.editIngredient.next(default_editIngredient)
  }

  setEditSection(index) {
    this.editSection.next(index)
  }

  deleteStep(sectionIndex, indexOfStep) {
    const clone = this.getDirections().slice()
    clone[sectionIndex].steps.splice(indexOfStep, 1)
    this.directions.next(clone)
  }

  moveStepUpOne(sectionIndex, indexOfStep) {
    if (indexOfStep === 0) return
    const clone = this.getDirections().slice()
    const [removedStep] = clone[sectionIndex].steps.splice(indexOfStep, 1)
    clone[sectionIndex].steps.splice(indexOfStep - 1, 0, removedStep)
    this.directions.next(clone)
  }

  moveStepDownOne(sectionIndex, indexOfStep) {
    if (indexOfStep === this.directions[sectionIndex].steps.length - 1) return
    const clone = this.getDirections().slice()
    const [removedStep] = clone[sectionIndex].steps.splice(indexOfStep, 1)
    clone[sectionIndex].steps.splice(indexOfStep + 1, 0, removedStep)
    this.directions.next(clone)
  }

  deleteSection(sectionIndex) {
    const clone = this.getDirections().slice()
    clone.splice(sectionIndex, 1)
    this.directions.next(clone)
  }

  addNewStep(sectionIndex, stepText) {
    const clone = this.getDirections().slice()
    clone[sectionIndex].steps.push(stepText)
    this.directions.next(clone)
  }

  addNewSection(sectionTitle) {
    const clone = this.getDirections().slice()
    clone.push({ sectionTitle, steps: [] })
    this.directions.next(clone)
  }

  updateSectionTitle(sectionTitle) {
    const clone = this.getDirections().slice()
    const index = this.editSection.getState()
    const steps = clone[index].steps
    clone.splice(index, 1, { sectionTitle, steps })
    this.directions.next(clone)
    this.editSection.next(null)
  }

  setEditStep(sectionIndex, stepIndex) {
    const clone = this.getDirections().slice()
    clone[sectionIndex].editStep = stepIndex
    this.directions.next(clone)
  }

  clearEditStep(sectionIndex) {
    const clone = this.getDirections().slice()
    clone[sectionIndex].editStep = null
    this.directions.next(clone)
  }
  removeImage() {
    this.setImageFile(null)
    this.setImageUrl(null)
    this.setRecipeImageIsLoading(false)
  }

  updateSectionStep(sectionIndex, values) {
    const clone = this.getDirections().slice()
    const section = clone[sectionIndex]
    const stepIndex = section.editStep
    section.steps.splice(stepIndex, 1, values[`nextStep-${sectionIndex}`])
    section.editStep = null
    this.directions.next(clone)
  }

  onPulledRecipe(recipe) {
    const clonedDirs = recipe.directions
      .slice()
      .map((section) => ({ ...section, editStep: null }))
    const ingredients = recipe.ingredients.slice()

    this.id = recipe.id
    this.title = recipe.title
    this.directions.next(clonedDirs)
    this.ingredients.next(ingredients)
  }

  onImageUrlChange(callback) {
    return this.imageUrl.subscribe({
      next: callback,
    })
  }

  onIngredientsChange(callback) {
    return this.ingredients.subscribe({
      next: callback,
    })
  }

  onEditIngredientChange(callback) {
    return this.editIngredient.subscribe({
      next: callback,
    })
  }

  onDirectionsChange(callback) {
    return this.directions.subscribe({
      next: callback,
    })
  }

  onEditSectionChange(callback) {
    return this.editSection.subscribe({
      next: callback,
    })
  }

  onLoadingRecipeImage(callback) {
    return this.loadingRecipeImage.subscribe({
      next: callback,
    })
  }
}
