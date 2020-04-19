import { Chicken, Sauce, Basil, CanOfTomatoes, Noodles, Cheese, Tomato } from "data/ingredients"
import categories from "data/categories"
import tags from "data/tags"

export const SlowCookerChickenAlfredoPasta = {
  title: "Slow Cooker Chicken Alfredo Pasta",
  contributor: "Kaylee Whitehead",
  category: categories.dinner,
  tags: [tags.dinner, tags.lunch, tags.crockPot],
  ingredients: [
    Chicken(5, { parens: "skinless breasts" }),
    Sauce("1 (15 oz)", { type: "Alfredo Pasta" }),
    Basil("1/2 cup", { type: "Pesto", special: true }),
    CanOfTomatoes("2 (14 oz)", { parens: "diced" }),
    Noodles("1 (16 oz)", { type: "Penne Pasta", substitutions: ["any"] }),
    Cheese("1/2 cup", { type: "Shredded Parmesan", special: true, optional: true }),
    Basil("2 Tbsp", { parens: "chopped", optional: true }),
    Tomato(2, { parens: "diced", optional: true }),
  ],
  directions: [
    { type: "section", text: "Prep" },
    { type: "step", text: "Spray slow cooker with non-stick cooking spray." },
    { type: "step", text: "Place chicken in the bottom of the slow cooker." },
    { type: "step", text: "Pour Alfredo sauce, pesto, and tomatoes(undrained) on top of chicken." },
    { type: "section", text: "Cook" },
    {
      type: "step",
      text:
        "Cook on low heat for 5-6 hours (or high heat for 3-4 hours) or until chicken is cooked through.",
    },
    {
      type: "step",
      text:
        "Near the end of the cooking time, cook the pasta according to the package directions and drain well.",
    },
    {
      type: "step",
      text:
        "Remove chicken rom slow cooker and shred using 2 forks (it should come apart fairly easy).",
    },
    { type: "step", text: "Add the chicken and pasta back to slow cooker and mix together." },
    { type: "section", text: "Serve" },
    {
      type: "step",
      text:
        "Serve topped with fresh Parmesan cheese, fresh basil, and fresh diced tomatoes. (optional)",
    },
  ],
}
