//pantry
export const Rice = (amount, type, special = false, optional) => ({
  name: "Rice",
  amount,
})
export const CreamOfChicken = (amount, type, special = false, optional) => ({
  name: "Cream of Chicken Soup",
  type: "can",
  special: true,
  amount,
})
export const ChocolateChipMorsels = (amount, type, special = false, optional) => ({
  name: typeof type === "undefined" ? "Chocolate Chip Morsels" : `Chocolate Chip Morsels (${type})`,
  special: true,
  amount,
})
export const Oil = (amount, type, special = false) => ({
  name: typeof type === "undefined" ? "Oil" : `${type} Oil`,
  special,
  amount,
})
export const BrownSugar = (amount, type, special = false, optional) => ({
  name: "Brown Sugar",
  amount,
})
export const WhiteSugar = (amount, type, special = false, optional) => ({
  name: "White Sugar",
  amount,
})

export const Sugar = (amount, type, special = false) => ({
  name: typeof type === "undefined" ? "Sugar" : `${type} Sugar`,
  special,
  amount,
})
export const Milk = (amount, type, special = false) => ({
  name: typeof type == "undefined" ? "Milk" : `${type} Milk`,
  special,
  amount,
})

export const VanillaExtract = (amount, type, special = false, optional) => ({
  name: "Vanilla Extract",
  amount,
})
export const CanOfTomatoes = (amount, type = "diced") => ({
  name: `Can of Tomatoes (${type})`,
  amount,
})
export const Sauce = (amount, type, special = false) => ({
  name: typeof type === "undefined" ? "Sauce" : `${type} Sauce`,
  special,
  amount,
})
export const Noodles = (amount, type, special = false, optional) => ({
  name: typeof type === "undefined" ? "Noodles" : `Noodles (${type})`,
  special: true,
  amount,
})
export const Oreos = (amount, type, special = false, optional) => ({
  name: typeof type === "undefined" ? "Oreos" : `Oreos (${type})`,
  special: true,
  amount,
})

//fridge
export const Eggs = (amount = 1) => ({
  name: "Eggs",
  amount,
})
export const Mayonaise = (amount, type, special = false, optional) => ({
  name: "Mayonaise",
  amount,
})
export const SourCream = (amount, type, special = false, optional) => ({
  name: "Sour Cream",
  amount,
})
export const Shortening = (amount, type, special = false, optional) => ({
  name: "Shortening",
  amount,
})
export const Butter = (amount = "1 cube", type) => ({
  name: typeof type === "undefined" ? "Butter" : `Butter (${type})`,
  amount,
})

export const Cheese = (amount, type, special = false) => ({
  name: typeof type !== "undefined" ? `${type} Cheese` : "Cheese",
  special,
  amount,
})

export const Onion = (amount, type, special = false, optional) => ({
  name: typeof type !== "undefined" ? `${type} Onion` : "Onion",
  type,
  amount,
})
export const Tomato = (amount, type, special = false, optional) => ({
  name: typeof type !== "undefined" ? `${type} Tomato` : "Tomato",
  type,
  amount,
})
export const Cilantro = (amount = "a pinch") => ({
  name: "Cilantro",
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
export const BakingSoda = (amount, type, special = false, optional) => ({
  name: "Baking Soda",
  amount,
})
export const Flour = (amount, type, special = false, optional) => ({
  name: "Flour",
  amount,
})
export const Garlic = (amount, type = "Minced") => ({
  name: `Garlic (${type})`,
  amount,
})
export const Basil = (amount, type, special = false, optional) => ({
  name: typeof type === "undefined" ? "Basil" : `Basil (${type})`,
  amount,
})

export const CakeMix = (amount, type, special = false, optional) => ({
  name: typeof type === "undefined" ? "Cake Mix" : `Cake Mix (${type})`,
  amount,
})

//water
export const Water = (amount, type, special = false, optional) => ({
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
export const PuddingMix = (amount, type, special = false, optional) => ({
  name: typeof type === "undefined" ? "Pudding Mix" : `Pudding Mix (${type})`,
  special: true,
  amount,
})
export const Tortillas = (amount = "1 can", type) => ({
  name: typeof type === "undefined" ? "Tortillas" : `Tortillas (${type})`,
  special: true,
  amount,
})
