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

//fridge
export const Eggs = (amount) => ({
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

//freezer
export const Chicken = (amount, type = "normal") => ({
  name: "Chicken",
  special: true,
  type,
  amount,
})

//spices/baking stuff
export const Paprika = (amount) => ({
  name: "Paprika",
  amount,
})
export const ParsleyFlakes = (amount) => ({
  name: "Parsley Flakes",
  amount,
})
export const Pepper = (amount) => ({
  name: "Pepper",
  amount,
})
export const Salt = (amount) => ({
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

//water
export const Water = (amount) => ({
  name: "Water",
  amount,
})
