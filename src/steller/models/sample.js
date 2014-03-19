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
