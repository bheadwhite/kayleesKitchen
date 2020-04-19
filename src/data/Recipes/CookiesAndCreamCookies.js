import {
  Flour,
  BakingSoda,
  Butter,
  Sugar,
  PuddingMix,
  Eggs,
  VanillaExtract,
  ChocolateChipMorsels,
  Oreos,
} from "data/ingredients"
import categories from "data/categories"
import tags from "data/tags"

export const CookiesNCremeCookies = {
  title: "Cookies N' Cream Cookies",
  contributor: "Kaylee Whitehead",
  tags: [tags.dessert, tags.cookies],
  category: categories.dessert,
  ingredients: [
    Flour("2 1/4 cup"),
    BakingSoda("1 tsp"),
    Butter("1 cup", { parens: "softened" }),
    Sugar("1/2 cup", { type: "Brown" }),
    Sugar("1/2 cup", { type: "White" }),
    PuddingMix("4.2 oz dry mix", { type: "Cookies N Creme" }),
    Eggs(2),
    VanillaExtract("1 tsp"),
    ChocolateChipMorsels("2 cups", { type: "White" }),
    Oreos(15, { parens: "coarsley chopped" }),
  ],
  directions: [
    {
      type: "section",
      text: "Prep",
    },
    {
      type: "step",
      text: "Preheat the oven to 350 degrees",
    },
    {
      type: "section",
      text: "Mix",
    },
    {
      type: "step",
      text:
        "In a large bowl, cream butter and sugars together and then add pudding mix until blended. Stir in the eggs and vanilla.",
    },
    {
      type: "step",
      text:
        "In a seperate bowl, combine the flour and baking soda with a whisk then add it to the wet ingredients.",
    },
    {
      type: "step",
      text: "Stir in the chocolate chips and Oreo Cookies.",
    },
    { type: "section", text: "Bake" },
    {
      type: "step",
      text: "Drop Rounded cookies onto a greased sheet.",
    },
    {
      type: "step",
      text:
        "Bake for 10 minutes in preheated oven until cookies tops barely have a touch of brown (do not over bake).",
    },
  ],
}
