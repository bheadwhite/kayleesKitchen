import React from "react"
import { Switch, Route } from "react-router-dom"
import { makeStyles } from "@material-ui/core"
import clsx from "clsx"
import useAuth from "./fire/useAuth"
import { Home, Login } from "./views"
import Toolbar from "components/Toolbar"

const useStyles = makeStyles((theme) => ({
  app: {
    height: "100vh",
    boxSizing: "border-box",
    display: "flex",
    flexFlow: "column",
  },
  pageWrapper: {
    padding: theme.spacing(2),
    height: "100%",
    boxSizing: "border-box",
  },
}))

function App() {
  const classes = useStyles()
  useAuth()

  return (
    <div className={clsx("Kitchen Recipes", classes.app)}>
      <Toolbar />
      <div className={classes.pageWrapper}>
        <Switch>
          <Route path='/' exact component={Home} />
          <Route path='/login' component={Login} />
        </Switch>
      </div>
    </div>
  )
}

export default App
