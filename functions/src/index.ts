import Anthropic from "@anthropic-ai/sdk"
import { defineSecret } from "firebase-functions/params"
import { HttpsError, onCall } from "firebase-functions/v2/https"

import { countImages, MAX_TURNS, runConversation } from "./conversation.js"
import { RECIPE_DRAFT_SCHEMA, SYSTEM_PROMPT } from "./prompt.js"
import type { AssistantRequest, AssistantResponse } from "./types.js"

export { generateRecipeImage } from "./generateImage.js"
export { askChef } from "./chef.js"

/**
 * The Anthropic key. Stored in Secret Manager, never in the client bundle:
 *   firebase functions:secrets:set ANTHROPIC_API_KEY
 */
const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY")

const MAX_IMAGES_PER_REQUEST = 8

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

    const result = await runConversation(anthropicApiKey.value(), {
      feature: "assistant",
      caller: { uid: request.auth.uid, email: request.auth.token.email ?? null },
      turns: request.data.turns,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      context:
        "Current contents of the recipe editor. Treat this as the source of truth " +
        "for what the user is looking at right now:\n" +
        JSON.stringify(request.data.currentDraft),
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
