import type { RecipePresenter } from "presenters/RecipePresenter"

type FormValues = Record<string, any>
type ChangeField = (field: string, value: unknown) => void

/**
 * Enter-key handling for the recipe editor.
 *
 * Pressing Enter inside an ingredient / section / step field should commit that
 * row to the presenter rather than submitting the whole recipe. Which action to
 * take is inferred from `document.activeElement` plus the presence of the
 * `add-ingredient` / `add-section` / `add-step` marker elements — those ids only
 * exist when the corresponding row is in "add" mode rather than "edit" mode.
 *
 * Returns true when the submit should be swallowed.
 *
 * NOTE: this is DOM-coupled by design. Renaming the `nameInput`, `add-*` or
 * `nextStep-{i}` ids, or the `name`/`amount`/`section`/`nextStep-*` field names,
 * silently breaks Enter-key editing.
 */
export const shouldNotSubmitAndFocusInputs = (
  values: FormValues,
  presenter: RecipePresenter,
  change: ChangeField
): boolean => {
  const active = document.activeElement as HTMLInputElement | null
  if (active == null || active.type !== "text") return false

  const name = active.name ?? ""

  if (name.match(/name|amount/gi)) {
    if (document.getElementById("add-ingredient") == null) {
      presenter.updateIngredient(values as never)
    } else {
      presenter.addIngredient(values as never)
      change("name", "")
      change("amount", "")
      change("unique", false)
      change("optional", false)
    }
    document.getElementById("nameInput")?.focus()
    return true
  }

  if (name.match(/section/gi)) {
    if (document.getElementById("add-section") == null) {
      presenter.updateSectionTitle(values.section)
    } else {
      presenter.addNewSection(values.section)
    }
    return true
  }

  if (name.match(/nextStep/gi)) {
    const index = Number(name.slice(name.indexOf("-") + 1))
    if (document.getElementById("add-step") != null) {
      presenter.addNewStep(index, values[name])
    } else {
      presenter.updateSectionStep(index, values)
    }
    document.getElementById(name)?.focus()
    return true
  }

  return false
}
