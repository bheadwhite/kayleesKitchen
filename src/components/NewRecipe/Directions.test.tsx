import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Form } from "react-final-form"
import { describe, expect, it } from "vitest"

import Directions from "./Directions"
import RecipeProvider, { useDirections, useEditSection } from "contexts/RecipeProvider"
import { RecipePresenter } from "presenters/RecipePresenter"

const RECIPE = {
  title: "Empanadas",
  ingredients: [],
  directions: [{ sectionTitle: "Shells", steps: ["Mix the dough.", "Knead 3-4 minutes."] }],
}

/**
 * Mirrors how RecipeEditor feeds the form: `initialValues` is rebuilt from the
 * presenter, so the step under edit arrives in `nextStep-{i}`.
 */
const setup = () => {
  const presenter = new RecipePresenter()
  presenter.loadRecipe(RECIPE)

  // Must subscribe like RecipeEditor does — a presenter mutation has to
  // re-render this so `initialValues` is rebuilt, or the inputs stay blank.
  const Harness = () => {
    const directions = useDirections()
    const editSection = useEditSection()

    const initialValues: Record<string, unknown> = {
      section: (editSection != null ? directions[editSection]?.sectionTitle : "") ?? "",
    }
    directions.forEach((section, i) => {
      if (section.editStep != null) {
        initialValues[`nextStep-${i}`] = section.steps[section.editStep]
      }
    })

    return (
      <Form onSubmit={() => {}} initialValues={initialValues}>
        {() => <Directions />}
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

describe("Directions", () => {
  it("edits a section title by clicking it", async () => {
    const user = userEvent.setup()
    const presenter = setup()

    await user.click(screen.getByRole("button", { name: "Shells" }))

    const input = await screen.findByDisplayValue("Shells")
    await user.clear(input)
    await user.type(input, "Pastry")
    await user.click(screen.getByRole("button", { name: "Save section title" }))

    expect(presenter.getDirections()[0].sectionTitle).toBe("Pastry")
    presenter.dispose()
  })

  it("edits a step by clicking it", async () => {
    const user = userEvent.setup()
    const presenter = setup()

    await user.click(screen.getByRole("button", { name: "Mix the dough." }))

    expect(presenter.getDirections()[0].editStep).toBe(0)
    // The inline editor replaces the row, so the add-step box is gone.
    expect(screen.queryByPlaceholderText("Type the next step")).toBeNull()
    presenter.dispose()
  })

  it("edits a step in a textarea, so a long one is fully visible", async () => {
    const user = userEvent.setup()
    const presenter = setup()

    expect(screen.getByPlaceholderText("Type the next step").tagName).toBe("TEXTAREA")

    await user.click(screen.getByRole("button", { name: "Mix the dough." }))

    const editor = await screen.findByDisplayValue("Mix the dough.")
    expect(editor.tagName).toBe("TEXTAREA")
    presenter.dispose()
  })

  it("keeps Enter inside the step and commits on Cmd+Enter", async () => {
    const user = userEvent.setup()
    const presenter = setup()

    const adder = screen.getByPlaceholderText("Type the next step")
    await user.click(adder)
    await user.type(adder, "Rest the dough.{Enter}Cover it.")

    // Enter is a newline here, not a commit — nothing has been added yet.
    expect(presenter.getDirections()[0].steps).toHaveLength(2)

    await user.keyboard("{Meta>}{Enter}{/Meta}")

    expect(presenter.getDirections()[0].steps[2]).toBe("Rest the dough.\nCover it.")
    presenter.dispose()
  })

  it("keeps one nextStep field mounted at a time", async () => {
    const user = userEvent.setup()
    const presenter = setup()

    expect(document.querySelectorAll('[name="nextStep-0"]')).toHaveLength(1)

    await user.click(screen.getByRole("button", { name: "Knead 3-4 minutes." }))

    // Edit mode: still exactly one, so the field name stays unambiguous.
    expect(document.querySelectorAll('[name="nextStep-0"]')).toHaveLength(1)
    presenter.dispose()
  })

  it("deletes a step from its row", async () => {
    const user = userEvent.setup()
    const presenter = setup()

    await user.click(screen.getByRole("button", { name: "Delete step: Mix the dough." }))

    expect(presenter.getDirections()[0].steps).toEqual(["Knead 3-4 minutes."])
    presenter.dispose()
  })

  it("offers a drag handle per step", () => {
    const presenter = setup()

    expect(screen.getByRole("button", { name: "Reorder: Mix the dough." })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Reorder: Knead 3-4 minutes." })
    ).toBeInTheDocument()

    presenter.dispose()
  })

  it("confirms before deleting a section", async () => {
    const user = userEvent.setup()
    const presenter = setup()

    await user.click(screen.getByRole("button", { name: "Delete section: Shells" }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Delete section" }))
    expect(presenter.getDirections()).toEqual([])

    presenter.dispose()
  })
})
