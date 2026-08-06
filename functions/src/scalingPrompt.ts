/**
 * The `analyse_scaling` tool: how each ingredient line responds to cooking for
 * more people.
 *
 * **A rule per line, not a scaled list.** Asked for a list, the chef would have
 * to be asked again for every serving count anybody ever wants; asked for the
 * rules, it is asked once per version of the recipe and the client answers
 * every number itself, for nothing, offline. That is the whole design — see
 * `src/scaling.ts`.
 *
 * Data rather than code, too. A model can write a scaling function in
 * JavaScript, and running one in a browser is executing text a model produced.
 * A closed vocabulary of rules cannot do anything except produce an amount.
 */
export const SCALING_SCHEMA = {
  type: "object" as const,
  properties: {
    baseServes: {
      type: "integer",
      description:
        "How many the recipe AS WRITTEN feeds — the number every quantity below is " +
        "quoted at. One number, not a range.",
    },
    lines: {
      type: "array",
      description:
        "One entry per ingredient line, in the SAME ORDER as the recipe, with none " +
        "added, merged, split, or left out. This becomes the ingredient list the cook " +
        "reads at every size, so a line missing here is a line missing from the recipe.",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The ingredient's name, exactly as the recipe writes it.",
          },
          text: {
            type: "string",
            description:
              "The amount exactly as the recipe writes it. Used verbatim for a fixed " +
              "line, and as the fallback whenever the parts below cannot rebuild it.",
          },
          rule: {
            type: "string",
            enum: ["linear", "sublinear", "fixed"],
            description:
              "How this line moves with the batch. 'linear' — doubles when the batch " +
              "doubles; the right answer for most things. 'sublinear' — rises, but more " +
              "slowly: salt, chemical leaveners, strong spices, chilli heat, and anything " +
              "where doubling the batch does not double how much you want. 'fixed' — does " +
              "not move at all, and is the ONLY correct answer for an amount that is not " +
              "a number: 'to taste', 'a pinch', 'for dusting', 'enough to cover'.",
          },
          qty: {
            type: ["number", "null"],
            description:
              "The numeric quantity at baseServes — 2 for '2 cups', 0.5 for '½ tsp', 3 " +
              "for '3 eggs'. Null ONLY for a fixed line. A scaling line with no quantity " +
              "would freeze at its base amount at every size, which is worse than either.",
          },
          unit: {
            type: ["string", "null"],
            description:
              "The unit — 'cup', 'tbsp', 'g', 'lb', 'medium', 'clove'. Empty string for " +
              "a bare count ('3 eggs'). Null on a fixed line.",
          },
          /*
           * A nullable enum is written as `anyOf`, not as a type array carrying
           * a null in its `enum` list. The strict validator checks each enum
           * value against the declared type and cannot read the array form, so
           * `type: ["string", "null"]` beside `enum: [..., null]` is rejected
           * outright — "Enum value 'exact' does not match declared type
           * '['string', 'null']'" — and rejected at the *tool* level, which
           * fails the whole call before the model sees anything. Every other
           * enum here is a plain non-nullable string and needs none of this.
           */
          rounding: {
            anyOf: [
              { type: "string", enum: ["exact", "quarter", "half", "whole"] },
              { type: "null" },
            ],
            description:
              "What the scaled quantity is settled onto, so the cook is given something " +
              "measurable. 'whole' for anything you buy or crack one at a time — eggs, " +
              "onions, cloves, tins. 'quarter' or 'half' for cups and pounds. 'exact' for " +
              "small spoon measures, where a decimal is fine.",
          },
          prefer: {
            anyOf: [{ type: "string", enum: ["up", "down"] }, { type: "null" }],
            description:
              "Which way a rounded quantity should break when it lands between. 'up' for " +
              "eggs, aromatics, and anything where more is harmless; 'down' for chilli, " +
              "salt, and anything that ruins a dish in excess. Null for nearest.",
          },
          exponent: {
            type: ["number", "null"],
            description:
              "For a sublinear line only: the power the ratio is raised to. 0.75 is the " +
              "usual answer for salt and leavening; 0.5 for something that barely rises " +
              "at all. Null otherwise.",
          },
          optional: {
            type: ["boolean", "null"],
            description: "True if the recipe marks this line optional.",
          },
          note: {
            type: ["string", "null"],
            description:
              "A few words the cook needs about THIS line at a bigger size, or null. " +
              "Not a restatement of the rule.",
          },
        },
        required: [
          "name",
          "text",
          "rule",
          "qty",
          "unit",
          "rounding",
          "prefer",
          "exponent",
          "optional",
          "note",
        ],
        additionalProperties: false,
      },
    },
    vessels: {
      type: "array",
      description:
        "The pan, pot, tin, or dish to use, and the serving count each stops working " +
        "at — ordered smallest first. This is the failure that ruins a dinner and is " +
        "invisible in a list of doubled quantities: a doubled traybake in the same tin " +
        "steams instead of roasting. Empty if the recipe names no vessel.",
      items: {
        type: "object",
        properties: {
          upTo: {
            type: "integer",
            description: "The largest number of servings this vessel still works for.",
          },
          text: {
            type: "string",
            description: "The vessel — '9×13 dish', 'two 9-inch tins', '7-qt pot'.",
          },
        },
        required: ["upTo", "text"],
        additionalProperties: false,
      },
    },
    notes: {
      type: "string",
      description:
        "One or two sentences on what changes at a bigger or smaller size and is not " +
        "an amount: timings that shift, a pan that needs a second batch, seasoning to " +
        "do at the end. Empty string if there is nothing worth saying.",
    },
  },
  required: ["baseServes", "lines", "vessels", "notes"],
  additionalProperties: false,
}

export const SCALING_PROMPT = `You are the same chef who helps with these recipes. Right now you are doing one job, once: working out how this recipe's ingredient list responds to being cooked for a different number of people.

WHY THIS IS RULES AND NOT A SCALED LIST
You are asked this once per recipe. What you hand back is applied by the app for every number anyone ever wants — four, eight, eleven — without asking you again. So the rules have to be right for the whole range, not tuned to one target you have in mind.

THE VOCABULARY IS CLOSED, AND THAT IS THE POINT
Every line is linear, sublinear, or fixed. If a line does not fit, 'fixed' with the text carried across unchanged is always available and always safe — a line the cook reads exactly as the recipe wrote it is never wrong, only occasionally unhelpful. Reach for it rather than inventing a number.

WHAT IS NOT LINEAR
Most things are. The ones that are not are worth getting right, because they are the ones a naive doubling ruins:
- Salt, chemical leaveners (baking powder, soda), strong spices, chilli heat, and yeast rise with the batch but more slowly. Sublinear, usually around 0.75.
- Eggs, onions, cloves of garlic, tins, and anything else bought or used whole must round to whole units — and say which way. Half an egg is not an instruction.
- Cooking times and temperatures do not scale at all, and are not ingredients; if a bigger batch needs longer, that belongs in notes.
- Pans and pots DO scale, in steps rather than smoothly, and that is what vessels is for.

AMOUNTS THAT ARE NOT NUMBERS
"To taste", "a pinch", "for dusting", "a splash", "enough to cover" are amounts. They are fixed lines. Do not put a number on them at any size — a cook who reads "3.4 pinches" stops trusting the whole list.

SCOPE
You are describing the recipe, not improving it. Same lines, same order, same names, same wording. Do not merge two lines, split one, add a staple the recipe forgot, or drop one you think is unnecessary. If something about the recipe looks wrong, describe it as written and say so in notes.

Call analyse_scaling exactly once. Do not answer in prose.`
