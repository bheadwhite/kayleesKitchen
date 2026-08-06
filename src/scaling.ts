import type { Ingredient } from "@/types"

/**
 * How one ingredient line responds to cooking for more people.
 *
 * **This is the thing the chef is actually asked for, and it is asked once.**
 * The alternative — asking for a scaled ingredient list every time somebody
 * wants a different number — pays the model per (recipe, number) pair, so an
 * unusual eleven costs exactly as much as the fourth doubling. A rule costs one
 * call per version of the recipe and then answers every number for nothing.
 *
 * It is deliberately **data, not code**. A model can write a scaling function
 * in JavaScript, and running one in the browser would be executing text a model
 * produced — which is a code-execution hole with a Firestore document for a
 * delivery mechanism, and which the PWA's own CSP would refuse anyway. A closed
 * vocabulary of rules is inspectable, testable, and cannot do anything but
 * produce an ingredient line.
 */
export type ScaleRule = "linear" | "sublinear" | "fixed"

/** How a scaled quantity is settled to something you can actually measure. */
export type Rounding = "exact" | "quarter" | "half" | "whole"

export interface ScaledLine {
  /** The ingredient's name, carried through unchanged. */
  name: string
  rule: ScaleRule
  /**
   * The quantity at `baseServes`. Absent on a `fixed` line, which has no number
   * to move.
   */
  qty?: number
  /** "cup", "tbsp", "lb", "medium" — or "" for a bare count ("3 eggs"). */
  unit?: string
  /**
   * The whole amount as written, used verbatim for a `fixed` line and as the
   * fallback whenever a line cannot be rebuilt from its parts.
   */
  text: string
  rounding?: Rounding
  /** Which way a rounded quantity should break. Defaults to nearest. */
  prefer?: "up" | "down"
  /**
   * For `sublinear`: the exponent applied to the ratio. Salt, leavening, and
   * strong spices do not double when the batch doubles — 0.7–0.8 is the usual
   * territory. Ignored for the other rules.
   */
  exponent?: number
  optional?: boolean
  /** Anything the cook should know about this line specifically. */
  note?: string
}

/** A pan or pot that has to change once the batch outgrows it. */
export interface VesselRule {
  /** The largest serving count this vessel still works for. */
  upTo: number
  text: string
}

/**
 * One recipe's scaling rules — `recipes/{id}/scaling/{ingredientsFingerprint}`.
 *
 * **Written only by the Cloud Function**, like the yield estimate, and read by
 * anyone. Keyed by `ingredientsFingerprint` rather than the full recipe stamp,
 * so rewriting the method leaves it standing: a rule about how much flour to
 * buy is not changed by a clearer instruction on how to fold it in.
 */
export interface ScalingSpec {
  /** How many the recipe as filed feeds — what `qty` is quoted at. */
  baseServes: number
  lines: ScaledLine[]
  /** Ordered by `upTo`; the first that fits wins. Empty when nothing changes. */
  vessels?: VesselRule[]
  /** What the cook should watch, in one or two sentences. */
  notes?: string
  /** The ingredient lines this was read off. Stale the moment they move. */
  fingerprint: string
}

/** What {@link applyScale} hands back. */
export interface ScaledRecipe {
  serves: number
  baseServes: number
  ingredients: Ingredient[]
  /** The vessel for this size, when the spec named one. */
  vessel?: string
  notes?: string
}

/**
 * The gradations a kitchen actually has: the eighths a measuring cup is marked
 * in, plus the thirds a spoon set adds.
 */
const FRACTIONS: Array<[number, string]> = [
  [1 / 8, "⅛"],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [3 / 8, "⅜"],
  [1 / 2, "½"],
  [5 / 8, "⅝"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
  [7 / 8, "⅞"],
]

/**
 * How far from a marking a value can sit and still be called that marking.
 *
 * Wide enough that arithmetic lands on something measurable — two teaspoons
 * times 2^0.75 is 3.36, and "3⅓ tsp" is an instruction where "3.36 tsp" is a
 * number you have to stand there converting. Narrow enough that the error is
 * always under a rounding a cook would make by hand anyway.
 */
const SNAP = 0.04

/**
 * A number as a cook would write it: "2", "1½", "⅔".
 *
 * Vulgar fractions rather than decimals because that is what the measure in the
 * drawer is marked in. A decimal is kept only for values genuinely nowhere near
 * a marking, where pretending otherwise would be the lie.
 */
export const formatQty = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return ""

  const whole = Math.floor(value + 1e-9)
  const rest = value - whole

  if (rest < 1e-6) return String(whole)
  // Just short of the next whole number is that whole number. Without this the
  // fraction search below has nothing near enough and falls through to "2.99",
  // which is a worse way of writing 3.
  if (rest > 1 - SNAP) return String(whole + 1)

  // The *nearest* marking, not the first one close enough — scanning in order
  // and stopping early quietly prefers ¼ over ⅓ for anything between them.
  const [, glyph, distance] = FRACTIONS.reduce<[number, string, number]>(
    (best, [fraction, mark]) => {
      const gap = Math.abs(rest - fraction)
      return gap < best[2] ? [fraction, mark, gap] : best
    },
    [0, "", Number.POSITIVE_INFINITY]
  )

  if (distance > SNAP) {
    // Rounded to two places: a third is precision the recipe never had.
    return String(Math.round(value * 100) / 100)
  }

  return whole === 0 ? glyph : `${whole}${glyph}`
}

