import {
  Onion,
  Celery,
  Butter,
  Flour,
  Salt,
  Thyme,
  Parsley,
  Milk,
  Turkey,
  Garlic,
  Carrots,
  Broth,
  Peas,
} from "data/ingredients"
import categories from "data/categories"
import tags from "data/tags"

export const TurkeySoup = {
  title: "Turkey or Chicken Soup",
  contributor: "Grace Whitehead",
  category: categories.dinner,
  tags: [tags.dinner, tags.lunch, tags.crockPot],
  ingredients: [
    Onion(1, { type: "Large" }),
    Celery(1, { parens: "stalks" }),
    Butter("8 tbsp"),
    Flour("8 tbsp"),
    Salt("1 tsp"),
    Thyme("1/2 tsp", { type: "Dryed" }),
    Parsley("1 tsp", { parens: "flakes" }),
    Milk("1 1/2 cup"),
    Turkey("2-3 cups", { parens: "cooked" }),
    Garlic("2 cloves", { parens: "chopped" }),
    Carrots("5 medium", { parens: "chopped (1/4 inch pieces" }),
    Broth("4 cups", { type: "Chicken" }),
    Peas("10 oz"),
  ],
  directions: [
    { type: "section", text: "Cook" },
    { type: "step", text: "In a large pot, saute onion and celery until tender." },
    { type: "step", text: "Stir in the flour and seasonings" },
    { type: "step", text: "gradually add milk stirring constantly until thickened." },
    { type: "step", text: "add meat, carrots, garlic, and broth." },
    { type: "step", text: "Simmer 15 minutes or until vegetables are tender." },
    { type: "step", text: "add peas and sercve when heated through" },
  ],
}
