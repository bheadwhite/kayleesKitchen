import type { DirectionSection, Ingredient } from "@/types"

/**
 * What a recipe looked like when it was last saved — the thing every "changed"
 * mark in the editor is measured against.
 *
 * The image is a boolean rather than a URL on purpose: the editor holds a fresh
 * download URL for the same file the recipe already points at, and comparing
 * those two strings reports a change on every load. What actually counts as an
 * image change is a *new file staged* or the picture removed, and both of those
 * are knowable without the URL.
 */
export interface RecipeBaseline {
  title: string
  /** What the recipe claims it makes. Null for one that does not say. */
  serves: number | null
  servingSize: string | null
  ingredients: Ingredient[]
  directions: DirectionSection[]
  tags: string[]
  hasImage: boolean
}

export type RowChange = "same" | "changed" | "added"

/**
 * One row's difference, with the text it is replacing.
 *
 * The text rides along so the editor can *show* it — press and hold a changed
 * line and the version you saved comes back under your finger. A flag saying
 * "changed" tells you where to look; it cannot tell you whether the change was
 * the one you wanted.
 */
export interface RowDiff {
  kind: RowChange
  /** What the row said before. Absent on an unchanged or brand-new row. */
  before?: string
}

export interface SectionChanges {
  added: boolean
  titleChanged: boolean
  /** One entry per step *currently* in the section. */
  steps: RowDiff[]
  stepsRemoved: number
  /** The section's previous title, for the same press-and-hold peek. */
  titleBefore?: string
}

export interface RecipeChanges {
  title: boolean
  image: boolean
  /**
   * The yield — how many it feeds, or what one serving is. One flag for both,
   * because they are one fact read two ways and a summary that split them would
   * say "Serves: changed. Serving size: changed" about a single edit.
   */
  makes: boolean
  /** One entry per ingredient currently in the list. */
  ingredients: RowDiff[]
  ingredientsRemoved: number
  tagsAdded: string[]
  tagsRemoved: string[]
  sections: SectionChanges[]
  sectionsRemoved: number
  /** Every individual difference, for the count on the save bar. */
  count: number
}

const EMPTY: RecipeBaseline = {
  title: "",
  serves: null,
  servingSize: null,
  ingredients: [],
  directions: [],
  tags: [],
  hasImage: false,
}

/** `optional`/`unique` are optional on the wire; absent and false are the same. */
const sameIngredient = (a: Ingredient, b: Ingredient) =>
  a.name === b.name &&
  a.amount === b.amount &&
  Boolean(a.optional) === Boolean(b.optional) &&
  Boolean(a.unique) === Boolean(b.unique)

export interface ChangeLine {
  kind: RowChange | "removed"
  /** Which part of the recipe this line belongs to, for grouping. */
  where: "title" | "makes" | "ingredient" | "step" | "section" | "tag"
  /** The text as it stands now. Absent on an addition. */
  before?: string
  /** The text as it would be. Absent on a removal. */
  after?: string
}

/** The yield as one readable line — what the peek and the summary both show. */
const describeYield = ({ serves, servingSize }: Pick<RecipeBaseline, "serves" | "servingSize">) =>
  serves == null
    ? servingSize
      ? `serving: ${servingSize}`
      : "not said"
    : `serves ${serves}${servingSize ? ` · ${servingSize}` : ""}`

const ingredientText = ({ name, amount, optional }: Ingredient) =>
  `${name}${amount ? ` — ${amount}` : ""}${optional ? " (optional)" : ""}`

/**
 * The differences themselves, line by line, rather than counted.
 *
 * This is what the assistant's proposal shows: "Ingredients: 2 changed" says
 * how much of the recipe moved, but not whether you would still recognise it.
 * Both texts ride along so the panel can show the one being replaced next to
 * the one replacing it.
 *
 * Positional, like everything else here: replacing the second ingredient reads
 * as a change to it, not as a removal and an addition.
 */
