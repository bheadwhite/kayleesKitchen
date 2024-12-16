//pantry
import { Ingredient } from "src/types/types";

type ExtraOptions = Partial<Ingredient>;

export const Rice = (amount: string, options?: ExtraOptions): Ingredient => ({
  name: "Rice",
  amount,
  ...options,
});
export const CreamOfChicken = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Cream of Chicken Soup",
  amount,
  ...options,
});
export const ChocolateChipMorsels = (
  amount,
  options?: ExtraOptions,
): Ingredient => ({
  name: "Chocolate Chip Morsels",
  amount,
  ...options,
});
export const Oil = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Oil",
  amount,
  ...options,
});
export const Sugar = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Sugar",
  amount,
  ...options,
});
export const Milk = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Milk",
  amount,
  ...options,
});

export const VanillaExtract = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Vanilla Extract",
  amount,
  ...options,
});
export const CanOfTomatoes = (amount, options?: ExtraOptions): Ingredient => ({
  name: `Can of Tomatoes`,
  amount,
  ...options,
});
export const Sauce = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Sauce",
  amount,
  ...options,
});
export const Noodles = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Noodles",
  amount,
  ...options,
});
export const Oreos = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Oreos",
  amount,
  special: true,
  ...options,
});

export const Eggs = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Eggs",
  amount,
  ...options,
});
export const Mayonaise = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Mayonaise",
  amount,
  ...options,
});
export const SourCream = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Sour Cream",
  amount,
  ...options,
});
export const Shortening = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Shortening",
  amount,
  ...options,
});
export const Butter = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Butter",
  amount,
  ...options,
});

export const Cheese = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Cheese",
  amount,
  ...options,
});

export const Onion = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Onion",
  amount,
  ...options,
});
export const Tomato = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Tomato",
  amount,
  ...options,
});
export const Cilantro = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Cilantro",
  amount,
  ...options,
});
export const Peas = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Peas",
  amount,
  ...options,
});
export const Beans = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Beans",
  amount,
  ...options,
});
export const Corn = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Corn",
  amount,
  ...options,
});
export const Carrots = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Carrots",
  amount,
  ...options,
});

//freezer
export const Chicken = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Chicken",
  amount,
  special: true,
  ...options,
});
export const Turkey = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Turkey",
  amount,
  special: true,
  ...options,
});
export const Beef = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Beef",
  amount,
  special: true,
  ...options,
});
export const Sausage = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Sausage",
  amount,
  special: true,
  ...options,
});

//spices/baking stuff
export const Paprika = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Paprika",
  amount,
  ...options,
});
export const Parsley = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Parsley",
  amount,
  ...options,
});
export const Pepper = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Pepper",
  amount,
  ...options,
});
export const Peppers = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Peppers",
  amount,
  special: true,
  ...options,
});
export const Dressing = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Dressing",
  amount,
  ...options,
});
export const Juice = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Juice",
  amount,
  ...options,
});
export const Avocado = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Avocado",
  amount,
  special: true,
  ...options,
});
export const ParsleyFlakes = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Parsley Flakes",
  amount,
  ...options,
});
export const RedChilliFlakes = (
  amount,
  options?: ExtraOptions,
): Ingredient => ({
  name: "Red Chilli Flakes",
  amount,
  ...options,
});
export const Cumin = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Cumin",
  amount,
  ...options,
});
export const Salt = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Salt",
  amount,
  ...options,
});
export const BakingSoda = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Baking Soda",
  amount,
  ...options,
});
export const Flour = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Flour",
  amount,
  ...options,
});
export const Garlic = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Garlic",
  amount,
  ...options,
});
export const Basil = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Basil",
  amount,
  ...options,
});
export const Celery = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Celery",
  amount,
  special: true,
  ...options,
});
export const Thyme = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Thyme",
  amount,
  ...options,
});

export const CakeMix = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Cake Mix",
  amount,
  ...options,
});
export const Water = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Water",
  amount,
  ...options,
});

export const HashBrownsBag = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Bag of HashBrowns",
  amount,
  special: true,
  ...options,
});
export const Ham = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Ham",
  amount,
  special: true,
  ...options,
});
export const PuddingMix = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Pudding Mix",
  amount,
  special: true,
  ...options,
});
export const Tortillas = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Tortillas",
  amount,
  ...options,
});
export const Broth = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Broth",
  amount,
  ...options,
});
export const BakingPowder = (amount, options?: ExtraOptions): Ingredient => ({
  name: "BakingPowder",
  amount,
  ...options,
});
export const Cinnamon = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Cinnamon",
  amount,
  ...options,
});
export const Pecans = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Pecans",
  special: true,
  amount,
  ...options,
});
export const Cranberries = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Cranberries",
  amount,
  special: true,
  ...options,
});
export const Raspberries = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Raspberries",
  amount,
  special: true,
  ...options,
});
export const Orange = (amount, options?: ExtraOptions): Ingredient => ({
  name: "Orange",
  amount,
  ...options,
});
