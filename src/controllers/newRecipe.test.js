import RecipeController from "./RecipeController"

describe("new recipe controller should", () => {
  test("create initial items on instantiation", () => {
    const controller = new RecipeController()
    expect(controller.directions).toBeDefined()
  })
})
