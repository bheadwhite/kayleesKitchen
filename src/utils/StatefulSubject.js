import { Subject } from "rxjs"

export default class StatefulSubject extends Subject {
  constructor(defaultState) {
    super()
    this.state = defaultState
  }

  next(value) {
    this.state = value
    return super.next(value)
  }

  getState() {
    return this.state
  }
}
