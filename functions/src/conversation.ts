import Anthropic from "@anthropic-ai/sdk"
import { HttpsError } from "firebase-functions/v2/https"

import { describeError, recordAiUsage, totalUsage } from "./telemetry.js"
import type { AssistantImage } from "./types.js"

/**
 * One model for both callables. Sharing it is not just tidiness — the admin
 * console splits spend by feature and compares the two, which only means
 * anything while they are priced the same.
 */
export const MODEL = "claude-opus-5"

export const MAX_TURNS = 40

/**
 * `web_fetch` runs a server-side loop that can stop with `pause_turn` before it
 * is finished. Each resume is another billed request, so it is bounded.
 */
const MAX_CONTINUATIONS = 4

/**
 * A turn as either feature sends it. `images` is optional because the chef is
 * text-only: it is looking at a recipe that is already in the request.
 */
export interface ConversationTurn {
  role: "user" | "assistant"
  text: string
  images?: AssistantImage[]
}

export interface ConversationRequest {
  /** Which callable — the console splits cost by this. */
  feature: "assistant" | "chef" | "shopping" | "scaling"
  caller: { uid: string; email: string | null }
  turns: ConversationTurn[]
  system: string
  tools: Anthropic.ToolUnion[]
  /**
   * The live state the model should treat as truth — the editor's contents, or
   * the recipe on screen and the working copy of it. Sent *after* the cache
   * breakpoint, so a keystroke in the editor does not invalidate the whole
   * cached prefix.
   */
  context: string
}

export interface ConversationResult {
  text: string
  /** Every tool call made, in order. Callers pick out the ones they asked for. */
  toolUses: Anthropic.ToolUseBlock[]
  /** A safety classifier declined; `text` and `toolUses` are empty or partial. */
  refused: boolean
}

/** Rebuilds the transcript as Messages API content blocks. */
const toMessages = (turns: ConversationTurn[]): Anthropic.MessageParam[] =>
  turns.map((turn) => {
    if (turn.role === "assistant") {
      return { role: "assistant" as const, content: turn.text }
    }

    const images = turn.images ?? []
    const content: Anthropic.ContentBlockParam[] = images.map((image) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: image.mediaType, data: image.data },
    }))
    // Images before text: Claude attends to a question better when it has already
    // seen what the question is about. The fallback only ever fires for a turn
    // that is nothing but photos, which is the assistant's "type this up".
    content.push({ type: "text", text: turn.text || "Transcribe the recipe in these photos." })
    return { role: "user" as const, content }
  })

export const countImages = (turns: ConversationTurn[]) =>
  turns.reduce((total, turn) => total + (turn.images?.length ?? 0), 0)

/**
 * One conversation with Claude, from transcript to text-and-tool-calls.
 *
 * Both callables run the same shape — auth is checked by the caller, then this
 * builds the messages, caches the prefix, sends, resumes a paused turn, records
 * usage, and maps provider errors onto `HttpsError`. What differs between them
 * is the system prompt, the tools, and the context message, which is exactly
 * what this takes as arguments.
 */
export const runConversation = async (
  apiKey: string,
  request: ConversationRequest
): Promise<ConversationResult> => {
  const startedAt = Date.now()
  const images = countImages(request.turns)

  /** Usage from every iteration — a paused turn bills for each one. */
  const usages: Anthropic.Message["usage"][] = []
  const record = (ok: boolean, errorCode?: string, error?: unknown) =>
    recordAiUsage({
      feature: request.feature,
      uid: request.caller.uid,
      email: request.caller.email,
      model: MODEL,
      ok,
      ms: Date.now() - startedAt,
      images,
      ...totalUsage(usages),
      ...(errorCode ? { errorCode } : {}),
      ...(error === undefined ? {} : describeError(error)),
    })

  const client = new Anthropic({ apiKey })
  const messages = toMessages(request.turns)

  // Cache the conversation prefix — photos are large and get resent every turn.
  // The breakpoint goes on the newest user turn, so this request's write
  // becomes the next request's read.
  const last = messages[messages.length - 1]
  if (Array.isArray(last.content)) {
    const tail = last.content[last.content.length - 1]
    if (tail.type === "text") tail.cache_control = { type: "ephemeral" }
  }

  // The live state goes after the cache breakpoint: it changes every turn, and
  // putting it in `system` would invalidate the whole prefix. A mid-conversation
  // system message is the operator channel for exactly this.
  messages.push({ role: "system", content: request.context })

  const send = () =>
    client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
      tools: request.tools,
      messages,
    })

  let response: Anthropic.Message
  // Blocks from every iteration, since a paused turn can leave text behind.
  const collected: Anthropic.ContentBlock[] = []

  try {
    response = await send()
    collected.push(...response.content)
    usages.push(response.usage)

    // `pause_turn` means a server-side tool loop hit its iteration cap
    // mid-task. Re-send with the partial assistant turn appended and it picks
    // up where it stopped — no "continue" message, which would derail it.
    let continuations = 0
    while (response.stop_reason === "pause_turn" && continuations < MAX_CONTINUATIONS) {
      messages.push({ role: "assistant", content: response.content })
      response = await send()
      collected.push(...response.content)
      usages.push(response.usage)
      continuations += 1
    }
  } catch (error) {
    // Failed calls are recorded too — a spike in rate-limit errors is exactly
    // the thing the console exists to make visible, and tokens spent before a
    // failure are still spent.
    //
    // The provider's own message rides along with the code. A 400 naming a
    // rejected tool schema and a 529 overload are both `internal` here, and
    // telling them apart is the difference between "retry later" and "this has
    // never worked and never will until someone edits the schema".
    if (error instanceof Anthropic.RateLimitError) {
      record(false, "resource-exhausted", error)
      throw new HttpsError("resource-exhausted", "The kitchen is busy — try again shortly.")
    }
    if (error instanceof Anthropic.APIError) {
      console.error("Anthropic API error", error.status, error.message)
      record(false, "internal", error)
      throw new HttpsError("internal", "The chef could not respond.")
    }
    record(false, "unknown", error)
    throw error
  }

  record(true)

  const text = collected
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim()

  return {
    text,
    toolUses: collected.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    ),
    // Safety classifiers can decline a request; `content` is empty or partial.
    refused: response.stop_reason === "refusal",
  }
}
