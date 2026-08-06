import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Form } from "react-final-form"
import { describe, expect, it } from "vitest"

import AddIngredient from "./AddIngredient"
import ListIngredients from "./ListIngredients"
import RecipeProvider, {
  useEditIngredientIndex,
  useIngredients,
} from "contexts/RecipeProvider"
import { RecipePresenter } from "presenters/RecipePresenter"

const RECIPE = {
  title: "Empanadas",
  ingredients: [
    { name: "Beef", amount: "1 lb" },
    { name: "Onion", amount: "1/2 cup", optional: true },
  ],
  directions: [],
}

/**
 * Mirrors how RecipeEditor feeds the form: `initialValues` is rebuilt from the
 * presenter, and the view subscribes to the edit index so that rebuild actually
 * happens. Without that subscription the Edit button appeared to do nothing —
 * the row swapped in an editor whose fields were still blank.
 */
const setup = () => {
  const presenter = new RecipePresenter()
  presenter.loadRecipe(RECIPE)

  const Harness = () => {
    const ingredients = useIngredients()
    const editIndex = useEditIngredientIndex()
    const editIngredient = editIndex == null ? null : ingredients[editIndex]

    return (
      <Form
        onSubmit={() => {}}
        initialValues={{
          name: editIngredient?.name ?? "",
          amount: editIngredient?.amount ?? "",
          optional: editIngredient?.optional ?? false,
          unique: editIngredient?.unique ?? false,
        }}>
        {() => (
          <>
            <ListIngredients />
            <AddIngredient />
          </>
        )}
      </Form>
    )
  }

  render(
    <RecipeProvider presenter={presenter}>
      <Harness />
    </RecipeProvider>
  )
  return presenter
}

describe("ListIngredients", () => {
  it("loads the ingredient into the inline editor", async () => {
    const user = userEvent.setup()
    const presenter = setup()

    await user.click(screen.getByRole("button", { name: "Edit Onion" }))

    expect(await screen.findByDisplayValue("Onion")).toBeInTheDocument()
    expect(screen.getByDisplayValue("1/2 cup")).toBeInTheDocument()
    presenter.dispose()
  })

  it("saves the edit back to the row that was opened", async () => {
    const user = userEvent.setup()
    const presenter = setup()

    await user.click(screen.getByRole("button", { name: "Edit Onion" }))
    const amount = await screen.findByDisplayValue("1/2 cup")
    await user.clear(amount)
    await user.type(amount, "2 cups")
    await user.click(screen.getByRole("button", { name: "Save ingredient" }))

    expect(presenter.getIngredients()).toEqual([
      { name: "Beef", amount: "1 lb", optional: undefined, unique: undefined },
      { name: "Onion", amount: "2 cups", optional: true, unique: false },
    ])
    presenter.dispose()
  })

  it("leaves the row alone when the edit is cancelled", async () => {
    const user = userEvent.setup()
    const presenter = setup()

    await user.click(screen.getByRole("button", { name: "Edit Onion" }))
    const amount = await screen.findByDisplayValue("1/2 cup")
    await user.clear(amount)
    await user.type(amount, "2 cups")
    await user.click(screen.getByRole("button", { name: "Cancel editing ingredient" }))

    expect(presenter.getIngredients()[1]).toMatchObject({ amount: "1/2 cup" })
    presenter.dispose()
  })

  it("hides the add row while one is being edited", async () => {
    const user = userEvent.setup()
    const presenter = setup()

    // Both use the `name` / `amount` fields and the `nameInput` id, so only one
    // may be mounted — see NewRecipe/utils.ts.
    expect(screen.getByRole("button", { name: "Add ingredient" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Edit Onion" }))

    expect(screen.queryByRole("button", { name: "Add ingredient" })).not.toBeInTheDocument()
    presenter.dispose()
  })
})
