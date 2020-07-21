import { Subject } from "rxjs"
import { Machine } from "xstate"

export class User {
  constructor(firebaseAuth) {
    this.state = "unknown"
    this.email = null
    this.firebaseAuth = firebaseAuth
    this.stateSubject = new Subject()
    this.user = firebaseAuth.currentUser

    this.authChangeObserver = authRef.onAuthStateChanged((user) => {
      this.email = this.state.email
      this.emailVerified = this.emailVerified
      this.this.stateSubject.next(state)
    })
  }

  logOut() {
    firebaseAuth.signOut()
  }

  logIn(email, password) {
    firebaseAuth.signInWithEmailAndPassword(email, password)
  }

  onStateChange(callback) {
    if (typeof callback === "function") {
      return this.stateSubject.subscribe({
        next: callback,
      })
    }
  }

  static createUser() {
    firebaseAuth.createUserWithEmailAndPassword(email, password)
  }

  dispose() {
    this.authChangeObserver()
  }
}

class Authentication {
  constructor(firebaseAuth) {
    this.currentUser = firebase.currentUser
    const initial = this.currentUser == null ? "loggedOut" : "loggedIn"

    const stateMachine = Machine({
      initial: "loggedOut",
      states: {
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
    })

    this.state = "loggedOut"
    this.firebaseAuth = firebaseAuth
  }

  logIn(user, password) {
    const currentState = this.state
    const transitionedState = this.stateMachine.transition(
      currentState,
      "logIn"
    )

    if (currentState !== transitionedState) {
      this.state = transitionedState

      this.firebaseAuth
        .signInWithEmailAndPassword(email, password)
        .then(() => {
          this.state = this.stateMachine.transition(this.state, "logInSuccess")
        })
        .catch(() => {
          this.state = this.stateMachine.transition(this.state, "logInError")
        })
    }
  }

  logOut() {
    const currentState = this.state
    const transitionedState = this.stateMachine.transition(
      currentState,
      "logOut"
    )

    if (currentState !== transitionedState) {
      this.state = transitionedState

      this.firebaseAuth
        .signInWithEmailAndPassword(email, password)
        .then(() => {
          this.state = this.stateMachine.transition(this.state, "logOutSuccess")
        })
        .catch(() => {
          this.state = this.stateMachine.transition(this.state, "logOutError")
        })
    }
  }
}
