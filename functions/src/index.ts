import Anthropic from "@anthropic-ai/sdk"
import { defineSecret } from "firebase-functions/params"
import { HttpsError, onCall } from "firebase-functions/v2/https"

import { countImages, MAX_TURNS, runConversation } from "./conversation.js"
import { RECIPE_DRAFT_SCHEMA, SYSTEM_PROMPT } from "./prompt.js"
import type { AssistantRequest, AssistantResponse } from "./types.js"

export { generateRecipeImage } from "./generateImage.js"
export { askChef } from "./chef.js"
export { buildShoppingList } from "./shoppingList.js"
export { analyseRecipeScaling } from "./analyseScaling.js"

/**
 * The Anthropic key. Stored in Secret Manager, never in the client bundle:
 *   firebase functions:secrets:set ANTHROPIC_API_KEY
 */
const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY")

const MAX_IMAGES_PER_REQUEST = 8

/**
 * How many tags to show the chef. Generous for a household, and a ceiling on
 * how far a client can push the prompt — the vocabulary sits inside the cached
 * prefix, so it wants a bound that does not move with the recipe box.
 */
const MAX_TAG_LIBRARY = 120

/**
 * How much of the recipe box to name. Unlike the tags, this does not sit in the
 * cached prefix — the context message goes *after* the breakpoint — so every
 * title is paid for on every turn of every conversation. A few hundred is a
 * household's whole box; the cap is here so a client cannot make the bill grow
 * without bound, not because the number is precious.
 */
const MAX_RECIPE_TITLES = 200

/** Ideas turned down in one sitting. Nobody rejects thirty in a row. */
const MAX_REJECTED = 30

/**
 * Categories to work inside. A baseline of a dozen is already the intersection
 * of a dozen conditions, and past that the ask is unsatisfiable rather than
 * specific — capping it keeps that from arriving as a prompt instead of a
 * refusal.
 */
const MAX_CATEGORIES = 12

/**
 * Titles as the model should read them: trimmed, de-duplicated, capped. Not
 * lowercased, unlike the tags — a tag is a filter key and a recipe title is a
 * name, and "Won Ton Salad" is how the household wrote it down.
 */
const cleanTitles = (values: unknown, limit: number) => [
  ...new Set(
    (Array.isArray(values) ? values : [])
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim().replace(/\s+/g, " "))
      .filter(Boolean)
  ),
].slice(0, limit)

/**
 * The same, folded to lowercase to match `normaliseTag` — so the model is never
 * shown two spellings of one tag and asked to prefer the ones that exist. The
 * fold happens before the de-duplication, or "Salad" and "salad" survive it as
 * two entries.
 */
const cleanTags = (values: unknown, limit: number) =>
  cleanTitles(
    (Array.isArray(values) ? values : []).map((value) =>
      typeof value === "string" ? value.toLowerCase() : value
    ),
    limit
  )

const asList = (titles: string[]) => titles.map((title) => `- ${title}`).join("\n")

const TOOLS: Anthropic.ToolUnion[] = [
  // Lets the user paste a link instead of photographing a screen. Only fetches
  // URLs already in the conversation, so it cannot wander off on its own.
  { type: "web_fetch_20260209", name: "web_fetch", max_uses: 5 },
  {
    name: "propose_recipe",
    description:
      "Propose a complete recipe draft for the user to review. Call this whenever you " +
      "have transcribed a recipe or made a change the user asked for. The draft " +
      "replaces the editor's contents wholesale, so it must always contain the FULL " +
      "recipe — every ingredient and every step — not just the parts that changed.",
    strict: true,
    input_schema: RECIPE_DRAFT_SCHEMA,
  },
]

const assertShape = (request: AssistantRequest) => {
  if (!Array.isArray(request?.turns) || request.turns.length === 0) {
    throw new HttpsError("invalid-argument", "turns is required.")
  }
  if (request.turns.length > MAX_TURNS) {
    throw new HttpsError("invalid-argument", "Conversation is too long. Start a new one.")
  }
  if (countImages(request.turns) > MAX_IMAGES_PER_REQUEST) {
    throw new HttpsError("invalid-argument", "Too many photos in this conversation.")
  }
  if (request.currentDraft == null) {
    throw new HttpsError("invalid-argument", "currentDraft is required.")
  }
}

