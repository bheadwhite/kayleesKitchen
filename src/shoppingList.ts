import type { Ingredient, ShoppingItem } from "@/types"

/**
 * The shop, in the order you walk it.
 *
 * Rendering follows **this** order and not whatever order the chef returned, and
 * a section it invents falls through to "other". Which aisle comes after which
 * is a fact about a supermarket, not about a conversation, and a model that
 * decides to lead with spices one day and dairy the next turns a list you can
 * walk into a list you have to search.
 *
 * `key` is what is stored; `label` is what is drawn. Renaming a label is a
 * change to this file; renaming a key is a migration, so don't.
 */
export const SECTIONS = [
  { key: "produce", label: "Produce" },
  { key: "meat", label: "Meat & seafood" },
  { key: "dairy", label: "Dairy & eggs" },
  { key: "bakery", label: "Bakery" },
  { key: "frozen", label: "Frozen" },
  { key: "pantry", label: "Pantry" },
  { key: "spices", label: "Herbs & spices" },
  { key: "other", label: "Other" },
] as const

export type SectionKey = (typeof SECTIONS)[number]["key"]

/** Where anything unrecognised goes. Never a dropped ingredient. */
export const OTHER: SectionKey = "other"

const SECTION_KEYS = new Set<string>(SECTIONS.map((section) => section.key))

export const sectionKey = (raw: string): SectionKey => {
  const key = raw.trim().toLowerCase()
  return SECTION_KEYS.has(key) ? (key as SectionKey) : OTHER
}

/**
 * Lowercase, trimmed, single-spaced — the same three operations `normaliseTag`
 * performs, kept separate on purpose. That one decides when two *labels* are the
 * same word; this one decides when two *ingredients* are the same thing, which
 * is a question that will grow singular/plural and unit handling of its own long
 * before a tag ever needs either.
 */
export const normaliseItemName = (raw: string) => raw.trim().replace(/\s+/g, " ").toLowerCase()

/** One planned meal's recipe, as the list is built from it. */
export interface MealIngredients {
  title: string
  ingredients: Ingredient[]
}

/**
 * A line as the chef proposes it — or as `consolidateVerbatim` proposes it when
 * the chef could not be reached. Both go through {@link mergePlan}, so there is
 * one path from "here is what should be on the list" to what is written.
 */
export interface ProposedItem {
  name: string
  amount: string
  section: string
  from: string[]
  /**
   * An existing row this line now covers, when the two are the same thing under
   * different words — "scallions" against a row reading "green onions". Matching
   * names are merged without it; this is only for the ones the words miss.
   */
  mergesWith?: string | null
}

/** What {@link mergePlan} resolves to: exactly the two writes a build makes. */
export interface ListPlan {
  updates: Array<{ id: string; amount: string; from: string[] }>
  additions: Array<Omit<ShoppingItem, "id" | "addedAt">>
}

const joinAmounts = (parts: string[]) => parts.filter((part) => part.trim() !== "").join(" + ")

const describeAmount = (ingredient: Ingredient) => {
  const amount = ingredient.amount?.trim() ?? ""
  return ingredient.optional ? `${amount} (optional)`.trim() : amount
}

/**
 * The list without a model: every ingredient of every planned meal, grouped by
 * name, amounts strung together exactly as they were written.
 *
 * This is the **fallback when the callable fails**, and it exists because a trip
 * to the shop must not depend on Anthropic being up. It adds nothing and merges
 * nothing it cannot see — "1 cup + 2 tbsp" stays two amounts rather than
 * becoming a number this file had to guess at — and everything lands in "other",
 * because a section is exactly the kind of judgement it has no way to make.
 *
 * `existing` is the list as it stands. Only **unticked** rows are merged into:
 * a ticked one is already in the trolley, and quietly growing the amount on
 * something you have picked up is how a list stops being worth reading.
 */
