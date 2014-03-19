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
        return oldMethod.apply(this, arguments);
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

