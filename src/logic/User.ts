//import { Subject } from "rxjs";
import { authRef } from "src/fire/firebase";
import StatefulSubject from "src/utils/StatefulSubject";
//import { Machine } from "xstate";

export class User {
  email: string | null = "";
  state = "unknown";
  emailVerified = false;
  firebaseAuth;
  user;
  stateSubject = new StatefulSubject(undefined);
  authChangeObserver = authRef.onAuthStateChanged((user) => {
    if (user == null) {
      return;
    }

    this.email = user.email;
    this.emailVerified = user.emailVerified;
    //this.stateSubject.next();
  });
  constructor(firebaseAuth) {
    this.firebaseAuth = firebaseAuth;
    this.user = firebaseAuth.currentUser;
  }

  logOut() {
    this.firebaseAuth.signOut();
  }

  logIn(email, password) {
    this.firebaseAuth.signInWithEmailAndPassword(email, password);
  }

  onStateChange(callback) {
    if (typeof callback === "function") {
      return this.stateSubject.subscribe({
        next: callback,
      });
    }
  }

  createUser(email, password) {
    this.firebaseAuth.createUserWithEmailAndPassword(email, password);
  }

  dispose() {
    this.authChangeObserver();
  }
}

//class Authentication {
//  currentUser;
//  private _state = "loggedOut";
//  firebaseAuth;
//  stateMachine;
//
//  constructor(firebaseAuth) {
//    this.currentUser = firebaseAuth.currentUser;
//    const initial = this.currentUser == null ? "loggedOut" : "loggedIn";
//
//    this.stateMachine = Machine({
//      initial: "loggedOut",
//      states: {
//        loggedOut: {
//          on: {
//            logIn: "loggingIn",
//          },
//        },
//        loggedIn: {
//          on: {
//            logOut: "loggingOut",
//          },
//        },
//        loggingIn: {
//          on: {
//            logInSuccess: "loggedIn",
//            logInError: "loggedOut",
//          },
//        },
//        loggingOut: {
//          on: {
//            logOutSuccess: "loggedOut",
//            logOutError: "loggedIn",
//          },
//        },
//      },
//    });
//
//    this.firebaseAuth = firebaseAuth;
//  }
//
//  logIn(user, password) {
//    const currentState = this._state;
//    const transitionedState = this.stateMachine.transition(
//      currentState,
//      "logIn",
//    );
//
//    if (currentState !== transitionedState) {
//      this._state = transitionedState;
//
//      this.firebaseAuth
//        .signInWithEmailAndPassword(email, password)
//        .then(() => {
//          this._state = this.stateMachine.transition(
//            this._state,
//            "logInSuccess",
//          );
//        })
//        .catch(() => {
//          this._state = this.stateMachine.transition(this._state, "logInError");
//        });
//    }
//  }
//
//  logOut() {
//    const currentState = this._state;
//    const transitionedState = this.stateMachine.transition(
//      currentState,
//      "logOut",
//    );
//
//    if (currentState !== transitionedState) {
//      this._state = transitionedState;
//
//      this.firebaseAuth
//        .signInWithEmailAndPassword(email, password)
//        .then(() => {
//          this._state = this.stateMachine.transition(
//            this._state,
//            "logOutSuccess",
//          );
//        })
//        .catch(() => {
//          this._state = this.stateMachine.transition(
//            this._state,
//            "logOutError",
//          );
//        });
//    }
//  }
//}