export const consolidateVerbatim = (
  meals: MealIngredients[],
  existing: ShoppingItem[] = []
): ProposedItem[] => {
  const open = new Map(
    existing.filter((item) => !item.checked).map((item) => [normaliseItemName(item.name), item])
  )

  const order: string[] = []
  const rows = new Map<string, { name: string; amounts: string[]; from: string[] }>()

  meals.forEach((meal) => {
    meal.ingredients.forEach((ingredient) => {
      const name = normaliseItemName(ingredient.name ?? "")
      if (name === "") return

      const row = rows.get(name)
      if (row == null) {
        order.push(name)
        rows.set(name, {
          name,
          amounts: [describeAmount(ingredient)],
          from: [meal.title],
        })
        return
      }
      row.amounts.push(describeAmount(ingredient))
      // One recipe listing an ingredient twice — "1 cup flour" in the dough and
      // "flour for dusting" — is one shopping trip, not two credits.
      if (!row.from.includes(meal.title)) row.from.push(meal.title)
    })
  })

  return order.map((name) => {
    const row = rows.get(name)!
    const already = open.get(name)
    return {
      name: row.name,
      amount: joinAmounts(already ? [already.amount, ...row.amounts] : row.amounts),
      section: already?.section ?? OTHER,
      from: already ? [...new Set([...already.from, ...row.from])] : row.from,
      mergesWith: already?.id ?? null,
    }
  })
}

/**
 * Turns a proposal into the two writes a build makes.
 *
 * The rule this enforces, and the reason it is enforced here rather than only
 * asked for in the prompt: **a ticked row is never merged into.** The model is
 * not shown ticked rows at all, so it should never try — but "should never" is
 * not the same as "cannot", and the consequence of getting it wrong is someone
 * putting back a thing they already bought. A merge whose target has been ticked
 * in the meantime, or has gone entirely, becomes its own row instead.
 *
 * Names are what merge; `mergesWith` only covers the case where the two words
 * differ. That way a proposal that forgets the field is still tidy, which is the
 * failure worth being robust to — the model dropping an optional id is far more
 * likely than it inventing a synonym.
 */
export const mergePlan = (existing: ShoppingItem[], proposed: ProposedItem[]): ListPlan => {
  const open = existing.filter((item) => !item.checked)
  const byId = new Map(open.map((item) => [item.id, item]))
  const byName = new Map(open.map((item) => [normaliseItemName(item.name), item]))

  /** Highest sort per section, so additions land after what is already there. */
  const tail = new Map<string, number>()
  existing.forEach((item) => {
    const key = sectionKey(item.section)
    tail.set(key, Math.max(tail.get(key) ?? 0, item.sort))
  })

  const updates: ListPlan["updates"] = []
  const additions: ListPlan["additions"] = []
  /** Rows already spoken for this batch, so two proposals cannot both claim one. */
  const claimed = new Set<string>()
  /** Additions by name, so a proposal listing "butter" twice makes one row. */
  const added = new Map<string, Omit<ShoppingItem, "id" | "addedAt">>()

  proposed.forEach((item) => {
    const name = normaliseItemName(item.name ?? "")
    if (name === "") return

    const section = sectionKey(item.section)
    const from = [...new Set(item.from ?? [])]

    const target = (item.mergesWith ? byId.get(item.mergesWith) : undefined) ?? byName.get(name)
    if (target != null && !claimed.has(target.id)) {
      claimed.add(target.id)
      updates.push({ id: target.id, amount: item.amount, from })
      return
    }

    const twin = added.get(name)
    if (twin != null) {
      twin.amount = joinAmounts([twin.amount, item.amount])
      twin.from = [...new Set([...twin.from, ...from])]
      return
    }

    const sort = (tail.get(section) ?? 0) + 1
    tail.set(section, sort)

    const addition = { name, amount: item.amount ?? "", section, from, checked: false, sort }
    added.set(name, addition)
    additions.push(addition)
  })

  return { updates, additions }
}

/** One rendered section: its label and the rows under it. */
export interface ListSection {
  key: SectionKey
  label: string
  items: ShoppingItem[]
}

/**
 * The list grouped for the screen, in store-walk order, with empty sections
 * dropped. Within a section, unticked rows come first — what is left to find is
 * the thing being read, and what is in the trolley settles to the bottom rather
 * than disappearing, so an accidental tap is visibly undoable.
 */
export const bySection = (items: ShoppingItem[]): ListSection[] =>
  SECTIONS.map(({ key, label }) => ({
    key,
    label,
    items: items
      .filter((item) => sectionKey(item.section) === key)
      .sort((a, b) => Number(a.checked) - Number(b.checked) || a.sort - b.sort),
  })).filter((section) => section.items.length > 0)
