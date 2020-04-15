import {
  BakingSoda,
  Flour,
  Salt,
  BakingPowder,
  Cinnamon,
  Sugar,
  Oil,
  Carrots,
  Eggs,
  Pecans,
  Cheese,
  Butter,
  VanillaExtract,
} from "data/ingredients"
import tags from "data/tags"
import categories from "data/categories"

export const CarrotCake = {
  title: "Carrot Cake",
  category: categories.dessert,
  tags: [tags.dessert, tags.cake],
  contributor: "Lisa Tarver",
  ingredients: [
    BakingSoda("2 tsp"),
    Flour("2 cups"),
    Salt("1 tsp"),
    BakingPowder("2 tsp"),
    Cinnamon("2 tsp"),
    Sugar("2 cups"),
    Oil("1 1/2 cup"),
    Carrots("3 cups", "shredded"),
    Eggs(4),
    Pecans("1 1/2 cup", "diced"),
    Cheese("8 oz (frosting)", "Cream"),
    Sugar("1 box (16 oz) (frosting)", "Powdered"),
    Butter("1/4 cup (frosting)"),
    VanillaExtract("2 tsp (frosting)"),
  ],
  directions: [
    { type: "section", text: "Prep" },
    { type: "step", text: "preheat oven to 350" },
    { type: "section", text: "Cake" },
    { type: "step", text: "mix sugar and oil in medium size bowl" },
    { type: "step", text: "add cinnamon, shredded carrots" },
    { type: "step", text: "add 1 egg at a time while beating, 2 minutes on medium speed" },
    { type: "step", text: "add pecans" },
    { type: "step", text: "mix well" },
    { type: "step", text: "spray or butter cake pan" },
    { type: "step", text: "bake for 35-45 minutes" },
    {
      type: "step",
      text:
        "put a toothpick in to check if it is done, if it comes out clean its finished, if it come out sticky cook it longer.",
    },
    { type: "section", text: "Cream Cheese Frosting" },
    { type: "step", text: "whip ingredients together until creamy" },
  ],
}
