import React from "react"
import ReactDOM from "react-dom"
import "./index.css"
import { BrowserRouter as Router } from "react-router-dom"
import { ThemeProvider } from "@material-ui/core"
import RecipeProvider from "contexts/RecipeProvider"
import App from "./App"
import theme from "theme"

ReactDOM.render(
  <ThemeProvider theme={theme}>
    <RecipeProvider>
      <Router>
        <App />
      </Router>
    </RecipeProvider>
  </ThemeProvider>,
  document.getElementById("root")
)
