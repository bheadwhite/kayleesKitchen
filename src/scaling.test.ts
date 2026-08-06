import { describe, expect, it } from "vitest"

import { applyScale, formatQty, isUsableSpec, roundQty, type ScalingSpec } from "./scaling"

const CHILLI: ScalingSpec = {
  baseServes: 4,
  fingerprint: "abc",
  lines: [
    { name: "ground beef", rule: "linear", qty: 1, unit: "lb", text: "1 lb", rounding: "quarter" },
    { name: "yellow onion", rule: "linear", qty: 1, unit: "medium", text: "1 medium", rounding: "whole" },
    { name: "eggs", rule: "linear", qty: 3, unit: "", text: "3", rounding: "whole", prefer: "up" },
    { name: "baking powder", rule: "sublinear", qty: 2, unit: "tsp", text: "2 tsp", exponent: 0.75 },
    { name: "kosher salt", rule: "fixed", text: "to taste" },
    { name: "cilantro", rule: "linear", qty: 1, unit: "bunch", text: "1 bunch", optional: true },
  ],
  vessels: [
    { upTo: 6, text: "5-qt pot" },
    { upTo: 12, text: "7-qt pot" },
  ],
  notes: "Season at the end rather than doubling the salt.",
}

const amountOf = (spec: ScalingSpec, serves: number, name: string) =>
  applyScale(spec, serves).ingredients.find((i) => i.name === name)?.amount

describe("formatQty", () => {
  it("writes numbers the way a measuring cup is marked", () => {
    expect(formatQty(2)).toBe("2")
    expect(formatQty(0.5)).toBe("½")
    expect(formatQty(1.5)).toBe("1½")
    expect(formatQty(2.25)).toBe("2¼")
    expect(formatQty(0.667)).toBe("⅔")
  })

  it("snaps to the nearest marking, not the first one close enough", () => {
    // 0.36 sits between ⅓ and ⅜; scanning in order and stopping early would
    // have called it ¼.
    expect(formatQty(3.36)).toBe("3⅜")
    expect(formatQty(0.35)).toBe("⅓")
  })

  it("falls back to a decimal for a value nowhere near a marking", () => {
    expect(formatQty(1.19)).toBe("1.19")
  })

  it("carries rather than leaving a stray mark on a rounded-up whole", () => {
    expect(formatQty(2.99)).toBe("3")
  })

  it("is empty for nothing at all", () => {
    expect(formatQty(0)).toBe("")
    expect(formatQty(Number.NaN)).toBe("")
  })
})

describe("roundQty", () => {
  it("leaves an exact quantity alone", () => {
    expect(roundQty(1.333, "exact")).toBeCloseTo(1.333)
  })

  it("settles onto the step it was given", () => {
    expect(roundQty(1.4, "quarter")).toBe(1.5)
    expect(roundQty(1.4, "half")).toBe(1.5)
    expect(roundQty(1.4, "whole")).toBe(1)
  })

  it("breaks the way the line says to", () => {
    expect(roundQty(4.5, "whole", "up")).toBe(5)
    expect(roundQty(4.5, "whole", "down")).toBe(4)
  })

  it("never rounds an ingredient away to nothing", () => {
    expect(roundQty(0.4, "whole")).toBe(1)
    expect(roundQty(0.01, "quarter")).toBe(0.25)
  })
})

