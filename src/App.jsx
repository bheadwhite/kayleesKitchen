import React from "react"
import { Switch, Route } from "react-router-dom"
import { makeStyles } from "@material-ui/core"
import clsx from "clsx"
import useAuth from "./fire/useAuth"
import { Home, Login } from "./views"
import Toolbar from "components/Toolbar"
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
  useAuth()

  return (
    <div className={clsx("Kitchen Recipes", classes.container)}>
      <Toolbar />
      <Switch>
        <Route path='/' exact component={Home} />
        <Route path='/login' component={Login} />
      </Switch>
    </div>
  )
}

export default App
