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
    model.attackTime = Param({min: 0.001, max: 1.0, value: 0.01, mapping: 'log'});
    model.level = Param({min: 0.125, max: 4.0, audioParam: output.gain, mapping: 'log'});

    function trigger(clock, pitchNumber, velocity) {
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
            return delay(duration);
        });
    };

    return model;
};


