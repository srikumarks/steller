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

    // In the code below, all the name aliasing is done at the time the audio
    // context is instantiated. This approach also makes no reference to
    // current parameter sets of other nodes so that it is robust to the api
    // evolving to some extent -- it only depends on the gain node having a
    // "gain" parameter. This offer a compatibility mode where the old
    // names are also supported in environments which provide only the new
    // names.
    //
    // See https://github.com/srikumarks/AudioContext-MonkeyPatch

    var AC = (function () { return this.AudioContext || this.webkitAudioContext; }());
    if (!AC) { return undefined; }

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

        ac.createGain = ac.createGainNode = (ac.createGain || ac.createGainNode);
        ac.createDelay = ac.createDelayNode = (ac.createDelay || ac.createDelayNode);
        ac.createScriptProcessor = ac.createJavaScriptNode = (ac.createScriptProcessor || ac.createJavaScriptNode);

        // Find out the AudioParam prototype object.
        // Some older implementations keep an additional empty
        // interface for the gain parameter.
        AudioParam = Object.getPrototypeOf(ac.createGain().gain);
        AudioParamOld = Object.getPrototypeOf(AudioParam);
        if (AudioParamOld.setValueAtTime) {
            // Checking for the presence of setValueAtTime to find whether
            // it is the right prototype class is, I expect, more robust than
            // checking whether the class name is this or that. - Kumar
            AudioParam = AudioParamOld;
        }

        AudioParam.setTargetAtTime = AudioParam.setTargetValueAtTime = (AudioParam.setTargetAtTime || AudioParam.setTargetValueAtTime);

        // For BufferSource node, we need to also account for noteGrainOn.
        BufferSource = Object.getPrototypeOf(ac.createBufferSource());
        if (BufferSource.start) {
            if (!BufferSource.noteOn) {
                BufferSource.noteOn = function noteOn(when) {
                    return this.start(when); // Ignore other arguments.
                };
            }
            BufferSource.noteOff = BufferSource.stop;
            if (!BufferSource.noteGrainOn) {
                BufferSource.noteGrainOn = function noteGrainOn(when, offset, duration) {
                    return this.start(when, offset, duration);
                };
            }
        } else {
            BufferSource.start = function start(when, offset, duration) {
                switch (arguments.length) {
                    case 1: return this.noteOn(when);
                    case 3: return this.noteGrainOn(when, offset, duration);
                    default: throw new Error('Invalid arguments to BufferSource.start');
                }
            };
            BufferSource.stop = BufferSource.noteOff;
        }


        Oscillator = Object.getPrototypeOf(ac.createOscillator());
        Oscillator.start = Oscillator.noteOn = (Oscillator.start || Oscillator.noteOn);
        Oscillator.stop = Oscillator.noteOff = (Oscillator.stop || Oscillator.noteOff);

        return ac;
    };
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
        } else {
            return function () {
                return Date.now() * 0.001;
            };
        }
    } catch (e) {
    }

    return undefined;
}

