import React from "react"

const Recipe = ({ recipe }) => {
  const { ingredients, directions } = recipe
  if (typeof recipe === "undefined") return null
  return (
    <div>
      <h1>{recipe.title}</h1>
      <Ingredients ingredients={ingredients} />
      {directions.map(({ type, text }, index) => {
        if (type === "section") {
          return (
            <h3 key={index} style={{ color: "blue" }}>
              {text}
            </h3>
          )
        } else if (type === "step") {
          return <p key={index}> - {text}</p>
        } else {
          return (
            <p key={index} style={{ color: "red" }}>
              {text}
            </p>
          )
        }
      })}
    </div>
  )
}

const Ingredients = ({ ingredients }) => (
  <div>
    <h3>Ingredients</h3>
    {ingredients.map((ingredient) => (
      <div key={ingredient.name + ingredient.amount}>
        <span style={{ fontWeight: 500, color: "green" }}>{ingredient.name}</span> -{" "}
        {ingredient.amount}
      </div>
    ))}
  </div>
)

export default Recipe
