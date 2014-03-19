
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

