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
  ingredients: Ingredient[]
  directions: DirectionSection[]
  tags: string[]
  hasImage: boolean
}

export type RowChange = "same" | "changed" | "added"

export interface SectionChanges {
  added: boolean
  titleChanged: boolean
  /** One entry per step *currently* in the section. */
  steps: RowChange[]
  stepsRemoved: number
}

export interface RecipeChanges {
  title: boolean
  image: boolean
  /** One entry per ingredient currently in the list. */
  ingredients: RowChange[]
  ingredientsRemoved: number
  tagsAdded: string[]
  tagsRemoved: string[]
  sections: SectionChanges[]
  sectionsRemoved: number
  /** Every individual difference, for the count on the save bar. */
  count: number
}

const tally = (rows: RowChange[]) => ({
  changed: rows.filter((row) => row === "changed").length,
  added: rows.filter((row) => row === "added").length,
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

const EMPTY: RecipeBaseline = {
  title: "",
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

/**
 * Rows are compared **by position**, not matched up cleverly.
 *
 * A moved step is therefore reported as two changed steps rather than as a
 * move, which is the honest answer: the editor cannot know whether a line was
 * dragged or retyped, and claiming to know would be worse than saying "these
 * two lines are not what you saved".
 */
const diffRows = <T,>(before: T[], after: T[], same: (a: T, b: T) => boolean): RowChange[] =>
  after.map((row, i) => {
    if (i >= before.length) return "added"
    return same(before[i], row) ? "same" : "changed"
  })

const countRows = (rows: RowChange[]) => rows.filter((row) => row !== "same").length

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

  const ingredients = diffRows(before.ingredients, current.ingredients, sameIngredient)
  const ingredientsRemoved = Math.max(0, before.ingredients.length - current.ingredients.length)

  const tagsAdded = current.tags.filter((tag) => !before.tags.includes(tag))
  const tagsRemoved = before.tags.filter((tag) => !current.tags.includes(tag))

  const sections: SectionChanges[] = current.directions.map((section, i) => {
    const added = i >= before.directions.length
    const previous = added ? { sectionTitle: "", steps: [] } : before.directions[i]
    return {
      added,
      titleChanged: !added && previous.sectionTitle !== section.sectionTitle,
      steps: diffRows(previous.steps, section.steps, (a, b) => a === b),
      stepsRemoved: Math.max(0, previous.steps.length - section.steps.length),
    }
  })
  const sectionsRemoved = Math.max(0, before.directions.length - current.directions.length)

  const count =
    (title ? 1 : 0) +
    (image ? 1 : 0) +
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
    ingredients,
    ingredientsRemoved,
    tagsAdded,
    tagsRemoved,
    sections,
    sectionsRemoved,
    count,
  }
}
