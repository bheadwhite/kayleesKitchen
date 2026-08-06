import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import ChefVersions from "./ChefVersions"
import ChefProvider from "contexts/ChefProvider"
import { ChefPresenter, type ChefStore } from "presenters/ChefPresenter"
import type { ChefVariant, Recipe } from "@/types"

vi.mock("fire/firebase", () => ({ functions: {} }))
vi.mock("fire/services", () => ({
  onRecipeVariantsSnapshot: vi.fn(() => () => {}),
  onRecipeYieldSnapshot: vi.fn(() => () => {}),
  saveRecipeVariant: vi.fn().mockResolvedValue(undefined),
  deleteRecipeVariant: vi.fn().mockResolvedValue(undefined),
}))

const CARBONARA: Recipe = {
  id: "carbonara",
  title: "Carbonara",
  ingredients: [{ name: "farfalle", amount: "6oz" }],
  directions: [{ sectionTitle: "", steps: ["Boil the pasta."] }],
}

const variant = (id: string, label: string, serves: number): ChefVariant => ({
  id,
  label,
  serves,
  baseServes: 4,
  summary: `${label}.`,
  title: "Carbonara",
  ingredients: [{ name: "farfalle", amount: `${serves * 1.5}oz`, optional: false, unique: false }],
  directions: [{ sectionTitle: "", steps: ["Boil the pasta."] }],
  email: "lauren@example.test",
  savedAt: new Date("2026-01-01"),
})

const DOUBLED = variant("v1", "Feeds 8", 8)
const DAIRY_FREE = variant("v2", "Dairy-free", 4)

const setup = (variants: ChefVariant[]) => {
  const ask = vi.fn()
  const remove = vi.fn().mockResolvedValue(undefined)
  let emit: (v: ChefVariant[]) => void = () => {}
  const store: ChefStore = {
    watchVariants: (_id: string, callback: (v: ChefVariant[]) => void) => {
      emit = callback
      return () => {}
    },
    watchYield: () => () => {},
    save: vi.fn().mockResolvedValue(undefined),
    remove,
  }

  const chef = new ChefPresenter(ask, store)
  chef.openFor(CARBONARA)
  emit(variants)

  render(
    <ChefProvider presenter={chef}>
      <ChefVersions />
    </ChefProvider>
  )
  return { chef, ask, remove }
}

describe("ChefVersions", () => {
  it("shows nothing when nobody has kept a version", () => {
    setup([])
    expect(screen.queryByText("Kept")).toBeNull()
  })

  it("loads a kept version without asking the chef", async () => {
    const user = userEvent.setup()
    const { chef, ask } = setup([DOUBLED, DAIRY_FREE])

    await user.click(screen.getByRole("button", { name: "Feeds 8" }))

    // The reason to keep one at all: the second time you want it, it costs a
    // read rather than a model call — and it is the same answer you cooked
    // from last time, not a fresh one that might differ.
    expect(ask).not.toHaveBeenCalled()
    expect(chef.getFork()?.serves).toBe(8)
  })

  it("marks which one is on screen", async () => {
    const user = userEvent.setup()
    setup([DOUBLED, DAIRY_FREE])

    await user.click(screen.getByRole("button", { name: "Feeds 8" }))

    expect(screen.getByRole("button", { name: "Feeds 8" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(screen.getByRole("button", { name: "Dairy-free" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
  })

  it("asks before forgetting one, because it is shared and costs a call to rebuild", async () => {
    const user = userEvent.setup()
    const { remove } = setup([DOUBLED])

    await user.click(screen.getByRole("button", { name: 'Forget "Feeds 8"' }))
    expect(remove).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Keep it" }))
    expect(remove).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: 'Forget "Feeds 8"' }))
    await user.click(screen.getByRole("button", { name: "Forget" }))
    expect(remove).toHaveBeenCalledWith("carbonara", "v1")
  })
})