export const describeChanges = (
  baseline: RecipeBaseline | null,
  current: RecipeBaseline
): ChangeLine[] => {
  const before = baseline ?? EMPTY
  const lines: ChangeLine[] = []

  if (before.title !== current.title) {
    lines.push({ kind: "changed", where: "title", before: before.title, after: current.title })
  }

  if (before.serves !== current.serves || before.servingSize !== current.servingSize) {
    lines.push({
      kind: "changed",
      where: "makes",
      before: describeYield(before),
      after: describeYield(current),
    })
  }

  current.ingredients.forEach((ingredient, i) => {
    const was = before.ingredients[i]
    if (was == null) {
      lines.push({ kind: "added", where: "ingredient", after: ingredientText(ingredient) })
    } else if (!sameIngredient(was, ingredient)) {
      lines.push({
        kind: "changed",
        where: "ingredient",
        before: ingredientText(was),
        after: ingredientText(ingredient),
      })
    }
  })
  before.ingredients.slice(current.ingredients.length).forEach((ingredient) => {
    lines.push({ kind: "removed", where: "ingredient", before: ingredientText(ingredient) })
  })

  const sectionName = (title: string) => (title === "" ? "Untitled section" : title)

  current.directions.forEach((section, i) => {
    const was = before.directions[i]

    if (was == null) {
      lines.push({ kind: "added", where: "section", after: sectionName(section.sectionTitle) })
      section.steps.forEach((step) => lines.push({ kind: "added", where: "step", after: step }))
      return
    }

    if (was.sectionTitle !== section.sectionTitle) {
      lines.push({
        kind: "changed",
        where: "section",
        before: sectionName(was.sectionTitle),
        after: sectionName(section.sectionTitle),
      })
    }

    section.steps.forEach((step, s) => {
      const wasStep = was.steps[s]
      if (wasStep == null) lines.push({ kind: "added", where: "step", after: step })
      else if (wasStep !== step) {
        lines.push({ kind: "changed", where: "step", before: wasStep, after: step })
      }
    })
    was.steps.slice(section.steps.length).forEach((step) => {
      lines.push({ kind: "removed", where: "step", before: step })
    })
  })

  before.directions.slice(current.directions.length).forEach((section) => {
    // The steps inside it go without being listed one by one — a section that
    // is gone takes its steps with it, and saying so twenty times is noise.
    lines.push({ kind: "removed", where: "section", before: sectionName(section.sectionTitle) })
  })

  current.tags
    .filter((tag) => !before.tags.includes(tag))
    .forEach((tag) => lines.push({ kind: "added", where: "tag", after: tag }))
  before.tags
    .filter((tag) => !current.tags.includes(tag))
    .forEach((tag) => lines.push({ kind: "removed", where: "tag", before: tag }))

  return lines
}

const tally = (rows: RowDiff[]) => ({
  changed: rows.filter((row) => row.kind === "changed").length,
  added: rows.filter((row) => row.kind === "added").length,
})

/** "2 changed, 1 new" — zero counts are left out rather than written as "0". */
const phrase = (parts: Array<[number, string]>) =>
  parts
    .filter(([count]) => count > 0)
    .map(([count, word]) => `${count} ${word}`)
    .join(", ")

/**
 * The same diff, in words — for the assistant's proposal, where the changes
 * cannot be marked in place because they have not been applied yet.
 *
 * Counting what *differs* rather than what the draft contains is the point: a
 * summary reading "12 ingredients" is true of a draft that changed one of them
 * and of one that replaced the lot, and those are not the same decision.
 *
 * An empty array means nothing would change.
 */
