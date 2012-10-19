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
console.assert(org.anclab.steller);

org.anclab.steller.Util.augment('Models',
function (sh) {
    var steller         = org.anclab.steller;
    var util            = org.anclab.steller.Util;
    var SoundModel      = steller.SoundModel;
    var GraphNode       = steller.GraphNode;
    var Param           = steller.Param;

    var AC = sh.audioContext;
    var models = this;

    var noiseBuffer, dcBuffer;

    (function () {
        // Make a 5 second noise buffer (used in Chris Wilson's vocoder).
        // This ought to be enough randomness for audio.
        noiseBuffer = AC.createBuffer(1, 5 * AC.sampleRate, AC.sampleRate);
        var data = noiseBuffer.getChannelData(0);
        var i, N;
        for (i = 0, N = data.length; i < N; ++i) {
            data[i] = 2 * Math.random() - 1;
        }

        // Make a 1-sample buffer for generating dc offset values.
        dcBuffer = AC.createBuffer(1, 1, AC.sampleRate);
        dcBuffer.getChannelData(0)[0] = 1.0;
    }());

    // The "chime" model plays a tone with an exponential decay. This component
    // is designed so that it can play multiple "ting"s through the output of
    // the same graph node. You may want this in some circumstances, and not in
    // others and both are expressible using the Steller framework.
    //
    // Usage: var ch = models.chime();
    //        ch.connect(models.AC.destination);
    //        sh.play(ch.play(60, 1.0));
    //
    models.chime = function () {
        var output = AC.createGainNode();
        var model = SoundModel({}, [], [output]);

        // halfLife parameter determines the amplitude decay half life (in secs) of
        // a ting at 440Hz.
        model.halfLife = Param({min: 0.001, max: 10, value: 0.5, mapping: 'log'});
        model.attackTime = Param({min: 0.0, max: 1.0, value: 0.01});
        model.level = Param({min: 0.125, max: 4.0, audioParam: output.gain, mapping: 'log'});

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
                var f = util.p2f(pitchNumber.valueOf());
                var osc = AC.createOscillator();
                osc.type = osc.SINE;
                osc.frequency.value = f;

                var gain = AC.createGainNode();
                gain.gain.value = 0;
                gain.gain.setValueAtTime(0, clock.t1);
                gain.gain.linearRampToValueAtTime(velocity.valueOf() / 8, clock.t1 + model.attackTime.value);

                var halfLife = model.halfLife.value * 440 / f;
                var dur = halfLife * 10;
                gain.gain.setTargetValueAtTime(0, clock.t1 + model.attackTime.value, halfLife);

                osc.connect(gain);
                gain.connect(output);
                osc.noteOn(clock.t1);
                osc.noteOff(clock.t1 + dur);
            });
        };

        return model;
    };

    // A DC source with a "level" parameter.
    models.dc = function (value) {
        var dc = AC.createBufferSource();
        dc.buffer = dcBuffer;
        dc.loop = true;
        dc.noteOn(0);

        var gain = AC.createGainNode();
        gain.gain.value = value;
        dc.connect(gain);

        var model = SoundModel({}, [], [gain]);
        model.level = Param({min: -1.0, max: 1.0, audioParam: gain.gain});

        return model;
    };

    // A simple noise model. Makes a noise source
    // that you can pipe to anywhere.
    //
    // Parameters = "spread" and "mean".
    models.noise = function () {
        var source = AC.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;
        source.gain.value = 1.0;

        var gain = AC.createGainNode();
        gain.gain.value = 1.0;

        source.connect(gain);
        source.noteOn(0);

        var dc = models.dc(0);
        dc.connect(gain);

        var model = SoundModel({}, [], [gain]);
        model.spread = Param({min: 0.01, max: 10.0, audioParam: source.gain});
        model.mean = dc.level;

        return model;
    };

    // Connect any single channel output to the input of this and read off
    // mean signal value via the "mean" param. Also has a "sigma" param for the
    // standard deviation. Note that if you want to know when mean or
    // sigma change, you can 'watch' the params. This model has no
    // outputs.
    models.probe = function () {

        var mean = Param({min: -1, max: 1, value: 0});
        var sigma = Param({min: -1, max: 1, value: 1});
        var energy = Param({min: 0, max: 1, value: 0});

        var js = AC.createJavaScriptNode(512, 1, 1);
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

        var model = SoundModel({}, [js], []);
        model.mean = mean;
        model.sigma = sigma;
        model.energy = energy;

        return model;
    };

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
    //              console.assert(status === 1);
    //          }
    //      });
    //
    models.mic = (function () {
        function getUserMedia(dictionary, callback, errback) {
            try {
                navigator.webkitGetUserMedia(dictionary, callback, errback);
            } catch (e) {
                errback(e);
            }
        }

        function setupMic(micModel, stream) {
            if (!micSource) {
                console.assert(stream);
                micSource = AC.createMediaStreamSource(stream);
            }

            micSource.connect(micModel.outputs[0]);
            micModel.error = null;
            micModel.ready.value = 1;
        }

        var micSource; // Make only one mic source node per context.

        return function () {
            var micOut = AC.createGainNode();
            var micModel = SoundModel({}, [], [micOut]);

            // 'ready' parameter = 1 indicates availability of mic,
            // -1 indicates error (in which case you can look at micModel.error)
            // and 0 indicates initialization in progress.
            micModel.ready = Param({min: -1, max: 1, value: 0});

            // Expose a gain parameter so different parts of the graph can use
            // different gains.
            micModel.gain = Param({min: 0, max: 1, audioParam: micOut.gain});

            if (micSource) {
                setupMic(micModel, null);
            } else {
                getUserMedia({audio: true},
                             function (stream) {
                                 return setupMic(micModel, stream);
                             },
                             function (e) {
                                 micModel.error = e;
                                 micModel.gain.value = 0; // Mute it.
                                 micModel.ready.value = -1;
                             });
            }

            return micModel;
        };
    }());

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
    models.spectrum = function (N, smoothingFactor) {
        N = N || 1024;

        var analyser = AC.createAnalyser();
        analyser.fftSize = N * 2;
        analyser.frequencyBinCount = N;
        analyser.smoothingTimeConstant = arguments.length < 2 ? 0.1 : smoothingFactor;
        // Note that the analyser doesn't need to be connected to AC.destination.

        var model = SoundModel({}, [analyser], []);
        model.bins = new Float32Array(N);
        model.freqs = new Float32Array(N);
        model.time = Param({min: 0, max: 1e9, value: 0});

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

                grabRequest = steller.requestAnimationFrame(update);

                // Update the time stamp. If there are watchers installed
                // on model.time, they'll now be notified of the frame grab.
                model.time.value = ts;
            }
        }

        model.start = sh.fire(function () {
            if (!grabRequest) {
                grabRequest = steller.requestAnimationFrame(update);
            }
        });

        model.stop = sh.fire(function () {
            grabRequest = undefined;
        });

        return model;
    };


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
    var sampleCache = {};
    models.sample = function (url, errback) {
        var level = AC.createGainNode();
        level.gain.value = 0.25;

        var model = SoundModel({}, [], [level]);
        model.level = Param({min: 0.001, max: 10, audioParam: level.gain, mapping: 'log'});
        model.attackTime = Param({min: 0.001, max: 10.0, value: 0.02, mapping: 'log'});
        model.releaseTime = Param({min: 0.001, max: 10.0, value: 0.1, mapping: 'log'});

        var key = 'sound:' + url;
        var soundBuff = sampleCache[key];

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
                var xhr = new XMLHttpRequest();

                xhr.open('GET', url, true);
                xhr.responseType = 'arraybuffer';
                xhr.onerror = function (e) {
                    console.error(e);
                    if (errback) {
                        errback(e, url);
                    }
                };
                xhr.onload = function () {
                    AC.decodeAudioData(xhr.response, 
                            function (buff) {
                                sampleCache[key] = soundBuff = buff;
                                console.log("Sound [" + url + "] loaded!");
                                model.duration = soundBuff.duration;
                                sched.perform(next, clock.jumpTo(AC.currentTime + dt), sched.stop);
                            },
                            function (err) {
                                console.error("Sound [" + url + "] failed to decode.");
                                if (errback) { 
                                    errback(err, url); 
                                }
                            });
                };
                xhr.send();
            }
        };

        function trigger(clock, rate, velocity, sampleOffset, sampleDuration) {
            console.assert(soundBuff); // Must be loaded already.

            var source = AC.createBufferSource();
            source.buffer = soundBuff;
            source.connect(level);
            source.playbackRate.value = rate;
            source.gain.setValueAtTime(0, clock.t1);
            source.gain.setTargetValueAtTime(velocity, clock.t1, model.attackTime.value / 3);
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

        // Plays the sample as a "note" of a specific duration.
        // Assumes that the model is already loaded. `pitch`
        // and `amplitude` are parameters that the resultant
        // voice will respond to live. `pitch` is a rate scale
        // factor. `amplitude` is a linear gain. The duration of
        // the note will be influenced by the clock rate, but
        // (unlike `play`) the clock rate will not influence the
        // playback rate of the sound since there is an explicit
        // pitch control.
        model.note = function (pitch, startOffset, duration, activeDur) {
            if (arguments.length < 4) {
                activeDur = duration;
            }
            return sh.dynamic(function (clock) {
                var source = trigger(clock, pitch.valueOf(), 1.0, startOffset, duration);
                source.gain.value = 0;
                source.gain.setTargetValueAtTime(1.0, clock.t1, model.attackTime.value / 3);
                source.playbackRate.setTargetValueAtTime(pitch.valueOf(), clock.t1, clock.dt/3);

                return sh.track([
                    sh.spawn(sh.track([
                            sh.delay(activeDur), 
                            sh.fire(function (clock) {
                                source.gain.setTargetValueAtTime(0.0, clock.t1, model.releaseTime.value / 3);
                                source.noteOff(clock.t1 + 12 * model.releaseTime.value);
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

    // Clears the sample cache to release resources.
    models.clearSampleCache = function () {
        sampleCache = {};
    };

    return models;
});
