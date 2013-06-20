// Utility for prohibiting parameter names such as "constructor",
// "hasOwnProperty", etc.
var dummyObject = {params: true, length: 1};
function validName(name) {
    if (dummyObject[name]) {
        throw new Error("Invalid param name [" + name + "]");
    }

    return name;
}

// Some utility functions.
var Util = {};

Util.p2f = function (pitch) {
    return 440 * Math.pow(2, (pitch.valueOf() - 69) / 12);
};

Util.f2p = function (f) {
    var p = 69 + 12 * Math.log(f.valueOf() / 440) / Math.LN2;
    return Math.round(p * 100) / 100; // Cents level precision is enough.
};

Util.augment = function (submodName, fn) {
    var steller = org.anclab.steller;
    if (submodName in steller) {
        steller[submodName].augmentors.push(fn);
    } else {
        // New module.
        function newMod() {
            var argv = Array.prototype.slice.call(arguments, 0);
            var obj = {};
            newMod.augmentors.forEach(function (f) {
                obj = f.apply(obj, argv) || obj;
            });
            return obj;
        }

        newMod.augmentors = [fn];
        steller[submodName] = newMod;
    }

    return steller[submodName];

};

// A function to find out if we're running in a browser environment.
// The other environment possible is node.js.
function detectBrowserEnv() {
    return typeof(window) === 'object' && typeof(document) === 'object' && window.document === document;
}

// Until requestAnimationFrame comes standard in all browsers, test
// for the prefixed names as well.
function getRequestAnimationFrameFunc() {
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
}

// Gets the AudioContext class when in a browser environment.
function getAudioContext() {
#   include "AudioContext.js"
    return AudioContext;
}

// Get a time function based on the high resolution performance
// timer if present. The returned function, when called, will
// give time in seconds.
function getHighResPerfTimeFunc() {
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
}

