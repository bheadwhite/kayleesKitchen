import { Butter, HashBrownsBag, Ham, Eggs, Milk, Salt, Pepper, Cheese } from "data/ingredients"
import categories from "data/categories"
import tags from "data/tags"

export const ChristmasCasserole = {
  title: "Christmas Casserole",
  category: categories.breakfast,
  contributor: "Campbell Family",
  tags: [tags.breakfast],
  ingredients: [
    Butter("1 cube"),
    HashBrownsBag("1 Bag"),
    Ham("1 package", { parens: "diced" }),
    Eggs("1 dozen"),
    Milk("as needed", { type: "Evaporated" }),
    Salt("as needed"),
    Pepper("as needed"),
    Cheese("as needed", { type: "Cheddar" }),
    Cheese("as needed", { type: "Jack", special: true }),
  ],
  directions: [
    { type: "section", text: "Prep" },
    { type: "step", text: "preheat oven to 350" },
    { type: "step", text: "spread pan with butter" },
    { type: "step", text: "spread a layer of hash browns in bottom of pan" },
    { type: "step", text: "melt rest of butter and pour it over the hashbrowns" },
    { type: "step", text: "layer ham over hash browns" },
    { type: "section", text: "Mix" },
    { type: "step", text: "in a bowl mix eggs, millk, salt, pepper and cheese." },
    { type: "step", text: "pour mix over hashbrowns" },
    { type: "section", text: "Bake" },
    { type: "step", text: "back in oven for 30-40 minutes" },
  ],
}
