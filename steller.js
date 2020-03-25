(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.steller = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],2:[function(require,module,exports){
(function (setImmediate,clearImmediate){
var nextTick = require('process/browser.js').nextTick;
var apply = Function.prototype.apply;
var slice = Array.prototype.slice;
var immediateIds = {};
var nextImmediateId = 0;

// DOM APIs, for completeness

exports.setTimeout = function() {
  return new Timeout(apply.call(setTimeout, window, arguments), clearTimeout);
};
exports.setInterval = function() {
  return new Timeout(apply.call(setInterval, window, arguments), clearInterval);
};
exports.clearTimeout =
exports.clearInterval = function(timeout) { timeout.close(); };

function Timeout(id, clearFn) {
  this._id = id;
  this._clearFn = clearFn;
}
Timeout.prototype.unref = Timeout.prototype.ref = function() {};
Timeout.prototype.close = function() {
  this._clearFn.call(window, this._id);
};

// Does not start the time, just sets up the members needed.
exports.enroll = function(item, msecs) {
  clearTimeout(item._idleTimeoutId);
  item._idleTimeout = msecs;
};

exports.unenroll = function(item) {
  clearTimeout(item._idleTimeoutId);
  item._idleTimeout = -1;
};

exports._unrefActive = exports.active = function(item) {
  clearTimeout(item._idleTimeoutId);

  var msecs = item._idleTimeout;
  if (msecs >= 0) {
    item._idleTimeoutId = setTimeout(function onTimeout() {
      if (item._onTimeout)
        item._onTimeout();
    }, msecs);
  }
};

// That's not how node.js implements it but the exposed api is the same.
exports.setImmediate = typeof setImmediate === "function" ? setImmediate : function(fn) {
  var id = nextImmediateId++;
  var args = arguments.length < 2 ? false : slice.call(arguments, 1);

  immediateIds[id] = true;

  nextTick(function onNextTick() {
    if (immediateIds[id]) {
      // fn.call() is faster so we optimize for the common use-case
      // @see http://jsperf.com/call-apply-segu
      if (args) {
        fn.apply(null, args);
      } else {
        fn.call(null);
      }
      // Prevent ids from leaking
      exports.clearImmediate(id);
    }
  });

  return id;
};

exports.clearImmediate = typeof clearImmediate === "function" ? clearImmediate : function(id) {
  delete immediateIds[id];
};
}).call(this,require("timers").setImmediate,require("timers").clearImmediate)
},{"process/browser.js":1,"timers":2}],3:[function(require,module,exports){
// Copyright (c) 2012 National University of Singapore
// Inquiries: director@anclab.org
// Author: Srikumar K. S. (http://github.com/srikumarks)
//
// #### License
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Lesser General Public License as published by
// the Free Software Foundation, either version 2 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/lgpl.html>.

// ## Introduction
//
// The [Web Audio API] provides facilities for generating and processing sounds
// within a browser using Javascript. It has already seen wide adoption and is
// shipping in Chrome and Safari 6. It provides the basic modules necessary for
// building intuitive sound models, but leaves further abstraction to developers.
// [Steller] is an set of basic tools for building such re-usable sound models
// that co-operate with the Web Audio API.
// 
// We want to be able to build abstract "sound models" with intuitive parameters
// for controlling them. The basic characteristics of sound models that we're
// looking at are the following -
// 
// 1. Sound models generate sound though one or more outputs. They may optionally
//    process input sounds as well, in which case they are sound *transformation*
//    models.
// 
// 2. They have parameters that control the generation or transformation in real
//    time. The animation of these parameters can be coordinated precisely.
// 
// 3. Sound models may use other sound models internally. This lets us build more
//    complex models out simpler ones and encapsulate them. A useful design
//    principle is to make the interfaces of sound models to be static and keep
//    all dynamic aspects internal to it.
//
// [AudioNode]: https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/specification.html#AudioNode-section
// [Web Audio API]: https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/specification.html
// [Steller]: https://raw.github.com/srikumarks/jsaSound/master/steller_api/steller.js 
// 
// ## Design ##
// 
// [Steller] realizes the important aspects of sound models mentioned above using
// the `GraphNode` object transformer and `Param` objects. `GraphNode` can impart
// node-like behaviour to an object. `Param` objects can be animated, watched and shared.
// Therefore a "base" sound model is an `Eventable GraphNode`.
// 
// We also need the ability to schedule these sounds. This facility is needed both
// for internal use by sound models as well as for the sound model user. This
// need arises from the fact that we want sound models to be compositional - i.e.
// a sound model can be the "user" of another sound model. The `Scheduler` is an
// orthogonal component that serves this purpose.
// 
// #### GraphNode
//
// The `GraphNode` encapsulates a signal processing graph and lets you use it as a
// single node in a larger graph. This way, larger graphs can be built using
// encapsulated smaller graphs. 
// 
// #### The Scheduler
// 
// A broad-stroke description of a sound model's function is that it organizes
// sounds and their processing in time. The `Scheduler`'s job is to facilitate
// that. Here is an example of using the scheduler to print "one" followed by
// "two" on the console after 3 seconds. (This shows that the scheduler isn't
// limited to performing audio activity alone.)
// 
//     // Make a new scheduler that uses the given audio 
//     // context's "currentTime" as its time base. You
//     // can also use an existing `audioContext`.
//     var audioContext = new webkitAudioContext(); 
//     var sh = new Scheduler(audioContext);
// 
//     // Start it running.
//     sh.running = true;
// 
//     // "print" makes a scheduler action that will 
//     // print the given message.
//     function print(msg) {
//         return sh.fire(function (clock) {
//             console.log(msg);
//         });
//     }
// 
//     // Using the scheduler's "track" combinator, make an 
//     // action that says "two" should follow "one" after 
//     // 3 seconds.
//     var one_and_two = sh.track( print("one")
//                               , sh.delay(3.0)
//                               , print("two") 
//                               );
// 
//     // "Play" it.
//     sh.play(one_and_two);
// 
// 
// In order to help make sound models composeable in time, the `Scheduler`
// separates the *specification* of temporal behaviour from the realization of the
// specification. This is a different design from the conventional notion of a
// scheduler whose interface is thought to be "make event E happen at time T".
// Instead, the separation of specification from realization encourages the sound
// model designer to think in terms of the temporal relationship between the sonic
// elements that play a part in its output. For example, when we want event B to
// happen DT seconds after event A, with a conventional scheduler we need to say
// "make A happen at T1 and B happen at T1+DT". What we want to do is to state the
// interval relationship between the two events and leave it to the context in
// which these two events are used to decide what T1 must be. This then lets a
// higher level sound model then say "AB must follow 1.5 seconds after C", when
// treating AB as a single unit.
// 
// The methods of the `Scheduler` object therefore create such specifications - or
// "actions" - often using other specifications. There is a single `play` function
// that realizes a given action.
// 
// The scheduler determines timing for the events using `Clock` objects. A clock
// object is passed between events that are declared to be part of a single
// temporal sequence - a.k.a. "track". The time of the clock advances as it is
// passed between consecutive events in a track. You can have multiple tracks that
// can be `spawn`ed or `fork`ed to run in parallel. Each such parallel track gets
// its own clock object, which enables such tracks to have their own timing
// characteristics. 


// # The Steller API
//
// With the above summary, we move on to the specifics of the Steller API.
// To start with, the Steller API is exposed as a global "package" named
// `org.anclab.steller`. So, for example, you access the `GraphNode` transformer 
// as `org.anclab.steller.GraphNode`.
var GLOBAL = require('./steller/dbg'),
    nextTick = require('./steller/nexttick'),
    Eventable = require('./steller/eventable'),
    AsyncEventable = require('./steller/async_eventable'),
    GraphNode = require('./steller/graphnode'),
    Patch = require('./steller/patch'),
    Param = require('./steller/param'),
    Scheduler = require('./steller/scheduler'),
    Clock = require('./steller/clock'),
    PeriodicTimer = require('./steller/periodictimer'),
    JSNodeTimer = require('./steller/jsnodetimer'),
    UI = require('./steller/ui'),
    Util = require('./steller/util'),
    Models = require('./steller/models');

var steller = {};

//
// ## SoundModel
//
// A "sound model" is a graph node with support for parameters.
// It is also "eventable" in that you can install watchers
// for events that are "emit"ed, perhaps by internal
// processes (see Eventable).
//
// `obj` is the object to turn into a "sound model"
// 
// `inputs` is the array of graph nodes (or sound models) that constitute
// the input for this model.
//
// `outputs` is the array of graph nodes (or sound models) that constitute
// the output for this model.
//
// By making the inputs and outputs explicit, we can make
// sound models whose output can be piped through other models
// before it hits the audio context's destination.
//
// Sound models are scheduled using the Scheduler (org.anclab.steller.Scheduler)
//
function SoundModel(obj, inputs, outputs) {
    var node = Eventable(GraphNode(obj, inputs, outputs));

    // Patch connect/disconnect methods to emit events
    // after the action is complete, so that other things
    // such as UI, cleanup, whatever can react to them.
    Eventable.observe(node, 'connect');
    Eventable.observe(node, 'disconnect');

    return node;
}

steller.nextTick      = nextTick;
steller.Eventable     = Eventable;
steller.AsyncEventable  = AsyncEventable;
steller.GraphNode     = GraphNode;
steller.Patch         = Patch(steller);
steller.SoundModel    = SoundModel;
steller.Param         = Param;
steller.Scheduler     = Scheduler;
steller.Clock         = Clock;
steller.PeriodicTimer = PeriodicTimer;
steller.JSNodeTimer   = JSNodeTimer;
steller.UI            = UI;
steller.Util          = Util;

// Expose the ones that we use.
steller.requestAnimationFrame = (function (raf) {
    return function (func) {
        return raf(func);   // This is so that steller.requestAnimationFrame
        // can be called with anything as "this".
    };
}(Util.getRequestAnimationFrameFunc()));
steller.AudioContext = Util.getAudioContext();

steller.Scheduler.Models = function (sh) { Models(steller, sh); };

module.exports = steller;

},{"./steller/async_eventable":5,"./steller/clock":6,"./steller/dbg":7,"./steller/eventable":8,"./steller/graphnode":9,"./steller/jsnodetimer":10,"./steller/models":11,"./steller/nexttick":23,"./steller/param":24,"./steller/patch":25,"./steller/periodictimer":26,"./steller/scheduler":28,"./steller/ui":29,"./steller/util":30}],4:[function(require,module,exports){
/* Copyright (c) 2013, Srikumar K. S. (srikumarks@gmail.com)
 * All rights reserved.
 * 
 * Licensed under the MIT License - 
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 * Usage: 
 *
 * Include this script as <script src="http://sriku.org/lib/AudioContext.js"></script>
 * or copy-paste the code into your JS lib files to use it.
 *
 * Description:
 *
 * This replaces the browser-provided AudioContext class with a wrapper that
 * supports legacy names in newer implementations and new names in older
 * implementations. This is so that new code can run in both new and old
 * implementations and old code can run in them as well without changes.
 *
 * When you run your code with this AudioContext, you'll get deprecation
 * warnings and prompts to move your code to the newer APIs ... which will
 * be available immediately even if you're working with a dated browser
 * implementation.
 */
var GLOBAL = (function () { return this; }());

function alias(obj, oldName, newName) {
    obj[newName] = obj[newName] || obj[oldName];
    supportDeprecated(obj, oldName, newName);
}

function supportDeprecated(obj, oldName, newName) {
    var oldMethod = obj[oldName];
    obj[oldName] = function () {
        console.warn('Web Audio API: Deprecated name %s used. Use %s instead.', oldName, newName);
        obj[oldName] = oldMethod || obj[newName];
        return obj[oldName].apply(this, arguments);
    };
}

GLOBAL.AudioContext = (function (AC) {
    'use strict';

    if (!AC) {
        console.warn('Web Audio API not supported on this client.');
        return undefined;
    }

    return function AudioContext() {
        var ac, AudioParam, AudioParamOld, BufferSource, Oscillator;

        if (arguments.length === 0) {
            // Realtime audio context.
            ac = new AC;
        } else if (arguments.length === 3) {
            // Offline audio context.
            ac = new AC(arguments[0], arguments[1], arguments[2]);
        } else {
            throw new Error('Invalid instantiation of AudioContext');
        }

        alias(ac, 'createGainNode', 'createGain');
        alias(ac, 'createDelayNode', 'createDelay');
        alias(ac, 'createJavaScriptNode', 'createScriptProcessor');
        alias(ac, 'createWaveTable', 'createPeriodicWave');

        // Find out the AudioParam prototype object.
        // Some older implementations keep an additional empty
        // interface for the gain parameter.
        AudioParam = Object.getPrototypeOf(ac.createGain().gain);
        AudioParamOld = Object.getPrototypeOf(AudioParam);
        if (AudioParamOld.setValueAtTime) {
            // Checking for the presence of setValueAtTime to find whether
            // it is the right prototype class is, I expect, more robust than
            // checking whether the class name is this or that. - Kumar
            console.warn('Implementation uses extra dummy interface for AudioGainParam. This will be removed.');
            AudioParam = AudioParamOld;
        }

        alias(AudioParam, 'setTargetValueAtTime', 'setTargetAtTime');

        // For BufferSource node, we need to also account for noteGrainOn.
        BufferSource = Object.getPrototypeOf(ac.createBufferSource());
        alias(BufferSource, 'noteOff', 'stop');
        if (BufferSource.start) {
            supportDeprecated(BufferSource, 'noteOn', 'start');
            supportDeprecated(BufferSource, 'noteGrainOn', 'start');
        } else {
            console.warn('Web Audio API: Only BufferSource.note[Grain]On available. Providing BufferSource.start.');
            BufferSource.start = function start(when, offset, duration) {
                switch (arguments.length) {
                    case 1: return this.noteOn(when);
                    case 3: return this.noteGrainOn(when, offset, duration);
                    default: throw new Error('Invalid arguments to BufferSource.start');
                }
            };
            supportDeprecated(BufferSource, 'noteOn', 'start');
            supportDeprecated(BufferSource, 'noteOff', 'stop');
        }


        Oscillator = Object.getPrototypeOf(ac.createOscillator());
        alias(Oscillator, 'noteOn', 'start');
        alias(Oscillator, 'noteOff', 'stop');
        alias(Oscillator, 'setWaveTable', 'setPeriodicWave');

        return ac;
    };
}(GLOBAL.AudioContext || GLOBAL.webkitAudioContext));

GLOBAL.webkitAudioContext = function AudioContext() {
    console.warn('Use "new AudioContext" instead of "new webkitAudioContext".');
    switch (arguments.length) {
        case 0: return new GLOBAL.AudioContext();
        case 3: return new GLOBAL.AudioContext(arguments[0], arguments[1], arguments[2]);
        default: throw new Error('Invalid AudioContext creation');
    }
};

module.exports = GLOBAL.AudioContext;


},{}],5:[function(require,module,exports){
var Eventable = require('./eventable');

var kAsyncEventableKey = '__steller_async_eventable__';

// A variant of Eventable where watchers will be triggered asynchronously.
function AsyncEventable(obj) {
    obj = Eventable(obj);

    var on = obj.on;
    obj.on = function asyncOn(eventName, watcher) {
        ASSERT(arguments.length === 2);
        ASSERT(typeof(watcher) === 'function');

        if (!watcher) {
            return this;
        }

        var async = watcher[kAsyncEventableKey];

        if (!async) {
            Object.defineProperty(watcher, kAsyncEventableKey, {
                value: (async = function () {
                    var argv = arguments;
                    setTimeout(function () { watcher.apply(obj, argv); }, 0);
                }),
                    enumerable: false,
                configurable: false,
                writable: false
            });
        }

        on(eventName, async);
    };

    return obj;

}

module.exports = AsyncEventable;


},{"./eventable":8}],6:[function(require,module,exports){
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
    return JSON.stringify([this.t1r, this.t2r - this.t1r, this.t1, this.t2 - this.t1].map(ms));
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
        this.t1 += (tr - this.t1r) * (this.t2 - this.t1) / (this.t2r - this.t1r);
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

},{}],7:[function(require,module,exports){

var G = (function () { return this; }());

G.ASSERT = function () {};
G.LOG = function () {};
G.WARNIF = function () {};
G.REQUIRE = function () {};

module.exports = G;


},{}],8:[function(require,module,exports){
var validEventName = (function () {
    var dummy = {};

    return function (eventName) {
        ASSERT(typeof(eventName) == 'string');
        if (dummy[eventName]) {
            throw new Error('Invalid event name - ' + eventName);
        }
        return eventName;
    };
}());

var nextEventableWatcherID = 1;

// Backbone-like event support for objects.
// Primary methods are obj.on, obj.off and obj.emit.
// on/off manage watchers on events and emit emits them.
function Eventable(obj) {
    var watchers = {};

    // on(eventName, watcher)
    //
    // Installs the given watchers (callbacks) for the specified
    // eventName. The watchers will all be called once the event 
    // is "emit"ed. The watchers will be passed the same argument-list
    // as the emit(..) call. The "this" context is set to `obj` inside
    // a watcher call.
    function on(eventName, watcher) {
        ASSERT(arguments.length === 2);
        ASSERT(typeof(watcher) === 'function');

        var i, N;

        eventName = validEventName(eventName);

        var eventWatchers = watchers[eventName] || (watchers[eventName] = {});

        var id = watcher['__steller_eventable_id__'] || 0;

        if (id in eventWatchers) {
            return this;
        }

        if (!id) {
            Object.defineProperty(watcher, '__steller_eventable_id__', {
                value: (id = nextEventableWatcherID++),
                enumerable: false,
                configurable: false,
                writable: false
            });
        }

        eventWatchers[id] = watcher;
        return this;
    }

    // off(eventName, watcher)
    //
    // Removes given watchers from the watch list. If no
    // watchers are given, removes all watchers associated with
    // the given event.
    function off(eventName, watcher) {
        ASSERT(arguments.length >= 1 && arguments.length <= 2);

        var i, N;

        eventName = validEventName(eventName);

        var eventWatchers = watchers[eventName];

        if (!eventWatchers) {
            return this;
        }

        var wid = (watcher && watcher['__steller_eventable_id__']) || 0;

        if (wid) {
            WARNIF(!eventWatchers[wid], "Watcher not found!");
            delete eventWatchers[wid];
        } else if (!watcher) {
            // Remove all watchers on the event.
            delete watchers[eventName];
        }

        return this;
    }

    // Fires off all watchers associated with the given event.
    // Exceptions in watcher handlers are all caught and logged
    // before the emit returns. Maybe I should make the
    // callbacks happen asynchronously, but as a first implementation.
    // this is likely ok.
    function emit(eventName) {
        eventName = validEventName(eventName);

        var eventWatchers = watchers[eventName];
        if (!eventWatchers) {
            // Nothing to do.
            return this;
        }

        for (var id in eventWatchers) {
            try {
                eventWatchers[id].apply(this, arguments);
            } catch (e) {
                LOG(1, "Exception in event watcher - ", e);
            }
        }

        return this;
    }

    ASSERT(!('on' in obj));
    ASSERT(!('off' in obj));
    ASSERT(!('emit' in obj));

    obj.on = on;
    obj.off = off;
    obj.emit = emit;

    return obj;
}

// Generic function to trap a method call and emit an event when
// the method call completes.
Eventable.observe = function (obj, methodName, eventName) {
    REQUIRE(obj.emit);

    eventName = validEventName(eventName || methodName);

    var method = obj[methodName];
    REQUIRE(typeof(method) === 'function');

    obj[methodName] = function () {
        var result = method.apply(this, arguments);

        var argv = Array.prototype.slice.call(arguments);
        argv.unshift(eventName);

        this.emit.apply(this, argv);

        return result;
    };

    return obj;
};

module.exports = Eventable;

},{}],9:[function(require,module,exports){
//
// ## GraphNode
//
// Makes an object into a node that can be used in a signal
// processing graph with the Web Audio API.
// 
// node = an object that you want to quack like a node.
// inputs = array of nodes that have open inputs in the graph.
// outputs = array of nodes that have open outputs in the graph.
//
// For simplicity. I provide a "strict" version of multichannel
// support for illustration, but you may want something
// smarter with auto-fanout, auto-mixdown, etc.
//
// Note that the graphNode is compositional in nature - i.e. you can
// treat smaller node graphs as nodes in a larger nor graph, which is what 
// you want, I guess.
// 
// The above implementation has a disadvantage due to the fact that the 
// protocol for determining pins *inside* an AudioNode is not exposed. 
// Therefore you can connect the output of a wrapped node to an input of 
// a regular AudioNode, but not vice versa. However, you can wrap any
// plain AudioNode `n` using `GraphNode({}, [n], [n])` after which
// you'll have to deal with only wrapped nodes ... and all is well :)
// 
// Of course, if you're wrapping all audio nodes anyway, you're free to
// depart from the "connect" protocol and implement it any way you like :D
//

function GraphNode(node, inputs, outputs) {
    node.inputs             = inputs || [];
    node.outputs            = outputs || [];

    node.numberOfInputs     = node.inputs.length;
    node.numberOfOutputs    = node.outputs.length;
    ASSERT(node.numberOfInputs + node.numberOfOutputs > 0);

    // Get the audio context this graph is a part of.
    node.context = (node.inputs[0] && node.inputs[0].context) || (node.outputs[0] && node.outputs[0].context);
    ASSERT(node.context);

    // ### connect
    //
    // Same function signature as with the Web Audio API's [AudioNode].
    //
    // [AudioNode]: https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/specification.html#AudioNode-section
    node.connect = function (target, outIx, inIx) {
        var i, N, inPin, outPin;

        /* If the target is not specified, then it defaults to the destination node. */
        target = target || node.context.destination;

        /* Set default output pin indices to 0. */
        outIx = outIx || 0;
        inIx = inIx || 0;
        outPin = node.outputs[outIx];

        /* The "receiving pin" could be a simple AudioNode
         * instead of a wrapped one. */
        inPin = target.inputs ? target.inputs[inIx] : target;

        if (inPin.constructor.name === 'AudioParam' || inPin.constructor.name === 'AudioGain') {
            // a-rate connection.
            outPin.connect(inPin);
        } else if (inPin.numberOfInputs === outPin.numberOfOutputs) {
            for (i = 0, N = inPin.numberOfInputs; i < N; ++i) {
                outPin.connect(inPin, i, i);
            }
        } else {
            outPin.connect(inPin);
        }

        return node;
    };

    // ### disconnect
    //
    // Same function signature as with the Web Audio API's [AudioNode].
    // ... but we also support providing the pin numbers to disconnect
    // as arguments.
    //
    // [AudioNode]: https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/specification.html#AudioNode-section
    node.disconnect = function () {
        if (arguments.length > 0) {
            /* Disconnect only the output pin numbers identified in
             * the arguments list. */
            Array.prototype.forEach.call(arguments, function (n) {
                node.outputs[n].disconnect();
            });
        } else {
            /* Disconnect all output pins. This is also the 
             * behaviour of AudioNode.disconnect() */
            node.outputs.forEach(function (n) { n.disconnect(); });
        }

        return node;
    };

    // ### keep and drop
    //
    // Javascript audio nodes need to be kept around in order to prevent them
    // from being garbage collected. This is a bug in the current system and
    // `keep` and `drop` are a temporary solution to this problem. However,
    // you can also use them to keep around other nodes.

    var preservedNodes = {};
    var thisNodeID = getOrAssignNodeID(node);

    node.keep = function (childNode) {
        var theNode = childNode || node;
        var id = getOrAssignNodeID(theNode);
        preservedNodes[id] = theNode;
        return theNode;
    };

    node.drop = function (childNode) {
        if (childNode) {
            var id = getOrAssignNodeID(childNode);
            delete preservedNodes[id];
        } else {
            delete GraphNode._preservedNodes[thisNodeID];
        }
    };

    GraphNode._preservedNodes[thisNodeID] = preservedNodes;

    return node;
}

var nextNodeID = 1;
var nodeIDKey = '#org.anclab.steller.GraphNode.globalid';

function getOrAssignNodeID(node) {
    var id = node[nodeIDKey];
    if (!id) {
        id = nextNodeID++;
        Object.defineProperty(node, nodeIDKey, {
            value: id,
            writable: false,
            enumerable: false,
            configurable: false
        });
    }
    return id;
}

// Keep references to nodes that need to be explicitly preserved.
// This currently applies to JS audio nodes, because the system
// seems to throw away references to it even if it is running.
// Use the keep()/drop() methods to preserve or discard nodes.
GraphNode._preservedNodes = {};

// Takes an array of nodes and connects them up in a chain.
GraphNode.chain = function (nodes) {
    var i, N;
    for (i = 0, N = nodes.length - 1; i < N; ++i) {
        nodes[i].connect(nodes[i+1]);
    }
    return GraphNode;
};

module.exports = GraphNode;



},{}],10:[function(require,module,exports){

// ## JSNodeTimer
//
// This is a timer class with the same interface as `PeriodicTimer`, but which uses
// a `JavaScriptNode` to generate the callbacks.
var PeriodicTimer = require('./periodictimer');

function preserveNode(node) {
    (window.JSNodeTimer_jsnodes || (window.JSNodeTimer_jsnodes = [])).push(node);
}

function JSNodeTimer(callback, precision_ms, audioContext) {
    if (audioContext) {
        var kBufferSize = 1024;
        var jsnode = audioContext.createJavaScriptNode(kBufferSize);
        jsnode.onaudioprocess = function (event) {
            callback(); // For the moment, no timing information within these.
        };

        var self = this;
        var running = false;

        preserveNode(jsnode);

        self.start = function () {
            if (!running) {
                running = true;
                jsnode.connect(audioContext.destination);
            }
        };
        self.stop = function () {
            if (running) {
                jsnode.disconnect();
                running = false;
            }
        };
        self.__defineGetter__('running', function () { return running; });
        self.__defineSetter__('running', function (val) {
            if (val) {
                self.start();
            } else {
                self.stop();
            }
            return running;
        });

        // Indicate a usable compute ahead interval based on how
        // frequently the callbacks happen;
        self.computeAheadInterval_secs = (Math.round(kBufferSize * 2.5)) / audioContext.sampleRate;

        return self;
    } else {
        return PeriodicTimer.call(this, callback, precision_ms);
    }
}

module.exports = JSNodeTimer;


},{"./periodictimer":26}],11:[function(require,module,exports){
// Copyright (c) 2012 Srikumar K. S. (http://github.com/srikumarks)
// All rights reserved.
//
// #### License
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Lesser General Public License as published by
// the Free Software Foundation, either version 2 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/lgpl.html>.

// Must've loaded steller.js before this.
var chime = require('./models/chime'),
    dc = require('./models/dc'),
    noise = require('./models/noise'),
    probe = require('./models/probe'),
    mic = require('./models/mic'),
    spectrum = require('./models/spectrum'),
    load_sample = require('./models/load_sample'),
    sample = require('./models/sample'),
    jsnode = require('./models/jsnode'),
    buffer_queue = require('./models/buffer_queue'),
    hihat = require('./models/hihat');

module.exports = function maker(S, sh) {

    var models = sh.models || (sh.models = {});
    models.chime = chime(S, sh);
    models.dc = dc(S, sh);
    models.noise = noise(S, sh);
    models.probe = probe(S, sh);
    models.mic = mic(S, sh);
    models.spectrum = spectrum(S, sh);
    models.load_sample = load_sample(S, sh);
    models.sample = sample(S, sh);
    models.jsnode = jsnode(S, sh);
    models.buffer_queue = buffer_queue(S, sh);
    models.hihat = hihat(S, sh);

    return models;
};

},{"./models/buffer_queue":12,"./models/chime":13,"./models/dc":14,"./models/hihat":15,"./models/jsnode":16,"./models/load_sample":17,"./models/mic":18,"./models/noise":19,"./models/probe":20,"./models/sample":21,"./models/spectrum":22}],12:[function(require,module,exports){

// buffer_queue
//
// A model to which you can submit AudioBuffers to be played
// back in FIFO order. If you're computing audio buffers in JS,
// you can treat this as a pump. You can, for example, create
// Float32Arrays in a JS worker and pump it to the audio output
// using this queue. Also features a simple timer to get a 
// just-in-time callback to keep the queue flowing.
//
// Example code to play a sine wave -
//
/*
   var ac = new AudioContext;
   var sh = new org.anclab.steller.Scheduler(ac);
   var q = sh.models.buffer_queue();
   q.connect(ac.destination);
   q.on('low', function () {
       var phase = 0.0, dphase = 2.0 * Math.PI * 440.0 / 44100.0;
       return function (lowEvent, q) {
           var audioBuffer = q.createBuffer(1, 1024);
           var chan = audioBuffer.getChannelData(0);
           var i;
           for (i = 0; i < 1024; ++i) {
               chan[i] = 0.2 * Math.sin(phase);
               phase += dphase;
           }
           q.enqueue(audioBuffer);
       };
   }());
   q.start(ac.currentTime);
*/
//
// model.gain is a Param that controls the output gain of the queue.
// 
// model.start(time) will start the queue at the given time. You can
// start the queue only once. Subsequent calls will be a no-op.
//
// model.enqueue(audioBuffer|channelArray|Float32Array) will enqueue
// the given buffer to be played after the already enqueued buffers
// are done. If the argument is an AudioBuffer object, then it is
// added to the queue by reference and not copied for efficiency. 
// The other Float32Array based objects will first be converted 
// into an AudioBuffer before being added to the queue and therefore 
// can be reused.
//
// model.createBuffer(channels, length) is a convenience method
// for creating an AudioBuffer that uses the audio context's
// sampling rate.
//
// model.latency_secs will give the "currentTime" (according to the
// audio context) at which the next buffer submitted will begin playing.
//
// When the queue is running low and it needs some filling up, 
// it will fire a 'low' event. You can watch for this event and 
// respond by filling up the queue with more buffers. This event 
// fires just a little before the queue is about to be emptied,
// not *after* it is emptied.
module.exports = function installer(S, sh) {
    var AC = sh.audioContext;
    return function buffer_queue() {

        var output = AC.createGainNode();
        var model = S.SoundModel({}, [], [output]);

        var startTime = -1.0;
        var nextBufferTime = -1.0;
        var queue = [];
        var queueDuration = 0.0;
        var generating = false;

        model.gain = S.Param({min: -10.0, max: 10.0, audioParam: output.gain, mapping: 'log'});

        function flushQueue() {
            // Don't play buffers into the past since the engine
            // will deliver them all simultaneously.
            if (nextBufferTime < AC.currentTime) {
                nextBufferTime = AC.currentTime;
            }

            var source, nextBuffer, i;

            while (queue.length > 0) {
                source = AC.createBufferSource();
                nextBuffer = queue.shift();
                source.buffer = nextBuffer;
                source.connect(output);
                source.start(nextBufferTime);
                nextBufferTime += nextBuffer.length / AC.sampleRate; // @fixme Cumulative errors here?
            }

            queueDuration = 0.0;
        }

        function latency_secs() {
            // If not started yet, return invalid 0.0 value.
            return queueDuration + (startTime < 0.0 ? 0.0 : Math.max(0.0, nextBufferTime - AC.currentTime));
        }

        model.createBuffer = function (channels, length) {
            return AC.createBuffer(channels, length, AC.sampleRate);
        };

        model.enqueue = function (audioBuffer) {
            var queuedBuffer, i;

            if (!audioBuffer.getChannelData) {
                if (audioBuffer.constructor === Array) {
                    for (i = 0; i < audioBuffer.length; ++i) {
                        if (audioBuffer[i].length !== audioBuffer[0].length) {
                            throw new Error('steller:buffer_queue: Inconsistent channel sizes.');
                        }
                    }
                    queuedBuffer = model.createBuffer(audioBuffer.length, audioBuffer[0].length);
                    for (i = 0; i < audioBuffer.length; ++i) {
                        queuedBuffer.getChannelData(i).set(audioBuffer[i]);
                    }
                } else if (audioBuffer.constructor === Float32Array) {
                    queuedBuffer = model.createBuffer(1, audioBuffer.length);
                    queuedBuffer.getChannelData(0).set(audioBuffer);
                } else {
                    throw new Error('steller.buffer_queue: Unsupported buffer object.');
                }
            } else {
                queuedBuffer = audioBuffer;
            }

            queue.push(queuedBuffer);
            queueDuration += queuedBuffer.duration;

            if (startTime >= 0.0) {
                // Continue generation if we've been started.
                flushQueue();
                generate();
            }

            return model;
        };

        model.start = function (t) {
            if (startTime < 0.0) {
                // Not started yet. Start it.
                startTime = nextBufferTime = Math.max(t, AC.currentTime);
                generate();
            }

            return model;
        };

        model.__defineGetter__('latency_secs', latency_secs);

        model.kPrepareAheadTime_ms = 50;

        function generate() {
            if (!generating) {
                generating = true;
                schedule(onLow);
            }
        }

        function onLow() {
            generating = false;
            model.emit('low', model);
        }

        function schedule(callback) {
            var delay_ms = Math.floor(model.latency_secs * 1000);

            if (delay_ms > model.kPrepareAheadTime_ms) {
                setTimeout(callback, Math.floor(delay_ms - model.kPrepareAheadTime_ms));
            } else {
                S.nextTick(callback); // Call right away. Not enough time left.
            }
        }

        return model;
    };
};



},{}],13:[function(require,module,exports){
// The "chime" model plays a tone with an exponential decay. This component
// is designed so that it can play multiple "ting"s through the output of
// the same graph node. You may want this in some circumstances, and not in
// others and both are expressible using the Steller framework.
//
// Usage: var ch = models.chime();
//        ch.connect(models.AC.destination);
//        sh.play(ch.play(60, 1.0));
//
module.exports = function installer(S, sh) {
    var AC = sh.audioContext;

    return function chime() {
        var output = AC.createGainNode();
        var model = S.SoundModel({}, [], [output]);

        // halfLife parameter determines the amplitude decay half life (in secs) of
        // a ting at 440Hz.
        model.halfLife = S.Param({min: 0.001, max: 10, value: 0.5, mapping: 'log'});
        model.attackTime = S.Param({min: 0.001, max: 1.0, value: 0.01, mapping: 'log'});
        model.level = S.Param({min: 0.125, max: 4.0, audioParam: output.gain, mapping: 'log'});

        function trigger(clock, pitchNumber, velocity) {
            var f = S.Util.p2f(pitchNumber.valueOf());
            var osc = AC.createOscillator();
            osc.type = osc.SINE;
            osc.frequency.value = f;

            var gain = AC.createGainNode();
            gain.gain.value = 0;
            gain.gain.setValueAtTime(0, clock.t1);
            gain.gain.linearRampToValueAtTime(velocity.valueOf() / 8, clock.t1 + model.attackTime.value);

            var halfLife = model.halfLife.value * 440 / f;
            var dur = halfLife * 10;
            gain.gain.setTargetAtTime(0, clock.t1 + model.attackTime.value, halfLife);

            osc.connect(gain);
            gain.connect(output);
            osc.start(clock.t1);
            osc.stop(clock.t1 + dur);
        }

        // You can play multiple chimes all mixed into the same output gain node.
        // Note that there is no standard way to "play" or "stop" any sound model.
        // This is left open since models may need different behaviours in this
        // regard. For this model, `.play(noteNumber, velocity)` is a method that makes
        // an action meant to be passed to the scheduler.
        model.play = function (pitchNumber, velocity) {
            if (velocity === undefined) {
                velocity = 1.0;
            }
            return sh.fire(function (clock) {
                trigger(clock, pitchNumber, velocity);
            });
        };

        // While "play" triggers a tone and has zero intrinsic duration,
        // "note" lasts for the given duration.
        model.note = function (pitchNumber, duration, velocity) {
            if (velocity === undefined) {
                velocity = 1.0;
            }
            return sh.dynamic(function (clock) {
                trigger(clock, pitchNumber, velocity);
                return sh.delay(duration);
            });
        };

        return model;
    };
};


},{}],14:[function(require,module,exports){

// A DC source with a "level" parameter.
module.exports = function installer(S, sh) {

    var i, N, data, dcBuffer;
    var AC = sh.audioContext;

    // Make a 1024-sample buffer for generating dc offset values.
    // In principle you only need a one sample buffer, but Chris Rogers
    // says the webkit implementation is less efficient for the 1-sample
    // case.
    N = 1024;
    dcBuffer = AC.createBuffer(1, N, AC.sampleRate);
    data = dcBuffer.getChannelData(0);
    for (i = 0; i < N; ++i) {
        data[i] = 1.0;
    }


    return function (value) {
        var dc = AC.createBufferSource();
        dc.buffer = dcBuffer;
        dc.loop = true;
        dc.start(0);

        var gain = AC.createGainNode();
        gain.gain.value = value;
        dc.connect(gain);

        var model = S.SoundModel({}, [], [gain]);
        model.level = S.Param({min: -1.0, max: 1.0, audioParam: gain.gain});
        model.stop = function (t) {
            dc.stop(t);
        };

        return model;
    };

};


},{}],15:[function(require,module,exports){
// The "hihat" model is a direct copy paste from http://joesul.li/van/synthesizing-hi-hats/
// ... except that it is now wrapped as a graph node that can participate in
// further processing and is parameterized for easy usage without knowing
// about the web audio api much at all.
//
// Usage: var hat = sh.models.hihat().connect();
//        sh.play(sh.track([hat.hit(1.0, 0.5), hat.hit(0.5, 0.5)]));
//
//        hat.fundamental.value = 40; // The default. This is how you change it.
//        hat.bandpass.value = 10000; // Change the bandpass frequency.
//        hat.highpass.value = 7000; // Change the highpass frequency.
//        hat.level.value = 0.5; // Change the combined output level of all hihat hits.
//
module.exports = function installer(S, sh) {
    var AC = sh.audioContext;
    var ratios = [2, 3, 4.16, 5.43, 6.79, 8.21];

    return function hihat() {
        var output = AC.createGainNode();
        var model = S.SoundModel({}, [], [output]);

        model.fundamental = S.Param({min: 20.0, max: 100.0, value: 40.0, mapping: 'log'});
        model.bandpass = S.Param({min: 5000, max: 20000, value: 10000, mapping: 'log'});
        model.highpass = S.Param({min: 3500, max: 14000, value: 7000, mapping: 'log'});
        model.level = S.Param({min: 0.0, max: 10.0, audioParam: output.gain});

        function trigger(clock, velocity) {

            // The clock gives the absolute audio time to schedule this event at.
            var when = clock.t1;
            
            var vel = velocity.valueOf(); // Doing this permits velocity to be either a number or a Param.
            var dur = 0.3 * (1.0 + vel) / 2.0; // Shorten the duration for lower velocities.

            var gain = AC.createGain();
            var fundamental = model.fundamental.valueOf();

            // Bandpass
            var bandpass = AC.createBiquadFilter();
            bandpass.type = "bandpass";
            bandpass.frequency.value = model.bandpass.valueOf();

            // Highpass
            var highpass = AC.createBiquadFilter();
            highpass.type = "highpass";
            highpass.frequency.value = model.highpass.valueOf();

            // Connect the graph
            bandpass.connect(highpass);
            highpass.connect(gain);
            gain.connect(output);

            // Create the oscillators
            for (var i = 0; i < ratios.length; ++i) {
                var osc = AC.createOscillator();
                osc.type = "square";
                // Frequency is the fundamental * this oscillator's ratio
                osc.frequency.value = fundamental * ratios[i];
                osc.connect(bandpass);
                osc.start(when);
                osc.stop(when + dur);
            }

            // Define the volume envelope
            gain.gain.setValueAtTime(0.00001, when);
            gain.gain.exponentialRampToValueAtTime(1 * vel, when + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.3 * vel, when + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.00001, when + dur);
        }

        // You can play multiple chimes all mixed into the same output gain node.
        // Note that there is no standard way to "play" or "stop" any sound model.
        // This is left open since models may need different behaviours in this
        // regard. 
        model.hit = function (velocity, duration) {
            if (velocity === undefined) {
                velocity = 1.0;
            }
            return sh.dynamic(function (clock) {
                trigger(clock, velocity);
                return sh.delay(duration);
            });
        };

        return model;
    };
};


},{}],16:[function(require,module,exports){
////////////////////////////////////////////////////////
// EXPERIMENTAL javascript node wrapper
//
// The builtin Javascript Audio node is not as capable as the other
// native nodes in that it cannot have AudioParams and it only has one
// input and one output, albeit with multiple channels. 
//
// This model expands the API of the javascript audio node by giving
// it multiple single channel inputs and outputs instead and audioParams 
// that can be set and scheduled similar to other native nodes.
//
// One major limitation is that the inputs to the jsnode are limited
// to single-channel pins. This can in principle be lifted, but would
// complicate the API at the moment and is perhaps not all that useful.
// So I've decided to live with the single-channel restriction for the 
// moment.
//
// var jsn = models.jsnode({
//      numberOfInputs: 4,
//      numberOfOutputs: 5,
//      bufferLength: 512,
//      audioParams: {
//          gain: 1,
//          pitch: 1.5,
//          frequencyMod: 0.5
//      },
//      onaudioprocess: function (event) {
//          // The following are all Float32Arrays you can access -
//          //      event.inputs[i]
//          //      event.outputs[i]
//          //      event.gain, 
//          //      event.pitch, 
//          //      event.frequencyMod
//          //
//          // 'this' will refer to the jsn model object within this
//          // handler. So you can access other model parameters and methods.
//
//          // Return the number of samples processed. If you 
//          // return any value that is less than the length
//          // of the output buffer passed, it is taken as a signal
//          // to end the jsnode and cleanup. This can also be used
//          // to finish stuff like a reverb tail before killing 
//          // the node. `event.samplesToStop` gives the number of
//          // samples to generate before the indicated stop time
//          // arrives. This information can be used to determine
//          // tail characteristics too.
//          return event.outputs[0].length;
//      }
// });
//
// jsn.gain.value = 0.5;
// anotherGraphNode.connect(jsn, 0, 3);
// jsn.connect(AC.destination, 2);
//      // etc.
//
// // Watch for the "ended" event to know when the node is destroyed.
// jsn.on('ended', function () { /* do something */ });
module.exports = function installer(S, sh) {
    var AC = sh.audioContext;
    return function jsnode(spec) {

        // Map inputs to merger inputs numbered [0, spec.numInputs)
        // Map params to merger inputs numbered [spec.numInputs, spec.numInputs + numParams)
        // Map outputs to splitter outputs numbered [0, spec.numOutputs)
        var numParams = spec.audioParams ? Object.keys(spec.audioParams).length : 0;
        var numberOfInputs = spec.numberOfInputs || 0;
        var numberOfOutputs = spec.numberOfOutputs || 1;
        var numInputs = numberOfInputs + numParams;
        var numOutputs = numberOfOutputs;

        ASSERT(numberOfInputs >= 0);
        ASSERT(numberOfOutputs >= 0);
        ASSERT(numOutputs > 0);

        var merger = numInputs > 0 ? AC.createChannelMerger(numInputs) : undefined;
        var splitter = numOutputs > 0 ? AC.createChannelSplitter(numOutputs) : undefined;
        var inputNodes = [];
        var i, N, node;
        for (i = 0, N = numInputs; i < N; ++i) {
            node = AC.createGainNode();
            inputNodes.push(node);
            node.connect(merger, 0, i);
        }
        var outputNodes = [];
        for (i = 0, N = numOutputs; i < N; ++i) {
            node = AC.createGainNode();
            outputNodes.push(node);
            if (splitter) {
                splitter.connect(node, i);
            }
        }
        var paramNames;
        if (spec.audioParams) {
            paramNames = Object.keys(spec.audioParams);
            ASSERT(!('inputs' in spec.audioParams));
            ASSERT(!('outputs' in spec.audioParams));
            ASSERT(!('playbackTime' in spec.audioParams));
        } else {
            paramNames = [];
        }

        // Prepare the event object that will be passed to the jsnode
        // callback. We initialize all parameters here so that the
        // hidden class of obj will not change within onaudioprocess.
        var obj = {};

        var inputs = [], outputs = [];
        obj.inputs = inputs;
        obj.outputs = outputs;
        for (i = 0, N = paramNames.length; i < N; ++i) {
            obj[paramNames[i]] = null;
        }
        obj.playbackTime = AC.currentTime;

        var hasStarted = false, hasFinished = false, startTime = 0, stopTime = Infinity;
        var autoDestroy;

        var onaudioprocess = function (event) {
            var i, N, t, t1, t2, samplesOutput = 0;

            if (hasFinished) {
                return;
            }

            var bufferLength = event.outputBuffer.length;

            t = Math.floor(AC.currentTime * AC.sampleRate);
            t1 = Math.max(t, startTime);
            t2 = t + bufferLength;

            var dt1 = t1 - t;
            var dt2 = t2 - t;

            if (t2 > t1) {
                // Prepare the buffers for access by the nested onaudioprocess handler.
                for (i = 0, N = numberOfInputs; i < N; ++i) {
                    inputs[i] = event.inputBuffer.getChannelData(i).subarray(dt1, dt2);
                }
                for (i = 0, N = numOutputs; i < N; ++i) {
                    outputs[i] = event.outputBuffer.getChannelData(i).subarray(dt1, dt2);
                }

                for (i = 0, N = paramNames.length; i < N; ++i) {
                    obj[paramNames[i]] = event.inputBuffer.getChannelData(numberOfInputs + i).subarray(dt1, dt2);
                }

                obj.playbackTime = (event.playbackTime || AC.currentTime) + dt1 / AC.sampleRate;
                obj.samplesToStop = stopTime - t1; 
                // samplesToStop gives number of samples of output remaining
                // before the node is expected to "stop". The node can,
                // however continue beyond the stop time by generating
                // more samples. It will be actually stopped only when it
                // generates fewer samples than requested, which is checked
                // using the return value. During "tail time", samplesToStop
                // will be negative.

                // Call the handler. We bypass the event object entirely since
                // there is nothing in there now that isn't present in `obj`.
                // The onaudioprocess can return the number of samples processed,
                // which is used to decide whether to continue processing the
                // sound or terminate it. If fewer samples are generated than
                // requested, then the node is stopped. This allows for some
                // tail time to follow a stoppage.
                samplesOutput = spec.onaudioprocess.call(sm, obj);
                if (samplesOutput === undefined) {
                    // If the callback doesn't have a return statement,
                    // then assume that it generates a whole buffer's worth.
                    samplesOutput = t2 - t1;
                }
            } 

            if (t1 + samplesOutput < t2) {
                LOG(1, "Finished", t2, stopTime);
                hasFinished = true;
                setTimeout(autoDestroy, Math.round(bufferLength * 1000 / AC.sampleRate));
            }
        };

        var sm = S.SoundModel({}, inputNodes, outputNodes);

        // Make a dc model to drive the gain nodes corresponding to
        // audio parameters.
        var dc = paramNames.length > 0 ? sh.models.dc(1) : undefined;
        paramNames.forEach(function (pn, i) {
            var node = inputNodes[numberOfInputs + i];
            sm[pn] = node.gain;

            // Initialize the AudioParams
            node.gain.value = spec.audioParams[pn];

            // Drive the param using the dc signal.
            dc.connect(node);

            // Make sure the user isn't shooting him/herself in
            // the foot by duplicate mentions of param names.
            ASSERT(!(paramNames[i] in obj), "Duplicate param name - ", paramNames[i]);
        });

        var kBufferLength = spec.bufferLength || 512;
        var jsn = sm.keep(AC.createScriptProcessor(kBufferLength, numInputs, Math.max(1, numOutputs)));
        merger && merger.connect(jsn); 
        jsn.onaudioprocess = onaudioprocess;
        var jsnDestination = splitter || AC.destination;

        // Takes the JSN out of the graph.
        autoDestroy = function () {
            hasFinished = true;
            jsn.disconnect();
            splitter && splitter.disconnect();
            dc && (dc.stop(0), dc.disconnect());
            merger && merger.disconnect();
            sm.drop(jsn);
            sm.emit && sm.emit('ended'); // Indicate that it's all over.
        };

        var startTimer;

        // Add start/stop methods depending on whether the node has any inputs
        // or not - i.e. on whether it is a "source node".
        sm.prepareAheadTime = 0.1; // seconds.

        // For source nodes (i.e. numberOfInputs === 0), start(t)
        // needs to be called to indicate when to begin generating audio.
        // This is needed even for processing nodes in order to avoid
        // unnecessary computation before its inputs are ready.
        sm.start = function (t) {
            if (hasStarted || hasFinished) {
                // Same constraints as other nodes.
                return;
            }

            if (t) {
                // Schedule for the future, maybe.
                var dt = (Math.max(t, AC.currentTime) - AC.currentTime);

                if (startTimer) {
                    cancelTimeout(startTimer);
                    startTimer = null;
                }

                var starter = function (t) {
                    startTime = Math.floor(t * AC.sampleRate);
                    hasStarted = true;
                    startTimer = null;
                    jsn.connect(jsnDestination);
                };

                if (dt <= sm.prepareAheadTime) {
                    starter(t);
                } else {
                    startTimer = setTimeout(starter, Math.round(1000 * (dt - sm.prepareAheadTime)), t);
                }
            } else {
                // Schedule immediately.
                hasStarted = true;
                jsn.connect(jsnDestination);
            }
        };

        // All jsnodes know how to stop. This is necessary for garbage collection.
        // Even filter nodes need to know when to stop based on when source nodes
        // that drive it are stopped.
        sm.stop = function (t) {
            // A start has been scheduled or already running.
            if (hasFinished) {
                // Nothing to do.
                return;
            }

            stopTime = Math.max(startTime, Math.ceil(t * AC.sampleRate));
        };

        if (numberOfInputs > 0) {
            // Not a source node.
            // Cannot assume that start will be called.
            // Need to call it right away.
            sm.start(0);
        }

        return sm;
    };
};



},{}],17:[function(require,module,exports){
module.exports = function installer(S, sh) {
    var AC = sh.audioContext;

    // A simple wrapper to get a decoded buffer.
    var sampleCache = {};
    function sampleKey(url) { return 'sound:' + url; }

    var load_sample = function (url, callback, errback) {
        var key = sampleKey(url);
        var buff = sampleCache[key];
        if (buff) {
            if (callback) {
                callback(buff);
            }
            return buff;
        } else if (callback) {
            var xhr = new XMLHttpRequest();

            xhr.open('GET', url, true);
            xhr.responseType = 'arraybuffer';
            xhr.onerror = function (e) {

                ERROR(e);
                if (errback) {
                    errback(e, url);
                }
            };
            xhr.onload = function () {
                AC.decodeAudioData(xhr.response, 
                        function (buff) {
                            callback(sampleCache[key] = buff);
                            LOG(0, "Sound [" + url + "] loaded!");
                        },
                        function (err) {
                            ERROR("Sound [" + url + "] failed to decode.");
                            if (errback) {
                                errback(err, url);
                            }
                        });
            };
            xhr.send();
        }
        return undefined;
    };

    // Clears the sample cache to release resources.
    load_sample.clearCache = function () {
        sampleCache = {};
    };

    return load_sample;
};

       

},{}],18:[function(require,module,exports){
// mic support
//
// Has a single output that serves up the audio stream coming
// from the computer's microphone. Since setting up the microphone
// needs async calls, the constructed model exposes a 'ready'
// parameter that you can watch to determine when the mic is ready.
//
// If the ready parameter is -1, it means mic is not supported or
// some error occurred. If it is +1, then all systems are a go. It
// remains at 0 during initialization.
//
// Under normal circumstances, you can write code pretending that
// the user will grant mic input and setup all the graphs you need,
// ignoring `ready` status. Then when mic input is available, it
// will automatically flow through the graph you've setup. This is
// because the mic model exposes its output immediately as a gain node.
// If you ignore ready, then lack of permission to access the mic will
// be equivalent to a mic input that generates pure silence.
//
// Minimal code sample -
//
//      var models = org.anclab.steller.Models(sh);
//      var mic = models.mic();
//      mic.connect(sh.audioContext.destination); // .. or wherever.
//
//      // If you want...
//      mic.ready.watch(function (status) {
//          if (status === -1) {
//              alert('Mic input access not granted. ' + mic.error);
//          } else {
//              ASSERT(status === 1);
//          }
//      });
module.exports = function installer(S, sh) {
    let AC = sh.audioContext;

    let audioConstraints = {
        audio: {
            latency: {min: 0.0, max: 0.05, ideal: 0.015},
            echoCancellation: false,
            autoGainControl: false,
            noiseSuppression: false
        }
    };

    function getUserMedia(dictionary, callback, errback) {
        try {
            navigator.mediaDevices.getUserMedia(dictionary).then(callback).catch(errback);
        } catch (e) {
            errback(e);
        }
    }

    function setupMic(micModel) {
        if (!micModel.source && micModel.stream) {
            micModel.source = AC.createMediaStreamSource(micModel.stream);
        }

        if (!micModel.source) {
            throw new Error('Mic source not initialized');
        }

        micModel.source.connect(micModel.outputs[0]);
        micModel.error = null;
        let settings = micModel.stream.getAudioTracks()[0].getSettings();
        micModel.latency_secs = settings.latency || undefined;  // Latency may not be available,
                                                                // in which case we mark it as
                                                                // undefined.
        micModel.ready.value = 1;
    }

    function mic(options) {
        var micOut = AC.createGainNode();
        var micModel = S.SoundModel({}, [], [micOut]);

        micModel.stream = null; // This is the stream attached to the source node.
        micModel.source = null; // This is the stream source node.

        // 'ready' parameter = 1 indicates availability of mic,
        // -1 indicates error (in which case you can look at micModel.error)
        // and 0 indicates initialization in progress.
        micModel.ready = S.Param({min: -1, max: 1, value: 0});

        // Expose a gain parameter so different parts of the graph can use
        // different gains.
        micModel.gain = S.Param({min: 0, max: 1, audioParam: micOut.gain});

        // A model to stop the mic before proceeding.
        micModel.stop = function (sh, clock, next) {
            if (micModel.source) {
                micModel.source.mediaStream.getAudioTracks()[0].stop();
                micModel.source.disconnect();
                micModel.source = null;
                micModel.ready.value = 0;
            }
            next(sh, clock, sh.stop);
        };

        // A model which will continue only when mic request either succeeds
        // or fails. Failure can be detected by examining the .ready.value
        // property, which will be 0 if the request failed.
        micModel.start = function (sh, clock, next) {
            if (micModel.source) {
                // We're ready already.
                next(sh, clock, sh.stop);
            } else if (micModel.stream) {
                setupMic(micModel);
                next(sh, clock, sh.stop);
            } else {
                // We turn off autoGainControl and such automatic processing 
                // available with some systems because they generally play havoc
                // with musical intentions.
                getUserMedia(audioConstraints,
                    function (stream) {
                        if (stream) {
                            micModel.stream = stream;
                            micModel.start(sh, clock, next);
                        } else {
                            next(sh, clock, sh.stop);
                        }
                    },
                    function (e) {
                        micModel.error = e;
                        micModel.gain.value = 0; // Mute it.
                        micModel.ready.value = -1;
                        console.error(e);
                        next(sh, clock, sh.stop);
                    });
            }
        };

        // Start by default, but if an option to suppress start is
        // given, respect that.
        if (!(options && options.dontStart)) {
            sh.play(micModel.start);
        }

        return micModel;
    }

    return mic;
};



},{}],19:[function(require,module,exports){

// A simple noise model. Makes a noise source
// that you can pipe to anywhere.
//
// Parameters = "spread" and "mean".
module.exports = function installer(S, sh) {
    var AC = sh.audioContext;

    // Make a 5 second noise buffer (used in Chris Wilson's vocoder).
    // This ought to be enough randomness for audio.
    var noiseBuffer = AC.createBuffer(1, 5 * AC.sampleRate, AC.sampleRate);
    var i, N, data = noiseBuffer.getChannelData(0);
    for (i = 0, N = data.length; i < N; ++i) {
        data[i] = 2 * Math.random() - 1;
    }

    return function noise() {
        var source = AC.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;
        source.gain.value = 1.0;

        var gain = AC.createGainNode();
        gain.gain.value = 1.0;

        source.connect(gain);
        source.start(0);

        var dc = models.dc(0);
        dc.connect(gain);

        var model = S.SoundModel({}, [], [gain]);
        model.spread = S.Param({min: 0.01, max: 10.0, audioParam: source.gain, mapping: 'log'});
        model.mean = dc.level;

        return model;
    };

};



},{}],20:[function(require,module,exports){

// Connect any single channel output to the input of this and read off
// mean signal value via the "mean" param. Also has a "sigma" param for the
// standard deviation. Note that if you want to know when mean or
// sigma change, you can 'watch' the params. This model has no
// outputs.
module.exports = function installer(S, sh) {
    var AC = sh.audioContext;
    return function probe() {

        var mean = S.Param({min: -1, max: 1, value: 0});
        var sigma = S.Param({min: -1, max: 1, value: 1});
        var energy = S.Param({min: 0, max: 1, value: 0});

        var js = AC.createScriptProcessor(512, 1, 1);
        var sum = 0, sumSq = 0, k = 1 - Math.exp(Math.log(0.5) / 1024);

        js.onaudioprocess = function (e) {
            var b = e.inputBuffer.getChannelData(0);
            var N = b.length, i = 0, v = 0;
            for (i = 0; i < N; ++i) {
                v = b[i];
                sum += k * (v - sum);
                sumSq += k * (v * v - sumSq);
            }

            mean.value = sum;
            energy.value = sumSq;
            sigma.value = Math.sqrt(Math.max(0, sumSq - sum * sum));
        };

        js.connect(AC.destination); // TODO: FIXME: Is this necessary?

        var model = S.SoundModel({}, [js], []);
        model.mean = mean;
        model.sigma = sigma;
        model.energy = energy;

        return model;
    };

};


},{}],21:[function(require,module,exports){
module.exports = function installer(S, sh) {
    var AC = sh.audioContext;

    // A simple "load and play sample" model that will load the given url when
    // the .load action is run, and can play the sound from start to finish.
    // Creating multiple sample models from the same URL will not incur
    // repeated loads and decodes. This is useful when the same sound is being
    // used for different purposes and you want different levels and attack
    // times on those occasions.
    //
    // Code to load and play a sound from a url -
    //      var theSound = models.sample(url);
    //      theSound.connect(models.AC.destination);
    //      sh.play(theSound.play);
    //
    // The above will play immediately if url was already loaded. "play" can be
    // run multiple times for the same sound object and all the resultant sounds
    // will be mixed through the sound's output.
    //
    // An optional second `errback` function argument can be supplied to `sample`.
    // This function will be called if the load or decode fails for some reason.
    //
    //      `theSound.load` will load the sound if not loaded already before continuing.
    //      `theSound.trigger(velocity)` is an action to play a loaded sound like drum hit.
    //          velocity is in the range [0,1.0]. The sound is always played at rate 1.0.
    //      `theSound.play` will play the sound from start to finish and will respond to
    //          the clock's rate control. The sound will first be loaded if not loaded 
    //          already.
    //      `theSound.note(pitch, startOffset, duration, activeDur)` will play the sound
    //          starting from the given offset, lasting for the given duration, with the
    //          sound switching into release after `activeDur`. `pitch` is a live rate 
    //          factor control.
    var sample = function (url, errback) {
        var level = AC.createGainNode();
        level.gain.value = 0.25;

        var model = S.SoundModel({}, [], [level]);
        model.level = S.Param({min: 0.001, max: 10, audioParam: level.gain, mapping: 'log'});
        model.attackTime = S.Param({min: 0.001, max: 10.0, value: 0.02, mapping: 'log'});
        model.releaseTime = S.Param({min: 0.001, max: 10.0, value: 0.1, mapping: 'log'});

        var soundBuff;

        // A scheduler task that will continue once loading completes.
        // You don't need to use this if you're using the .play action
        // because that will load it automatically. You may want to use
        // this if you wish to manage sound loads separately.
        model.load = function (sched, clock, next) {
            if (soundBuff) {
                // Already loaded. This load call is a no-op.
                sched.perform(next, clock, sched.stop);
            } else {
                var dt = clock.t1 - AC.currentTime;
                sh.models.load_sample(
                        url,
                        function (buff) {
                            soundBuff = buff;
                            model.duration = soundBuff.duration;
                            sched.perform(next, clock.jumpTo(AC.currentTime + dt), sched.stop);
                        },
                        errback
                        );
            }
        };

        function trigger(clock, rate, velocity, sampleOffset, sampleDuration) {
            ASSERT(soundBuff); // Must be loaded already.

            var source = AC.createBufferSource();
            source.buffer = soundBuff;
            source.connect(level);
            source.playbackRate.value = rate;
            source.gain.setValueAtTime(0, clock.t1);
            source.gain.setTargetAtTime(velocity, clock.t1, model.attackTime.value / 3);
            if (arguments.length > 3) {
                source.noteGrainOn(clock.t1, sampleOffset, (arguments.length > 4 ? sampleDuration : source.duration));
            } else {
                source.noteOn(clock.t1);
            }
            return source;
        }

        // Triggers the sound and forgets about it. This is good for drum hits.
        // Make sure sound is loaded first before performing trigger. If you pass
        // a parameter for the velocity, then you can control the velocity of a
        // single trigger action by varying the parameter.
        model.trigger = function (velocity, detune_semitones) {
            // Play triggered sounds at normal rate by default.
            detune_semitones = detune_semitones || 0.0; 
            return sh.fire(function (clock) {
                var rate = Math.pow(2, detune_semitones.valueOf() / 12);
                trigger(clock, rate, velocity.valueOf());
            });
        };

        // Plays the sound from start to finish. Plays immediately if sound is already loaded.
        // Responds to rate changes of the clock (likely to be not precise).
        model.play = sh.track([ 
                model.load, // Ensure the sound is loaded.
                sh.dynamic(function (clock) {
                    var source = trigger(clock, clock.rate.valueOf(), 1.0);

                    return sh.delay(model.duration, function (clock) {
                        source.playbackRate.value = clock.rate.valueOf();
                    });
                })
                ]);

        // Plays the sample as a "note" of a specific duration.  Assumes that
        // the model is already loaded. The resultant voice will respond live
        // to `pitch`, which is a rate scale factor. The duration of the note
        // will be influenced by the clock rate, but (unlike `play`) the clock
        // rate will not influence the playback rate of the sound since there
        // is an explicit pitch control. The duration of the resultant note is
        // given by `duration`, while `activeDur` gives the period for which
        // the sound will actually remain active before switching into release
        // mode. It is useful to have these be separate.
        model.note = function (pitch, startOffset, duration, activeDur) {
            if (arguments.length < 4) {
                activeDur = duration;
            }
            return sh.dynamic(function (clock) {
                var source = trigger(clock, pitch.valueOf(), 1.0, startOffset, duration);
                source.gain.value = 0;
                source.gain.setTargetAtTime(1.0, clock.t1, model.attackTime.value / 3);
                source.playbackRate.setTargetAtTime(pitch.valueOf(), clock.t1, clock.dt/3);

                return sh.track([
                    sh.spawn(sh.track([
                            sh.delay(activeDur), 
                            sh.fire(function (clock) {
                                source.gain.setTargetAtTime(0.0, clock.t1, model.releaseTime.value / 3);
                                source.stop(clock.t1 + 12 * model.releaseTime.value);
                            })
                            ])),
                    sh.delay(duration, function (clock) {
                        source.playbackRate.exponentialRampToValueAtTime(pitch.valueOf(), clock.t1);
                    })
                    ]);
            });
        };

        return model;
    };

    return sample;
};

},{}],22:[function(require,module,exports){
// A simple wrapper around the realtime analyzer node that fetches the
// magnitude spectrum (converting from decibels) periodically. The optional
// argument gives the number of bins desired (the fft size is double this).
// The bin count defaults to 1024 if unspecified.
//
// .bins is a Float32Array that will be kept updated with the power spectrum.
// .freqs is a constant Float32Array containing the frequency value of each bin.
// .time is a parameter whose value gives the time at which the spectrum was grabbed last.
//      You can 'watch' this parameter to be notified of each grab.
//
// You must run the .start action to start grabbing. You can stop 
// using the .stop action.
module.exports = function installer(S, sh) {
    var AC = sh.audioContext;
    return function spectrum(N, smoothingFactor) {
        N = N || 1024;

        var analyser = AC.createAnalyser();
        analyser.fftSize = N * 2;
        analyser.frequencyBinCount = N;
        analyser.smoothingTimeConstant = arguments.length < 2 ? 0.1 : smoothingFactor;
        // Note that the analyser doesn't need to be connected to AC.destination.

        var model = S.SoundModel({}, [analyser], []);
        model.bins = new Float32Array(N);
        model.freqs = new Float32Array(N);
        model.time = S.Param({min: 0, max: 1e9, value: 0});

        // Compute the frequencies of the bins.
        for (var i = 0; i < N; ++i) {
            model.freqs[i] = i * AC.sampleRate / analyser.fftSize;
        }

        var grabRequest;

        function update() {
            if (grabRequest) {
                var ts = AC.currentTime;
                analyser.getFloatFrequencyData(model.bins);

                // Convert from decibels to power.
                for (var i = 0, bins = model.bins, N = bins.length; i < N; ++i) {
                    bins[i] = Math.pow(10, bins[i] / 20);
                }

                grabRequest = S.requestAnimationFrame(update);

                // Update the time stamp. If there are watchers installed
                // on model.time, they'll now be notified of the frame grab.
                model.time.value = ts;
            }
        }

        model.start = sh.fire(function () {
            if (!grabRequest) {
                grabRequest = S.requestAnimationFrame(update);
            }
        });

        model.stop = sh.fire(function () {
            grabRequest = undefined;
        });

        return model;
    };
};



},{}],23:[function(require,module,exports){
(function (process,setImmediate){
// nextTick function largely taken from Q.js by kriskowal.
//  repo: https://github.com/kriskowal/q
//  file: q.js
//
// The "new Image()" hack is from - http://www.nonblocking.io/2011/06/windownexttick.html
// Whoa! The original source of that hack is JSDeferred - https://github.com/cho45/jsdeferred
//
// Use the fastest possible means to execute a task in a future turn
// of the event loop.

var nextTick = (function () {
    if (typeof process !== "undefined" && typeof process.nextTick === 'function') {
        // node
        return process.nextTick;
    } else if (typeof setImmediate === "function") {
        // In IE10, or use https://github.com/NobleJS/setImmediate
        return setImmediate;
    } else if (typeof MessageChannel !== "undefined") {
        // modern browsers
        // http://www.nonblocking.io/2011/06/windownexttick.html
        var channel = new MessageChannel();
        // linked list of tasks (single, with head node)
        var head = {}, tail = head;
        channel.port1.onmessage = function () {
            head = head.next;
            var task = head.task;
            delete head.task;
            task();
        };
        return function (task) {
            tail = tail.next = {task: task};
            channel.port2.postMessage(0);
        };
    } else if (typeof Image !== 'undefined') {
        // Fast hack for not so modern browsers.
        return function (task) {
            var img = new Image();
            img.onerror = task;
            img.src = 'data:image/png,' + Math.random();
        };
    } else {
        // Worst case.
        return function (task) {
            return setTimeout(task, 0);
        };
    }
}());

module.exports = nextTick;



}).call(this,require('_process'),require("timers").setImmediate)
},{"_process":1,"timers":2}],24:[function(require,module,exports){
//
// Param(spec)
//
// A "class" that reifies a model parameter as an independent object.
// You create a parameter like this -
//      model.paramName = Param({min: 0, max: 1, value: 0.5});
//      model.paramName = Param({min: 0, max: 1, audioParam: anAudioParam});
//      model.paramName = Param({min: 0, max: 1, getter: g, setter: s});
//      model.paramName = Param({options: ["one", "two", "three"], value: "one"});
//
// You can use Param.names(model) to get the exposed parameter names.
//
// You can get and set the value of a parameter like this -
//      model.paramName.value = 5;
//
// You can install a callback to be called when a parameter value changes -
//      model.paramName.watch(function (value, param) { ... });
//      model.paramName.unwatch(callback);
//      model.paramName.unwatch(); // Removes all callbacks.
//

function Param(spec) {
    var self = Object.create(Param.prototype);
    self.spec = spec = processOptionsParam(Object.create(spec));
    self.getter = undefined;
    self.setter = undefined;
    self.valueOf = undefined;       // Support for valueOf() protocol.
    self.audioParam = undefined;
    self.watchers = [];             // Maintain a per-parameter list of watchers.
    self._value = undefined;

    // Initialization.
    if (spec.audioParam) {
        self.audioParam = spec.audioParam;
        self.getter = spec.getter || Param.getters.audioParam;
        self.setter = spec.setter || Param.setters.audioParam;
    } else if (spec.options) {
        self.getter = spec.getter || Param.getters.value;
        self.setter = spec.setter || Param.setters.option;
    } else {
        self.getter = spec.getter || Param.getters.value;
        self.setter = spec.setter || Param.setters.value;
    }

    self.valueOf = self.getter;

    if ('value' in spec) {
        self.setter(spec.value);
    }

    return self;
}

// Take care of enumeration or "options" parameters.
function processOptionsParam(spec) {
    if (spec.options) {
        var hash = {};
        spec.options.forEach(function (o, i) {
            hash['option:' + o] = i + 1;
        });

        // Set a limiting function that validates the
        // value being assigned to the parameter.
        spec.limit = function (val) {
            if (typeof val === 'number') {
                if (val >= 0 && val < spec.options.length) {
                    return spec.options[val];
                } 

                throw new Error('Invalid enumeration index');
            } 

            if (hash['option:' + val]) {
                return val;
            }

            throw new Error('Invalid enumeration value');
        };
    }
    return spec;
}

Param.getters = {
    value: function () {
        return this._value;
    },
    audioParam: function () {
        return this.audioParam.value;
    }
};

Param.setters = {
    value: function (v) {
        return (this._value = v);
    },
    audioParam: function (v) {
        return (this.audioParam.value = v);
    },
    option: function (v) {
        return (this._value = this.spec.limit(v));
    }
};

// Use for "mapping:" field of spec. This is not used internally at all, but
// intended for UI use.
Param.mappings = {};

// Condition: spec.max > spec.min
Param.mappings.linear = {
    fromNorm: function (p, f) {
        return p.spec.min + f * (p.spec.max - p.spec.min);
    },
    toNorm: function (p) {
        return (p.value - p.spec.min) / (p.spec.max - p.spec.min);
    }
};

// Condition: spec.max > spec.min > 0
Param.mappings.log = {
    fromNorm: function (p, f) {
        var spec = p.spec;
        var lmin = Math.log(spec.min);
        var lmax = Math.log(spec.max);
        return Math.exp(lmin + f * (lmax - lmin));
    },
    toNorm: function (p) {
        var spec = p.spec;
        var lmin = Math.log(spec.min);
        var lmax = Math.log(spec.max);
        var lval = Math.log(p.value);
        return (lval - lmin) / (lmax - lmin);
    }
};

// Returns the names of all the exposed parameters of obj.
Param.names = function (obj) {
    return Object.keys(obj).filter(function (k) {
        return obj[k] instanceof Param;
    });
};

// Exposes parameters of obj1 through obj2 as well.
// `listOfParamNames`, if given, should be an array
// of only those parameters that must be exposed.
Param.expose = function (obj1, obj2, listOfParamNames) {
    if (!listOfParamNames) {
        listOfParamNames = Param.names(obj1);
    }

    listOfParamNames.forEach(function (n) {
        WARNIF(n in obj2, "Overwriting parameter named [" + n + "] in Param.expose call.");
        obj2[n] = obj1[n];
    });

    return Param;
};

// Bind one parameter to another. p2 is expected to 
// be a parameter. If p1 is a parameter, then bind sets
// things up so that updating p1 will cause p2 to be updated
// to the same value. If p1 is just a value, then bind() simply
// assigns its value to p2 once.
//
// This is similar in functionality to param.bind(p2), except that
// it also works when p1 is not a parameter and is, say, an
// audioParam or a normal numeric value.
Param.bind = function (p1, p2, sh) {
    if (p1 instanceof Param) {
        p1.bind(p2, sh);
    } else if ('value' in p1) {
        if (sh) {
            sh.update(function () {
                p2.value = p1.value;
            });
        } else {
            p2.value = p1.value;
        }
    } else {
        if (sh) {
            sh.update(function () {
                p2.value = p1;
            });
        } else {
            p2.value = p1;
        }
    }

    return Param;
};

// To get the value of a parameter p, use p.value
Param.prototype.__defineGetter__('value', function () {
    return this.getter();
});

// To set the value of a parameter p, do 
//      p.value = v;
Param.prototype.__defineSetter__('value', function (val) {
    if (val !== this.getter()) {
        return observeParam(this, this.setter(val));
    } else {
        return val;
    }
});

function observeParam(param, val) {
    var i, N, watchers = param.watchers;
    for (i = 0, N = watchers.length; i < N; ++i) {
        watchers[i](val, param);
    }
    return val;
}

// Installs a callback that gets called whenever the parameter's
// value changes. The callback is called like this -
//      callback(value, paramObject);
Param.prototype.watch = function (callback) {
    var i, N, watchers = this.watchers;

    /* Make sure the callback isn't already installed. */
    for (i = 0, N = watchers.length; i < N; ++i) {
        if (watchers[i] === callback) {
            return this;
        }
    }

    watchers.push(callback);
    return this;
};

// Removes the given callback, or if none given removes
// all installed watchers.
Param.prototype.unwatch = function (callback) {
    var watchers = this.watchers;

    if (arguments.length < 1 || !callback) {
        /* Remove all watchers. */
        watchers.splice(0, watchers.length);
        return this;
    }

    /* Remove the installed watcher. Note that we only need
     * to check for one watcher because watch() will never 
     * add duplicates. */
    for (var i = watchers.length - 1; i >= 0; --i) {
        if (watchers[i] === callback) {
            watchers.splice(i, 1);
            return this;
        }
    }

    return this;
};

// Can call to force an observer notification.
Param.prototype.changed = function () {
    observeParam(this, this.getter());
    return this;
};

// Makes an "alias" parameter - i.e. a parameter that 
// represents the same value, but has a different name.
// The alias is constructed such that p.alias("m").alias("n")
// is equivalent to p.alias("n") - i.e. the original
// parameter is the one being aliased all the time.
Param.prototype.alias = function (name, label) {
    ASSERT(name, "Param.alias call needs name as first argument.");
    // If name is not given, no point in calling alias().

    var self = this;

    // Inherit from the original.
    var p = Object.create(self);

    // Rename it.
    p.spec = Object.create(self.spec);
    p.spec.name = name;
    if (label) {
        p.spec.label = label;
    }

    // Bind core methods to the original.
    p.getter = function () { return self.getter(); };
    p.setter = function (val) { return self.setter(val); };
    p.alias = function (name, label) { return self.alias(name, label); };

    return p;
};

// Binds a parameter to the given element's value.
// Whetever the element changes, the parameter will be updated
// and whenever the parameter is assigned, the element will also
// be updated.
//
// The "element" can be a DOM element such as a slider, or 
// anything with a '.value' that needs to be updated with the
// latest value of this parameter whenever it happens to change.
// If it is a DOM element, the parameter is setup to update to
// the value of the DOM element as well.
//
// If you pass a string for `elem`, it is taken to be a DOM
// element identifier and will be used via querySelectorAll to
// find which elements it refers to and bind to all of them.
Param.prototype.bind = function (elem, sh) {
    var param = this;
    if (elem.addEventListener) {
        var spec = param.spec;
        var mapfn = spec.mapping ? Param.mappings[spec.mapping] : Param.mappings.linear;
        var updater;

        var onchange, updateElem;
        if (elem.type === 'checkbox') {
            updater = function () {
                param.value = elem.checked ? 1 : 0;
            };

            onchange = sh ? (function () { sh.update(updater); }) : updater;

            updateElem = function (v) {
                elem.checked = v ? true : false;
            };
        } else if (elem.type === 'range') {
            updater = function () {
                param.value = mapfn.fromNorm(param, parseFloat(elem.value));
            };

            onchange = sh ? (function () { sh.update(updater); }) : updater;

            updateElem = function (v) {
                elem.value = mapfn.toNorm(param);
            };
        } else {
            throw new Error('org.anclab.steller.Param.bind: Unsupported control type - ' + elem.type);
        }

        updateElem.elem = elem;
        updateElem.unbind = function () {
            elem.removeEventListener('input', onchange);
            param.unwatch(updateElem);
        };

        elem.addEventListener('input', onchange);
        param.watch(updateElem);
        updateElem(param.value);
    } else if (typeof elem === 'string') {
        var elems = document.querySelectorAll(elem);
        var i, N;
        for (i = 0, N = elems.length; i < N; ++i) {
            this.bind(elems[i]);
        }
    } else {
        function updateValueElem(v) {
            elem.value = v;
        }

        updateValueElem.elem = elem;
        updateValueElem.unbind = function () {
            param.unwatch(updateValueElem);
        };

        param.watch(updateValueElem);
        elem.value = param.value;
    }

    return this;
};

// Removes binding to element, where `elem` is the
// same kind as for `.bind(elem)` above.
Param.prototype.unbind = function (elem) {
    if (typeof elem === 'string') {
        var elems = document.querySelectorAll(elem);
        var i, N;
        for (i = 0, N = elems.length; i < N; ++i) {
            this.unbind(elems[i]);
        }
    } else {
        var i, N, watchers = this.watchers;
        for (i = 0, N = watchers.length; i < N; ++i) {
            if (watchers[i].elem === elem) {
                watchers[i].unbind();
                return this;
            }
        }
    }

    return this;
};

module.exports = Param;

},{}],25:[function(require,module,exports){
var Eventable = require('./eventable');

module.exports = function (steller) {

    // A "patch" is a "graph node set" that helps keep track of a set of
    // connected SoundModel (or GraphNode) objects so that the network can
    // be saved and loaded across sessions. 
    //
    // nodeTypes can either be another Patch instance from which to inherit
    // model constructor definitions, or is an argument that can be passed
    // to loadDefinitions() (see below).
    //
    // TODO: Optimize the saved node set to only those that are active.
    // Also when saving as a Model, do not save any nodes that are not in
    // the path between the given input and output nodes. This includes
    // nodes from which connections come into the input nodes and nodes to
    // which connections go from the output nodes.
    function Patch(audioContext, nodeTypes) {
        this._nextID = 1;
        this._nodes = {destination: {node: audioContext.destination, setup: []}};
        this._audioContext = audioContext;
        this._constructors = {};
        audioContext.destination._patch_id = "destination";
        if (nodeTypes) {
            if (nodeTypes instanceof Patch) {
                // Take a short cut when one Patch is permitted
                // to inherit definitions from another.
                this._constructors = Object.create(nodeTypes._constructors);
            } else {
                defineNodeTypes(this, nodeTypes);
            }
        }
        return this;
    }

    // See defineNodeTypes() below.
    Patch.prototype.loadDefinitions = function (definitions) {
        defineNodeTypes(this, definitions);
    };

    // When building your node graph, always create nodes using the node
    // method of the patch you want the node to be a part of. The
    // inputs/outputs must also be created this way. Any args beyond the
    // typename argument are passed on to the constructor.
    Patch.prototype.node = function (typename) {
        var self = this;
        var argv = Array.prototype.slice.call(arguments, 1);
        var cons = self._constructors[typename];
        var nodeObj = Object.create(cons.prototype);
        nodeObj.audioContext = this._audioContext;
        var node = cons.apply(nodeObj, argv) || nodeObj;
        node.constructor = cons;
        argv.unshift(typename);
        var setup = [{fn: 'node', args: argv}]; // The first setup specifies the patch.node(..) call.
        if (!(node.on && node.off && node.emit)) {
            node = Eventable(node);
            Eventable.observe(node, 'connect');
            Eventable.observe(node, 'disconnect');
        }
        var id = self._nextID++;
        node._patch = self;
        node._patch_id = id;
        node._patch_typename = typename;
        self._nodes[id] = {node: node, setup: setup};

        // Keep track of connect/disconnect calls so they can 
        // be run again during de-serialization.
        node.on('connect', function () {
            var args = Array.prototype.slice.call(arguments, 1);
            args[0] = args[0]._patch_id;
            setup.push({fn: 'connect', args: args});
        });
        node.on('disconnect', function () {
            var args = Array.prototype.slice.call(arguments, 1);
            setup.push({fn: 'disconnect', args: args});
        });

        return node;
    };

    // You can optionally label nodes so that you can access
    // specific nodes after deserialization. The node must
    // already be a part of the patch.
    Patch.prototype.label = function (label, node) {
        console.assert(node._patch === this);
        if (this._nodes[label]) {
            console.warn('Patch.label: Existing label "' + label + '" will be redefined.');
            this._nodes[label]._patch = null;
            this._nodes[label]._patch_id = null;
        }
        if (label !== node._patch_id) {
            this._nodes[label] = this._nodes[node._patch_id];
            delete this._nodes[node._patch_id];
            this._nodes[label].setup.push(['label', label]);
            node._patch_id = label;
        }
        return node;
    };

    // Get a named node. If the label doesn't exist, undefined
    // is returned.
    Patch.prototype.get = function (label) {
        var info = this._nodes[label];
        return info && info.node;
    };

    // At any time you can serialize the graph by calling save() on the
    // node set object. The return value is not a string, but a JSON-able
    // object which you need to convert to a string by JSON.stringify().
    //
    // This is unoptimized since it serializes all nodes part of the set,
    // whereas only the nodes that are connected to the destination by
    // some path are relevant. I leave that as an exercise :)
    //
    // A second optimization is that the setup sequence can be reduced
    // depending on the existence of disconnect calls. I just keep them
    // in the same sequence for simplicity.
    Patch.prototype.save = function () {
        var self = this;
        var json = {
            type: 'Patch',
            nodes: Object.keys(self._nodes).map(function (id) {
                return {
                    id: id,
            setup: self._nodes[id].setup
                };
            })
        };
        return json;
    };

    // Serializes the Patch as a SoundModel, which can then be
    // loaded to instantiate a sound model instead of a patch.
    // To turn a patch into a SoundModel, you identify input pins
    // of component nodes that are to serve as inputs of the wrapped
    // model, output pins of component nodes that are to serve as outputs
    // of the wrapped model and the parameters of component models to expose
    // to the users of the wrapped model.
    //
    // name is a name that will be given to the sound model 
    // constructor when it is loaded into a graph node.
    //
    // inputs is an array of {node: theNode, pin: inputPinNumber}
    // outputs is an array of {node: theNode, pin: outputPinNumber}
    // params is an array of {name: paramName, node: nodeLabel, nameInNode: optionalNodeParamName} 
    // The current value of the parameters will be snapshotted into the
    // saved model.
    Patch.prototype.saveAsModel = function (name, inputs, outputs, params) {
        // Perform some basic checks on the arguments.
        // Once we do this check here, it is basically guaranteed that
        // a subsequent load() call will succeed.
        checkInputsSpec(this, inputs);
        checkOutputsSpec(this, outputs);
        checkParamsSpec(this, params);

        var self = this;
        var json = this.save();

        function encodePin(pinSpec) {
            if (pinSpec.hasOwnProperty('pin')) {
                return { node: pinSpec.node._patch_id, pin: pinSpec.pin };
            } else {
                return { node: pinSpec.node._patch_id };
            }
        }

        function encodeParam(param) {
            return {
                name: param.name,
                    node: param.node,
                    nameInNode: param.nameInNode || param.name,
                    value: self._nodes[param.node][param.nameInNode || param.name].valueOf()
            };
        }

        json.type = 'SoundModel';
        json.name = name;
        json.inputs = inputs.map(encodePin);
        json.outputs = outputs.map(encodePin);
        json.params = params.map(encodeParam);

        return json;
    };

    // De-serialize a node graph from a JSON structure as produced by save() above;
    // You can load a new node set from a JSON like this -
    //      var patch = new Patch(audioContext, json);
    // or you can intake a graph into an existing patch like this -
    //      patch.load(json);
    //
    Patch.prototype.load = function (json) {
        return loaders[json.type](this, json);
    };

    /////////////////////////
    // Helpers

    // When instantiating a patch, you need to first define
    // types of nodes by associating a name with their constructor
    // of the form `function (...) { .. return aSoundModel; }`
    // You can either do this by explicitly passing a constructor
    // function and an associated name, or by passing a serialized
    // model specification as generated using saveAsModel(). In the
    // latter case, only one argument is necessary.
    //
    // A constructor function is one that produces a steller.SoundModel
    // when called like - `new ConstructorFn(args...)`, where the
    // arguments are all JSON serializable values.
    //
    // Within the constructor function, "this.audioContext" gives
    // access to the audio context within which the instantiation is
    // happening. The "this" object is expected to be enhanced 
    // by mixing in SoundModel. For example, here is a constructor
    // for a simple sine model that exposes a live controllable "freq" 
    // parameter.
    //
    //  function sine(freq) {
    //      var osc = this.audioContext.createOscillator();
    //      this.freq = steller.Param({min: 44.0, max: 4400.0, mapping: 'log', audioParam: osc.frequency, value: freq});
    //      osc.start(0);
    //      osc.connect(this.audioContext.destination);
    //      return steller.SoundModel(this, [], [osc]);
    //  }
    //  
    //  If the constructor function has a name, you can omit the
    //  first argument and only pass the function in.
    //
    function defineNodeType(self, typename, spec) {
        if (arguments.length < 3) {
            spec = arguments[1];
            typename = spec.name;
        }

        if (typeof spec === 'function') {
            self._constructors[typename] = spec;
        } else if (spec.type === 'SoundModel') {
            self._constructors[typename] = wrapModel(self, spec);
        } else {
            throw new Error('Invalid model specification type - ' + (typeof spec));
        }
    };

    // Easier to use wrapper around defineNodeType for defining multiple
    // types in one call. `specs` is either an array of serialized models
    // as produced by `saveAsModel()` or an object whose keys give the
    // type names and whose values give either constructor functions or
    // serialized models.

    function defineNodeTypes(self, specs) {
        if (specs.constructor === Array) {
            specs.forEach(function (cons) {
                defineNodeType(self, cons);
            });
        } else if (specs.constructor === Object) {
            Object.keys(specs).forEach(function (typename) {
                defineNodeType(self, typename, specs[typename]);
            });
        } else {
            throw new Error('Invalid node type collection');
        }
    };

    // Loader functions for the type types of serialized data.
    // A loader function is of the form function (aPatch, json) { ... }
    // and can return anything it wants.
    var loaders = {
        Patch: function (patch, json) {
            var idmap = {destination: "destination"};

            var idspecmap = {};
            json.nodes.forEach(function (n) { idspecmap[n.id] = n; });

            function setupNode(nodeid) {
                if (idmap[nodeid]) {
                    return patch._nodes[idmap[nodeid]].node;
                }
                var spec = idspecmap[nodeid];
                var setup = spec.setup;
                console.assert(setup[0].fn === 'node');
                var node = patch.node.apply(patch, setup[0].args);
                idmap[nodeid] = node._patch_id;
                for (var i = 1, step, args; i < setup.length; ++i) {
                    var step = setup[i];
                    if (step.fn === "connect") {
                        args = step.args.slice(0);
                        args[0] = setupNode(args[0]); // Reify the target node.
                        node.connect.apply(node, args);
                    } else if (step.fn === "disconnect") {
                        node.disconnect.apply(node, step.args);
                    } else if (step.fn === "label") {
                        patch.label(step.args[0], node);
                    }
                }
                return node;
            }

            json.nodes.forEach(function (spec) { setupNode(spec.id); });
            return patch;
        },

        SoundModel: function (patch, json) {
            return asNode(loaders.Patch(patch, json), json.inputs, json.outputs, json.params);
        }
    };


    // Takes a SoundModel type JSON object created using saveAsModel().
    //
    // The return value is a constructor function that you can use
    // with any Patch to define a new model type. The argument
    // to the constructor function is an object whose keys give 
    // parameter names and whose values give the values that the parameters
    // should be set to.
    //
    // The returned constructor has a 'json' property that contains
    // the serialized JSON form of the wrapped model.
    function wrapModel(patch, json) {
        console.assert(json.type === 'SoundModel');

        function soundModel(paramSettings) {
            var patch2 = new Patch(this.audioContext, patch); // Borrow definitions from patch.
            var model = patch2.load(soundModel.json);
            if (paramSettings) {
                Object.keys(paramSettings).forEach(function (pname) {
                    model[pname].value = paramSettings[pname];
                });
            }
            return model;
        }

        soundModel.json = json;

        return soundModel;
    };

    // Given arrays of labels that identify input and output nodes within
    // the graph set, asNode returns a SoundModel that wraps the entire 
    // subgraph. Note that asNode can itself be used within a constructor
    // function definition to load sound model definitions from a JSON
    // file, for example.
    //
    // For the specification of inputs, outputs and exposedParams
    // arguments, see Patch.prototype.saveAsModel above.
    function asNode(self, inputs, outputs, exposedParams) {

        function labelToInputNode(label) {
            var node = self._nodes[label.node].node;
            return label.hasOwnProperty('pin') ? node.inputs[label.pin] : node;
        }

        function labelToOutputNode(label) {
            var node = self._nodes[label.node].node;
            return label.hasOwnProperty('pin') ? node.outputs[label.pin] : node;
        }

        function labelToNode(label) {
            return self._nodes[label].node;
        }

        var sm = steller.SoundModel({}, inputs.map(labelToInputNode), outputs.map(labelToOutputNode));

        if (exposedParams) {
            exposedParams.forEach(function (paramID) {
                sm[paramID.name] = labelToNode(paramID.node)[paramID.nameInNode || paramID.name];
                sm[paramID.name].value = paramID.value;
            });
        }

        return sm;
    };

    function checkInputsSpec(self, inputs) {
        inputs.forEach(function (spec) {
            if (spec.constructor !== Object) {
                throw new Error('Invalid pin identifier ' + spec);
            }
            var node = spec.node;
            if (node._patch !== self) {
                throw new Error("Node doesn't belong to set.");
            }
            if (spec.hasOwnProperty('pin')) {
                if (!node.inputs[spec.pin]) {
                    throw new Error('Invalid input pin number ' + spec.pin + ' for node "' + spec.node._patch_id + '". Node has ' + node.inputs.length + ' input pins.');
                }
            }
        });
    };

    function checkOutputsSpec(self, outputs) {
        outputs.forEach(function (spec) {
            if (spec.constructor !== Object) {
                throw new Error('Invalid pin identifier ' + spec);
            }
            var node = spec.node;
            if (node._patch !== self) {
                throw new Error("Node doesn't belong to set.");
            }
            if (spec.hasOwnProperty('pin')) {
                if (!node.outputs[spec.pin]) {
                    throw new Error('Invalid output pin number ' + spec.pin + ' for node "' + spec.node._patch_id + '". Node has ' + node.outputs.length + ' output pins.');
                }
            }
        });
    };


    function checkParamsSpec(self, paramIDs) {
        paramIDs.forEach(function (pid) {
            if (pid.constructor !== Object) {
                throw new Error('Invalid parameter identifier ' + pid);
            }
            var node;
            var pname = pid.nameInNode || pid.name;
            if (!(node = self.get(pid.node))) {
                throw new Error('Invalid node label "' + pid.node + '" for parameter "' + pname + '"');
            }
            if (!node.hasOwnProperty(pname)) {
                throw new Error('Node labelled "' + pid.node + '" does not have a parameter named "' + pname + '"');
            }
        });        
    };

    return Patch;
};

},{"./eventable":8}],26:[function(require,module,exports){
//
// ## PeriodicTimer 
//
// A simple class with two methods - start() and stop().
// The given callback is called periodically. I wrote
// this class because setInterval() has **significantly* better
// callback regularity than setTimeout in node.js. You can,
// however, use this in a browser as well as in node.js as it
// can check for a browser environment and adapt the precision
// to the necessary level. Note that the *minimum* precision
// in a browser environment will be that of requestAnimationFrame
// if that API exists. Otherwise the callback will be called
// at least once every 33 ms.
//
// Here are a couple of measurements (in ms) for N callbacks 
// with dt interval for setInterval under node.js -
//      {"N":1500,"dt":10,"mean":0.13,"min":-1,"max":1,"deviation":0.34}
//      {"N":1500,"dt":10,"mean":-0.84,"min":-2,"max":0,"deviation":0.37}
// Here are two measurements for setTimeout under node.js -
//      {"N":1500,"dt":10,"mean":-850.31,"min":-1680,"max":-3,"deviation":486.16}
//      {"N":1500,"dt":10,"mean":-833.59,"min":-1676,"max":0,"deviation":479.3}
//
// There is no such difference between the two in the browser, so
// we always latch on to requestAnimationFrame if found. Here is 
// a measurement of setInterval in the browser (Chrome) - 
//      {"N":1500,"dt":10,"mean":-687.63,"min":-1381,"max":-1,"deviation":402.51}
//
var Util = require('./util');

function PeriodicTimer(callback, precision_ms) {

    var requestAnimationFrame = Util.getRequestAnimationFrameFunc();

    if (Util.detectBrowserEnv() && !requestAnimationFrame) {
        throw new Error('PeriodicTimer needs requestAnimationFrame support. Use a sufficiently modern browser.');
    }

    var self = this;
    var running = false;
    var intervalID;

    if (precision_ms === undefined) {
        precision_ms = 15; // Default to about 60fps just like requestAnimationFrame.
    } else {
        // If we're in a browser environment, no point trying to use
        // setInterval based code because the performance is as bad
        // as with setTimeout anyway -
        //      {"N":1500,"dt":10,"mean":-687.63,"min":-1381,"max":-1,"deviation":402.51}
        precision_ms = Math.min(Math.max(Util.detectBrowserEnv() ? 15 : 1, precision_ms), 33);
    }

    if (requestAnimationFrame && precision_ms >= 12) {
        self.start = function () {
            if (!running) {
                running = true;
                intervalID = requestAnimationFrame(function () {
                    if (running) {
                        intervalID = requestAnimationFrame(arguments.callee);
                        callback();
                    } else {
                        intervalID = undefined;
                    }
                });
            }
        };

        self.stop = function () {
            running = false;
            if (intervalID) {
                cancelAnimationFrame(intervalID);
                intervalID = undefined;
            }
        };
    } else {
        self.start = function () {
            if (!running) {
                running = true;
                intervalID = setInterval(callback, 1);
            }
        };

        self.stop = function () {
            if (running) {
                running = false;
                clearInterval(intervalID);
                intervalID = undefined;
            }
        };
    }

    self.__defineGetter__('running', function () { return running; });
    self.__defineSetter__('running', function (state) {
        if (state) {
            self.start();
        } else {
            self.stop();
        }
        return running;
    });

    WARNIF(precision_ms <= 5, "High precision timing used. May impact performance.");

    // Indicate a usable compute ahead interval based on how
    // frequently the callbacks happen;
    self.computeAheadInterval_secs = (Math.round(precision_ms * 3.333)) / 1000;

    return self;
}


module.exports = PeriodicTimer;


},{"./util":30}],27:[function(require,module,exports){
// A simple Queue class with the intention to minimize
// memory allocation just for the sake of queue processing.

function Queue(name) {
    var length = 0, maxLength = 4, store = [null,null,null,null], removeAt = -1, addAt = 0;


    // Add an element to the queue.
    function add(x) {
        if (length >= maxLength) {
            // Grow store
            var newStore = new Array(maxLength * 2);
            var i, j, N, M;
            for (i = removeAt, j = 0, N = length, M = maxLength; j < N; ++j, i = (i + 1) % M) {
                newStore[j] = store[i];
            }
            store = newStore;
            addAt = length;
            removeAt = length === 0 ? -1 : 0;
            maxLength *= 2;
        }

        // Add element.
        store[addAt] = x;
        if (removeAt < 0) {
            removeAt = addAt;
        }
        addAt = (addAt + 1) % maxLength;

        return this.length = length = (length + 1);
    }

    // Remove an element from the queue.
    // Throws an exception when the queue is empty.
    function remove() {
        if (length <= 0) {
            throw new Error('Empty queue');
        }

        var x = store[removeAt];
        store[removeAt] = null; // Needed for garbage collector friendliness.
        removeAt = (removeAt + 1) % maxLength;
        this.length = length = (length - 1);

        return x;
    }

    // Remove all elements. The `optFn` is a function that, if given,
    // will be invoked on all the queued elements before they're dumped
    // from the queue. You can use this to do cleanup actions. 
    //
    // WARNING: Within the optFn, you cannot call add/remove/clear of this
    // queue. Calling them will raise a "Method not available" error.
    function clear(optFn) {
        if (optFn) {
            if (typeof(optFn) !== 'function') {
                throw new Error("Queue: Argument to clear, if given, must be a function.");
            }

            // Protect against calling other methods during the
            // optFn calls.
            this.add = this.remove = this.clear = methodNotAvailable;

            for (let i = 0; i < length; ++i) {
                try {
                    if (store[i]) {
                        optFn(store[i]);
                    }
                } catch (e) {
                    // Swallow exceptions.
                    console.error("BAD PROGRAMMER ERROR: Cleanup functions for scheduler models should not throw.");
                }
            }

            this.add = add;
            this.remove = remove;
            this.clear = clear;
        }
        
        this.length = length = 0;
        store.splice(0, store.length, null, null, null, null);
        maxLength = 4;
        removeAt = -1;
        addAt = 0;
    }

    function methodNotAvailable() {
        throw new Error('Method not available');
    }

    // Length is kept up to date.
    this.length = 0;

    this.add = add;
    this.remove = remove;
    this.clear = clear;

    return this;
}

module.exports = Queue;

},{}],28:[function(require,module,exports){
var Queue = require('./queue'),
    Param = require('./param'),
    PeriodicTimer = require('./periodictimer'),
    JSNodeTimer = require('./jsnodetimer'),
    Clock = require('./clock'),
    Util = require('./util');

//
// ## Scheduler
//
// This is a scheduler for "models" .. which are functions
// of the form --
// 
//      function (sched, clock, next) {
//           // ... do something
//           next(sched, clock, sched.stop); // Go to the next one (optional).
//       }
//
// where --
// 
//   - `sched` is the scheduler object.
//   - `clock` is the clock object containing absolute and rate integrated 
//     time information for this interval.
//   - `next` is the model that is supposed to follow this one in time.
// 
// To use the scheduler, you first make an instance using "new".
//
//      var sh = new Scheduler;
//
// Then you start it running by setting the 'running' property to true.
//
//      sh.running = true;
//
// Then you can play models already. Here is something that will keep
// outputting 'fizz', 'buzz' alternately every 2 seconds.
//
//      var dur = Param({min: 0.01, max: 60, value: 2});
//      var fizzbuzz = sh.loop(sh.track([
//          sh.log('fizz'), sh.delay(dur),
//          sh.log('buzz'), sh.delay(dur)
//      ]));
//      sh.play(fizzbuzz);
// 
// Now try changing the value of the duration parameter p.dur like below
// while the fizzes and buzzes are being printed out --
//      
//      dur.value = 1
//
function Scheduler(audioContext, options) {
    /* Make sure we don't clobber the global namespace accidentally. */
    var self = (this === window ? {} : this);
    var Timer = PeriodicTimer; // or JSNodeTimer

    // We need requestAnimationFrame when scheduling visual animations.
    var requestAnimationFrame = Util.getRequestAnimationFrameFunc();

    var AudioContext = Util.getAudioContext();

    if (Util.detectBrowserEnv() && !requestAnimationFrame) {
        throw new Error('Scheduler needs requestAnimationFrame support. Use a sufficiently modern browser version.');
    }

    /* How long is an "instant"? */
    var instant_secs = 0.001;

    /* Wrap Date.now() or audioContext.currentTime as appropriate.
     * The scheduler supports both mechanisms for tracking time. */
    var time_secs = (function () {
        if (!audioContext) {
            return Util.getHighResPerfTimeFunc() || (function () { return Date.now() * 0.001; });
        } else if (audioContext.createGain || audioContext.createGainNode) {
            instant_secs = 1 / audioContext.sampleRate;
            audioContext.createGain = audioContext.createGainNode = (audioContext.createGain || audioContext.createGainNode);
            audioContext.createGainNode();  // Looks useless, but it gets the
            // audioContext.currentTime running.
            // Otherwise currentTime continues to
            // be at 0 till some API call gets made,
            // it looks like.

            return function () {
                return audioContext.currentTime;
            };
        } else {
            throw new Error("Scheduler: Argument is not an audio context");
        }
    }());


    var timer, running = false;

    // To start the scheduler, set "scheduler.running = true"
    // To stop it, set it to false.
    self.__defineGetter__('running', function () { return running; });
    self.__defineSetter__('running', function (state) {
        if (state) {
            if (!running) {
                running = true;
                mainClock.advanceTo(time_secs());
                if (playNow.activeFunc) {
                    playNow = playNow.activeFunc;
                    play = play.activeFunc;
                }
                timer.start();
            }
        } else {
            running = false;
            timer.stop();
            playNow = (function (playNow) {
                function inactivePlayNow(model) {
                    schedule(model);
                };
                inactivePlayNow.activeFunc = playNow;
                return inactivePlayNow;
            }(playNow));
            play = (function (play) {
                function inactivePlay(model) {
                    schedule(function () { play(model); });
                }
                inactivePlay.activeFunc = play;
                return inactivePlay;
            }(play));
        }
    });

    // A frame rate observer that gets updated once in a while.
    // If you want to update a display when frame rate changes,
    // add a watcher.
    self.frame_rate = Param({min: 15, max: 75, value: 60});

    // Scheduled actions are placed in an event tick queue. The queue is
    // processed on each `scheduleTick()`.  A pair of arrays used as the
    // event tick queue.  Models placed in queue are processed and the
    // resultant models scheduled go into the requeue. Then after one such
    // cycle, the variables are swapped.
    var queue = new Queue('tick');

    // The frame queue is for running visual frame calculations after
    // the normal scheduling loop has finished. This runs *every*
    // scheduleTick.
    var fqueue = new Queue('frames');

    // Update queue. This can be used to synchronize parameter changes.
    var uqueue = new Queue('update');

    // Cancels all currently running actions.
    function cancel() {
        uqueue.clear();
        queue.clear();
        fqueue.clear();
    }

    // `scheduleTick` needs to be called with good solid regularity.
    // If we're running the scheduler under node.js, it can only
    // be because MIDI is needed, which needs high precision,
    // indicated by 0. The `PeriodicTimer` and `JSNodeTimer` encapsulate
    // this timing functionality required.
    timer = new Timer(scheduleTick, 0, audioContext);

    /* Keep track of time. */
    var kFrameInterval = 1/60;
    var kFrameAdvance = kFrameInterval;
    var clockDt = timer.computeAheadInterval_secs || 0.05; // Use a 60Hz time step.
    var clockBigDt = clockDt * 5; // A larger 10Hz time step.
    var mainClock = new Clock(time_secs(), 0, clockDt, 1.0);
    var compute_upto_secs = mainClock.t1;
    var advanceDt = 0.0;

    // A simple mechanism to adjust the "frame rate". Normally, this
    // shouldn't be necessary, but given that we're operating audio and
    // visuals in the same framework, the notion of a steady frame rate is
    // needed to predict when to render stuff and how much further to
    // compute. We compute audio 3 callbacks ahead of time.
    //
    // runningFrameInterval is the low pass filtered frame interval. The
    // time constant of the filter is of the order of a second, so that
    // instantaneous changes to frame rate don't disrupt the rate for just
    // a few frames.
    var adaptFrameInterval = (function () {
        var runningFrameInterval = 1/60;
        var lastTickTime_secs = mainClock.t1;

        // Steller can periodically update the 'frame_rate' property
        // (which is actually a Param). You can watch it for changes
        // if you want.
        var frUpdateInterval = 15;
        var frUpdateCounter = frUpdateInterval;

        return function (t) {
            // Adjust the notion of frame interval if the going rate is smooth.
            var frameDt = t - lastTickTime_secs;
            if (frameDt > 0.01 && frameDt < 0.07) {
                runningFrameInterval += 0.05 * (frameDt - runningFrameInterval);
                kFrameAdvance = kFrameInterval = runningFrameInterval;
                clockDt = 3.33 * kFrameInterval;
                clockBigDt = clockDt * 5;
                if (frUpdateCounter-- <= 0) {
                    self.frame_rate.value = Math.round(1/kFrameInterval);
                    frUpdateCounter = frUpdateInterval;
                }
            }

            lastTickTime_secs = t;
        };
    }());

    /* Main scheduling work happens here.  */
    function scheduleTick() {
        var i, N, t, length, f, a, once = true;
        t = time_secs();

        adaptFrameInterval(t);

        // Determine target time up to which we need to compute.
        compute_upto_secs = t + clockDt;

        /* If lagging behind, advance time before processing models. */
        while (t - mainClock.t1 > clockBigDt) {
            advanceDt = t - mainClock.t1;
            mainClock.advance(advanceDt);
        }

        while (once || mainClock.t1 < compute_upto_secs) {
            if (uqueue.length > 0) {
                length = uqueue.length;
                for (i = 0; i < length; ++i) {
                    uqueue.remove()();
                }
            }

            // Process no more than the existing number of elements
            // in the queue. Do not process any newly added elements
            length = queue.length;

            /* Process the scheduled tickers. The tickers
             * will know to schedule themselves and for that
             * we pass them the scheduler itself.
             */
            for (i = 0; i < length; ++i) {
                queue.remove()(self, mainClock, cont);
            }

            if (mainClock.t1 < compute_upto_secs) {
                mainClock.tick();
            }

            advanceDt = 0.0;
            once = false;
        }

        if (fqueue.length > 0) {
            length = fqueue.length;

            for (i = 0; i < length; i += 2) {
                f = fqueue.remove();
                a = fqueue.remove();
                f(t, a);
            }
        }

        // Finally, if there is an ontick handler installed, we call
        // that for every tick, passing it the current time.
        if (self.ontick) {
            self.ontick(t);
        }
    }

    // Schedules the model by placing it into the processing queue.
    function schedule(model) {
        if (model) {
            queue.add(model);
        }
    }

    // Schedules a "frame computation" which will run every scheduleTick
    // regardless of how much ahead the rest of the scheduler is running.
    //
    // f is expected to be a function and will be called with no arguments.
    function scheduleFrame(f, info) {
        if (f) {
            fqueue.add(f);
            fqueue.add(info);
        }
    }

    // Makes sure f is called before the next schedule.
    function scheduleUpdate(f) {
        if (f) {
            uqueue.add(f);
        }
    }

    // ### perform
    //
    // Wraps the concept of "performing" a model so that
    // the representation of the model as a continuation 
    // is not strewn all over the place. 
    function perform(model, clock, next) {
        model(self, clock, next);
    }

    // ### clock()
    //
    // Constructs a new clock based on the main clock.
    function clock() {
        return mainClock.copy().jumpTo(time_secs());
    }

    // ### play
    //
    // Having constructed a model, you use play() to play it.
    // The playing starts immediately. See `delay` below if you want
    // the model to start playing some time in the future.
    //
    // If you construct a clock yourself, you can pass that
    // as the second argument. This will let you stop all derived
    // clocks using the clock.stop() mechanism.
    function playNow(model, optClock) {
        model(self, optClock || clock(), stop);
    }

    var play = (function () {
        if (audioContext) {
            /* waitForAudioClockStartAndPlay will play the given model only
             * after the audio clock has advanced beyond zero.  This can
             * take some time on iOS6. This is necessary for Web Audio API
             * on iOS6. Sadly, as of this writing, (22 Sep 2012), this
             * technique is sufficient only for iOS6 on iPhone4. Safari on
             * iPad doesn't work even with this wait in place. 
             */
            return function waitForAudioClockStartAndPlay(model, clock) {
                if (audioContext.currentTime === 0) {
                    setTimeout(waitForAudioClockStartAndPlay, 100, model, clock);
                } else if (clock) {
                    self.play = play = playNow;
                    playNow(model, clock);
                } else {
                    mainClock = new Clock(time_secs(), 0, clockDt, 1.0);
                    compute_upto_secs = mainClock.t1;
                    self.play = play = playNow;
                    playNow(model);
                }
            };
        } else {
            return playNow;
        }
    }());

    // ### stop
    //
    // This "model" says "stop right here, nothing more to do."
    // This is the "zero" of the algebra. No model placed after a stop
    // in a sequence will get to run.
    function stop(sched, clock, next) {
    }

    // ### cont
    //
    // This "model" just says "continue on with whatever's next".
    // This is the "one" of the algebra. Placing it anywhere in
    // a sequence has no consequence on it.
    function cont(sched, clock, next) {
        if (next) {
            next(sched, clock, stop);
        }
    }

    // ### delay
    //
    //      delay(dt)
    //      delay(dt, function (clock, t1r, t2r, startTime, endTime) {...})
    //
    // Gives a model that introduces the given amount of delay in a
    // sequence. Notice that the "valueOf" protocol on dt is used. This
    // lets us introduce fixed as well as variable delays. This is the
    // absolute *core* of the "scheduler" since it is the only function
    // which actually does something about invoking stuff at a specified
    // time! Any optimization of the scheduling loop will also involve this
    // function and, likely, this one *only*.
    //
    // Example:
    //
    //      sh.play(sh.track(sh.delay(1), model))
    //
    // Will cause the model to play after 1 second.
    //
    // If callback is provided, it will be called throughout the wait
    // period with the arguments (t1, t2, startTime, endTime) giving the
    // interval for which it is being called. Continuous parameter
    // animations can be handled using the callback, for example.
    function delay(dt, callback) {
        function delayInstance(sched, clock, next) {
            var startTime = clock.t1r;

            function tick(sched, clock) {
                // Provide a way for derived clocks to stop.
                // A derived clock will return true for isStopped()
                // if its parent is stopped. So if the derived
                // clock's stop() method is then overridden, it will
                // result in the stop actions being taken. The protocol
                // for the stop() method is that it must at least
                // set dt to 0.
                if (clock.isStopped()) {
                    clock.stop();
                    return;
                }
                
                var endTime = startTime + dt.valueOf();

                // If lagging behind, advance time before processing models.
                // If, say, the user switched tabs and got back while
                // the scheduler is locked to a delay, then all the pending
                // delays need to be advanced by exactly the same amount.
                // The way to determine this amount is to keep track of
                // the time interval between the previous call and the
                // current one. That value is guaranteed to be the same
                // for all delays active within a single scheduleTick().
                //
                // Furthermore, the delay needs to be cryo-frozen frozen
                // during the lapse and then thawed when the playback
                // resumes. This also entails adjustment of the startTime
                // and endTime so everything stays in sync. This results in
                // an adjustment of the "past" of the delay to be consistent
                // with the present and the future.
                if (advanceDt > 0.0 && clock.t1 < mainClock.t1) {
                    clock.advance(advanceDt);
                }

                if (clock.t1 > compute_upto_secs) {
                    // We're already ahead of time. Wait before
                    // computing further ahead.
                    schedule(poll);
                    return;
                }

                if (clock.t2r < endTime) {
                    if (callback) {
                        callback(clock, clock.t1r, clock.t2r, startTime, endTime);
                    }
                    clock.tick();
                    schedule(poll);
                } else {
                    if (callback && endTime >= clock.t1r) {
                        callback(clock, clock.t1r, endTime, startTime, endTime);
                    }
                    if (clock.t2r > clock.t1r) {
                        next(sched, clock.nudgeToRel(endTime), stop);
                    } else {
                        next(sched, clock, stop);
                    }
                }
            }

            function poll(sched) {
                tick(sched, clock, stop);
            }

            tick(sched, clock);
        }

        return delayInstance;
    }

    // ### seq (internal)
    //
    // The two given models will be performed in sequence.
    // When the first model ends, it will transfer control
    // to the second model. 
    //
    // Note: This is an internal combinator exposed via the
    // more convenient "track".
    function seq(model1, model2) {
        return function (sched, clock, next) {
            model1(sched, clock, seq(model2, next));
        };
    }

    // ### loop
    //
    // Here is a model that will never end. The given model
    // will be looped forever. You better have a delay in 
    // there or you'll get an infinite loop or blow the stack
    // or something like that.
    function loop(model) {
        return function looper(sched, clock, next) {
            model(sched, clock, looper);
        };
    }

    // ### loop_while(flag, model)
    //
    // Keeps executing model in a loop as long as flag.valueOf() is truthy.
    function loop_while(flag, model) {
        return function (sched, clock, next) {

            function loopWhileFlag() {
                if (flag.valueOf()) {
                    model(sched, clock, loopWhileFlag);
                } else {
                    next(sched, clock, stop);
                }
            }

            loopWhileFlag();
        };
    }

    // ### repeat(n, model)
    //
    // Produces a model that, when played, repeats the model `n` times.
    // This means that the duration of the resultant model will be
    // n times the duration of the given model (if it is a constant).
    function repeat(n, model) {
        return function (sched, clock, next) {
            var counter = 0;

            function repeatNTimes() {
                if (counter < n) {
                    counter++;
                    model(sched, clock, repeatNTimes);
                } else {
                    next(sched, clock, stop);
                }
            }

            repeatNTimes();
        };
    }

    // ### fork
    //
    // The models in the given array are spawned off simultanously.
    // When all the models finish their work, the fork will
    // continue on with whatever comes next.
    //
    //  Ex: 
    //
    //      sh.play(sh.track(sh.fork([drumpat1, drumpat2]), drumpat3));
    //
    // That will cause pat1 to be played simultaneously with pat2
    // and when both finish, pat3 will play.
    //
    // Supports both `fork(a, b, c, ..)` and `fork([a, b, c, ..])` forms.
    //
    function fork(models) {
        if (models && models.constructor === Function) {
            /* We're given the models as arguments instead of an array. */
            models = Array.prototype.slice.call(arguments, 0);
        } else {
            models = models.slice(0);
        }
        return function (sched, clock, next) {
            var syncCount = 0;
            function join(sched, clockJ) {
                syncCount++;
                if (syncCount === models.length) {
                    /* All models have finished. */
                    next(sched, clock.syncWith(clockJ), stop);
                }
            }

            /* Start off all models. */
            models.forEach(function (model) {
                model(sched, clock.copy(), join);
            });
        };
    }

    // ### spawn
    //
    // Similar to `fork`, except that the `spawn` will immediately
    // continue on with whatever is next, as though its duration
    // is zero.
    //
    // Supports both `spawn(a, b, c, ..)` and `spawn([a, b, c, ..])` forms.
    function spawn(models) {
        if (models && models.constructor === Function) {
            /* We're given the models as arguments instead of an array. */
            models = Array.prototype.slice.call(arguments, 0);
        } else {
            models = models.slice(0);
        }
        return function (sched, clock, next) {
            models.forEach(function (model) {
                model(sched, clock.copy(), stop);
            });
            next(sched, clock, stop);
        };
    }

    // ### dynamic
    //
    // A generic 'dynamic model', which determines the
    // model to use at any given time according to some
    // rule. 'dyn' is a `function (clock)` and is expected
    // to return a model, which is then scheduled. You can
    // use this, for example, to do random choices, conditional
    // choices, etc.
    function dynamic(dyn) {
        return function (sched, clock, next) {
            dyn(clock)(sched, clock, next);
        };
    }

    // ### track
    //
    // Produces a model that consists of a sequence of
    // the given models (given as an array of models).
    // 
    // `track([a,b,c,d])` is just short hand for
    // `seq(a, seq(b, seq(c, d)))`
    //
    // Supports both `track(a, b, c, ..)` and `track([a, b, c, ..])` forms.
    //
    // Note that the intermediate continuations are one-shot
    // and are not reusable for the sake of performance.
    function track(models) {
        if (models && models.constructor === Function) {
            /* We're given the models as arguments instead of an array. */
            models = Array.prototype.slice.call(arguments, 0);
        }

        function track_iter(sched, clock, next, startIndex, endIndex) {
            // The extra arguments are used by slice() to provide a playback
            // range for a given track. When the arguments are not given,
            // the whole track is played. Use track_iter.minIndex and maxIndex
            // to determine valid values for the index range.
            var i = 0, i_end = models.length;

            if (arguments.length > 3) {
                ASSERT(arguments.length === 5);
                i = startIndex;
                i_end = endIndex;
            }

            function iter(sched, clock, _) {
                if (i < i_end) {
                    models[i++](sched, clock, iter);
                } else {
                    next(sched, clock, stop);
                }
            }

            iter(sched, clock, next);
        }

        // minIndex and maxIndex give the range of possible index values
        // for the track. The range is [minIndex, maxIndex).
        track_iter.minIndex = 0;
        track_iter.maxIndex = models.length;
        track_iter.models = models;

        return track_iter;
    }

    // ### slice(aTrack, startIndex, endIndex)
    //
    // Makes an action that will play the given slice of the track.
    // The `aTrack` is created using the `track()` method.
    // The given indices are constrained by the track's index range
    // as specified by aTrack.minIndex and aTrack.maxIndex.
    // 
    // If you want control of a track or a slice *while* it is playing,
    // you need to build synchronization mechanisms into it yourself.
    // See `sync()` and `gate()`.
    function slice(aTrack, startIndex, endIndex) {
        endIndex = (arguments.length > 2 ? endIndex : aTrack.maxIndex);
        startIndex = (arguments.length > 1 ? Math.max(aTrack.minIndex, Math.min(startIndex, endIndex)) : aTrack.minIndex);
        return function (sched, clock, next) {
            aTrack(sched, clock, next, startIndex, endIndex);
        };
    }

    // ### fire
    //
    // A model that simply fires the given call at the right time, takes
    // zero duration itself and moves on.
    var fire;
    if (options && options.diagnostics) {
        LOG(4, "fire: diagnostics on");
        fire = function (callback) {
            return function (sched, clock, next) {
                var t = time_secs();
                WARNIF(clock.t1 < t, "fire: late by " + Math.round(1000 * (t - clock.t1)) + " ms");
                callback(clock);
                next(sched, clock, stop);
            };
        };
    } else {
        fire = function (callback) {
            return function (sched, clock, next) {
                callback(clock);
                next(sched, clock, stop);
            };
        };
    }

    // ### display
    //
    // Very similar to fire(), except that the given callback will be
    // called for the next visual frame. Consecutive display()s in a
    // track will result in their callbacks being bunched.
    //
    //      callback(clock, scheduledTime, currentTime)
    function display(callback) {
        return function (sched, clock, next) {
            var t1 = clock.t1;

            function show(t) { 
                if (t + kFrameAdvance > t1) {
                    callback(clock, t1, t); 
                } else {
                    // Not yet time to display it. Delay by one
                    // more frame.
                    scheduleFrame(show);
                }
            }

            scheduleFrame(show);
            next(sched, clock, stop);
        };
    }

    // ### frame
    // 
    // Similar to fire() and display(), but actually lasts one frame
    // duration.  So consecutive frame() actions in a track can be used for
    // frame by frame animation. The frame will be delayed at the time at
    // which it actually needs to be displayed. The scheduler runs
    // computations a little bit into the future so this may need the frame
    // to be delayed by a few frames. The clock will always advance by one
    // frame duration between two consecutive frames.
    //
    // Due to the "sync to time" behaviour of frame(), the very first frame
    // in a sequence may be delayed by more than one frame. Subsequent
    // frames will occur (typically) with a single frame delay.
    //
    // The callback will receive a clock whose `t1` field is exactly the
    // same as the current time.
    function frame(callback) {
        return function (sched, clock, next) {
            var t1 = clock.t1;

            function show(t) {
                if (t + kFrameAdvance > t1) {
                    clock.jumpTo(t);
                    callback(clock);
                    next(sched, clock, stop);
                } else {
                    // Delay by one more frame. Keep doing this
                    // until clock syncs with the real time.
                    scheduleFrame(show);
                }
            }

            scheduleFrame(show);
        };
    }

    // ### frames(duration, callback)
    //
    // Couples a regular delay with a scheduled series of callbacks for
    // visual animation. The animation calls occur forked relative to the
    // main schedule and will sync to real time irrespective of the amount
    // of "compute ahead" used for audio. Therefore the following actions
    // may begin to run a little before the requested series of callbacks
    // finish. However, if the following action is also a frames(), then 
    // that will occur strictly (?) after the current frames() finishes,
    // due to the "sync to real time" behaviour.
    //
    // Responds live to changes in `duration` if it is a parameter.
    function frames(dt, callback) {
        return function (sched, clock, next) {
            var startTime = clock.t1r;
            var animTime = startTime;
            var animTimeAbs = clock.t1;
            var animTick, animInfo;

            if (callback) {
                animTick = function (t, info) {
                    if (info.intervals.length > 0) {
                        var t1 = info.intervals[0], t1r = info.intervals[1], t2r = info.intervals[2], r = info.intervals[3];
                        if (t1r <= info.endTime) {
                            if (t1 < kFrameAdvance + t) { 
                                callback(info.clock, t1r, t2r, info.startTime, info.endTime, r);
                                info.intervals.splice(0, 4);
                            }
                            scheduleFrame(animTick, info);
                            return;
                        } else {
                            // Animation ended.
                        }
                    }

                    if (!info.end) {
                        scheduleFrame(animTick, info);
                    }
                };

                animInfo = {clock: clock, intervals: [], startTime: clock.t1r, endTime: clock.t1r + dt.valueOf(), end: false};
                scheduleFrame(animTick, animInfo);
            }

            function tick(sched, clock) {
                var i, N, dtr, step;
                var endTime = startTime + dt.valueOf();

                // If lagging behind, advance time before processing models.
                // If, say, the user switched tabs and got back while
                // the scheduler is locked to a delay, then all the pending
                // delays need to be advanced by exactly the same amount.
                // The way to determine this amount is to keep track of
                // the time interval between the previous call and the
                // current one. That value is guaranteed to be the same
                // for all delays active within a single scheduleTick().
                //
                // Furthermore, the delay needs to be cryo-frozen frozen
                // during the lapse and then thawed when the playback
                // resumes. This "cryo" is achieved by only adjusting the
                // real time and leaving the rate integrated time untouched.
                // That implies that "logically" nothing happened during the
                // advance - i.e. the world skipped some seconds, without
                // leaving a trace!
                if (advanceDt > 0.0 && clock.t1 < mainClock.t1) {
                    clock.advance(advanceDt);

                    if (animInfo) {
                        animTimeAbs += step;

                        if (animInfo.intervals.length > 4) {
                            // Leave only one frame in the queue intact.
                            animInfo.intervals.splice(0, animInfo.intervals.length - 4);
                        }

                        if (animInfo.intervals.length > 0) {
                            animInfo.intervals[0] += step;
                            animInfo.intervals[3] = clock.rate.valueOf();
                        }
                    }
                }

                if (clock.t1 > compute_upto_secs) {
                    // We're already ahead of time. Wait before
                    // computing further ahead.
                    schedule(poll);
                    return;
                }

                if (animInfo && clock.t1r <= endTime) {
                    animInfo.endTime = endTime;
                    var frozenRate = clock.rate.valueOf();
                    dtr = Math.max(0.001, kFrameInterval * frozenRate);
                    while (animTime < clock.t2r) {
                        animInfo.intervals.push(animTimeAbs);
                        animInfo.intervals.push(animTime);
                        animInfo.intervals.push(animTime + dtr);
                        animInfo.intervals.push(frozenRate);
                        animTime += dtr;
                    }
                }

                if (clock.t2r < endTime) {
                    clock.tick();
                    schedule(poll);
                } else {
                    if (animInfo) {
                        animInfo.end = true;
                    }
                    if (clock.t2r > clock.t1r) {
                        next(sched, clock.nudgeToRel(endTime), stop);
                    } else {
                        next(sched, clock, stop);
                    }
                }
            }

            function poll(sched) {
                tick(sched, clock, stop);
            }

            tick(sched, clock);
        };
    }

    // ### log
    //
    // Useful logging utility.
    function log(msg) {
        return fire(function () {
            console.log(msg);
        });
    }

    // ### Parameter animation curves.
    //
    // #### anim(param, dur, func)
    // func is expected to be a function (t) where t is 
    // in the range [0,1]. The given parameter will be assigned
    // the value of the function over the given duration.
    //
    // #### anim(param, dur, v1, v2)
    // The parameter will be linearly interpolated over the given duration
    // starting with value v1 and ending with v2.
    //
    // #### anim(param, dur, v1, v2, interp)
    // The parameter will be interpolated from value v1 to value v2
    // over the given duration using the given interpolation function
    // interp(t) whose domain and range are both [0,1].
    //
    // #### Notes
    //
    // Note that animation curves have a duration so that you
    // can sequence different curves using track().
    // If you want a bunch of parameters to animate simultaneously,
    // you need to use spawn() or fork().
    //
    // Also remember that the "dur" parameter can be anything
    // that supports "valueOf" protocol. That said, be aware that
    // varying the duration can result in the parameter jumping
    // values due to large changes in the fractional time. Sometimes,
    // that might be exactly what you want and at other times that
    // may not be what you want.
    function anim(param, dur) {
        var v1, v2, func, afunc;
        switch (arguments.length) {
            case 3: /* Third argument must be a function. */
                afunc = arguments[2];
                break;
            case 4: /* Third and fourth arguments are starting
                     * and ending values over the duration. */
                v1 = arguments[2];
                v2 = arguments[3];
                afunc = function (f) { 
                    return (1 - f ) * v1.valueOf() + f * v2.valueOf(); 
                };
                break;
            case 5: /* Third and fourth are v1, and v2 and fifth is
                     * a function(fractionalTime) whose return value is
                     * in the range [0,1] which is remapped to [v1,v2].
                     * i.e. the function is an interpolation function. */
                v1 = arguments[2];
                v2 = arguments[3];
                func = arguments[4];
                afunc = function (frac) { 
                    var f = func(frac);
                    return (1 - f) * v1.valueOf() + f * v2.valueOf();
                };

                break;
            default:
                throw new Error("Invalid arguments to anim()");
        }

        if (param.constructor.name === 'AudioGain' || param.constructor.name === 'AudioParam') {
            // Use linear ramp for audio parameters.
            return delay(dur, function (clock, t1, t2, startTime, endTime) {
                var dt = endTime - startTime;
                var t1f, t2f;
                if (t1 <= startTime) {
                    t1f = dt > instant_secs ? (t1 - startTime) / dt : 0;
                    param.setValueAtTime(afunc(t1f), clock.rel2abs(t1));
                }

                t2f = dt > instant_secs ? (t2 - startTime) / dt : 1;
                param.linearRampToValueAtTime(afunc(t2f), clock.rel2abs(t2));
            });
        } else {
            return delay(dur, function (clock, t1, t2, startTime, endTime) {
                // When animating a parameter, we need to account for the
                // fact that we're generating only one value for the
                // parameter per call. This means the first call should
                // have a fractional time of 0 and the last one should have
                // a fractional time of 1. We can make that happen if we
                // assume that t2-t1 stays constant.
                //
                // The ideal behaviour would be to generate two values for
                // each call and have the audio engine interpolate between
                // them. The technique below serves as a stop-gap
                // arrangement until then.
                var dt = endTime - startTime - (t2 - t1);
                if (dt > instant_secs) {
                    param.value = afunc((t1 - startTime) / dt);
                } else {
                    // If we're generating only one value because the
                    // animation duration is very short, make it 
                    // the final value.
                    param.value = afunc(1);
                }
            });
        }
    }

    // ### rate
    //
    // Changes the rate of progress of time through delays.  The given rate
    // "r" can be anything that supports the valueOf() protocol. The rate
    // value/parameter will flow along with the clock object that arrives
    // at this point - meaning it will affect all events that occur
    // sequenced with the rate control action. Note that fork() and spawn()
    // copy the clock before propagating. This means that each track within
    // a spawn/fork can have its own rate setting and that won't interfere
    // with the others. However, if you set a rate in the track that
    // contains the fork/spawn (and before them), the rate setting will
    // propagate to all the forked tracks by virtue of the clock copy.
    //
    // You need to be aware of whether the rate is being propagated "by
    // reference" or "by value". If the rate is a parameter, it gets
    // propagated by reference - i.e. changing the *value* of the rate
    // parameter in one track (clock.rate.value = num) affects the rate of
    // all the tracks that share the rate parameter. If it is a simple
    // number, then it gets propagated by value - i.e. "clock.rate = num" in
    // one track won't change the rate for the other tracks.
    function rate(r) {
        return function (sched, clock, next) {
            clock.rate = r;
            next(sched, clock, stop);
        };
    }

    // A dynamic model that randomly chooses one from the given array of models
    // every time it is played.
    function choice(models) {
        return dynamic(function () {
            return models[Math.floor(Math.random() * models.length)];
        });
    }

    // Simple synchronization facility. You make a sync action and use it
    // in your composition. Keep a reference around to it and call its
    // `.play` with a model that has to be started when the sync point is
    // hit. Multiple models played will all be `spawn`ed.
    function sync(N) {
        if (arguments.length > 0) {
            // If N is given, make that many syncs.
            return (function (i, N, syncs) {
                for (; i < N; ++i) {
                    syncs.push(sync());
                }
                return syncs;
            }(0, N, []));
        }

        var models = [];

        function syncModel(sched, clock, next) {
            var i, N, actions;
            if (models.length > 0) {
                actions = models;
                models = [];
                for (i = 0, N = actions.length; i < N; ++i) {
                    actions[i](sched, clock.copy(), stop);
                }
            } 

            next(sched, clock, stop);
        }

        syncModel.play = function (model) {
            models.push(model);
            return this;
        };

        syncModel.cancel = function () {
            models.splice(0, models.length);
            return this;
        };

        return syncModel;
    }

    // ### gate()
    //
    // Another synchronization option. You make a gate and use it at
    // various points. You can then close() and open() gate. A newly
    // created gate doesn't block by default. 
    //
    // You can use gate() as a primitive to implement context aware
    // pause/resume. You make a `gate()` instance `g` first and introduce
    // it at appropriate points in your composition where you can allow it
    // to pause/resume. You can then pause your composition by calling
    // `g.close()` and resume it by calling `g.open()`.
    //
    // Other methods of a gate include - 
    //  
    //  - g.toggle() 
    //  - g.isOpen property gives open status of gate.
    //  - g.cancel() discards all pending resume actions.
    //      
    function gate(N) {
        if (arguments.length > 0) {
            // If N is given, make that many gates.
            return (function (i, N, gates) {
                for (; i < N; ++i) {
                    gates.push(gate());
                }
                return gates;
            }(0, N, []));
        }

        var cache = [];
        var state_stack = [];
        var isOpen = true;

        function gateModel(sched, clock, next) {
            if (isOpen) {
                next(sched, clock, stop);
            } else {
                // Cache this and wait.
                cache.push({sched: sched, next: next, clock: clock});
            }
        }

        function release(clock) {
            var actions = cache;
            var i, N, a, t = time_secs();
            cache = [];
            for (i = 0, N = actions.length; i < N; ++i) {
                a = actions[i];
                a.next(a.sched, clock ? clock.copy() : a.clock.advanceTo(t), stop);
            }
        }

        gateModel.__defineGetter__('isOpen', function () { return isOpen; });
        gateModel.__defineSetter__('isOpen', function (v) {
            if (v) {
                gateModel.open();
            } else {
                gateModel.close();
            }
            return v;
        });

        gateModel.open = function (sched, clock, next) {
            isOpen = true;
            release(clock);
            if (next) {
                next(sched, clock, stop);
            }
        };

        gateModel.close = function (sched, clock, next) {
            isOpen = false;
            if (next) {
                next(sched, clock, stop);
            }
        };

        gateModel.toggle = function (sched, clock, next) {
            if (isOpen) {
                return gateModel.close(sched, clock, next);
            } else {
                return gateModel.open(sched, clock, next);
            }
        };

        gateModel.cancel = function (sched, clock, next) {
            cache.splice(0, cache.length);
            if (next) {
                next(sched, clock, stop);
            }
        };

        gateModel.push = function (sched, clock, next) {
            state_stack.push({isOpen: isOpen, cache: cache});
            cache = [];
            if (next) {
                next(sched, clock, stop);
            }
        };

        gateModel.pop = function (sched, clock, next) {
            var state = state_stack.pop();
            cache.push.apply(cache, state.cache);
            this.isOpen = state.isOpen;
            if (next) {
                next(sched, clock, stop);
            }
        };

        return gateModel;
    }

    function stats() {
        return {
            frame_jitter_ms: 0
        };
    }

    // One of the requests towards connecting steller's scheduler to a
    // score is that it would be good to have a way to convert an object
    // notation into a scheduler spec that can be played using sh.play().
    //
    // Towards this, I've now added a "specFromJSON" method to the scheduler
    // that does such a transformation. 
    //
    // specFromJSON accepts an object and parses its key-value associations to
    // determine which scheduler models to build. For example, if the
    // object is of the form {track: [m1, m2, ..]}, then a "track" model
    // is built and the sub-models m1, m2, .. are recursively parsed for 
    // similar object properties.
    //
    // An additional "vocabulary" structure can be passed to "specFromJSON" to
    // take care of keys that are not recognized using the scheduler's built-in
    // vocabulary. This "vocabulary" is an object whose keys constitute the
    // introduced vocabulary and whose values give functions that will be
    // called to produce scheduler models. These functions are wrapped with
    // some minimal metadata to indicate to specFromJSON how they should be
    // used.
    //
    // To specify a vocabulary item as a function, provide an object
    // value of the form {convertArgs: true, fn: theFunction}. The convertArgs
    // property of this wrapper object is to tell specFromJSON to first recursively
    // expand the arguments into models before passing them to the function.
    // It's can be false too, in which case the recursion won't be performed.
    //
    // Note that fromJSON accepts more than just valid JSON since arguments
    // to vocabulary can be non-JSON objects as well. The "JSON" is a indication
    // in the name as to the purpose of this function - which is to de-serialize
    // models.
    //
    // Within the vocabulary function, the object that is required to be
    // transformed is available as "this", so that additional key-value
    // arguments may be looked up.
    //
    // If you wish to indicate that a particular object should not be
    // parsed and should be passed through as is, wrap it in a quote
    // form using the "$" key like this - {$: anyObject}.
    //
    // Example:
    //  Here is a new vocabulary called "majchord" that will play a 
    //  major chord using the chime model, given a reference pitch number.
    //
    //  var ch = sh.models.chime().connect();
    //  var vocab = {
    //      majchord: {
    //          convertArgs: false, // No need to convert pitchNumber and duration arguments.
    //          fn: function (pitchNumber, duration) {
    //              return sh.track([
    //                  sh.spawn([
    //                      ch.play(pitchNumber),
    //                      ch.play(pitchNumber + 4),
    //                      ch.play(pitchNumber + 7)
    //                  ]),
    //                  sh.delay(duration)
    //              ]);
    //          }
    //      }
    //  };
    //  var majchord = sh.specFromJSON({track: [{majchord: [72, 1.0]}, {majchord: [74, 1.0]}]}, vocab);

    var sh_vocab = {
        delay:      {convertArgs: true, fn: delay},
        loop:       {convertArgs: true, fn: loop},
        loop_while: {convertArgs: true, fn: loop_while},
        repeat:     {convertArgs: true, fn: repeat},
        fork:       {convertArgs: true, fn: fork},
        spawn:      {convertArgs: true, fn: spawn},
        track:      {convertArgs: true, fn: track},
        anim:       {convertArgs: true, fn: anim},
        rate:       {convertArgs: true, fn: rate},
        choice:     {convertArgs: true, fn: choice}
    };

    function specFromJSON(json, vocab) {
        if (!json || json.constructor !== Object) {
            return json;
        }

        // Get first key in object. Note that the object can
        // have multiple keys and (afaik) all Javascript engines
        // respect the order in which keys were inserted when
        // enumerating keys.
        var key = null;
        for (key in json) { break; }

        // Since modelFromJSON recursively transforms all
        // objects, treating everyone as a scheduler model
        // specifier, we need a way to tell the parser
        // "don't touch this". You can pass through any
        // value untouched by wrapping it into a quote
        // form which looks like {$: anyObject}.
        if (key === '$') {
            return json.$;
        }

        var impl = (vocab && vocab[key]) || sh_vocab[key];
        if (!impl) { throw new Error('Unknown vocabulary : ' + key); }

        var args = json[key], keys;
        if (args.constructor === Array) {
            // Recursively process all JSON object forms.
            if (impl.convertArgs) {
                args = args.map(function (arg) { return specFromJSON(arg, vocab); });
            }
        } else if (args.constructor === Object) {
            args = [impl.convertArgs ? specFromJSON(args, vocab) : args];
        } else {
            args = [args]; // Solo argument.
        }

        // The vocabulary spec is expected to be a function that can be applied with the
        // json as the "this" and the arguments array as normal function arguments.

        if (impl.fn) {
            return impl.fn.apply(json, args);
        }

        throw new Error('Bad vocabulary specification');
    }

    self.audioContext   = audioContext;
    self.update         = scheduleUpdate;
    self.perform        = perform;
    self.cancel         = cancel;
    self.clock          = clock;
    self.play           = play;
    self.stop           = stop;
    self.cont           = cont;
    self.delay          = delay;
    self.loop           = loop;
    self.loop_while     = loop_while;
    self.repeat         = repeat;
    self.fork           = fork;
    self.spawn          = spawn;
    self.dynamic        = dynamic;
    self.track          = track;
    self.slice          = slice;
    self.fire           = fire;
    self.display        = display;
    self.frame          = frame;
    self.frames         = frames;
    self.log            = log;
    self.anim           = anim;
    self.rate           = rate;
    self.choice         = choice;
    self.sync           = sync;
    self.gate           = gate;
    self.stats          = stats;
    self.specFromJSON   = specFromJSON;

    // Start the scheduler by default. I decided to do this because
    // so far on many occasions I've spent considerable time in 
    // debugging an unexpected outcome simply because I forgot to
    // start the scheduler. Shows I have an expectation that once
    // a "new Scheduler" is created, it is expected to be up and
    // running. Hence this choice of a default. If you really
    // need it to be quiet upon start, provide an "options.running = false"
    // in the second argument.
    self.running = (options && ('running' in options) && options.running) || true;

    // If the Models collection is available, instantiate it for
    // this scheduler so that the user won't have to bother doing that
    // separately.         
    try {
        Scheduler.Models(self);
    } catch (e) {
        console.log(e);
    }

    return self;
};

module.exports = Scheduler;

},{"./clock":6,"./jsnodetimer":10,"./param":24,"./periodictimer":26,"./queue":27,"./util":30}],29:[function(require,module,exports){
var Param = require('./param');
var UI = {};

function round(n) {
    var m = n % 1;
    var f = n - m;
    var k = Math.pow(10, 4 - Math.min(3, ('' + f).length));
    return Math.round(n * k) / k;
}

function mappingFn(mapping) {
    if (typeof(mapping) === 'string') {
        return Param.mappings[mapping];
    } else {
        return mapping || Param.mappings.linear;
    }
}

function insertBeforeEnd(target) {
    return function (e) {
        target.appendChild(e);
    };
}

// Makes a simple UI with sliders for the parameters exposed by the model.
// The return value is a div element that can be inserted into some DOM part.
// This element is also stored in "model.ui" for reuse. If one already exists,
// a new one is not created.
UI.basicUI = function (document, model, sectionLabel) {
    if (model.ui) {
        return model.ui;
    }

    var div = document.createElement('div');
    if (sectionLabel) {
        div.insertAdjacentHTML('beforeend', '<p><b>' + sectionLabel + '</b></p>');
    }

    var specs = Param.names(model).map(function (k) {
        var spec = Object.create(model[k].spec);
        spec.name = spec.name || k;
        spec.param = model[k];
        return spec;
    });

    specs.forEach(function (spec) {
        var paramName = spec.name;
        var param = spec.param;

        if ('min' in spec && 'max' in spec) {
            // Only expose numeric parameters for the moment.
            var cont = document.createElement('div');
            var label = document.createElement('span');
            var valueDisp = document.createElement('span');
            label.innerText = (spec.label || paramName) + ': ';
            label.style.width = '100px';
            label.style.display = 'inline-block';
            label.style.textAlign = 'left';

            var slider = document.createElement('input');
            slider.type = 'range';
            slider.min = 0.0;
            slider.max = 1.0;
            slider.step = 0.001;

            var mapping = mappingFn(spec.mapping);
            var units = spec.units ? ' ' + spec.units : '';

            slider.value = mapping.toNorm(param);
            valueDisp.innerText = ' (' + round(param.value) + units + ')';

                    slider.changeModelParameter = function (e) {
                        // Slider value changed. So change the model parameter.
                        // Use curve() to map the [0,1] range of the slider to
                        // the parameter's range.
                        param.value = mapping.fromNorm(param, parseFloat(this.value));
                    };

                    slider.changeSliderValue = function (value) {
                        // Model value changed. So change the slider. Use curve()
                        // to map the parameter value to the slider's [0,1] range.
                        slider.value = mapping.toNorm(param);
                        valueDisp.innerText = ' (' + round(value) + units + ')';
                            };

                            slider.addEventListener('input', slider.changeModelParameter);
                            param.watch(slider.changeSliderValue);

                            [label, slider, valueDisp].forEach(insertBeforeEnd(cont));
                            div.appendChild(cont);
                            }
                            });

                        return (model.ui = div);
};

module.exports = UI;



},{"./param":24}],30:[function(require,module,exports){
// Utility for prohibiting parameter names such as "constructor",
// "hasOwnProperty", etc.
var AudioContext = require('./AudioContext');

// Some utility functions.
var Util = {};

var dummyObject = {params: true, length: 1};

Util.validName = function validName(name) {
    if (dummyObject[name]) {
        throw new Error("Invalid param name [" + name + "]");
    }

    return name;
};

Util.p2f = function (pitch) {
    return 440 * Math.pow(2, (pitch.valueOf() - 69) / 12);
};

Util.f2p = function (f) {
    var p = 69 + 12 * Math.log(f.valueOf() / 440) / Math.LN2;
    return Math.round(p * 100) / 100; // Cents level precision is enough.
};

// A function to find out if we're running in a browser environment.
// The other environment possible is node.js.
Util.detectBrowserEnv = function detectBrowserEnv() {
    return typeof(window) === 'object' && typeof(document) === 'object' && window.document === document;
};

// Until requestAnimationFrame comes standard in all browsers, test
// for the prefixed names as well.
Util.getRequestAnimationFrameFunc = function getRequestAnimationFrameFunc() {
    try {
        return (window.requestAnimationFrame ||
                window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame ||
                window.msRequestAnimationFrame ||
                (function (cb) {
                    setTimeout(cb, 1000/60);
                }));
    } catch (e) {
        return undefined;
    }
};

// Gets the AudioContext class when in a browser environment.
Util.getAudioContext = function getAudioContext() {
    return AudioContext;
};

// Get a time function based on the high resolution performance
// timer if present. The returned function, when called, will
// give time in seconds.
Util.getHighResPerfTimeFunc = function getHighResPerfTimeFunc() {
    try {
        var perf = window.performance;
        var perfNow = (perf && (perf.now || perf.webkitNow || perf.mozNow));
        if (perfNow) {
            // High resolution performance time available.
            return function () {
                return perfNow.call(perf) * 0.001;
            };
        }
    } catch (e) {
    }

    // Fall back to Date.now().
    return function () {
        return Date.now() * 0.001;
    };
};

module.exports = Util;

},{"./AudioContext":4}]},{},[3])(3)
});
