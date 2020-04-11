import {
  Butter,
  HashBrownsBag,
  DicedHam,
  Eggs,
  EvaporatedMilk,
  Salt,
  Pepper,
  CheddarCheese,
  JackCheese,
} from "ingredients"

export const ChristmasCasserole = {
  title: "Christmas Casserole",
  ingredients: [
    Butter("1 cube"),
    HashBrownsBag(),
    DicedHam(),
    Eggs("1 dozen"),
    EvaporatedMilk(),
    Salt(),
    Pepper(),
    CheddarCheese(),
    JackCheese(),
  ],
  directions: [
    { type: "section", text: "Prep" },
    { type: "step", text: "preheat oven to 350" },
    { type: "step", text: "spread pan with butter" },
    { type: "step", text: "spread a layer of hash browns in bottom of pan" },
    { type: "step", text: "melt rest of butter and pour it over the hashbrowns" },
    { type: "step", text: "layer ham over hash browns" },
    { type: "section", text: "Mix" },
    { type: "step", text: "in a bowl mix eggs, millk, salt, pepper and cheese." },
    { type: "step", text: "pour mix over hashbrowns" },
    { type: "section", text: "Bake" },
    { type: "step", text: "back in oven for 30-40 minutes" },
  ],
}
