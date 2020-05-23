import { Subject } from "rxjs"
import { Machine } from "xstate"

const defaultState = {
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

export default class Authentication {
  constructor(firebaseAuth) {
    this.firebaseAuth = firebaseAuth
    this.currentUser = firebaseAuth.currentUser
    this.userSubject = new Subject()
    this.stateSubject = new Subject()

    this.stateMachine = Machine({ ...defaultState })
    this.state = "getUser"

    this.firebaseUnsubscribe = firebaseAuth.onAuthStateChanged((user) => {
      if (user == null) {
        const { value } = this.stateMachine.transition(this.state, "getUserError")
        this.state = value
      } else {
        const { value } = this.stateMachine.transition(this.state, "getUserSuccess")
        this.state = value
      }

      this.currentUser = this.firebaseAuth.currentUser
      this.stateSubject.next(this.state)
      this.userSubject.next(this.currentUser)
    })
  }

  logIn(email, password) {
    const { value, changed } = this.stateMachine.transition(this.state, "logIn")

    if (changed) {
      this.state = value
      this.stateSubject.next(this.state)

      this.firebaseAuth
        .signInWithEmailAndPassword(email, password)
        .then(() => {
          const { value } = this.stateMachine.transition(this.state, "logInSuccess")
          this.state = value
          this.stateSubject.next(this.state)

          this.currentUser = this.firebaseAuth.currentUser
          this.userSubject.next(this.currentUser)
        })
        .catch((e) => {
          debugger
          const { value } = this.stateMachine.transition(this.state, "logInError")
          this.state = value
          this.stateSubject.next(this.state)
          return Promise.reject(e.message)
        })
    }
  }

  logOut() {
    const { value, changed } = this.stateMachine.transition(this.state, "logOut")

    if (changed) {
      this.state = value
      this.stateSubject.next(this.state)

      return this.firebaseAuth
        .signOut()
        .then(() => {
          const { value } = this.stateMachine.transition(this.state, "logOutSuccess")
          this.state = value

          this.stateSubject.next(this.state)

          this.currentUser = this.firebaseAuth.currentUser
          this.userSubject.next(this.currentUser)
        })
        .catch((e) => {
          const { value } = this.stateMachine.transition(this.state, "logOutError")
          this.state = value

          this.stateSubject.next(this.state)
          return Promise.reject(e)
        })
    }

    return Promise.resolve("Blah")
  }

  onUserChange(callback) {
    if (typeof callback === "function") {
      return this.userSubject.subscribe({
        next: callback,
      })
    } else {
      throw new Error("Callback needs to be a function.")
    }
  }

  onChange(callback) {
    if (typeof callback === "function") {
      return this.stateSubject.subscribe({
        next: callback,
      })
    } else {
      throw new Error("Callback needs to be a function.")
    }
  }

  dispose() {
    this.userSubject.complete()
    this.stateSubject.complete()
    this.firebaseUnsubscribe()
  }
}
