//pantry
export const Rice = (amount) => ({
  name: "Rice",
  amount,
})
export const CreamOfChicken = (amount) => ({
  name: "Cream of Chicken Soup",
  type: "can",
  special: true,
  amount,
})
export const ChocolateChipMorsels = (amount) => ({
  name: "Chocolate Chip Morsels",
  special: true,
  amount,
})
export const BrownSugar = (amount) => ({
  name: "Brown Sugar",
  amount,
})
export const WhiteSugar = (amount) => ({
  name: "White Sugar",
  amount,
})
export const VanillaExtract = (amount) => ({
  name: "Vanilla Extract",
  amount,
})
export const CanOfTomatoes = (amount, type = "diced") => ({
  name: `Can of Tomatoes (${type})`,
  amount,
})
export const TomatoSauce = (amount) => ({
  name: "Tomato Sauce",
  amount,
})
export const Noodles = (amount, type) => ({
  name: typeof type !== "undefined" ? "Noodles" : `Noodles (${type})`,
  special: true,
  amount,
})

//fridge
export const Eggs = (amount = 1) => ({
  name: "Eggs",
  amount,
})
export const Mayonaise = (amount) => ({
  name: "Mayonaise",
  amount,
})
export const SourCream = (amount) => ({
  name: "Sour Cream",
  amount,
})
export const Shortening = (amount) => ({
  name: "Shortening",
  amount,
})
export const Butter = (amount = "1 cube") => ({
  name: "Butter",
  amount,
})
export const CheddarCheese = (amount = "as much as you want") => ({
  name: "Cheddar Cheese",
  amount,
})
export const JackCheese = (amount = "as much as you want") => ({
  name: "Jack Cheese",
  special: true,
  amount,
})

export const Cheese = (amount, type, special) => ({
  name: typeof type !== "undefined" ? `${type} Cheese` : "Cheese",
  amount,
})

export const DicedOnions = (amount, type = "diced") => ({
  name: "Diced Onions",
  type,
  amount,
})

//freezer
export const Chicken = (amount, type = "normal") => ({
  name: "Chicken",
  special: true,
  type,
  amount,
})
export const GroundBeef = (amount = "1 lb") => ({
  name: "Ground Beef",
  special: true,
  amount,
})
export const GroundSausage = (amount = "1 lb") => ({
  name: "Ground Sausage",
  special: true,
  amount,
})

//spices/baking stuff
export const Paprika = (amount = "a pinch") => ({
  name: "Paprika",
  amount,
})
export const ParsleyFlakes = (amount = "a pinch") => ({
  name: "Parsley Flakes",
  amount,
})
export const Pepper = (amount = "a pinch") => ({
  name: "Pepper",
  amount,
})
export const Salt = (amount = "a pinch") => ({
  name: "Salt",
  amount,
})
export const BakingSoda = (amount) => ({
  name: "Baking Soda",
  amount,
})
export const Flour = (amount) => ({
  name: "Flour",
  amount,
})
export const Garlic = (amount, type = "Minced") => ({
  name: `Garlic (${type})`,
  amount,
})
export const Basil = (amount, type) => ({
  name: typeof type !== "undefined" ? "Basil" : `Basil (${type})`,
  amount,
})

//water
export const Water = (amount) => ({
  name: "Water",
  amount,
})

//special
export const HashBrownsBag = (bags = 1) => ({
  name: "Bag of HashBrowns",
  special: true,
  amount: bags,
})
export const DicedHam = (amount = 1) => ({
  name: "Diced Ham",
  special: true,
  amount,
})
export const EvaporatedMilk = (amount = "1 can") => ({
  name: "Evaporated Milk",
  special: true,
  amount,
})
