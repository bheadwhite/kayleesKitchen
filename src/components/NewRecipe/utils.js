export const shouldNotSubmitAndFocusInputs = (values, controller, change) => {
  const activeE = document.activeElement
  if (activeE.type === "text") {
    if (activeE.name.match(/name|amount/gi)) {
      const addIngredient = document.getElementById("add-ingredient")
      if (addIngredient == null) {
        controller.updateIngredient(values)
      } else {
        controller.addIngredient(values)
        change("name", "")
        change("amount", "")
        change("unique", false)
        change("optional", false)
      }
      document.getElementById("nameInput").focus()
      return true
    } else if (activeE.name.match(/section/gi)) {
      const addSection = document.getElementById("add-section")
      if (addSection == null) {
        controller.updateSectionTitle(values.section)
      } else {
        controller.addNewSection(values.section)
      }
      return true
    } else if (activeE.name.match(/nextStep/gi)) {
      const addStep = document.getElementById("add-step")
      const name = activeE.name
      const index = Number(activeE.name.slice(activeE.name.indexOf("-") + 1))
      if (addStep != null) {
        controller.addNewStep(index, values[name])
      } else {
        controller.updateSectionStep(index, values)
      }
      document.getElementById(name).focus()
      return true
    }
  } else {
    return false
  }
}
