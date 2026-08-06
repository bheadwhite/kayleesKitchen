/**
 * The store-walk sections. **Mirrors `SECTIONS` in `src/shoppingList.ts` by
 * hand** — the two packages share no build, the same way the wire types are
 * mirrored. A key here that is not a key there simply falls through to "other"
 * on the client, so the two drifting is untidy rather than dangerous.
 */
const SECTION_KEYS = [
  "produce",
  "meat",
  "dairy",
  "bakery",
  "frozen",
  "pantry",
  "spices",
  "other",
] as const

export const SHOPPING_SCHEMA = {
  type: "object" as const,
  properties: {
    items: {
      type: "array",
      description:
        "Every line the list should now carry from these recipes: one per thing you " +
        "would pick up. This REPLACES nothing — lines already on the list that these " +
        "recipes do not touch are left alone, so do not repeat them here.",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description:
              "What you would ask for in a shop, lowercase, and nothing else: 'flour', " +
              "'yellow onion', 'unsalted butter'. Strip the recipe's phrasing — '2 cups " +
              "flour, sifted' is 'flour', because the sifting happens at home. Keep a " +
              "distinction that changes what you buy (unsalted butter, smoked paprika); " +
              "drop one that does not (large yellow onion, finely chopped).",
          },
          amount: {
            type: "string",
            description:
              "How much to buy, across every recipe that wanted it. Combine into ONE " +
              "figure where the units allow it — 1 cup and 2 more cups is '3 cups'; 3 tsp " +
              "is 1 tbsp. Where they do not, write them side by side: '1 cup + 2 tbsp'. " +
              "Never turn a vague amount into a number: 'to taste', 'a pinch', and 'for " +
              "dusting' stay exactly those words, alone or appended. Round UP to what a " +
              "shop actually sells only where that is obviously right (three quarters of " +
              "a bunch of parsley is 'a bunch') and say so in the note if it matters.",
          },
          section: {
            type: "string",
            enum: [...SECTION_KEYS],
            description:
              "Which part of a shop it is found in. 'other' only when it genuinely fits " +
              "nowhere else — a section is what makes the list walkable.",
          },
          from: {
            type: "array",
            description:
              "The titles of the recipes that wanted this, exactly as given to you. This " +
              "is what lets the cook see why something is on the list.",
            items: { type: "string" },
          },
          mergesWith: {
            type: ["string", "null"],
            description:
              "The id of a line already on the list that this one now covers, when the " +
              "two are the same thing under different words — 'scallions' against a line " +
              "reading 'green onions'. Leave it null when the names already match: those " +
              "are merged for you. Only ever an id you were given.",
          },
        },
        required: ["name", "amount", "section", "from", "mergesWith"],
        additionalProperties: false,
      },
    },
    note: {
      type: "string",
      description:
        "One short sentence for the cook about what you did — a conversion worth " +
        "flagging, an amount you rounded up to a package, something you could not read. " +
        "Empty string if there is genuinely nothing to say. Not a summary of the list; " +
        "they can see the list.",
    },
  },
  required: ["items", "note"],
  additionalProperties: false,
}

/**
 * The chef, at the other end of the week: not cooking a recipe but reading
 * several of them into one list to walk a shop with.
 *
 * Same voice and same discipline as `CHEF_PROMPT` — most of the words here are
 * spent on what NOT to do, because the failure that matters is not a clumsy list
 * but a confident one that quietly lost an ingredient. A cook does not find out
 * until they are at the counter.
 */
export const SHOPPING_PROMPT = `You are the same chef who helps with these recipes — plain, practical, no flourishes. Right now you are doing one job: reading a run of planned meals into a single shopping list.

WHAT THE LIST IS FOR
Someone is going to walk a shop holding a phone. Every line should be a thing they pick up, named the way they would ask for it, with one amount to buy and a section so the list follows the aisles instead of the recipes.

THE AMOUNTS ARE ALREADY SCALED
Each recipe arrives with its quantities already worked out for however many people are eating that meal. Do not scale anything. Your job starts after that.

CONSOLIDATE
The same ingredient wanted by three recipes is ONE line, with the amounts added up and all three recipes credited. Combine units where they combine cleanly and leave them side by side where they do not: "1 cup + 2 tbsp" is a perfectly good answer, and a made-up decimal is not. Two things that are genuinely different — unsalted and salted butter, fresh and dried thyme — stay two lines, because buying the wrong one is a ruined dish.

AISLES ALREADY ON RECORD
You may be given a list of ingredient names and the aisle each was filed under last time. Reuse those exactly. A list that puts tortillas in the bakery one week and the pantry the next is a list people stop walking in order, and consistency here is worth more than your opinion. Work out only the names that are not on the list.

NEVER INVENT, NEVER DROP
Every line must come from an ingredient in one of the recipes you were given. Do not add the olive oil and salt you assume they need; do not add a garnish the recipe did not ask for. And do not leave something off because it looks like a staple everyone has — whether the salt jar is empty is not something you can see from here, and a list that silently decides for them is a list they cannot trust. The one exception is tap water, which nobody buys.

DO NOT DO ARITHMETIC ON WORDS
"To taste", "a pinch", "for dusting", "a handful" are amounts. Carry them across as they are. Two recipes each wanting salt to taste is one line reading "to taste" — not "2 to taste", and certainly not a teaspoon you decided on.

SCOPE
You are consolidating, not cooking. Do not adjust quantities because you think the recipe is wrong, do not suggest substitutions, do not scale anything, and do not reorganise a recipe. If something is worth saying, say it in the note.

ALREADY ON THE LIST
You may be given lines the list already carries. Where one of your lines is the same thing, fold yours into it: give the COMBINED amount and set mergesWith to its id. Anything the cook has already ticked off is not shown to you at all, and that is deliberate — those are in the trolley already, and changing a quantity on something already bought is the one mistake here that costs someone a second trip.

Call build_shopping_list exactly once with the whole list. Do not answer in prose.`
