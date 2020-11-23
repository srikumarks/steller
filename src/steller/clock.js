//
// ## Clock
//
// A clock type that can keep track of absolute time
// as well as a rate-integrated relative time.
//
// [t1,t2] is the absolute time interval,
// [t1r,t2r] is the rate integrated time interval,
// dt is the absolute time step for scheduler tick. 'dt' is
// expected to remain a constant.
//
// The 'rate' property can be anything that supports
// the 'valueOf()' protocol.
//
function Clock(t, tr, dt, rate) {
    this.dt = dt;
    this.t1 = t;
    this.t2 = t + dt;
    this.t1r = tr;
    this.t2r = tr + rate.valueOf() * dt;
    this.rate = rate;

    // Keep an arbitrary data slot for use by scheduler tasks.  Each "track"
    // inherits this "data" field from the track that spawned/forked it.
    // The field is copied via prototypal inheritance using
    // `Object.create()`, so each track can treat "data" as though it owns it
    // and add and change properties. However, note that the "virtual copy"
    // isn't a deep copy, so modifying an object held in the data object
    // (ex: `data.arr[3]`) is likely to affect all tracks that can access
    // that object. You can override how data is copied by overriding a
    // clock's copy() method.
    this.data = null;

    // If this clock is derived by copying another clock, then the
    // parent field is set to the parent clock.
    this.parent = null;

    return this;
}

// A function for rounding time in seconds up to millisecond precision.
function ms(t) {
    return Math.round(t * 1000) / 1000;
}

// Convenience method to show the state of a clock object.
Clock.prototype.toString = function () {
    return JSON.stringify(
        [this.t1r, this.t2r - this.t1r, this.t1, this.t2 - this.t1].map(ms)
    );
};

// Makes a copy such that the absolute and rate-integrated
// times both match and the "data" field is "inherited".
Clock.prototype.copy = function () {
    var c = new Clock(this.t1, this.t1r, this.dt, this.rate);
    if (this.data) {
        c.data = Object.create(this.data);
    }
    c.parent = this;
    return c;
};

// Advances the absolute time interval by dt. Doesn't touch the
// rate integrated time. It is in general desirable to keep
// the rate integrated time continuous.
Clock.prototype.advance = function (dt) {
    this.t1 += dt;
    this.t2 += dt;
    return this;
};

// Advances the absolute time interval by dt = t - clock.t1. Doesn't
// touch the rate integrated time. It is in general desirable to keep
// the rate integrated time continuous.
Clock.prototype.advanceTo = function (t) {
    return this.advance(t - this.t1);
};

// Makes one scheduler time step. This just means that t1 takes
// on the value of t2 and t2 correspondingly increments by a
// tick interval. Similarly for the rate-integrated interval.
Clock.prototype.tick = function () {
    this.t1 = this.t2;
    this.t2 += this.dt;
    this.t1r = this.t2r;
    this.t2r += this.dt * this.rate.valueOf();
    return this;
};

// Jumps the absolute time to the given time and adjusts
// the rate-integrated value according to the jump difference.
Clock.prototype.jumpTo = function (t) {
    var step_dt = t - this.t1;
    var step_dtr = step_dt * this.rate.valueOf();
    this.t1 += step_dt;
    this.t2 += step_dt;
    this.t1r += step_dtr;
    this.t2r += step_dtr;
    return this;
};

// syncWith will adjust the real time and the rate integrated
// time to sync with the given clock, but the rate will
// remain untouched and so will the time step.
Clock.prototype.syncWith = function (clock) {
    this.t1 = clock.t1;
    this.t2 = this.t1 + this.dt;
    this.t1r = clock.t1r;
    this.t2r = this.t1r + this.rate.valueOf() * this.dt;
    return this;
};

// Nudges the rate-integrated "relative" time to the given value.
// The absolute start time is also adjusted proportionally.
//
// WARNING: This needs t2r > t1r to hold.
Clock.prototype.nudgeToRel = function (tr) {
    tr = Math.max(this.t1r, tr);
    if (this.t2r > this.t1r) {
        this.t1 +=
            ((tr - this.t1r) * (this.t2 - this.t1)) / (this.t2r - this.t1r);
    }
    this.t1r = tr;
    return this;
};

// Relative time to absolute time.
Clock.prototype.rel2abs = function (rel) {
    return this.t1 + (rel - this.t1r) / this.rate.valueOf();
};

// Absolute time to relative time.
Clock.prototype.abs2rel = function (abs) {
    return this.t1r + (abs - this.t1) * this.rate.valueOf();
};

// The clock's stop() method is intended to be overridden, but
// its minimum functionality is expected to be to set the "dt"
// property to 0 to indicate that the clock is stopped. If a
// delay encounters a stopped clock, it will not schedule itself
// and so will effectively be terminated. You can override the
// stop behaviour of a clock by setting a custom `stop()` method,
// which can do anything it wants, but it MUST set dt to 0 for the
// clock to actually stop.
Clock.prototype.stop = function () {
    this.dt = 0;
    return this;
};

// Whether a clock is stopped depends on its own dt as
// well as its parent's dt.
//
// WARNING: Potentially inefficient call.
Clock.prototype.isStopped = function () {
    return this.dt === 0 || (this.parent && this.parent.isStopped());
};

module.exports = Clock;
