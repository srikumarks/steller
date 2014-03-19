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
