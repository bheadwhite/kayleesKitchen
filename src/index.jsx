import React from "react"
import ReactDOM from "react-dom"
import "./index.css"
import { BrowserRouter as Router } from "react-router-dom"
import { ThemeProvider } from "@material-ui/core"
import App from "./App"
import theme from "theme"
import NewRecipe, { RecipeContext } from "controllers/newRecipe"

const recipe = new NewRecipe()

ReactDOM.render(
  <ThemeProvider theme={theme}>
    <RecipeContext.Provider value={recipe}>
      <Router>
        <App />
      </Router>
    </RecipeContext.Provider>
  </ThemeProvider>,
  document.getElementById("root")
)
