import { Machine } from "xstate";
import StatefulSubject from "src/utils/StatefulSubject";
import AuthStateMachine from "../../logic/AuthStateMachine";

export default class Authentication {
  auth;
  user;
  state: StatefulSubject<string>;
  stateMachine;
  firebaseUnsubscribe;
  constructor(firebaseAuth) {
    this.auth = firebaseAuth;
    this.user = new StatefulSubject(firebaseAuth.currentUser);
    this.state = new StatefulSubject("getUser");
    this.stateMachine = Machine({ ...AuthStateMachine });
    this.firebaseUnsubscribe = firebaseAuth.onAuthStateChanged((user) => {
      const state = this.state.getState();
      const newState = user == null ? "getUserError" : "getUserSuccess";
      const { value } = this.stateMachine.transition(state, newState);

      this.state.next(value);
      this.user.next(this.auth.currentUser);
    });
  }

  logIn(email, password) {
    const state = this.state.getState();
    const { value, changed } = this.stateMachine.transition(state, "logIn");

    if (changed) {
      this.state.next(value);

      return this.auth
        .signInWithEmailAndPassword(email, password)
        .then(() => {
          const state = this.state.getState();
          const { value } = this.stateMachine.transition(state, "logInSuccess");

          this.state.next(value);
          this.user.next(this.auth.currentUser);
        })
        .catch((e) => {
          const state = this.state.getState();
          const { value } = this.stateMachine.transition(state, "logInError");
          this.state.next(value);
          return Promise.reject(e.message);
        });
    }
  }

  logOut() {
    const state = this.state.getState();
    const { value, changed } = this.stateMachine.transition(state, "logOut");

    if (changed) {
      this.state.next(value);

      return this.auth
        .signOut()
        .then(() => {
          const state = this.state.getState();
          const { value } = this.stateMachine.transition(
            state,
            "logOutSuccess",
          );

          this.state.next(value);
          this.user.next(this.auth.currentUser);
        })
        .catch((e) => {
          const state = this.state.getState();
          const { value } = this.stateMachine.transition(state, "logOutError");

          this.state.next(value);
          return Promise.reject(e);
        });
    }

    return Promise.resolve("Blah");
  }

  onUserChange(callback) {
    if (typeof callback === "function") {
      return this.user.subscribe({
        next: callback,
      });
    } else {
      throw new Error("Callback needs to be a function.");
    }
  }

  onStateChange(callback) {
    if (typeof callback === "function") {
      return this.state.subscribe({
        next: callback,
      });
    } else {
      throw new Error("Callback needs to be a function.");
    }
  }

  dispose() {
    this.user.complete();
    this.state.complete();
    this.firebaseUnsubscribe();
  }
}
