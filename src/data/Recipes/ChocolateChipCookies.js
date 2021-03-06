import {
  BakingSoda,
  Sugar,
  ChocolateChipMorsels,
  Eggs,
  Flour,
  Salt,
  Shortening,
  VanillaExtract,
} from "data/ingredients"
import tags from "data/tags"
import categories from "data/categories"

export const ChocolateChipCookies = {
  title: "Chocolate Chip Cookies",
  category: categories.dessert,
  tags: [tags.dessert],
  contributor: "Kaylee Whitehead",
  ingredients: [
    BakingSoda("1 tsp"),
    Sugar("1 cup", { type: "Brown" }),
    ChocolateChipMorsels("1 1/2 cup"),
    Eggs(2),
    Flour("2 1/4 cup"),
    Salt("1/2 tsp"),
    Shortening("1 cup"),
    VanillaExtract("2 1/2 tsp"),
    Sugar("1/2 cup", { type: "White" }),
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
      text: "Mix",
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
    { type: "section", text: "Bake" },
    {
      type: "step",
      text: "place on pan and cook for 10 minutes at 350 deg",
    },
  ],
}
