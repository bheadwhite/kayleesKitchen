import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import Chef from "./Chef"
import ChefProvider from "contexts/ChefProvider"
import { ChefPresenter } from "presenters/ChefPresenter"
import type { ChefFork, Recipe } from "@/types"

vi.mock("fire/firebase", () => ({ functions: {} }))
vi.mock("fire/services", () => ({
  onRecipeVariantsSnapshot: vi.fn(() => () => {}),
  onRecipeYieldSnapshot: vi.fn(() => () => {}),
  saveRecipeVariant: vi.fn().mockResolvedValue(undefined),
  deleteRecipeVariant: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("contexts/AuthProvider", () => ({
  useSessionUser: () => ({
    uid: "u1",
    email: "lauren@example.test",
    displayName: "Lauren Tarver",
    photoURL: null,
  }),
}))
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const CARBONARA: Recipe = {
  id: "carbonara",
  title: "Carbonara",
  ingredients: [{ name: "farfalle", amount: "6oz" }],
  directions: [{ sectionTitle: "", steps: ["Boil the pasta."] }],
}

const DOUBLED: ChefFork = {
  title: "Carbonara",
  ingredients: [{ name: "farfalle", amount: "12oz", optional: false, unique: false }],
  directions: [{ sectionTitle: "", steps: ["Boil the pasta in a wide pot."] }],
  serves: 8,
  baseServes: 4,
  summary: "Doubled. Use a wider pot so it does not steam.",
  label: "Feeds 8",
  servingSize: "about 1½ cups",
}

const setup = (ask = vi.fn().mockResolvedValue({ text: "…", fork: null, baseServes: null })) => {
  const chef = new ChefPresenter(ask)
  chef.openFor(CARBONARA)
  render(
    <ChefProvider presenter={chef}>
      <Chef />
    </ChefProvider>
  )
  return { chef, ask }
}

beforeEach(() => {
  sessionStorage.clear()
})

describe("Chef", () => {
  it("asks how many it feeds before offering to change the number", async () => {
    const user = userEvent.setup()
    const ask = vi.fn().mockResolvedValue({ text: "About four.", fork: null, baseServes: 4 })
    setup(ask)

    // A recipe records no yield, so there is nothing for a stepper to count
    // from — the control is the question whose answer it needs.
    expect(screen.queryByRole("button", { name: "One more person" })).toBeNull()

    await user.click(screen.getByRole("button", { name: /How many does this feed/ }))

    expect(await screen.findByRole("button", { name: "One more person" })).toBeVisible()
    expect(screen.getByText(/The recipe as written feeds 4/)).toBeInTheDocument()
  })

  it("commits a scale instead of spending a call on every press", async () => {
    const user = userEvent.setup()
    const ask = vi
      .fn()
      .mockResolvedValueOnce({ text: "About four.", fork: null, baseServes: 4 })
      .mockResolvedValueOnce({ text: "Doubled it.", fork: DOUBLED, baseServes: 4 })
    setup(ask)

    await user.click(screen.getByRole("button", { name: /How many does this feed/ }))
    const up = await screen.findByRole("button", { name: "One more person" })

    await user.click(up)
    await user.click(up)
    await user.click(up)
    await user.click(up)

    // Four presses, still one call: walking from four to eight must not be
    // four trips to the model.
    expect(ask).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole("button", { name: "Scale to 8" }))

    expect(ask).toHaveBeenCalledTimes(2)
    expect(await screen.findByText(/Use a wider pot/)).toBeInTheDocument()
  })

  it("offers nothing to press when the number already matches the copy", async () => {
    const user = userEvent.setup()
    const ask = vi
      .fn()
      .mockResolvedValueOnce({ text: "Doubled it.", fork: DOUBLED, baseServes: 4 })
    setup(ask)

    await user.type(screen.getByLabelText("Ask the chef"), "double it")
    await user.click(screen.getByRole("button", { name: "Ask" }))

    expect(await screen.findByText(/this version feeds 8/)).toBeInTheDocument()
    // The stepper now reads 8, which is what is on the plate — a live "Scale to
    // 8" would spend a call to ask for what you already have.
    expect(screen.queryByRole("button", { name: /^Scale to/ })).toBeNull()
  })

  it("drops the copy on demand without losing the conversation", async () => {
    const user = userEvent.setup()
    const ask = vi.fn().mockResolvedValue({ text: "Doubled it.", fork: DOUBLED, baseServes: 4 })
    const { chef } = setup(ask)

    await user.type(screen.getByLabelText("Ask the chef"), "double it")
    await user.click(screen.getByRole("button", { name: "Ask" }))
    await screen.findByText(/Use a wider pot/)

    await user.click(screen.getByRole("button", { name: "Discard" }))

    expect(chef.getFork()).toBeNull()
    expect(screen.getByText("Doubled it.")).toBeInTheDocument()
  })

  it("puts a failed question back in the box rather than losing it", async () => {
    const user = userEvent.setup()
    setup(vi.fn().mockRejectedValue(new Error("network")))

    const box = screen.getByLabelText("Ask the chef")
    await user.type(box, "can I use bacon?")
    await user.click(screen.getByRole("button", { name: "Ask" }))

    expect(await screen.findByDisplayValue("can I use bacon?")).toBe(box)
  })

  it("offers to double before the yield has been worked out", async () => {
    const user = userEvent.setup()
    const ask = vi.fn().mockResolvedValue({ text: "Doubled.", fork: DOUBLED, baseServes: 4 })
    setup(ask)

    // The stepper is not offered yet — there is no number to count from — but
    // "twice the recipe" needs none, so the shortcut is live from the start.
    expect(screen.queryByRole("button", { name: "One more person" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "Double it" }))

    expect(ask).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/Use a wider pot/)).toBeInTheDocument()
  })

  it("stops offering to double once the copy already is", async () => {
    const user = userEvent.setup()
    const ask = vi
      .fn()
      .mockResolvedValueOnce({ text: "About four.", fork: null, baseServes: 4 })
      .mockResolvedValueOnce({ text: "Doubled.", fork: DOUBLED, baseServes: 4 })
    setup(ask)

    await user.click(screen.getByRole("button", { name: /How many does this feed/ }))
    await screen.findByRole("button", { name: "One more person" })
    // Base 4, so doubling is still worth offering.
    expect(screen.getByRole("button", { name: "Double it" })).toBeVisible()

    await user.click(screen.getByRole("button", { name: "Double it" }))

    // Now feeding 8 from a base of 4 — pressing it again would spend a call to
    // hand back what is already on screen.
    await screen.findByText(/this version feeds 8/)
    expect(screen.queryByRole("button", { name: "Double it" })).toBeNull()
  })

  it("says what one serving is, so the count means something", async () => {
    const user = userEvent.setup()
    const ask = vi.fn().mockResolvedValue({ text: "Doubled.", fork: DOUBLED, baseServes: 4 })
    setup(ask)

    await user.click(screen.getByRole("button", { name: "Double it" }))

    // "Serves 18" is unreadable for a batch of cookies on its own.
    expect(await screen.findByText(/A serving is about 1½ cups\./)).toBeInTheDocument()
  })

  it("leaves the serving-size line out rather than inventing one", async () => {
    const user = userEvent.setup()
    // A copy from before serving sizes existed — restored from sessionStorage,
    // or loaded from a variant kept back then.
    const { servingSize: _dropped, ...older } = DOUBLED
    const ask = vi.fn().mockResolvedValue({ text: "Doubled.", fork: older, baseServes: 4 })
    setup(ask)

    await user.click(screen.getByRole("button", { name: "Double it" }))

    expect(await screen.findByText(/this version feeds 8/)).toBeInTheDocument()
    expect(screen.queryByText(/A serving is/)).toBeNull()
  })
})
