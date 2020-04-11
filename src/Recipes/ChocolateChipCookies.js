import {
  BakingSoda,
  BrownSugar,
  ChocolateChipMorsels,
  Eggs,
  Flour,
  Salt,
  Shortening,
  VanillaExtract,
  WhiteSugar,
} from "ingredients"

export const ChocolateChipCookies = {
  title: "Chocolate Chip Cookies",
  ingredients: [
    BakingSoda("1 tsp"),
    BrownSugar("1 cup"),
    ChocolateChipMorsels("1 1/2 cup"),
    Eggs(2),
    Flour("2 1/4 cup"),
    Salt("1/2 tsp"),
    Shortening("1 cup"),
    VanillaExtract("2 1/2 tsp"),
    WhiteSugar("1/2 cup"),
  ],
  directions: [
    {
      type: "section",
      text: "Prep",
    },
    {
      type: "step",
      text: "preheat the oven to 350 degrees",
    },
    {
      type: "step",
      text: "get a large mixing bowl",
    },
    {
      type: "section",
      text: "mix",
    },
    {
      type: "step",
      text: "combine shortening, brown sugar, and white sugar",
    },
    {
      type: "step",
      text: "add eggs, vanilla, salt baking soda",
    },
    {
      type: "step",
      text: "slowly add flour and chips",
    },
    { type: "section", text: "bake" },
    {
      type: "step",
      text: "place on pan and cook for 10 minutes at 350 deg",
    },
  ],
}