export const recipeAssistant = onCall<AssistantRequest, Promise<AssistantResponse>>(
  { secrets: [anthropicApiKey], timeoutSeconds: 300, memory: "512MiB", cors: true },
  async (request) => {
    // Only signed-in family members can spend tokens.
    if (request.auth == null) {
      throw new HttpsError("unauthenticated", "Sign in to consult the chef.")
    }

    assertShape(request.data)

    /**
     * Normalised and capped here rather than trusted: it is a client-supplied
     * list that goes straight into the prompt, and a recipe box with hundreds of
     * tags would otherwise push the conversation out of the cached prefix on
     * every call. Lowercased to match `normaliseTag`, so the model is never
     * shown two spellings of one tag and asked to prefer the existing ones.
     */
    const tagLibrary = cleanTags(request.data.tagLibrary, MAX_TAG_LIBRARY)

    const recipeTitles = cleanTitles(request.data.recipeTitles, MAX_RECIPE_TITLES)
    const rejected = cleanTitles(request.data.rejected, MAX_REJECTED)
    const categories = cleanTags(request.data.categories, MAX_CATEGORIES)

    const sections = [
      "Current contents of the recipe editor, including the tags it already " +
        "carries. Treat this as the source of truth for what the user is looking " +
        "at right now:\n" +
        JSON.stringify(request.data.currentDraft),

      // The vocabulary, not a suggestion list: reusing a tag that exists is
      // what keeps the recipe list's filters worth using. Said plainly when
      // it is empty, because an absent list and an empty one mean opposite
      // things — the second is a household that has not tagged anything yet,
      // and inventing the first few tags is then exactly the right move.
      tagLibrary.length === 0
        ? "Nobody has tagged a recipe in this household yet, so there is no " +
          "vocabulary to reuse. Pick a few plain ones and they become the list."
        : "Tags already in use in this household — prefer these over coining " +
          "anything new:\n" +
          tagLibrary.join(", "),
    ]

    // The baseline goes first of the three, because it is the only one that
    // says what to aim *at* — the other two say what to avoid, and a model
    // handed nothing but exclusions writes something safe and beside the point.
    if (categories.length > 0) {
      sections.push(
        "The cook has asked for ideas in these categories, picked from the " +
          "household's own tags. Treat them as the baseline: anything you " +
          "suggest has to fit all of them, and the draft should carry them as " +
          "tags. They do not constrain transcribing a photo or a link, and " +
          "anything the user asks for in words outranks them:\n" +
          asList(categories)
      )
    }

    // Omitted rather than announced when empty, unlike the tags: an empty box
    // rules nothing out, so there is nothing for the model to do with the fact.
    if (recipeTitles.length > 0) {
      sections.push(
        "Recipes already in this household's box, by title. Do not offer one of " +
          "these as a new idea — they have it. This constrains what you suggest " +
          "and nothing else:\n" +
          asList(recipeTitles)
      )
    }

    // The only record of what has already been put in front of them: a proposal
    // reaches the model as a tool call, and the transcript replayed on the next
    // request carries the prose beside it and not the draft.
    if (rejected.length > 0) {
      sections.push(
        "Ideas you have already offered in this conversation and had turned " +
          "down. Do not offer any of these again, or a thin variation of one:\n" +
          asList(rejected)
      )
    }

    const result = await runConversation(anthropicApiKey.value(), {
      feature: "assistant",
      caller: { uid: request.auth.uid, email: request.auth.token.email ?? null },
      turns: request.data.turns,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      context: sections.join("\n\n"),
    })

    if (result.refused) {
      return { text: "I can't help with that one. Try rephrasing the request.", draft: null }
    }

    // Last one wins: a later iteration may have revised an earlier proposal.
    const toolUse = result.toolUses.filter((block) => block.name === "propose_recipe").pop()

    return {
      text: result.text || (toolUse ? "Here's a draft — take a look." : "…"),
      draft: toolUse ? (toolUse.input as AssistantResponse["draft"]) : null,
    }
  }
)
