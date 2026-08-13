import { beforeEach, describe, expect, it, vi } from "vitest"

import { AiDraftPresenter } from "./AiDraftPresenter"
import type {
  AssistantImage,
  AssistantRequest,
  AssistantResponse,
  EditorDraft,
} from "@/ai/types"

vi.mock("fire/firebase", () => ({ functions: {} }))

const EMPTY_DRAFT: EditorDraft = {
  title: "",
  ingredients: [],
  directions: [],
  tags: [],
  serves: null,
  servingSize: null,
}

const DRAFT: EditorDraft = {
  title: "Won Ton Salad",
  ingredients: [{ name: "cabbage", amount: "1 head", optional: false, unique: false }],
  directions: [{ sectionTitle: "", steps: ["Chop the cabbage."] }],
  tags: ["salad"],
  serves: 4,
  servingSize: "1 bowl",
}

const file = (name: string) => new File(["x"], name, { type: "image/png" })

const encodeImage = vi.fn(
  async (f: File): Promise<AssistantImage> => ({ mediaType: "image/png", data: f.name })
)

const build = (ask: (request: AssistantRequest) => Promise<AssistantResponse>) =>
  new AiDraftPresenter(ask, encodeImage)

beforeEach(() => {
  // jsdom implements neither; the presenter uses them for thumbnails.
  URL.createObjectURL = vi.fn((f) => `blob:${(f as File).name}`)
  URL.revokeObjectURL = vi.fn()
  encodeImage.mockClear()
})

