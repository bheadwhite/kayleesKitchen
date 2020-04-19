import {
  Peas,
  Beans,
  Corn,
  Tomato,
  Peppers,
  Avocado,
  Sugar,
  Cumin,
  Garlic,
  Dressing,
  Oil,
  Juice,
  RedChilliFlakes,
} from "data/ingredients"
import tags from "data/tags"

export const CowboyCaviar = {
  title: "Cowboy Caviar",
  contributor: "Lauren Tarver",
  description:
    "Chip Dip. Peppers and Avocados make this one an incredibly fresh big bowl of flavours. Perfect for get-togethers, pot lucks barbecues, or anything you need it for.",
  tags: [tags.chipDip],
  ingredients: [
    Peas("as needed", { type: "Black-eyed" }),
    Beans("as needed", { type: "Black" }),
    Corn("as needed", { type: "Sweet" }),
    Tomato("as needed", { type: "Grape or cherry or finely diced Roma" }),
    Peppers("as needed", { parens: "capsicums" }),
    Avocado("as needed"),
    Dressing("as needed", { type: "Italian" }),
    Oil("as needed", { type: "Olive" }),
    Juice("as needed", { type: "Lime" }),
    Sugar("as needed", { type: "Brown" }),
    RedChilliFlakes("as needed"),
    Garlic("as needed"),
    Cumin("as needed"),
  ],
  directions: [
    { type: "section", text: "Mix" },
    { type: "step", text: "add as much or as little as you want!" },
  ],
}
