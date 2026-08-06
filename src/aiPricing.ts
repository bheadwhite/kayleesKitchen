/**
 * What a call costs, in dollars, from the tokens that were recorded.
 *
 * **Cost is computed here, at read time, and never stored.** `aiUsageDaily`
 * holds tokens; tokens are a fact about what happened. A price is an
 * interpretation of that fact, and interpretations get revised — introductory
 * rates expire, tiers change, and a number transcribed wrong from a pricing
 * page is wrong forever once it is baked into a record with nothing left to
 * recompute it from. Keeping the table on this side means correcting a rate
 * corrects every day already recorded, including the ones being used as the
 * baseline for a "should we self-host" comparison. Getting that backwards would
 * quietly poison the comparison this whole thing exists to support.
 *
 * ⚠️ **These rates are transcribed by hand and go stale.** Check them against
 * the provider's pricing page before trusting a total, and treat the figures in
 * the console as "what this would have cost at these rates" rather than as an
 * invoice. The console says as much on screen.
 */

/** Dollars per million tokens. */
export interface ModelRate {
  input: number
  output: number
  /** Reads are heavily discounted; writes carry a premium over base input. */
  cacheRead: number
  cacheWrite: number
  /**
   * Priced per call rather than per token — the image model bills per image and
   * reports no token counts, so its row is a flat rate and its token fields
   * stay zero.
   */
  perCall?: number
}

/**
 * Keyed by the exact `model` string recorded on the event, so a model swap
 * shows up as a new row rather than silently repricing history at the old
 * rate. An unknown model is priced at zero and named on screen — see
 * `unpricedModels` — because a confident wrong total is worse than an obvious
 * gap when the number is the input to a spending decision.
 */
export const MODEL_RATES: Record<string, ModelRate> = {
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-sonnet-5": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  // Google, via Vertex — billed per generated image, not per token.
  "gemini-2.5-flash-image": {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    perCall: 0.039,
  },
}

export interface UsageTotals {
  calls: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
}

const PER_MILLION = 1_000_000

/** What one model's usage would cost at the rates above. Unknown model → 0. */
export const costOf = (model: string, totals: UsageTotals): number => {
  const rate = MODEL_RATES[model]
  if (rate == null) return 0
  return (
    (totals.inputTokens * rate.input +
      totals.outputTokens * rate.output +
      totals.cacheReadTokens * rate.cacheRead +
      totals.cacheCreationTokens * rate.cacheWrite) /
      PER_MILLION +
    (rate.perCall ?? 0) * totals.calls
  )
}

/**
 * Models that ran but have no rate, so the console can say so rather than
 * quietly reporting a total that is missing a line item.
 */
export const unpricedModels = (models: Record<string, UsageTotals>) =>
  Object.keys(models).filter((model) => MODEL_RATES[model] == null)

/**
 * Dollars, at the precision the number actually carries.
 *
 * Three decimals below a dollar, not two. A household's daily AI spend is
 * fractions of a cent, and two decimals renders every one of those as `$0.00` —
 * which reads as *free* rather than as *small*, and being able to tell those
 * apart is the entire reason this feed exists. Below a tenth of a cent there is
 * no precision left worth printing, so it says so rather than rounding to a
 * zero it does not mean.
 */
export const money = (value: number) =>
  value === 0
    ? "$0"
    : value >= 10
      ? `$${value.toFixed(0)}`
      : value >= 1
        ? `$${value.toFixed(2)}`
        : value >= 0.001
          ? `$${value.toFixed(3)}`
          : "<$0.001"
