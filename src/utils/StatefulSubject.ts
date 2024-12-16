import { Subject } from "rxjs";

export type Subscription = {
  unsubscribe: () => void;
};

export default class StatefulSubject<T> extends Subject<T> {
  state: T;
  constructor(defaultState) {
    super();
    this.state = defaultState;
  }

  next(value) {
    this.state = value;
    return super.next(value);
  }

  getState() {
    return this.state;
  }
}
