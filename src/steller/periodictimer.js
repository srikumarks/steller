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

