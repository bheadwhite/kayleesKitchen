import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Form } from "react-final-form"
import { describe, expect, it } from "vitest"

import Tags from "./Tags"
import { shouldNotSubmitAndFocusInputs } from "./utils"
import RecipeProvider from "contexts/RecipeProvider"
import { RecipePresenter } from "presenters/RecipePresenter"
import type { TagRecord } from "@/types"

/** Mirrors RecipeEditor: one form, and its submit runs the Enter-key helper. */
const setup = (known: TagRecord[] = []) => {
  const presenter = new RecipePresenter()

  render(
    <RecipeProvider presenter={presenter}>
      <Form<Record<string, any>> onSubmit={() => {}} initialValues={{ tag: "" }}>
        {({ values, form: { change } }) => (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              shouldNotSubmitAndFocusInputs(values, presenter, change)
            }}>
            <Tags known={known} />
          </form>
        )}
      </Form>
    </RecipeProvider>
  )
  return presenter
}

describe("Tags", () => {
  it("adds a tag from the button", async () => {
    const user = userEvent.setup()
    const presenter = setup()

    await user.type(screen.getByPlaceholderText("Or type a new one"), "Mexican")
    await user.click(screen.getByRole("button", { name: "Add tag" }))

    expect(presenter.getTags()).toEqual(["mexican"])
    expect(screen.getByRole("button", { name: "Remove tag: mexican" })).toBeInTheDocument()
    // The box is cleared for the next one rather than left holding what it just
    // committed.
    expect(screen.getByPlaceholderText("Or type a new one")).toHaveValue("")
    presenter.dispose()
  })

  it("adds a tag on Enter instead of submitting the recipe", async () => {
    const user = userEvent.setup()
    const presenter = setup()

    await user.type(screen.getByPlaceholderText("Or type a new one"), "salad{Enter}")

    expect(presenter.getTags()).toEqual(["salad"])
    expect(screen.getByPlaceholderText("Or type a new one")).toHaveValue("")
    presenter.dispose()
  })

  it("removes a tag by pressing its chip", async () => {
    const user = userEvent.setup()
    const presenter = setup()
    presenter.addTag("salad")

    await user.click(await screen.findByRole("button", { name: "Remove tag: salad" }))

    expect(presenter.getTags()).toEqual([])
    presenter.dispose()
  })

  it("adds an existing tag in one tap, and stops offering it", async () => {
    const user = userEvent.setup()
    const presenter = setup([
      { name: "mexican", color: "clay" },
      { name: "salad", color: "sage" },
    ])

    await user.click(screen.getByRole("button", { name: "Add tag: salad" }))

    expect(presenter.getTags()).toEqual(["salad"])
    // Already spent — offering it again only invites a duplicate.
    expect(screen.queryByRole("button", { name: "Add tag: salad" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add tag: mexican" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove tag: salad" })).toBeInTheDocument()
    presenter.dispose()
  })

  it("draws a tag in the colour the registry gives it", async () => {
    const presenter = setup([{ name: "salad", color: "sage" }])
    presenter.addTag("salad")

    const chip = await screen.findByRole("button", { name: "Remove tag: salad" })
    // sage's fill, from src/tagColors.ts.
    expect(chip).toHaveStyle({ backgroundColor: "#edf3ea" })
    presenter.dispose()
  })
})
