import Anthropic from "@anthropic-ai/sdk"
import { defineSecret } from "firebase-functions/params"
import { HttpsError, onCall } from "firebase-functions/v2/https"

import { runConversation } from "./conversation.js"
import { db } from "./db.js"
import { assertCanSpend } from "./entitlement.js"
import { ingredientsFingerprint } from "./recipeFingerprint.js"
import { SCALING_PROMPT, SCALING_SCHEMA } from "./scalingPrompt.js"
import type { ScalingRequest, ScalingResponse, ScalingSpec } from "./types.js"

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY")

const TOOLS: Anthropic.ToolUnion[] = [
  {
    name: "analyse_scaling",
    description:
      "Report how each of this recipe's ingredient lines responds to cooking for a " +
      "different number of people. Called once per recipe; the answer is applied for " +
      "every serving count afterwards, so the rules must hold across the range. Call " +
      "this exactly once, with a line for every ingredient. It is the only way to answer.",
    strict: true,
    input_schema: SCALING_SCHEMA,
  },
]

/** A line the app can actually apply — see `isUsableSpec` on the client. */
const usable = (spec: ScalingSpec | null): spec is ScalingSpec =>
  spec != null &&
  Number.isFinite(spec.baseServes) &&
  spec.baseServes > 0 &&
  Array.isArray(spec.lines) &&
  spec.lines.length > 0 &&
  spec.lines.every(
    (line) =>
      typeof line?.name === "string" &&
      line.name.trim() !== "" &&
      typeof line.text === "string" &&
      (line.rule === "fixed" ||
        line.rule === "linear" ||
        line.rule === "sublinear") &&
      (line.rule === "fixed" || (typeof line.qty === "number" && Number.isFinite(line.qty)))
  )

/**
 * Strips the nulls the strict schema forces on every optional field.
 *
 * `strict` requires every property in `required`, so the model has to send
 * `"exponent": null` on a linear line rather than omitting it — and Firestore
 * would store those nulls, where the client's types say "absent". Dropped here
 * so what is written matches what `ScalingSpec` claims.
 */
const clean = (spec: ScalingSpec): ScalingSpec => ({
  baseServes: spec.baseServes,
  lines: spec.lines.map((line) => ({
    name: line.name,
    text: line.text,
    rule: line.rule,
    ...(line.qty == null ? {} : { qty: line.qty }),
    ...(line.unit == null ? {} : { unit: line.unit }),
    ...(line.rounding == null ? {} : { rounding: line.rounding }),
    ...(line.prefer == null ? {} : { prefer: line.prefer }),
    ...(line.exponent == null ? {} : { exponent: line.exponent }),
    ...(line.optional ? { optional: true } : {}),
    ...(line.note ? { note: line.note } : {}),
  })),
  ...(spec.vessels?.length ? { vessels: spec.vessels } : {}),
  ...(spec.notes ? { notes: spec.notes } : {}),
  fingerprint: spec.fingerprint,
})

/**
 * Works out how a recipe scales, once, and writes it down.
 *
 * The **one call per version of the ingredient list** that makes everything
 * downstream free: `recipes/{id}/scaling/{fingerprint}` then answers every
 * serving count for every session and every member, and reading it needs no
 * entitlement at all.
 *
 * The fingerprint comes from the client rather than being computed here —
 * checked against a local recomputation first, since a spec filed under a key
 * the reader will never compute is a spec bought and thrown away.
 */
export const analyseRecipeScaling = onCall<ScalingRequest, Promise<ScalingResponse>>(
  { secrets: [anthropicApiKey], timeoutSeconds: 120, memory: "512MiB", cors: true },
  async (request) => {
    if (request.auth == null) {
      throw new HttpsError("unauthenticated", "Sign in to consult the chef.")
    }

    const { recipeId, recipe, fingerprint } = request.data ?? {}
    if (recipe == null || !Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
      throw new HttpsError("invalid-argument", "A recipe with ingredients is required.")
    }
    if (typeof recipeId !== "string" || recipeId === "") {
      throw new HttpsError("invalid-argument", "recipeId is required.")
    }

    // The client's stamp has to agree with this package's. If the two ever
    // drift, every later lookup would miss and this call would be bought again
    // on every build — so it fails loudly here rather than silently forever.
    const local = ingredientsFingerprint(recipe)
    if (local !== fingerprint) {
      console.error("Fingerprint drift", { client: fingerprint, server: local })
      throw new HttpsError("failed-precondition", "Could not agree on the recipe's version.")
    }

    const caller = { uid: request.auth.uid, email: request.auth.token.email ?? null }
    await assertCanSpend(caller, "scaling")

    const result = await runConversation(anthropicApiKey.value(), {
      feature: "scaling",
      caller,
      turns: [{ role: "user", text: "Work out how this recipe scales." }],
      system: SCALING_PROMPT,
      tools: TOOLS,
      context:
        "The recipe, as filed. Describe these lines; do not change them:\n" +
        JSON.stringify(recipe),
    })

    if (result.refused) {
      throw new HttpsError("internal", "The chef could not read that recipe.")
    }

    const call = result.toolUses.filter((block) => block.name === "analyse_scaling").pop()
    if (call == null) {
      throw new HttpsError("internal", "The chef did not hand back any rules.")
    }

    const spec = clean({ ...(call.input as ScalingSpec), fingerprint })

    // Checked before it is stored as well as when it is read. A spec that
    // cannot be applied is worse than none — it would sit in the cache
    // suppressing the retry that might have produced a good one.
    if (!usable(spec)) {
      throw new HttpsError("internal", "The chef's rules did not make sense.")
    }

    // Fire-and-forget, like the yield: this turn already has its answer, and a
    // failed cache write costs one repeat call rather than a failed build.
    void db()
      .collection("recipes")
      .doc(recipeId)
      .collection("scaling")
      .doc(fingerprint)
      .set(spec)
      .catch((error) => console.warn("Could not cache the scaling rules", error))

    return { spec }
  }
)
