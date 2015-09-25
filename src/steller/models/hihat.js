// The "hihat" model is a direct copy paste from http://joesul.li/van/synthesizing-hi-hats/
// ... except that it is now wrapped as a graph node that can participate in
// further processing and is parameterized for easy usage without knowing
// about the web audio api much at all.
//
// Usage: var hat = sh.models.hihat().connect();
//        sh.play(sh.track([hat.hit(1.0, 0.5), hat.hit(0.5, 0.5)]));
//
//        hat.fundamental.value = 40; // The default. This is how you change it.
//        hat.bandpass.value = 10000; // Change the bandpass frequency.
//        hat.highpass.value = 7000; // Change the highpass frequency.
//        hat.level.value = 0.5; // Change the combined output level of all hihat hits.
//
module.exports = function installer(S, sh) {
    var AC = sh.audioContext;
    var ratios = [2, 3, 4.16, 5.43, 6.79, 8.21];

    return function hihat() {
        var output = AC.createGainNode();
        var model = S.SoundModel({}, [], [output]);

        model.fundamental = S.Param({min: 20.0, max: 100.0, value: 40.0, mapping: 'log'});
        model.bandpass = S.Param({min: 5000, max: 20000, value: 10000, mapping: 'log'});
        model.highpass = S.Param({min: 3500, max: 14000, value: 7000, mapping: 'log'});
        model.level = S.Param({min: 0.0, max: 10.0, audioParam: output.gain});

        function trigger(clock, velocity) {

            // The clock gives the absolute audio time to schedule this event at.
            var when = clock.t1;
            
            var vel = velocity.valueOf(); // Doing this permits velocity to be either a number or a Param.
            var dur = 0.3 * (1.0 + vel) / 2.0; // Shorten the duration for lower velocities.

            var gain = AC.createGain();
            var fundamental = model.fundamental.valueOf();

            // Bandpass
            var bandpass = AC.createBiquadFilter();
            bandpass.type = "bandpass";
            bandpass.frequency.value = model.bandpass.valueOf();

            // Highpass
            var highpass = AC.createBiquadFilter();
            highpass.type = "highpass";
            highpass.frequency.value = model.highpass.valueOf();

            // Connect the graph
            bandpass.connect(highpass);
            highpass.connect(gain);
            gain.connect(output);

            // Create the oscillators
            for (var i = 0; i < ratios.length; ++i) {
                var osc = AC.createOscillator();
                osc.type = "square";
                // Frequency is the fundamental * this oscillator's ratio
                osc.frequency.value = fundamental * ratios[i];
                osc.connect(bandpass);
                osc.start(when);
                osc.stop(when + dur);
            }

            // Define the volume envelope
            gain.gain.setValueAtTime(0.00001, when);
            gain.gain.exponentialRampToValueAtTime(1 * vel, when + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.3 * vel, when + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.00001, when + dur);
        }

        // You can play multiple chimes all mixed into the same output gain node.
        // Note that there is no standard way to "play" or "stop" any sound model.
        // This is left open since models may need different behaviours in this
        // regard. 
        model.hit = function (velocity, duration) {
            if (velocity === undefined) {
                velocity = 1.0;
            }
            return sh.dynamic(function (clock) {
                trigger(clock, velocity);
                return sh.delay(duration);
            });
        };

        return model;
    };
};

