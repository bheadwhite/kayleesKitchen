import newRecipe from "./newRecipe"

describe("new recipe controller should", () => {
  test("create initial items on instantiation", () => {
    const controller = new newRecipe()
    expect(controller.directions).toBeDefined()
  })
})