describe("AiDraftPresenter", () => {
  it("records both turns and the proposed draft", async () => {
    const ask = vi.fn().mockResolvedValue({ text: "Here you go.", draft: DRAFT })
    const presenter = build(ask)

    await presenter.send("type this up", EMPTY_DRAFT)

    expect(presenter.getTurns()).toEqual([
      { role: "user", text: "type this up", images: [] },
      { role: "assistant", text: "Here you go." },
    ])
    expect(presenter.getProposedDraft()).toEqual(DRAFT)
    presenter.dispose()
  })

  it("sends the editor's current contents so the assistant edits real state", async () => {
    const ask = vi.fn().mockResolvedValue({ text: "Doubled.", draft: DRAFT })
    const presenter = build(ask)

    await presenter.send("double it", DRAFT)

    expect(ask.mock.calls[0][0].currentDraft).toEqual(DRAFT)
    presenter.dispose()
  })

  it("keeps images attached to their own turn across the conversation", async () => {
    const ask = vi.fn().mockResolvedValue({ text: "ok", draft: null })
    const presenter = build(ask)

    presenter.attachImages([file("card.png")])
    await presenter.send("read this", EMPTY_DRAFT)
    await presenter.send("what about the sauce?", EMPTY_DRAFT)

    // Second request still carries the first turn's photo.
    const secondRequest = ask.mock.calls[1][0] as AssistantRequest
    expect(secondRequest.turns[0]).toEqual({
      role: "user",
      text: "read this",
      images: [{ mediaType: "image/png", data: "card.png" }],
    })
    expect(secondRequest.turns[2]).toEqual({
      role: "user",
      text: "what about the sauce?",
      images: [],
    })
    presenter.dispose()
  })

  it("clears staged photos once they have been sent", async () => {
    const ask = vi.fn().mockResolvedValue({ text: "ok", draft: null })
    const presenter = build(ask)

    presenter.attachImages([file("a.png"), file("b.png")])
    expect(presenter.getPendingImages()).toHaveLength(2)

    await presenter.send("go", EMPTY_DRAFT)

    expect(presenter.getPendingImages()).toEqual([])
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
    presenter.dispose()
  })

  it("reports photos it had no room for", () => {
    const presenter = build(vi.fn())

    const rejected = presenter.attachImages(
      Array.from({ length: 10 }, (_, i) => file(`p${i}.png`))
    )

    expect(presenter.getPendingImages()).toHaveLength(8)
    expect(rejected).toEqual(["p8.png", "p9.png"])
    presenter.dispose()
  })

  it("counts photos already sent against the budget", async () => {
    const ask = vi.fn().mockResolvedValue({ text: "ok", draft: null })
    const presenter = build(ask)

    presenter.attachImages(Array.from({ length: 6 }, (_, i) => file(`first-${i}.png`)))
    await presenter.send("type these up", EMPTY_DRAFT)
    expect(presenter.getPendingImages()).toEqual([])

    // Those six ride along on every later turn, so only two slots are left.
    // Counting just the pending batch here let the callable — which counts
    // across all turns — reject the send after the whole upload.
    const rejected = presenter.attachImages([
      file("more-0.png"),
      file("more-1.png"),
      file("more-2.png"),
    ])

    expect(presenter.getPendingImages()).toHaveLength(2)
    expect(rejected).toEqual(["more-2.png"])
    presenter.dispose()
  })

  it("sends every staged photo in one turn", async () => {
    const ask = vi.fn().mockResolvedValue({ text: "ok", draft: null })
    const presenter = build(ask)

    presenter.attachImages([file("a.png"), file("b.png"), file("c.png")])
    await presenter.send("three cards", EMPTY_DRAFT)

    expect(ask.mock.calls[0][0].turns[0].images).toEqual([
      { mediaType: "image/png", data: "a.png" },
      { mediaType: "image/png", data: "b.png" },
      { mediaType: "image/png", data: "c.png" },
    ])
    presenter.dispose()
  })

  it("rolls the user's turn back when the call fails", async () => {
    const ask = vi.fn().mockRejectedValue(new Error("network"))
    const presenter = build(ask)

    await expect(presenter.send("hello", EMPTY_DRAFT)).rejects.toThrow("network")

    // Otherwise a retry would send the same turn twice.
    expect(presenter.getTurns()).toEqual([])
    presenter.dispose()
  })

  it("leaves the draft alone on a conversational turn", async () => {
    const ask = vi
      .fn()
      .mockResolvedValueOnce({ text: "Here you go.", draft: DRAFT })
      .mockResolvedValueOnce({ text: "About a week.", draft: null })
    const presenter = build(ask)

    await presenter.send("type this up", EMPTY_DRAFT)
    await presenter.send("how long does it keep?", EMPTY_DRAFT)

    expect(presenter.getProposedDraft()).toEqual(DRAFT)
    presenter.dispose()
  })

  it("ignores an empty message with no photos", async () => {
    const ask = vi.fn()
    const presenter = build(ask)

    await presenter.send("   ", EMPTY_DRAFT)

    expect(ask).not.toHaveBeenCalled()
    presenter.dispose()
  })

  /**
   * The chef never sees its own past drafts — a proposal leaves as a tool call
   * and comes back as the sentence written beside it — so the list of what has
   * been turned down is the only record there is.
   */
  describe("something else", () => {
    it("names the dish, remembers it, and asks again", async () => {
      const ask = vi
        .fn()
        .mockResolvedValueOnce({ text: "Here's a draft.", draft: DRAFT })
        .mockResolvedValueOnce({ text: "How about a chowder?", draft: null })
      const presenter = build(ask)

      await presenter.send("something for tonight", EMPTY_DRAFT)
      await presenter.rejectDraft(EMPTY_DRAFT)

      // Named in the transcript, so scrolling back says *what* was refused
      // rather than showing a row of identical "something else"s.
      expect(presenter.getTurns()[2]).toEqual({
        role: "user",
        text: 'Not "Won Ton Salad" — suggest something else.',
        images: [],
      })
      // And named on the list, which is what the prompt actually points at.
      expect(ask.mock.calls[1][0].rejected).toEqual(["Won Ton Salad"])
      expect(presenter.getRejected()).toEqual(["Won Ton Salad"])
      // The proposal it replaces is off the screen.
      expect(presenter.getProposedDraft()).toBeNull()
      presenter.dispose()
    })

    it("keeps carrying what was turned down on later turns", async () => {
      const ask = vi
        .fn()
        .mockResolvedValueOnce({ text: "Here's a draft.", draft: DRAFT })
        .mockResolvedValueOnce({ text: "A chowder, then.", draft: null })
        .mockResolvedValueOnce({ text: "Lighter still.", draft: null })
      const presenter = build(ask)

      await presenter.send("something for tonight", EMPTY_DRAFT)
      await presenter.rejectDraft(EMPTY_DRAFT)
      await presenter.send("make it lighter", EMPTY_DRAFT)

      // "Make it lighter" is still a request the refused dish is out of bounds
      // for, so the list rides on every turn rather than only the rejection.
      expect(ask.mock.calls[2][0].rejected).toEqual(["Won Ton Salad"])
      presenter.dispose()
    })

    it("remembers nothing for a draft that was merely discarded", async () => {
      const ask = vi
        .fn()
        .mockResolvedValueOnce({ text: "Here's a draft.", draft: DRAFT })
        .mockResolvedValueOnce({ text: "Sure.", draft: null })
      const presenter = build(ask)

      await presenter.send("type this up", EMPTY_DRAFT)
      presenter.clearProposedDraft()
      await presenter.send("what else could I add?", EMPTY_DRAFT)

      // Discard takes a draft off the screen; it does not say the dish was
      // unwanted. A chef barred from re-proposing every title it has used could
      // not revise a recipe at all.
      expect(presenter.getRejected()).toEqual([])
      expect(ask.mock.calls[1][0].rejected).toEqual([])
      presenter.dispose()
    })

    it("puts the draft back when the ask that would replace it fails", async () => {
      const ask = vi
        .fn()
        .mockResolvedValueOnce({ text: "Here's a draft.", draft: DRAFT })
        .mockRejectedValueOnce(new Error("network"))
      const presenter = build(ask)

      await presenter.send("something for tonight", EMPTY_DRAFT)
      await expect(presenter.rejectDraft(EMPTY_DRAFT)).rejects.toThrow("network")

      // A call that failed rejected nothing, and the draft may still be the one
      // they want to apply — losing it to a dropped connection would be the
      // expensive half of a free action.
      expect(presenter.getProposedDraft()).toEqual(DRAFT)
      expect(presenter.getRejected()).toEqual([])
      presenter.dispose()
    })

    it("does nothing without a proposal to turn down", async () => {
      const ask = vi.fn()
      const presenter = build(ask)

      await presenter.rejectDraft(EMPTY_DRAFT)

      expect(ask).not.toHaveBeenCalled()
      presenter.dispose()
    })

    it("sends the recipe box so a new idea is one they do not have", async () => {
      const ask = vi.fn().mockResolvedValue({ text: "ok", draft: null })
      const presenter = build(ask)

      await presenter.send("something for tonight", EMPTY_DRAFT, {
        recipeTitles: ["Won Ton Salad", "Beef Stew"],
      })

      expect(ask.mock.calls[0][0].recipeTitles).toEqual(["Won Ton Salad", "Beef Stew"])
      presenter.dispose()
    })
  })

  /**
   * The baseline: the household's own tags, picked as chips, holding across the
   * conversation rather than living in one message's wording.
   */
  describe("categories", () => {
    it("carries the picked categories on every turn", async () => {
      const ask = vi.fn().mockResolvedValue({ text: "ok", draft: null })
      const presenter = build(ask)

      presenter.toggleCategory("mexican")
      presenter.toggleCategory("weeknight")
      await presenter.send("something for tonight", EMPTY_DRAFT)
      await presenter.send("make it lighter", EMPTY_DRAFT)

      expect(presenter.getCategories()).toEqual(["mexican", "weeknight"])
      // A follow-up is still a request the baseline applies to, so it rides on
      // every turn rather than only the one that picked it.
      expect(ask.mock.calls[0][0].categories).toEqual(["mexican", "weeknight"])
      expect(ask.mock.calls[1][0].categories).toEqual(["mexican", "weeknight"])
      presenter.dispose()
    })

    it("takes a category back off, and normalises what it is given", () => {
      const presenter = build(vi.fn())

      // Chips come from the library already normalised; anything else must not
      // be able to open a second baseline spelled differently.
      presenter.toggleCategory("  Mexican ")
      expect(presenter.getCategories()).toEqual(["mexican"])

      presenter.toggleCategory("mexican")
      expect(presenter.getCategories()).toEqual([])

      presenter.toggleCategory("   ")
      expect(presenter.getCategories()).toEqual([])
      presenter.dispose()
    })

    it("forgets the baseline when the editor is left", () => {
      const presenter = build(vi.fn())

      presenter.toggleCategory("mexican")
      presenter.reset()

      expect(presenter.getCategories()).toEqual([])
      presenter.dispose()
    })
  })

  it("releases thumbnail URLs on reset", async () => {
    const presenter = build(vi.fn())

    presenter.attachImages([file("a.png")])
    presenter.reset()

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:a.png")
    expect(presenter.getPendingImages()).toEqual([])
    presenter.dispose()
  })
})