export const summariseChanges = (changes: RecipeChanges): string[] => {
  const lines: string[] = []

  if (changes.title) lines.push("A different title")
  if (changes.makes) lines.push("How much it makes")

  const ingredients = tally(changes.ingredients)
  const ingredientLine = phrase([
    [ingredients.changed, "changed"],
    [ingredients.added, "new"],
    [changes.ingredientsRemoved, "removed"],
  ])
  if (ingredientLine !== "") lines.push(`Ingredients: ${ingredientLine}`)

  const steps = changes.sections.reduce(
    (total, section) => {
      const counted = tally(section.steps)
      return {
        changed: total.changed + counted.changed,
        added: total.added + counted.added,
        removed: total.removed + section.stepsRemoved,
      }
    },
    { changed: 0, added: 0, removed: 0 }
  )
  const stepLine = phrase([
    [steps.changed, "changed"],
    [steps.added, "new"],
    [steps.removed, "removed"],
  ])
  if (stepLine !== "") lines.push(`Steps: ${stepLine}`)

  const sectionLine = phrase([
    [changes.sections.filter((section) => section.added).length, "new"],
    [changes.sections.filter((section) => section.titleChanged).length, "renamed"],
    [changes.sectionsRemoved, "removed"],
  ])
  if (sectionLine !== "") lines.push(`Sections: ${sectionLine}`)

  const tagLine = phrase([
    [changes.tagsAdded.length, "added"],
    [changes.tagsRemoved.length, "removed"],
  ])
  if (tagLine !== "") lines.push(`Tags: ${tagLine}`)

  return lines
}

/**
 * Rows are compared **by position**, not matched up cleverly.
 *
 * A moved step is therefore reported as two changed steps rather than as a
 * move, which is the honest answer: the editor cannot know whether a line was
 * dragged or retyped, and claiming to know would be worse than saying "these
 * two lines are not what you saved".
 */
const diffRows = <T,>(
  before: T[],
  after: T[],
  same: (a: T, b: T) => boolean,
  text: (row: T) => string
): RowDiff[] =>
  after.map((row, i) => {
    if (i >= before.length) return { kind: "added" }
    if (same(before[i], row)) return { kind: "same" }
    return { kind: "changed", before: text(before[i]) }
  })

const countRows = (rows: RowDiff[]) => rows.filter((row) => row.kind !== "same").length

/**
 * What is different between the saved recipe and what is on the screen —
 * whichever put it there. A draft applied from the assistant and a stray
 * keystroke are the same kind of event to someone about to press Update, so
 * they are marked the same way rather than tracked separately.
 *
 * A null baseline means an unsaved recipe: everything on the screen is new.
 */
export const diffRecipe = (
  baseline: RecipeBaseline | null,
  current: RecipeBaseline
): RecipeChanges => {
  const before = baseline ?? EMPTY

  const title = before.title !== current.title
  const image = before.hasImage !== current.hasImage
  const makes =
    before.serves !== current.serves || before.servingSize !== current.servingSize

  const ingredients = diffRows(
    before.ingredients,
    current.ingredients,
    sameIngredient,
    ingredientText
  )
  const ingredientsRemoved = Math.max(0, before.ingredients.length - current.ingredients.length)

  const tagsAdded = current.tags.filter((tag) => !before.tags.includes(tag))
  const tagsRemoved = before.tags.filter((tag) => !current.tags.includes(tag))

  const sections: SectionChanges[] = current.directions.map((section, i) => {
    const added = i >= before.directions.length
    const previous = added ? { sectionTitle: "", steps: [] } : before.directions[i]
    const titleChanged = !added && previous.sectionTitle !== section.sectionTitle
    return {
      added,
      titleChanged,
      titleBefore: titleChanged ? previous.sectionTitle : undefined,
      steps: diffRows(previous.steps, section.steps, (a, b) => a === b, (step) => step),
      stepsRemoved: Math.max(0, previous.steps.length - section.steps.length),
    }
  })
  const sectionsRemoved = Math.max(0, before.directions.length - current.directions.length)

  const count =
    (title ? 1 : 0) +
    (image ? 1 : 0) +
    (makes ? 1 : 0) +
    countRows(ingredients) +
    ingredientsRemoved +
    tagsAdded.length +
    tagsRemoved.length +
    sectionsRemoved +
    sections.reduce(
      (total, section) =>
        total +
        (section.added ? 1 : 0) +
        (section.titleChanged ? 1 : 0) +
        countRows(section.steps) +
        section.stepsRemoved,
      0
    )

  return {
    title,
    image,
    makes,
    ingredients,
    ingredientsRemoved,
    tagsAdded,
    tagsRemoved,
    sections,
    sectionsRemoved,
    count,
  }
}
