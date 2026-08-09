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
    const tagLibrary = [
      ...new Set(
        (request.data.tagLibrary ?? [])
          .filter((tag): tag is string => typeof tag === "string")
          .map((tag) => tag.trim().replace(/\s+/g, " ").toLowerCase())
          .filter(Boolean)
      ),
    ].slice(0, MAX_TAG_LIBRARY)

    const result = await runConversation(anthropicApiKey.value(), {
      feature: "assistant",
      caller: { uid: request.auth.uid, email: request.auth.token.email ?? null },
      turns: request.data.turns,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      context:
        "Current contents of the recipe editor, including the tags it already " +
        "carries. Treat this as the source of truth for what the user is looking " +
        "at right now:\n" +
        JSON.stringify(request.data.currentDraft) +
        "\n\n" +
        // The vocabulary, not a suggestion list: reusing a tag that exists is
        // what keeps the recipe list's filters worth using. Said plainly when
        // it is empty, because an absent list and an empty one mean opposite
        // things — the second is a household that has not tagged anything yet,
        // and inventing the first few tags is then exactly the right move.
        (tagLibrary.length === 0
          ? "Nobody has tagged a recipe in this household yet, so there is no " +
            "vocabulary to reuse. Pick a few plain ones and they become the list."
          : "Tags already in use in this household — prefer these over coining " +
            "anything new:\n" +
            tagLibrary.join(", ")),
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
