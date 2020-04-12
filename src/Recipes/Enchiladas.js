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
} from "ingredients"

export const Enchiladas = {
  title: "Chicken Enchiladas",
  ingredients: [
    Chicken(_, "rotisserie or breast"),
    Tortillas(_, "flour"),
    SourCream("1 cup"),
    Cheese("2 cups", "Shredded Mexican"),
    Sauce("1 lb", "Red Enchilada"),
    Oil("1 tsp", "Olive"),
    ParsleyFlakes("1/2 cup", "chopped"),
    Onion(1, "medium"),
    Cilantro(),
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
}
