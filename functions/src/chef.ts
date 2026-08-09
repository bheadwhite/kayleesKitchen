import Anthropic from "@anthropic-ai/sdk"
import { defineSecret } from "firebase-functions/params"
import { HttpsError, onCall } from "firebase-functions/v2/https"

import { CHEF_PROMPT, FORK_SCHEMA, SERVINGS_SCHEMA } from "./chefPrompt.js"
import { MAX_TURNS, runConversation } from "./conversation.js"
import { cacheYield, readCachedYield, type CachedYield } from "./recipeYield.js"
import type { ChefFork, ChefRequest, ChefResponse } from "./types.js"

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY")

/**
 * No `web_fetch` here, deliberately. The editor's assistant needs it because a
 * pasted link is one of the things it is for; the chef is looking at a recipe
 * that is already in front of it, and a tool that can wander off to the web is
 * an invitation to answer "can I swap the buttermilk" with somebody else's
 * recipe instead of this one.
 */
const TOOLS: Anthropic.ToolUnion[] = [
  {
    name: "estimate_servings",
    description:
      "Report how many people the recipe as filed feeds. Call this whenever the yield " +
      "comes up — asked outright, or needed as the baseline before you scale anything. " +
      "Answer in your reply as well; this call is what puts the number on the screen.",
    strict: true,
    input_schema: SERVINGS_SCHEMA,
  },
  {
    name: "fork_recipe",
    description:
      "Hand back a working copy of the recipe with your changes made — scaled to a " +
      "different number of people, or with a substitution worked through. The copy " +
      "replaces what is on screen wholesale, so it must always contain the FULL recipe: " +
      "every ingredient and every step, not just the parts that changed. That is a " +
      "requirement to INCLUDE everything, not licence to revise everything: anything the " +
      "request does not reach is carried over exactly as filed — same lines, same order, " +
      "same wording. Do not call this to answer a question that leaves the recipe alone.",
    strict: true,
    input_schema: FORK_SCHEMA,
  },
]

const assertShape = (request: ChefRequest) => {
  if (!Array.isArray(request?.turns) || request.turns.length === 0) {
    throw new HttpsError("invalid-argument", "turns is required.")
  }
  if (request.turns.length > MAX_TURNS) {
    throw new HttpsError("invalid-argument", "This conversation is too long. Start a new one.")
  }
  if (request.recipe == null) {
    throw new HttpsError("invalid-argument", "recipe is required.")
  }
}

/**
 * What the chef is looking at. Both sides go in — the recipe as filed is what
 * every scale is computed from, and the working copy is what the cook can see,
 * so a follow-up like "actually make that dairy-free too" has to land on the
 * fork rather than on the original.
 */
const describeState = (request: ChefRequest, cached: CachedYield | null) =>
  "The recipe as filed. This is the source of truth and you never change it:\n" +
  JSON.stringify(request.recipe) +
  "\n\n" +
  (request.fork == null
    ? "There is no working copy yet — the cook is reading the recipe as filed."
    : "The working copy currently on screen. Later changes build on this, but any " +
      "rescaling is still computed from the recipe as filed:\n" +
      JSON.stringify(request.fork)) +
  // **What the recipe itself says, which outranks any estimate.** A person
  // wrote this down; the cache below is a model reading a number off the
  // ingredients. Said first and said plainly, or the chip on the page and the
  // chef in the drawer can disagree about the same recipe in the same breath.
  (request.authored?.serves == null
    ? ""
    : `\n\nThe recipe itself states that it feeds ${request.authored.serves}` +
      (request.authored.servingSize
        ? `, a serving being ${request.authored.servingSize}`
        : "") +
      ". That is what the recipe says rather than anything worked out, so it is " +
      "settled: do not contradict it, do not re-estimate it, and scale from it. " +
      "There is no need to call estimate_servings for this recipe at all.") +
  // A yield already settled for *this* recipe. Given to the model rather than
  // used to skip the call, because the turn may not be about the yield at all —
  // what it prevents is the same recipe being told it feeds four today and five
  // next week, which is the kind of inconsistency that stops a number being
  // trusted at all.
  (cached == null
    ? ""
    : "\n\nA yield was already settled for this exact recipe: it feeds " +
      `${cached.baseServes}` +
      (cached.servingSize ? `, a serving being ${cached.servingSize}` : "") +
      ` (${cached.basis}). Treat that as the established answer and reuse both ` +
      "the count and the serving size — call estimate_servings with the same " +
      "figures when the yield comes up, and scale from them. Only depart from " +
      "them if the cook is disputing them in this conversation." +
      // The count on its own is unreadable for anything portioned, and the
      // record cannot repair itself: a stored count makes the servings control
      // live, so the cook is never prompted to ask the question that would
      // supply the missing half.
      (cached.servingSize
        ? ""
        : " No serving size was recorded with it, which leaves the count " +
          "meaningless for anything portioned. Work one out from the recipe " +
          "and call estimate_servings with that same count and your serving " +
          "size, even if the yield is not what this turn is about — it records " +
          "a missing fact and changes nothing the cook is reading."))

