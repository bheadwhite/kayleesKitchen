import {
  Flour,
  BakingSoda,
  Butter,
  BrownSugar,
  WhiteSugar,
  PuddingMix,
  Eggs,
  VanillaExtract,
  ChocolateChipMorsels,
  Oreos,
} from "ingredients"
import categories from "categories"
import tags from "tags"

export const CookiesNCremeCookies = {
  title: "Cookies N' Cream Cookies",
  contributor: "Kaylee Whitehead",
  tags: [tags.dessert, tags.cookies],
  category: categories.dessert,
  ingredients: [
    Flour("2 1/4 cup"),
    BakingSoda("1 tsp"),
    Butter("1 cup", "softened"),
    BrownSugar("1/2 cup"),
    WhiteSugar("1/2 cup"),
    PuddingMix("4.2 oz dry mix", "Cookies N Creme"),
    Eggs(2),
    VanillaExtract("1 tsp"),
    ChocolateChipMorsels("2 cups", "white"),
    Oreos(15, "coarsley chopped"),
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
