var assert = require('chai').assert;

export class Plan {
  constructor (count, done) {
    this.done = done;
    this.count = count;
  }

  ok () {
    if (this.count === 0) {
      assert(false, 'Too many assertions called');
    } else {
      this.count--;
    }
    if (this.count === 0) {
      this.done();
    }
  }
}
