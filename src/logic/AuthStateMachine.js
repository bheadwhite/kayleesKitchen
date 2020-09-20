export default {
  initial: "getUser",
  states: {
    getUser: {
      on: {
        getUserSuccess: "loggedIn",
        getUserError: "loggedOut",
      },
    },
    loggedOut: {
      on: {
        logIn: "loggingIn",
      },
    },
    loggedIn: {
      on: {
        logOut: "loggingOut",
      },
    },
    loggingIn: {
      on: {
        logInSuccess: "loggedIn",
        logInError: "loggedOut",
      },
    },
    loggingOut: {
      on: {
        logOutSuccess: "loggedOut",
        logOutError: "loggedIn",
      },
    },
  },
}
