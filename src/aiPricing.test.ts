import { describe, expect, it } from "vitest"

import { costOf, money, MODEL_RATES, unpricedModels } from "./aiPricing"

const totals = (over: Partial<Parameters<typeof costOf>[1]> = {}) => ({
  calls: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  ...over,
})

/**
 * These numbers are the input to a "should we run this ourselves" decision, so
 * the failure that matters is a total that is confidently wrong — quietly
 * pricing an unknown model at a known model's rate, or charging cache reads at
 * full input price and making the API look worse than it is.
 */
describe("costOf", () => {
  it("prices input and output apart, because they are priced apart", () => {
    // 1M output on Opus is $25; 1M input is $5. A combined token count would
    // report the same figure for two calls that differ fivefold in cost.
    expect(costOf("claude-opus-5", totals({ outputTokens: 1_000_000 }))).toBeCloseTo(25)
    expect(costOf("claude-opus-5", totals({ inputTokens: 1_000_000 }))).toBeCloseTo(5)
  })

  it("charges cache reads at the discount and writes at the premium", () => {
    // The whole point of the caching design is that reads are ~a tenth of
    // input. Pricing them as input would overstate the bill several times over
    // on the assistant, which is the most cache-heavy caller.
    expect(costOf("claude-opus-5", totals({ cacheReadTokens: 1_000_000 }))).toBeCloseTo(0.5)
    expect(costOf("claude-opus-5", totals({ cacheCreationTokens: 1_000_000 }))).toBeCloseTo(6.25)
  })

  it("prices the image model per call, since it reports no tokens", () => {
    const rate = MODEL_RATES["gemini-2.5-flash-image"]
    expect(costOf("gemini-2.5-flash-image", totals({ calls: 10 }))).toBeCloseTo(
      (rate.perCall ?? 0) * 10
    )
  })

  it("returns zero for a model it has no rate for, rather than guessing", () => {
    expect(costOf("some-new-model", totals({ outputTokens: 1_000_000 }))).toBe(0)
  })

  it("names the models it could not price", () => {
    expect(
      unpricedModels({
        "claude-opus-5": totals({ calls: 1 }),
        "some-new-model": totals({ calls: 1 }),
      })
    ).toEqual(["some-new-model"])
  })
})

describe("money", () => {
  it("keeps precision where the number is small and drops it where it is not", () => {
    // A household's daily spend rounds to $0.00 at two decimals, which reads as
    // free rather than as small — the distinction this whole feed exists for.
    expect(money(0.004)).toBe("$0.004")
    expect(money(0.0001)).toBe("<$0.001")
    expect(money(4.2)).toBe("$4.20")
    expect(money(120)).toBe("$120")
    // Nothing spent is nothing spent — not a rounded-down small number.
    expect(money(0)).toBe("$0")
  })
})
