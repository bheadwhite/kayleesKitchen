import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Form } from "react-final-form"
import { describe, expect, it, vi } from "vitest"

import AddIngredient from "./AddIngredient"
import ListIngredients from "./ListIngredients"
import type { RowDiff } from "@/recipeDiff"
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
const setup = (changes?: RowDiff[]) => {
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
            <ListIngredients changes={changes} />
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

describe("ListIngredients — peeking at what a row said", () => {
  const CHANGED: RowDiff[] = [
    { kind: "same" },
    { kind: "changed", before: "Onion — 1 whole" },
  ]

  it("shows the previous text while the row is held, and not before", () => {
    vi.useFakeTimers()
    try {
      const presenter = setup(CHANGED)
      const row = screen.getByTitle("Click to edit · hold to see what it said")

      fireEvent.pointerDown(row)
      expect(screen.queryByText("Onion — 1 whole")).toBeNull()

      act(() => void vi.advanceTimersByTime(400))
      expect(screen.getByText("Onion — 1 whole")).toBeInTheDocument()

      // Ephemeral: letting go puts the current version straight back.
      fireEvent.pointerUp(row)
      expect(screen.queryByText("Onion — 1 whole")).toBeNull()
      presenter.dispose()
    } finally {
      vi.useRealTimers()
    }
  })

  it("does not open the editor when a hold ends", () => {
    vi.useFakeTimers()
    try {
      const presenter = setup(CHANGED)
      const row = screen.getByTitle("Click to edit · hold to see what it said")

      fireEvent.pointerDown(row)
      act(() => void vi.advanceTimersByTime(400))
      fireEvent.pointerUp(row)
      fireEvent.click(row)

      // A hold is a look, not a tap — the row must not swap itself for an input.
      expect(presenter.getEditIngredientIndex()).toBeNull()
      presenter.dispose()
    } finally {
      vi.useRealTimers()
    }
  })

  it("still opens the editor on a plain tap", () => {
    const presenter = setup(CHANGED)
    const row = screen.getByTitle("Click to edit · hold to see what it said")

    fireEvent.pointerDown(row)
    fireEvent.pointerUp(row)
    fireEvent.click(row)

    expect(presenter.getEditIngredientIndex()).toBe(1)
    presenter.dispose()
  })

  it("offers no hold on a row that has not changed", () => {
    const presenter = setup(CHANGED)
    // The unchanged row keeps the plain title: there is nothing to look at.
    expect(screen.getAllByTitle("Click to edit")).toHaveLength(1)
    presenter.dispose()
  })
})

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
