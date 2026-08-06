import Anthropic from "@anthropic-ai/sdk"
import { defineSecret } from "firebase-functions/params"
import { HttpsError, onCall } from "firebase-functions/v2/https"

import { runConversation } from "./conversation.js"
import { db } from "./db.js"
import { assertCanSpend } from "./entitlement.js"
import { SHOPPING_PROMPT, SHOPPING_SCHEMA } from "./shoppingPrompt.js"
import type { ShoppingProposal, ShoppingRequest, ShoppingResponse } from "./types.js"

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY")

/** A week of three meals a day, with room to spare. Past this it is a mistake. */
const MAX_MEALS = 40

/**
 * No `web_fetch`, for the same reason the chef has none: everything this needs
 * is in the request, and a tool that can wander off is a way for somebody else's
 * ingredients to end up on your list.
 */
const TOOLS: Anthropic.ToolUnion[] = [
  {
    name: "build_shopping_list",
    description:
      "Hand back the lines these recipes add to the shopping list — consolidated, " +
      "amounts combined, each filed under the part of the shop it is found in. Call " +
      "this exactly once, with every line. It is the only way to answer.",
    strict: true,
    input_schema: SHOPPING_SCHEMA,
  },
]

const assertShape = (request: ShoppingRequest) => {
  if (!Array.isArray(request?.meals) || request.meals.length === 0) {
    throw new HttpsError("invalid-argument", "meals is required.")
  }
  if (request.meals.length > MAX_MEALS) {
    throw new HttpsError("invalid-argument", "That is more meals than one shop covers.")
  }
  if (!Array.isArray(request.existing)) {
    throw new HttpsError("invalid-argument", "existing is required, even if empty.")
  }
}

/**
 * Files away which aisle each ingredient turned out to be in.
 *
 * The same move as caching the yield and the scaling rules: **what the chef
 * works out becomes data the app reads without it.** After a few weeks most
 * names are on record, so this call is only asked about the novel ones — and a
 * household with no AI at all still gets a correctly sorted list.
 *
 * Only names the pantry did not already hold are written, so a run of builds
 * costs nothing once the vocabulary settles. Fire-and-forget: the list is
 * already on its way back, and a failed write means one more name looked up
 * next time rather than a failed shop.
 */
const rememberAisles = (items: ShoppingProposal[], known: Record<string, string>) => {
  const fresh = new Map<string, string>()
  items.forEach((item) => {
    const name = item.name?.trim().toLowerCase()
    const section = item.section?.trim().toLowerCase()
    // "other" is the chef declining to place something, not a fact about a
    // shop. Recording it would pin the name there for good.
    if (!name || !section || section === "other") return
    if (known[name] === section || fresh.has(name)) return
    fresh.set(name, section)
  })

  if (fresh.size === 0) return

  const batch = db().batch()
  fresh.forEach((section, name) => {
    batch.set(db().collection("pantry").doc(name), { name, section })
  })
  void batch
    .commit()
    .catch((error) => console.warn("Could not record which aisles those were in", error))
}

/**
 * What the chef is reading. The planned meals and the list as it stands, both
 * after the cache breakpoint — this is the volatile half, and it changes on
 * every build.
 */
const describeState = (request: ShoppingRequest) =>
  "The meals planned for this shop. **The amounts are already scaled** to however " +
  "many are eating each one, so take them as they stand — no multiplying. Every line " +
  "of your list has to come from one of these ingredient lists:\n" +
  JSON.stringify(request.meals) +
  "\n\n" +
  (request.existing.length === 0
    ? "The shopping list is empty, so everything you produce is a new line."
    : "Lines the list already carries, which you may fold your own into by id. " +
      "Anything already ticked off has been withheld — do not assume this is the " +
      "whole list:\n" + JSON.stringify(request.existing)) +
  "\n\n" +
  (Object.keys(request.known).length === 0
    ? "No aisles are on record yet, so section everything yourself."
    : "Aisles already on record, from every shop anyone here has done. Use these as " +
      "given — they are what makes the list read the same way twice — and work out " +
      "only the names that are missing:\n" + JSON.stringify(request.known))

/**
 * Reads a run of planned meals into one shopping list.
 *
 * A single request rather than a conversation — there is nothing to follow up —
 * so it goes through `runConversation` with one synthetic turn. Sharing that
 * path is what keeps the telemetry, the provider-error mapping, and the
 * `pause_turn` handling identical across all three callables.
 *
 * The client falls back to a plain grouped-by-name list when this fails, so a
 * failure here is a worse list rather than no shopping. That is the reason it
 * can afford to be strict about everything above.
 */
export const buildShoppingList = onCall<ShoppingRequest, Promise<ShoppingResponse>>(
  { secrets: [anthropicApiKey], timeoutSeconds: 120, memory: "512MiB", cors: true },
  async (request) => {
    if (request.auth == null) {
      throw new HttpsError("unauthenticated", "Sign in to build a shopping list.")
    }

    assertShape(request.data)

    const caller = { uid: request.auth.uid, email: request.auth.token.email ?? null }
    await assertCanSpend(caller, "shopping")

    const result = await runConversation(anthropicApiKey.value(), {
      feature: "shopping",
      caller,
      turns: [{ role: "user", text: "Read these into the shopping list." }],
      system: SHOPPING_PROMPT,
      tools: TOOLS,
      context: describeState(request.data),
    })

    if (result.refused) {
      throw new HttpsError("internal", "The chef could not read that list.")
    }

    // Last one wins, as everywhere else here: a later iteration may have revised
    // an earlier answer.
    const call = result.toolUses.filter((block) => block.name === "build_shopping_list").pop()

    // Answering in prose is a failure, not a result. Thrown rather than returned
    // empty so the client takes its fallback instead of writing nothing and
    // reporting success.
    if (call == null) {
      throw new HttpsError("internal", "The chef did not hand back a list.")
    }

    const answer = call.input as ShoppingResponse
    const items = answer.items ?? []

    rememberAisles(items, request.data.known ?? {})

    return { items, note: answer.note ?? "" }
  }
)
