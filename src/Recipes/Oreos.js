import { CakeMix, Shortening, Eggs } from "ingredients"
import tags from "tags"
import categories from "categories"

export const Oreos = {
  title: "Oreos",
  ingredients: [CakeMix("1 box", "Devils Food Cake"), Shortening("1 stick or 1 cup"), Eggs(2)],
  contributor: "Laurel Fletcher",
  category: categories.dessert,
  tags: [tags.dessert, tags.cookies],
  directions: [
    { type: "section", text: "Prep" },
    { type: "step", text: "oven to 350 degrees" },
    { type: "section", text: "Mix" },
    { type: "step", text: "mix all the ingredients in a big bowl" },
    { type: "step", text: "drop cookie size scoops on a greased pan." },
    { type: "section", text: "Bake" },
    { type: "step", text: "bake for 8 minutes" },
  ],
}
