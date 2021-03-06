import {
  Cheese,
  Pepper,
  Noodles,
  Eggs,
  Parsley,
  Basil,
  Salt,
  Sauce,
  CanOfTomatoes,
  Garlic,
  Onion,
  Beef,
} from "data/ingredients"
import categories from "data/categories"
import tags from "data/tags"

export const Lasagna = {
  title: "Lasagna",
  contributor: "Kaylee Whitehead",
  category: categories.dinner,
  tags: [tags.lunch, tags.dinner],
  ingredients: [
    Beef("1 lb"),
    Onion("1/2 cup", { parens: "diced" }),
    Garlic("1 tsp", { parens: "minced" }),
    CanOfTomatoes("14.5 Oz | 16 oz", { parens: "diced" }),
    CanOfTomatoes("12 oz", { parens: "paste" }),
    Sauce("15 oz", { type: "Tomato" }),
    Basil("2 tsp", { parens: "dried & crushed" }),
    Salt("1 tsp"),
    Noodles("8 oz", { type: "Lasagna", special: true }),
    Eggs(2),
    Cheese("2 1/2 cups", { type: "Riccotta", special: true }),
    Cheese("3/4 cup", { type: "Parmesan" }),
    Parsley("2 tbs", { parens: "flakes" }),
    Cheese("1 lb", { type: "Grated Mozerrela", special: true }),
    Pepper("as needed"),
  ],
  directions: [
    { type: "section", text: "Prep" },
    { type: "step", text: "casserole dish" },
    { type: "step", text: "oven to 375 degrees" },
    { type: "step", text: "big mixing bowl for cheese mix" },
    { type: "step", text: "2 big stove pans, 1 for boiling noodles and 1 for cooking the meat" },
    { type: "section", text: "Meat" },
    { type: "step", text: "cook low heat onion and garlic til lightly brown in a pan" },
    { type: "step", text: "add in ground beef and mix til meat is cooked" },
    { type: "step", text: "add all tomatoes (diced, sauce, and paste) with salt, and basil." },
    { type: "step", text: "let simmer for 15 minutes" },
    { type: "section", text: "Noodles" },
    { type: "step", text: "grab a big pan and boil noodles" },
    { type: "step", text: "at about 12-15 minutes check and strain" },
    { type: "section", text: "Make cheese paste" },
    { type: "step", text: "beat the eggs and ricotta" },
    { type: "step", text: "add 1/2 cup of parmesan, parsley, salt, pepper" },
    { type: "section", text: "Layer it up" },
    { type: "step", text: "in a casserole dish, make your layers." },
    { type: "step", text: "start with a little meat sauce to grease the bottom of the pan" },
    { type: "step", text: "next lay 4~ noodles, cover the whole dish" },
    { type: "step", text: "follow with half of the ricotta cheese on top" },
    { type: "step", text: "half of the mozerella cheese on top of that" },
    { type: "step", text: "following the cheese comes half of the meat sauce. " },
    { type: "step", text: "repeat starting from noodles" },
    { type: "section", text: "Bake" },
    { type: "step", text: "toss it in the oven for 30-35 minutes" },
  ],
}
