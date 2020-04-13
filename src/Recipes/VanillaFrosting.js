import { Butter, Milk, VanillaExtract, Sugar } from "ingredients"
import categories from "categories"
import tags from "tags"

export const VanillaFrosting = {
  title: "Vanilla Frosting",
  contributor: "Laurel Fletcher",
  category: categories.homemade,
  tags: [tags.homemade],
  ingredients: [
    Butter("2 sticks", "Melted"),
    Milk("2 tbsp"),
    VanillaExtract("1 tsp"),
    Sugar("4 cups", "Powdered"),
  ],
  directions: [
    { type: "section", text: "Mix" },
    { type: "step", text: "mix it all together." },
    { type: "step", text: "enjoy." },
  ],
}
