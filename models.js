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
        dc.gain.value = value;
        dc.noteOn(0);

        var model = SoundModel({}, [], [dc]);
        model.level = Param({min: -1.0, max: 1.0, audioParam: dc.gain});

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
                        source.playbackRate.setTargetValueAtTime(pitch.valueOf(), clock.t1, clock.dt/3);
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