export const askChef = onCall<ChefRequest, Promise<ChefResponse>>(
  { secrets: [anthropicApiKey], timeoutSeconds: 300, memory: "512MiB", cors: true },
  async (request) => {
    if (request.auth == null) {
      throw new HttpsError("unauthenticated", "Sign in to consult the chef.")
    }

    assertShape(request.data)

    // Awaited, unlike the write: the model needs it before it answers, and it
    // is one document read against a several-second call.
    const cached =
      request.data.recipeId == null
        ? null
        : await readCachedYield(request.data.recipeId, request.data.recipe)

    const result = await runConversation(anthropicApiKey.value(), {
      feature: "chef",
      caller: { uid: request.auth.uid, email: request.auth.token.email ?? null },
      turns: request.data.turns,
      system: CHEF_PROMPT,
      tools: TOOLS,
      context: describeState(request.data, cached),
    })

    if (result.refused) {
      return { text: "I can't help with that one. Try asking a different way.", fork: null, baseServes: null }
    }

    // Last one wins: a later iteration may have revised an earlier answer.
    const forkCall = result.toolUses.filter((block) => block.name === "fork_recipe").pop()
    const servingsCall = result.toolUses
      .filter((block) => block.name === "estimate_servings")
      .pop()

    const fork = forkCall ? (forkCall.input as ChefFork) : null

    // Whatever the chef settled on, kept beside the recipe so the next person
    // to ask gets it for free. Fire-and-forget — this turn already has its
    // answer, and the cook is standing in a kitchen.
    const estimate = servingsCall?.input as
      | { baseServes: number; basis: string; servingSize?: string }
      | undefined

    if (request.data.recipeId != null) {
      if (estimate?.baseServes != null) {
        cacheYield(request.data.recipeId, request.data.recipe, estimate)
      } else if (fork != null && fork.baseServes != null && !cached?.servingSize) {
        // **A fork knows the yield too, and that is how an entry stored before
        // serving sizes existed gets one.** A cached count makes the servings
        // stepper live, which means the cook never sees "how many does this
        // feed?" — so the tool that fills the gap is exactly the tool the cache
        // stops from running. Scaling is the path they *do* take, and every
        // fork carries `baseServes` and `servingSize` because the schema is
        // strict, so the record repairs itself on the way past.
        //
        // `basis` is carried over rather than blanked: the fork does not report
        // one, and the sentence explaining where the number came from is worth
        // more than the consistency of writing the whole document at once.
        // (`cached` is null when the recipe has changed, so there is never an
        // old basis attached to a new count.)
        cacheYield(request.data.recipeId, request.data.recipe, {
          baseServes: fork.baseServes,
          basis: cached?.basis ?? "",
          servingSize: fork.servingSize,
        })
      }
    }
    // A fork carries the baseline it scaled from, so it answers the yield
    // question too — but an explicit estimate is the more considered number, so
    // it wins where both are present.
    const baseServes =
      (servingsCall?.input as { baseServes: number } | undefined)?.baseServes ??
      fork?.baseServes ??
      null

    return {
      text: result.text || (fork ? "Here's a version to cook from." : "…"),
      fork,
      baseServes,
    }
  }
)
