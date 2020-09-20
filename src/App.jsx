import React from "react"
import { Switch, Route } from "react-router-dom"
import { makeStyles } from "@material-ui/core"
import clsx from "clsx"
import useAuthState from "./controllers/Auth/useAuthState"
import { Recipes, Login, Register, RecipeEditor } from "./views"
import { ToastContainer } from "react-toastify"
import Toolbar from "components/Toolbar"
import { Redirect } from "react-router-dom"
import { CircularProgress } from "@material-ui/core"
import "react-toastify/dist/ReactToastify.css"
import { authRef } from "fire/firebase"
import AuthenticationContext from "contexts/AuthenticationContext"
import Authentication from "controllers/Auth/Auth"

const useStyles = makeStyles((theme) => ({
  app: {
    boxSizing: "border-box",
    display: "flex",
    flexFlow: "column",
    "& div": {
      boxSizing: "border-box",
    },
  },
  pageWrapper: {
    padding: theme.spacing(15, 2, 0),
    height: "100vh",
  },
  loading: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
  },
}))

function App() {
  const classes = useStyles()
  const auth = new Authentication(authRef)
  window.auth = auth

  return (
    <AuthenticationContext.Provider value={auth}>
      <div className={clsx("Kitchen Recipes", classes.app)}>
        <Toolbar />
        <div className={classes.pageWrapper}>
          <Switch>
            <Restricted path='/recipes' exact component={Recipes} />
            <Restricted path='/recipes/new' exact component={RecipeEditor} />
            <Route path='/login' component={Login} />
            <Route path='/register' component={Register} />
            <Restricted path='/*' component={Recipes} />
          </Switch>
        </div>
        <ToastContainer autoClose={4000} hideProgressBar={true} />
      </div>
    </AuthenticationContext.Provider>
  )
}

const Restricted = ({ children, path, component, ...props }) => {
  const classes = useStyles()
  const authState = useAuthState()

  if (
    authState === "loggingIn" ||
    authState === "loggingOut" ||
    authState === "getUser"
  ) {
    return (
      <Route
        path={path}
        render={() => (
          <div className={classes.loading}>
            <CircularProgress />
          </div>
        )}
        {...props}
      />
    )
  } else if (authState === "loggedIn") {
    return <Route path={path} component={component} {...props} />
  } else if (authState === "loggedOut") {
    return <Redirect to='/login' />
  }
}

export default App
