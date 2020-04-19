import { Juice, Cranberries, Orange, Raspberries, Sugar } from "data/ingredients"
import tags from "data/tags"

export const CranberrySauce = {
  title: "Cranberry Sauce",
  contributor: "Kauren Campbell",
  tags: [tags.sauce],
  ingredients: [
    Sugar("1 cup", { type: "Brown" }),
    Juice("1 cup", { type: "Orange" }),
    Cranberries("2 cups", { type: "Fresh or Frozen" }),
    Orange("2 tsp", { parens: "grated peel" }),
    Raspberries("1 carton"),
  ],
  directions: [
    { type: "section", text: "Mix" },
    {
      type: "step",
      text:
        "In a 2 quart saucepan, heat brown sugar and OJ to boiling over medium heat, stirring frequently.",
    },
    { type: "step", text: "Boil for 5 minutes." },
    { type: "step", text: "Stir in cranberries, heat to boiling." },
    {
      type: "step",
      text:
        "Boil about 5 minutes, stir frequently until cranberries are popped and mixture has thickened.",
    },
    { type: "step", text: "Stir in orange peel + rasperries" },
    { type: "section", text: "Cool" },
    { type: "step", text: "Cover and refrigerate about 3 hours, or until chilled." },
  ],
}
