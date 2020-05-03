export default class NewRecipeController {
  title = ""
  directions = []
  ingredients = []

  stepsToEdit = []
  ingredientToEdit = undefined
  sectionToEdit = undefined

  setTitle(title) {
    this.title = title
  }

  //ingredients
  getIngredients() {
    return this.ingredients.slice()
  }
  setIngredients(ingredients) {
    this.ingredients = ingredients
  }
  deleteIngredient(index) {
    const clone = this.ingredients.slice()
    clone.splice(index, 1)
    this.setIngredients(clone)
  }
  addIngredient(ingredient) {
    const clone = this.ingredients.slice()
    clone.push(ingredient)
    this.setIngredients(clone)
  }
  updateIngredient(index, ingredient) {
    const clone = this.ingredients.slice()
    clone.splice(index, 1, ingredient)
    this.setIngredients(clone)
  }

  // directions
  getDirections() {
    return this.directions.slice()
  }
  setDirections(directions) {
    this.directions = directions
  }
  deleteStep(sectionIndex, indexOfStep) {
    const clone = this.directions.slice()
    clone[sectionIndex].splice(indexOfStep, 1)
    this.setDirections(clone)
  }
  deleteSection(sectionIndex) {
    const clone = this.directions.slice()
    clone.splice(sectionIndex, 1)
    this.setDirections(clone)
  }
  addStep(sectionIndex, stepText) {
    const clone = this.directions.slice()
    clone[sectionIndex].push({ type: "step", text: stepText })
    this.setDirections(clone)
  }
  addSection(sectionText) {
    const clone = this.directions.slice()
    clone.push({ type: "section", text: sectionText })
    this.setDirections(clone)
  }
  updateSection(index, sectionText) {
    const clone = this.directions.slice()
    clone[index].splice(0, 1, { type: "section", text: sectionText })
    this.setDirections(clone)
  }
  updateStep(sectionIndex, stepIndex, stepText) {
    const clone = this.directions.slice()
    clone[sectionIndex].slice(stepIndex, 1, { type: "step", text: stepText })
    this.setDirections(clone)
  }
}
