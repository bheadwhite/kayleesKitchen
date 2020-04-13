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
} from "ingredients"
import tags from "tags"

export const CowboyCaviar = {
  title: "Cowboy Caviar",
  contributor: "Lauren Tarver",
  description:
    "Chip Dip. Peppers and Avocados make this one an incredibly fresh big bowl of flavours. Perfect for get-togethers, pot lucks barbecues, or anything you need it for.",
  tags: [tags.chipDip],
  ingredients: [
    Peas("*", "Black-eyed"),
    Beans("*", "Black"),
    Corn("*", "Sweet"),
    Tomato("*", "Grape or cherry or finely diced Roma"),
    Peppers("*", "capsicums"),
    Avocado(),
    Dressing("*", "Italian"),
    Oil("*", "olive"),
    Juice("*", "lime"),
    Sugar("*", "Brown"),
    RedChilliFlakes("*"),
    Garlic("*"),
    Cumin("*"),
    { name: "*", amount: "amount not specified" },
  ],
  directions: [
    { type: "section", text: "Mix" },
    { type: "step", text: "add as much or as little as you want!" },
  ],
}
