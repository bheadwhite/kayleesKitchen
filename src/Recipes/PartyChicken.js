import {
  Chicken,
  CreamOfChicken,
  Mayonaise,
  Paprika,
  ParsleyFlakes,
  Pepper,
  Rice,
  SourCream,
  Water,
} from "ingredients"

export const PartyChicken = {
  title: "Party Chicken",
  ingredients: [
    Chicken("2-4 cups", "chunks"),
    CreamOfChicken("1 (2 reg cans or 1 big)"),
    Mayonaise("1/2 cup"),
    Paprika("1 tsp"),
    ParsleyFlakes("2 tbsp"),
    Pepper(1),
    Rice("2 cups"),
    SourCream("1 cup"),
    Water("2 cups"),
  ],
  directions: [
    {
      type: "section",
      text: "prep",
    },
    {
      type: "step",
      text: "prep the chicken, 4 hours on high in crockpot or cook it on stove",
    },
    {
      type: "step",
      text: "cook the rice",
    },
    {
      type: "step",
      text: "preheat the oven to 350 degrees",
    },
    {
      type: "section",
      text: "combine",
    },
    {
      type: "step",
      text: "combine soup, mayo, sourcream, parsley, paprika, and pepper",
    },
    {
      type: "step",
      text:
        "apply a thin layer of sauce to the bottom of a casserole dish, rice, half sauce, chicken, rest of the sauce",
    },
    {
      type: "section",
      text: "bake",
    },
    {
      type: "step",
      text: "heat in oven 35-48 minutes",
    },
  ],
}