describe("applyScale", () => {
  it("returns the recipe as filed at its own size", () => {
    expect(amountOf(CHILLI, 4, "ground beef")).toBe("1 lb")
    expect(amountOf(CHILLI, 4, "eggs")).toBe("3")
  })

  it("scales a linear line", () => {
    expect(amountOf(CHILLI, 8, "ground beef")).toBe("2 lb")
    expect(amountOf(CHILLI, 2, "ground beef")).toBe("½ lb")
  })

  it("rounds a whole-unit line to something you can buy", () => {
    // 1 onion × 1.5 is not an amount; the spec says this line is whole.
    expect(amountOf(CHILLI, 6, "yellow onion")).toBe("2 medium")
  })

  it("breaks eggs upward, because the spec says so", () => {
    // Three eggs × 1.5 is four and a half. Four is a different cake.
    expect(amountOf(CHILLI, 6, "eggs")).toBe("5")
  })

  it("holds leavening back from doubling", () => {
    // 2 tsp × 2^0.75 ≈ 3.36 — well short of the 4 tsp linear would give, and
    // written as something a spoon can actually measure.
    expect(amountOf(CHILLI, 8, "baking powder")).toBe("3⅜ tsp")
  })

  it("never puts a number on 'to taste'", () => {
    expect(amountOf(CHILLI, 4, "kosher salt")).toBe("to taste")
    expect(amountOf(CHILLI, 24, "kosher salt")).toBe("to taste")
  })

  it("keeps an optional line optional at every size", () => {
    const scaled = applyScale(CHILLI, 12).ingredients.find((i) => i.name === "cilantro")
    expect(scaled?.optional).toBe(true)
  })

  it("names the pot the batch has outgrown", () => {
    expect(applyScale(CHILLI, 4).vessel).toBe("5-qt pot")
    expect(applyScale(CHILLI, 10).vessel).toBe("7-qt pot")
  })

  it("keeps the largest vessel it knows rather than going silent", () => {
    expect(applyScale(CHILLI, 40).vessel).toBe("7-qt pot")
  })

  it("carries the notes and both serving counts", () => {
    const scaled = applyScale(CHILLI, 8)
    expect(scaled).toMatchObject({ serves: 8, baseServes: 4 })
    expect(scaled.notes).toContain("Season at the end")
  })

  it("refuses to scale to nothing", () => {
    expect(applyScale(CHILLI, 0).serves).toBe(1)
    expect(applyScale(CHILLI, -5).serves).toBe(1)
  })

  it("clamps a nonsense exponent rather than trusting it", () => {
    const silly: ScalingSpec = {
      ...CHILLI,
      lines: [{ name: "salt", rule: "sublinear", qty: 4, unit: "tsp", text: "4 tsp", exponent: -3 }],
    }
    // Clamped to 0.3, so it still rises with the batch instead of collapsing.
    const scaled = applyScale(silly, 8).ingredients[0].amount
    expect(scaled).toBe("4.92 tsp")
  })

  it("falls back to the written text when a line cannot be rebuilt", () => {
    const odd: ScalingSpec = {
      ...CHILLI,
      lines: [{ name: "sesame oil", rule: "linear", qty: Number.NaN, text: "a splash" }],
    }
    expect(applyScale(odd, 8).ingredients[0].amount).toBe("a splash")
  })
})

describe("isUsableSpec", () => {
  it("takes a spec whose stamp still matches", () => {
    expect(isUsableSpec(CHILLI, "abc")).toBe(true)
  })

  it("rejects one written for a different ingredient list", () => {
    expect(isUsableSpec(CHILLI, "moved")).toBe(false)
  })

  it("rejects nothing at all", () => {
    expect(isUsableSpec(null, "abc")).toBe(false)
    expect(isUsableSpec(undefined, "abc")).toBe(false)
  })

  it("rejects a spec with no lines to scale", () => {
    expect(isUsableSpec({ ...CHILLI, lines: [] }, "abc")).toBe(false)
  })

  it("rejects a spec that does not know its own base", () => {
    expect(isUsableSpec({ ...CHILLI, baseServes: 0 }, "abc")).toBe(false)
  })

  it("rejects a scaling line with no quantity — it would freeze at its base", () => {
    expect(
      isUsableSpec(
        { ...CHILLI, lines: [{ name: "flour", rule: "linear", text: "2 cups" }] },
        "abc"
      )
    ).toBe(false)
  })

  it("accepts a fixed line with no quantity, which is the point of one", () => {
    expect(
      isUsableSpec(
        { ...CHILLI, lines: [{ name: "salt", rule: "fixed", text: "to taste" }] },
        "abc"
      )
    ).toBe(true)
  })
})
