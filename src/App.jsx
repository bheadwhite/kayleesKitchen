import React from "react"
import { Switch, Route } from "react-router-dom"
import { makeStyles } from "@material-ui/core"
import clsx from "clsx"
import Home from "./Home"
import "./App.css"

const useStyles = makeStyles((theme) => ({
  container: {
    height: "100vh",
    padding: theme.spacing(2),
    boxSizing: "border-box",
  },
}))

function App() {
  const classes = useStyles()
  return (
    <div className={clsx("Kitchen Recipes", classes.container)}>
      <Switch>
        <Route path='/' exact component={Home} />
      </Switch>
    </div>
  )
}

export default App
