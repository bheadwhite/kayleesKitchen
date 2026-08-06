import type { RecipePresenter } from "presenters/RecipePresenter"

type FormValues = Record<string, any>
type ChangeField = (field: string, value: unknown) => void

/**
 * Committing a row swaps the element under the cursor for a different one with
 * the same id — the inline editor unmounts and the "add" field takes its place.
 * Focusing straight away would grab the node React is about to throw out, so
 * this waits for the commit.
 */
const focusByIdAfterRender = (id: string) =>
  setTimeout(() => document.getElementById(id)?.focus(), 0)

/**
 * Enter-key handling for the recipe editor.
 *
 * Pressing Enter inside an ingredient, tag, or section field should commit that
 * row to the presenter rather than submitting the whole recipe. Whether it is an
 * add or an edit is inferred from `document.activeElement` plus the presence of
 * the `add-ingredient` marker element, which only exists while that row is in
 * "add" mode.
 *
 * Steps are deliberately absent: they are textareas (`components/finalForm/
 * TextArea`), where Enter is a newline and never reaches a form submit at all.
 * `Directions.tsx` gives them Cmd/Ctrl+Enter instead.
 *
 * Returns true when the submit should be swallowed.
 *
 * NOTE: this is DOM-coupled by design. Renaming the `nameInput` / `tagInput` /
 * `add-ingredient` ids, or the `name` / `amount` / `tag` / `section` field
 * names, silently breaks Enter-key editing.
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
    focusByIdAfterRender("nameInput")
    return true
  }

  // Tags have no edit mode — one field, one action — so there is no marker to
  // probe for here.
  if (name === "tag") {
    presenter.addTag(String(values.tag ?? ""))
    change("tag", "")
    focusByIdAfterRender("tagInput")
    return true
  }

  if (name.match(/section/gi)) {
    // The section field is only ever mounted in edit mode, so there is no "add"
    // half to tell apart here — `updateSectionTitle` no-ops if nothing is open.
    presenter.updateSectionTitle(values.section)
    return true
  }

  return false
}
