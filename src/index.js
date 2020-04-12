import React from "react"
import ReactDOM from "react-dom"
import "./index.css"
import { BrowserRouter as Router } from "react-router-dom"
import { ThemeProvider } from "@material-ui/core"
import App from "./App"
import theme from "theme"
import * as serviceWorker from "./serviceWorker"

ReactDOM.render(
  <ThemeProvider theme={theme}>
    <Router>
      <App />
    </Router>
  </ThemeProvider>,
  document.getElementById("root")
)

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister()
