export default class MockFirebaseAuth {
  constructor() {
    this.observerCallbacks = []
    this.currentUser = null
  }

  onAuthStateChanged(callback) {
    this.observerCallbacks.push(callback)

    return () => {
      const index = this.observerCallbacks.indexOf(callback)

      if (index >= 0) {
        this.observerCallbacks.splice(index, 1)
      }
    }
  }

  signOut() {}

  signInWithEmailAndPassword() {}

  createUserWithEmailAndPassword() {}

  changeState(state) {
    this.observerCallbacks.forEach((callback) => {
      callback.state()
    })
  }
}