const STEP: Record<Rounding, number> = {
  exact: 0,
  quarter: 0.25,
  half: 0.5,
  whole: 1,
}

/**
 * Settles a scaled quantity onto something measurable.
 *
 * `prefer` is what stops three eggs times one and a half from being an argument:
 * the spec says which way that particular line breaks, once, rather than the
 * client applying a blanket rule that is wrong for eggs *or* wrong for salt.
 */
export const roundQty = (value: number, rounding: Rounding = "exact", prefer?: "up" | "down") => {
  const step = STEP[rounding] ?? 0
  if (step === 0) return value

  const scaled = value / step
  const settled =
    prefer === "up"
      ? Math.ceil(scaled - 1e-9)
      : prefer === "down"
        ? Math.floor(scaled + 1e-9)
        : Math.round(scaled)

  // Never round a real ingredient away to nothing: half an egg prefers one egg
  // over none, whatever the arithmetic says.
  return Math.max(step, settled * step)
}

const scaleLine = (line: ScaledLine, ratio: number): Ingredient => {
  const base: Ingredient = { name: line.name, amount: line.text }
  if (line.optional) base.optional = true

  // "To taste" is an amount. It does not have a number hiding inside it, and
  // inventing one is the single worst thing this function could do.
  if (line.rule === "fixed" || line.qty == null || !Number.isFinite(line.qty)) return base

  const factor =
    line.rule === "sublinear" ? Math.pow(ratio, clampExponent(line.exponent)) : ratio

  const quantity = roundQty(line.qty * factor, line.rounding ?? "exact", line.prefer)
  const shown = formatQty(quantity)
  if (shown === "") return base

  const unit = (line.unit ?? "").trim()
  return { ...base, amount: unit === "" ? shown : `${shown} ${unit}` }
}

/** Outside this range "sublinear" stops meaning anything useful. */
const clampExponent = (exponent?: number) =>
  Number.isFinite(exponent) ? Math.min(1, Math.max(0.3, exponent as number)) : 0.75

const vesselFor = (spec: ScalingSpec, serves: number) =>
  (spec.vessels ?? []).find((vessel) => serves <= vessel.upTo)?.text ??
  (spec.vessels ?? [])[(spec.vessels ?? []).length - 1]?.text

/**
 * The recipe's ingredients, for however many are eating.
 *
 * Pure, instant, offline, and free — which is the entire reason the spec is
 * shaped the way it is. Every judgement in here was made once, by the chef, and
 * written down; this function only applies it.
 */
export const applyScale = (spec: ScalingSpec, serves: number): ScaledRecipe => {
  const base = spec.baseServes > 0 ? spec.baseServes : 1
  const wanted = Math.max(1, Math.round(serves))
  const ratio = wanted / base

  return {
    serves: wanted,
    baseServes: base,
    ingredients: spec.lines.map((line) => scaleLine(line, ratio)),
    vessel: vesselFor(spec, wanted),
    notes: spec.notes,
  }
}

/**
 * Whether a stored spec can be trusted to scale this recipe.
 *
 * Checked on the way *out* of the cache rather than only on the way in, because
 * a spec is written by a model and read for months: the shape that was valid
 * when it was stored is not the shape this code necessarily still expects. A
 * spec that does not pass is treated as absent — the chef is asked again, or
 * the amounts go through verbatim. **Failing closed is the whole contract**;
 * the failure this must never have is a confident wrong quantity.
 */
export const isUsableSpec = (
  spec: ScalingSpec | null | undefined,
  fingerprint: string
): spec is ScalingSpec => {
  if (spec == null) return false
  if (spec.fingerprint !== fingerprint) return false
  if (!Number.isFinite(spec.baseServes) || spec.baseServes <= 0) return false
  if (!Array.isArray(spec.lines) || spec.lines.length === 0) return false

  return spec.lines.every(
    (line) =>
      typeof line?.name === "string" &&
      line.name.trim() !== "" &&
      typeof line.text === "string" &&
      (line.rule === "fixed" || line.rule === "linear" || line.rule === "sublinear") &&
      // A scaling line with nothing to scale is a `fixed` line that lied, and
      // would silently carry its base amount into every size.
      (line.rule === "fixed" || (typeof line.qty === "number" && Number.isFinite(line.qty)))
  )
}
