export default class MockFirebaseAuth {
  observerCallbacks: (() => void)[] = [];
  currentUser = null;

  onAuthStateChanged(callback) {
    this.observerCallbacks.push(callback);

    return () => {
      const index = this.observerCallbacks.indexOf(callback);

      if (index >= 0) {
        this.observerCallbacks.splice(index, 1);
      }
    };
  }

  signOut() {}

  signInWithEmailAndPassword() {}

  createUserWithEmailAndPassword() {}

  changeState() {
    //this.observerCallbacks.forEach((callback) => {
    //  //callback.state();
    //});
  }
}
