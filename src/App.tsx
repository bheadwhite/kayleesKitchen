import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { makeStyles } from "@material-ui/core";
import clsx from "clsx";
import useAuthState from "./controllers/Auth/useAuthState";
import { Recipes, Login, Register, RecipeEditor } from "./views";
import { ToastContainer } from "react-toastify";
import Toolbar from "src/components/Toolbar";
import { CircularProgress } from "@material-ui/core";
import "react-toastify/dist/ReactToastify.css";
import AuthProvider from "src/contexts/AuthProvider";
import Authentication from "src/controllers/Auth/Auth";
import { authRef } from "src/fire/firebase";

const useStyles = makeStyles((theme) => ({
  app: {
    boxSizing: "border-box",
    display: "flex",
    flexFlow: "column",
    "& div": {
      boxSizing: "border-box",
    },
    alignItems: "center",
  },
  pageWrapper: {
    padding: theme.spacing(15, 2, 0),
    height: "100vh",
    maxWidth: "900px",
    width: "100%",
  },
  loading: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
  },
}));

function App() {
  const classes = useStyles();
  const [auth] = React.useState(() => new Authentication(authRef));

  return (
    <AuthProvider auth={auth}>
      <div className={clsx("Kitchen Recipes", classes.app)}>
        <Toolbar />
        <div className={classes.pageWrapper}>
          <Routes>
            <Route
              path="/recipes"
              element={
                <ProtectedRoute>
                  <Recipes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recipes/new"
              element={
                <ProtectedRoute>
                  <RecipeEditor />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Recipes />
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
        <ToastContainer autoClose={4000} hideProgressBar={true} />
      </div>
    </AuthProvider>
  );
}

interface ProtectedRouteProps {
  children: JSX.Element;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const classes = useStyles();
  const authState = useAuthState();
  const isAuthenticated = authState === "loggedIn";
  const isLoggedOut = authState === "loggedOut";
  const isLoading =
    authState === "loggingIn" ||
    authState === "loggingOut" ||
    authState === "getUser";

  if (isLoggedOut) {
    return <Navigate to="/login" />;
  } else if (isAuthenticated) {
    return children;
  } else if (isLoading) {
    <div className={classes.loading}>
      <CircularProgress />
    </div>;
  } else {
    throw new Error("Invalid auth state");
  }
};

export default App;
