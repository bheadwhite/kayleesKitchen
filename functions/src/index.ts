import Anthropic from "@anthropic-ai/sdk"
import { defineSecret } from "firebase-functions/params"
import { HttpsError, onCall } from "firebase-functions/v2/https"

import { RECIPE_DRAFT_SCHEMA, SYSTEM_PROMPT } from "./prompt.js"
import type { AssistantRequest, AssistantResponse, AssistantTurn } from "./types.js"

export { generateRecipeImage } from "./generateImage.js"

/**
 * The Anthropic key. Stored in Secret Manager, never in the client bundle:
 *   firebase functions:secrets:set ANTHROPIC_API_KEY
 */
const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY")

const MODEL = "claude-opus-5"
const MAX_IMAGES_PER_REQUEST = 8
const MAX_TURNS = 40
/**
 * `web_fetch` runs a server-side loop that can stop with `pause_turn` before it
 * is finished. Each resume is another billed request, so it is bounded.
 */
const MAX_CONTINUATIONS = 4

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
  const images = request.turns.reduce(
    (total, turn) => total + (turn.role === "user" ? turn.images.length : 0),
    0
  )
  if (images > MAX_IMAGES_PER_REQUEST) {
    throw new HttpsError("invalid-argument", "Too many photos in this conversation.")
  }
  if (request.currentDraft == null) {
    throw new HttpsError("invalid-argument", "currentDraft is required.")
  }
}

/** Rebuilds the transcript as Messages API content blocks. */
const toMessages = (turns: AssistantTurn[]): Anthropic.MessageParam[] =>
  turns.map((turn) => {
    if (turn.role === "assistant") {
      return { role: "assistant" as const, content: turn.text }
    }

    const content: Anthropic.ContentBlockParam[] = turn.images.map((image) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: image.mediaType, data: image.data },
    }))
    // Images before text: Claude attends to a question better when it has already
    // seen what the question is about.
    content.push({ type: "text", text: turn.text || "Transcribe the recipe in these photos." })
    return { role: "user" as const, content }
  })

export const recipeAssistant = onCall<AssistantRequest, Promise<AssistantResponse>>(
  { secrets: [anthropicApiKey], timeoutSeconds: 300, memory: "512MiB", cors: true },
  async (request) => {
    // Only signed-in family members can spend tokens.
    if (request.auth == null) {
      throw new HttpsError("unauthenticated", "Sign in to use the recipe assistant.")
    }

    assertShape(request.data)

    const client = new Anthropic({ apiKey: anthropicApiKey.value() })
    const messages = toMessages(request.data.turns)

    // Cache the conversation prefix — photos are large and get resent every turn.
    // The breakpoint goes on the newest user turn, so this request's write
    // becomes the next request's read.
    const last = messages[messages.length - 1]
    if (Array.isArray(last.content)) {
      const tail = last.content[last.content.length - 1]
      if (tail.type === "text") tail.cache_control = { type: "ephemeral" }
    }

    // The editor's live state goes after the cache breakpoint: it changes every
    // turn, and putting it in `system` would invalidate the whole prefix. A
    // mid-conversation system message is the operator channel for exactly this.
    messages.push({
      role: "system",
      content:
        "Current contents of the recipe editor. Treat this as the source of truth " +
        "for what the user is looking at right now:\n" +
        JSON.stringify(request.data.currentDraft),
    })

    const send = () =>
      client.messages.create({
        model: MODEL,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        output_config: { effort: "high" },
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        tools: TOOLS,
        messages,
      })

    let response: Anthropic.Message
    // Blocks from every iteration, since a paused turn can leave text behind.
    const collected: Anthropic.ContentBlock[] = []

    try {
      response = await send()
      collected.push(...response.content)

      // `pause_turn` means the server-side web_fetch loop hit its iteration cap
      // mid-task. Re-send with the partial assistant turn appended and it picks
      // up where it stopped — no "continue" message, which would derail it.
      let continuations = 0
      while (response.stop_reason === "pause_turn" && continuations < MAX_CONTINUATIONS) {
        messages.push({ role: "assistant", content: response.content })
        response = await send()
        collected.push(...response.content)
        continuations += 1
      }
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        throw new HttpsError("resource-exhausted", "The assistant is busy — try again shortly.")
      }
      if (error instanceof Anthropic.APIError) {
        console.error("Anthropic API error", error.status, error.message)
        throw new HttpsError("internal", "The assistant could not respond.")
      }
      throw error
    }

    // Safety classifiers can decline a request; `content` is empty or partial.
    if (response.stop_reason === "refusal") {
      return { text: "I can't help with that one. Try rephrasing the request.", draft: null }
    }

    const text = collected
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim()

    // Last one wins: a later iteration may have revised an earlier proposal.
    const toolUse = collected
      .filter(
        (block): block is Anthropic.ToolUseBlock =>
          block.type === "tool_use" && block.name === "propose_recipe"
      )
      .pop()

    return {
      text: text || (toolUse ? "Here's a draft — take a look." : "…"),
      draft: toolUse ? (toolUse.input as AssistantResponse["draft"]) : null,
    }
  }
)
