import {
  Chicken,
  Tortillas,
  Cheese,
  SourCream,
  Sauce,
  Oil,
  ParsleyFlakes,
  Onion,
  Cilantro,
} from "src/data/ingredients";

export const Enchiladas = {
  title: "Chicken Enchiladas",
  ingredients: [
    Chicken(undefined, { type: "rotisserie or breast" }),
    Tortillas(undefined, { type: "flour" }),
    SourCream("1 cup"),
    Cheese("2 cups", { type: "Shredded Mexican" }),
    Sauce("1 lb", { type: "Red Enchilada" }),
    Oil("1 tsp", { type: "Olive" }),
    ParsleyFlakes("1/2 cup", { type: "chopped" }),
    Onion(1, { type: "medium" }),
    Cilantro(1),
  ],
  directions: [
    //// TODO: this is a WIP. ... need to revisit
    { type: "section", text: "Cook" },
    { type: "step", text: "cook olive oil & onion." },
    { type: "section", text: "Cook" },
    { type: "step", text: "add shredded chicken" },
    { type: "step", text: "add 1/2 cup red enchilada sauce and mix well." },
    { type: "step", text: "add sour cream, and cilantro" },
    { type: "step", text: "turn heat OFF & add cheese." },
  ],
};
